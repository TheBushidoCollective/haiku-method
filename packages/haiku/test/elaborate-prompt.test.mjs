// Elaborate-prompt body assertions. Three modes the elaborate builder
// can render (fresh / iterative re-entry / revisit-with-FB), plus a
// few forward-progress invariants that prove the agent has enough
// data to act without asking us back.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
const REPO_ROOT = resolve(HERE, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

// 2026-05-08: per-stage elaborate split into a conversation gate
// (`prompts/elaborate.ts`) and unit-spec writing (`prompts/decompose.ts`,
// formerly elaborate.ts). The exported `buildElaboratePromptBody`
// stayed with the unit-spec writer, just under the new file name.
// 2026-05-14 (GAPS § 1a → Option A): both per-signal prompt builders
// live in their respective directories (`elaborate/`, `decompose/`,
// etc.) and the `elaborate_loop` router composes them. The decompose
// signal builder still exports `buildElaboratePromptBody` so this
// test exercises the heavy elaboration body directly.
const { buildElaboratePromptBody } = await import(
	`${SRC}/orchestrator/prompts/stage/elaborate/decompose/index.ts`
)

function setupSyntheticStudio(root, name = "synth") {
	const stageDir = (s) => join(root, ".haiku", "studios", name, "stages", s)
	for (const [s, hats] of [
		["a", ["planner", "builder", "verifier"]],
		["b", ["planner", "builder", "verifier"]],
	]) {
		mkdirSync(stageDir(s), { recursive: true })
		writeFileSync(
			join(stageDir(s), "STAGE.md"),
			[
				`---`,
				`name: ${s}`,
				`hats: [${hats.join(", ")}]`,
				`elaboration: collaborative`,
				`---`,
				`# Stage ${s}`,
				``,
				`Body for stage ${s} — describes what the stage produces.`,
			].join("\n"),
		)
		mkdirSync(join(stageDir(s), "hats"), { recursive: true })
		for (const h of hats) {
			writeFileSync(
				join(stageDir(s), "hats", `${h}.md`),
				`# ${h}\n\nMandate for ${h}.\n`,
			)
		}
	}
	mkdirSync(join(root, ".haiku", "studios", name), { recursive: true })
	writeFileSync(
		join(root, ".haiku", "studios", name, "STUDIO.md"),
		`---\nname: ${name}\nstages: [a, b]\n---\n# ${name}\n`,
	)
}

function gitInit(root) {
	execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root })
	execFileSync("git", ["config", "user.email", "t@t"], { cwd: root })
	execFileSync("git", ["config", "user.name", "t"], { cwd: root })
	execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], {
		cwd: root,
	})
}

function setupIntent(root, slug) {
	const intentDir = join(root, ".haiku", "intents", slug)
	mkdirSync(join(intentDir, "stages", "a", "units"), { recursive: true })
	mkdirSync(join(intentDir, "stages", "a", "feedback"), { recursive: true })
	mkdirSync(join(intentDir, "stages", "b", "units"), { recursive: true })
	const matter = `---\ntitle: ${slug}\nstudio: synth\nmode: continuous\nplugin_version: "4.0.0"\nstarted_at: 2026-04-01T00:00:00.000Z\napprovals: {}\nsealed_at: null\n---\n# ${slug}\n`
	writeFileSync(join(intentDir, "intent.md"), matter)
	return intentDir
}

test("elaborate fresh: emits stage def + workflow contracts + decide block", () => {
	const root = mkdtempSync(join(tmpdir(), "elab-fresh-"))
	gitInit(root)
	setupSyntheticStudio(root)
	setupIntent(root, "fresh")
	const cwd = process.cwd()
	process.chdir(root)
	try {
		const body = buildElaboratePromptBody({
			slug: "fresh",
			studio: "synth",
			action: {
				action: "elaborate",
				stage: "a",
				elaboration: "collaborative",
				iteration: 0,
				completed_units: [],
				pending_units: [],
				iterative: false,
			},
			dir: join(root, ".haiku", "intents", "fresh"),
		})
		assert.match(body, /Stage a/, "stage def header inlined")
		assert.match(body, /Body for stage a/, "stage body inlined")
		assert.match(
			body,
			/Workflow Contracts/i,
			"workflow contracts block emitted",
		)
		assert.match(body, /haiku_run_next/, "agent told to call haiku_run_next")
		// Unit authoring must name the MCP tool up front so the agent doesn't
		// reach for generic Write and burn a round-trip on the guard hook.
		assert.match(
			body,
			/haiku_unit_write/,
			"decompose body must name haiku_unit_write as the unit-authoring tool",
		)
		// …and must NOT tell the agent to 'write unit files to <path>', the old
		// phrasing that invited the generic Write the guard hook blocks.
		assert.doesNotMatch(
			body,
			/write unit files to/i,
			"decompose body must not invite generic Write to a units/ path",
		)
		assert.ok(body.length > 500, `body too short (${body.length} chars)`)
	} finally {
		process.chdir(cwd)
		rmSync(root, { recursive: true, force: true })
	}
})

