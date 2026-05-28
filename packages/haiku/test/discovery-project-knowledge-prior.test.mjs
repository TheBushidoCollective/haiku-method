// discovery-project-knowledge-prior.test.mjs — pins the read-as-prior
// behavior for `scope: project` discovery artifacts (long-lived repo
// knowledge that persists across intents at `.haiku/knowledge/`).
//
// Before this change, a `scope: project` artifact was write-once: created
// by the first intent that hit the stage, then — because the cursor gates
// discovery on file existence — silently skipped by every later intent.
// It was never read back and never refreshed.
//
// The fix is a NON-blocking read-as-prior splice in the decompose prompt:
// when a `scope: project` artifact already exists, the builder injects a
// "Long-Lived Repo Knowledge (read as prior)" section telling the agent to
// read it as a starting point and update it in place only if the intent's
// work shows it diverged. No cursor gate change (forcing a refresh signal
// would loop, since the file still exists after the refresh).
//
// This test pins:
//   1. existing project-scope artifact → prior section appears, lists it.
//   2. absent project-scope artifact → no prior section (nothing to read).
//   3. existing INTENT-scope artifact → never listed as a prior.

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

const { buildElaboratePromptBody } = await import(
	`${SRC}/orchestrator/prompts/stage/elaborate/decompose/index.ts`
)

// Regex-safe substring of the section header (avoids the literal parens
// in "(read as prior)").
const PRIOR_HEADER = /Long-Lived Repo Knowledge/

function gitInit(root) {
	execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root })
	execFileSync("git", ["config", "user.email", "t@t"], { cwd: root })
	execFileSync("git", ["config", "user.name", "t"], { cwd: root })
	execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], {
		cwd: root,
	})
}

/** Synthetic studio with a single stage `a` carrying two discovery
 *  templates: one `scope: project` (repo-global) and one `scope: intent`. */
function setupStudio(root, name = "synth") {
	const stageDir = join(root, ".haiku", "studios", name, "stages", "a")
	mkdirSync(join(stageDir, "hats"), { recursive: true })
	writeFileSync(
		join(stageDir, "STAGE.md"),
		[
			`---`,
			`name: a`,
			`hats: [planner, builder, verifier]`,
			`elaboration: collaborative`,
			`---`,
			`# Stage a`,
			``,
			`Body for stage a.`,
		].join("\n"),
	)
	for (const h of ["planner", "builder", "verifier"]) {
		writeFileSync(join(stageDir, "hats", `${h}.md`), `# ${h}\n\nMandate.\n`)
	}
	const discDir = join(stageDir, "discovery")
	mkdirSync(discDir, { recursive: true })
	writeFileSync(
		join(discDir, "PROJECT-KB.md"),
		[
			`---`,
			`name: project-kb`,
			`location: .haiku/knowledge/PROJECT-KB.md`,
			`scope: project`,
			`required: false`,
			`---`,
			`# Project KB`,
			``,
			`Long-lived repo knowledge.`,
		].join("\n"),
	)
	writeFileSync(
		join(discDir, "INTENT-KB.md"),
		[
			`---`,
			`name: intent-kb`,
			`location: .haiku/intents/{intent-slug}/knowledge/INTENT-KB.md`,
			`scope: intent`,
			`required: true`,
			`---`,
			`# Intent KB`,
			``,
			`Intent-scoped knowledge.`,
		].join("\n"),
	)
	mkdirSync(join(root, ".haiku", "studios", name), { recursive: true })
	writeFileSync(
		join(root, ".haiku", "studios", name, "STUDIO.md"),
		`---\nname: ${name}\nstages: [a]\n---\n# ${name}\n`,
	)
}

function setupIntent(root, slug) {
	const intentDir = join(root, ".haiku", "intents", slug)
	mkdirSync(join(intentDir, "stages", "a", "units"), { recursive: true })
	mkdirSync(join(intentDir, "stages", "a", "feedback"), { recursive: true })
	mkdirSync(join(intentDir, "knowledge"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		`---\ntitle: ${slug}\nstudio: synth\nmode: continuous\nplugin_version: "5.0.0"\nstarted_at: 2026-04-01T00:00:00.000Z\napprovals: {}\nsealed_at: null\n---\n# ${slug}\n`,
	)
	return intentDir
}

function render(root, slug) {
	const cwd = process.cwd()
	process.chdir(root)
	try {
		return buildElaboratePromptBody({
			slug,
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
			dir: join(root, ".haiku", "intents", slug),
		})
	} finally {
		process.chdir(cwd)
	}
}

test("project-scope artifact exists → read-as-prior section lists it", () => {
	const root = mkdtempSync(join(tmpdir(), "proj-kb-prior-"))
	gitInit(root)
	setupStudio(root)
	setupIntent(root, "one")
	// The long-lived artifact already exists at the repo-global path.
	mkdirSync(join(root, ".haiku", "knowledge"), { recursive: true })
	writeFileSync(
		join(root, ".haiku", "knowledge", "PROJECT-KB.md"),
		"# Project KB\n\nPrior architecture decisions.\n",
	)
	try {
		const body = render(root, "one")
		assert.match(body, PRIOR_HEADER, "prior section present")
		assert.match(
			body,
			/\.haiku\/knowledge\/PROJECT-KB\.md/,
			"prior section lists the project-scope artifact path",
		)
		// It must NOT be re-created via a discovery fan-out subagent — it
		// already exists; the agent reads it, doesn't author it fresh.
		assert.doesNotMatch(
			body,
			/Subagent: `project-kb`/,
			"existing project-scope artifact must not spawn a create subagent",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("project-scope artifact absent → no read-as-prior section", () => {
	const root = mkdtempSync(join(tmpdir(), "proj-kb-absent-"))
	gitInit(root)
	setupStudio(root)
	setupIntent(root, "two")
	try {
		const body = render(root, "two")
		assert.doesNotMatch(
			body,
			PRIOR_HEADER,
			"no prior section when nothing exists to read yet",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("intent-scope artifact is never listed as a long-lived prior", () => {
	const root = mkdtempSync(join(tmpdir(), "intent-kb-"))
	gitInit(root)
	setupStudio(root)
	const intentDir = setupIntent(root, "three")
	// Seed BOTH: an existing intent-scoped artifact and no project one.
	writeFileSync(
		join(intentDir, "knowledge", "INTENT-KB.md"),
		"# Intent KB\n\nScoped to this intent only.\n",
	)
	try {
		const body = render(root, "three")
		// No project-scope artifact exists → no prior section at all.
		assert.doesNotMatch(
			body,
			PRIOR_HEADER,
			"intent-scoped artifact must not trigger the long-lived prior section",
		)
		assert.doesNotMatch(
			body,
			/knowledge\/INTENT-KB\.md`[^\n]*prior/i,
			"intent-scoped artifact must never be presented as a cross-intent prior",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})