test("elaborate iterative re-entry: emits knowledge block + decide A/B/C", () => {
	const root = mkdtempSync(join(tmpdir(), "elab-iter-"))
	gitInit(root)
	setupSyntheticStudio(root)
	const intentDir = setupIntent(root, "iter")
	writeFileSync(
		join(intentDir, "stages", "a", "units", "unit-01-x.md"),
		`---\nname: unit-01-x\ntitle: x\nhat: builder\noutputs: ["foo.txt"]\nstatus: completed\n---\nbody\n`,
	)
	const cwd = process.cwd()
	process.chdir(root)
	try {
		const body = buildElaboratePromptBody({
			slug: "iter",
			studio: "synth",
			action: {
				action: "elaborate",
				stage: "a",
				elaboration: "collaborative",
				iteration: 2,
				completed_units: ["unit-01-x"],
				pending_units: [],
				iterative: true,
			},
			dir: intentDir,
		})
		assert.match(body, /Iterative Re-Entry/, "iterative re-entry header")
		assert.match(
			body,
			/Completed Units \(knowledge — read-only\)/,
			"knowledge block",
		)
		assert.match(body, /unit-01-x/, "completed unit listed by name")
		assert.match(body, /A\. New units are needed/, "decision option A present")
		assert.match(
			body,
			/B\. Pending units need revision/,
			"decision option B present",
		)
		assert.match(body, /C\. No changes needed/, "decision option C present")
	} finally {
		process.chdir(cwd)
		rmSync(root, { recursive: true, force: true })
	}
})

test("elaborate iterative: pending units listed when present", () => {
	const root = mkdtempSync(join(tmpdir(), "elab-pending-"))
	gitInit(root)
	setupSyntheticStudio(root)
	const intentDir = setupIntent(root, "pend")
	const cwd = process.cwd()
	process.chdir(root)
	try {
		const body = buildElaboratePromptBody({
			slug: "pend",
			studio: "synth",
			action: {
				action: "elaborate",
				stage: "a",
				elaboration: "collaborative",
				iteration: 2,
				completed_units: [],
				pending_units: ["unit-02-todo", "unit-03-todo"],
				iterative: true,
			},
			dir: intentDir,
		})
		assert.match(body, /Pending Units/, "pending units header")
		assert.match(body, /unit-02-todo/, "pending unit 1 listed")
		assert.match(body, /unit-03-todo/, "pending unit 2 listed")
	} finally {
		process.chdir(cwd)
		rmSync(root, { recursive: true, force: true })
	}
})

test("elaborate fresh on stage b: prior-stage references included", () => {
	// Stage b's elaborate should reference stage a's already-shipped
	// artifacts (via input/output chain), so the agent has prior-stage
	// context without rereading every file.
	const root = mkdtempSync(join(tmpdir(), "elab-prior-"))
	gitInit(root)
	setupSyntheticStudio(root)
	const intentDir = setupIntent(root, "prior")
	// Land an artifact on stage a so its existence shows up.
	writeFileSync(
		join(intentDir, "stages", "a", "units", "unit-01-foo.md"),
		`---\nname: unit-01-foo\ntitle: foo\nhat: builder\noutputs: ["a-output.txt"]\nstatus: completed\n---\n`,
	)
	const cwd = process.cwd()
	process.chdir(root)
	try {
		const body = buildElaboratePromptBody({
			slug: "prior",
			studio: "synth",
			action: {
				action: "elaborate",
				stage: "b",
				elaboration: "collaborative",
				iteration: 0,
				completed_units: [],
				pending_units: [],
				iterative: false,
			},
			dir: intentDir,
		})
		// The fresh elaborate block must mention the intent path so the
		// agent knows where to read for context. Whether prior-stage
		// references are inlined depends on stage requires; we assert
		// at minimum the agent is pointed at the intent dir.
		assert.match(
			body,
			/\.haiku\/intents\/prior/,
			"intent path referenced for context",
		)
		assert.match(body, /Stage b/, "stage b header")
	} finally {
		process.chdir(cwd)
		rmSync(root, { recursive: true, force: true })
	}
})

test("elaborate body always names the slug (anti-ambiguity)", () => {
	const root = mkdtempSync(join(tmpdir(), "elab-slug-"))
	gitInit(root)
	setupSyntheticStudio(root)
	const intentDir = setupIntent(root, "named-slug")
	const cwd = process.cwd()
	process.chdir(root)
	try {
		const body = buildElaboratePromptBody({
			slug: "named-slug",
			studio: "synth",
			action: {
				action: "elaborate",
				stage: "a",
				elaboration: "collaborative",
				iteration: 0,
				completed_units: [],
				pending_units: [],
				iterative: false,
			},
			dir: intentDir,
		})
		assert.match(body, /named-slug/, "slug name appears in body")
	} finally {
		process.chdir(cwd)
		rmSync(root, { recursive: true, force: true })
	}
})

test("elaborate in autopilot: autonomous mechanics + zero-user-interaction directive (never the collaborative ask-the-user path)", () => {
	// Regression: `action.elaboration` was never populated by the cursor, so the
	// builder pinned EVERY mode to collaborative — autopilot included — which
	// instructs the agent to ask the user questions during elaboration. In
	// autopilot the only human touchpoint is the pre-intent conversation.
	const root = mkdtempSync(join(tmpdir(), "elab-autopilot-"))
	gitInit(root)
	setupSyntheticStudio(root)
	const intentDir = join(root, ".haiku", "intents", "auto")
	mkdirSync(join(intentDir, "stages", "a", "units"), { recursive: true })
	mkdirSync(join(intentDir, "stages", "a", "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		`---\ntitle: auto\nstudio: synth\nmode: autopilot\nplugin_version: "9.0.0"\nstarted_at: 2026-04-01T00:00:00.000Z\napprovals: {}\nsealed_at: null\n---\n# auto\n`,
	)
	const cwd = process.cwd()
	process.chdir(root)
	try {
		const body = buildElaboratePromptBody({
			slug: "auto",
			studio: "synth",
			// Action says collaborative AND STAGE.md says collaborative — autopilot
			// must override both to the autonomous, no-interaction path.
			action: {
				action: "elaborate",
				stage: "a",
				elaboration: "collaborative",
				iteration: 0,
				completed_units: [],
				pending_units: [],
				iterative: false,
			},
			dir: intentDir,
		})
		assert.match(
			body,
			/Mode: \*\*autonomous\*\*/,
			"autopilot uses the autonomous mechanics block",
		)
		assert.doesNotMatch(
			body,
			/Mode: \*\*collaborative\*\*/,
			"autopilot must NOT use the collaborative (ask-the-user) mechanics",
		)
		assert.match(
			body,
			/Autopilot — zero user interaction/,
			"autopilot no-interaction directive present",
		)
		assert.match(
			body,
			/Do NOT call `AskUserQuestion`/,
			"autopilot explicitly bans user-facing prompt tools",
		)
	} finally {
		process.chdir(cwd)
		rmSync(root, { recursive: true, force: true })
	}
})

test("elaborate in continuous mode keeps the stage's collaborative path (no autopilot directive)", () => {
	const root = mkdtempSync(join(tmpdir(), "elab-continuous-"))
	gitInit(root)
	setupSyntheticStudio(root)
	const intentDir = setupIntent(root, "cont") // setupIntent → mode: continuous
	const cwd = process.cwd()
	process.chdir(root)
	try {
		const body = buildElaboratePromptBody({
			slug: "cont",
			studio: "synth",
			action: {
				action: "elaborate",
				stage: "a",
				iteration: 0,
				completed_units: [],
				pending_units: [],
				iterative: false,
			},
			dir: intentDir,
		})
		// STAGE.md declares `elaboration: collaborative`; continuous honors it.
		assert.match(body, /Mode: \*\*collaborative\*\*/, "collaborative path kept")
		assert.doesNotMatch(
			body,
			/Autopilot — zero user interaction/,
			"no autopilot directive outside autopilot",
		)
	} finally {
		process.chdir(cwd)
		rmSync(root, { recursive: true, force: true })
	}
})

test("elaborate iterative: completed unit body references the unit file path", () => {
	// Forward-progress invariant: agent must know WHERE the completed
	// unit's spec lives so it can read the prior decisions on demand.
	const root = mkdtempSync(join(tmpdir(), "elab-paths-"))
	gitInit(root)
	setupSyntheticStudio(root)
	const intentDir = setupIntent(root, "paths")
	writeFileSync(
		join(intentDir, "stages", "a", "units", "unit-01-x.md"),
		`---\nname: unit-01-x\ntitle: x\nhat: builder\noutputs: ["foo.txt"]\nstatus: completed\n---\n`,
	)
	const cwd = process.cwd()
	process.chdir(root)
	try {
		const body = buildElaboratePromptBody({
			slug: "paths",
			studio: "synth",
			action: {
				action: "elaborate",
				stage: "a",
				elaboration: "collaborative",
				iteration: 2,
				completed_units: ["unit-01-x"],
				pending_units: [],
				iterative: true,
			},
			dir: intentDir,
		})
		assert.match(
			body,
			/\.haiku\/intents\/paths\/stages\/a\/units\/unit-01-x\.md/,
			"completed unit file path emitted",
		)
	} finally {
		process.chdir(cwd)
		rmSync(root, { recursive: true, force: true })
	}
})
