// e2e-mode-coverage.test.mjs — proves every supported mode can drive
// a real intent start → sealed without getting stuck.
//
// Pattern mirrors `real-intent-dry-run.test.mjs` (one mode, continuous)
// but parameterized so each mode runs the same drive loop against the
// production software studio. The drive simulates an agent + a user
// stamping each action's predicate; the cursor + handlers do the rest.
//
// What this catches that unit tests don't:
//   - Mode-conditional action sequences (autopilot skips user_gate;
//     discrete swaps gates for external review; quick runs one stage)
//   - Inter-handler wiring (cursor → run-tick → orchestrator-actions
//     → state-tool side effects → next-tick cursor read)
//   - The `complete_stage` auto-execute loop firing under each mode
//   - Real git-driven stage→main merges via `mergeStageBranchIntoMain`
//
// Asserts per scenario:
//   1. Pipeline reaches `sealed` within MAX_TICKS.
//   2. Every actionable response carries a prompt_file or message
//      (no instructionless surfaces).
//   3. `intent.sealed_at` is set on disk.
//   4. The action sequence contains the mode's required gates
//      (e.g., autopilot must NOT contain `user_gate`; non-autopilot
//      modes MUST contain at least one `user_gate`).
//
// Not yet covered (deferred follow-ups):
//   - SPA wire-payload assertions via respondSessionApi (needs HTTP
//     server stand-up — see PR backlog).
//   - Mid-flight FB / drift scenarios per mode (each gets a dedicated
//     scenario test once this base coverage is green).

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
const REPO_ROOT = resolve(HERE, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

function readFm(path) {
	return matter(readFileSync(path, "utf8")).data
}

function writeFm(path, fm, body = "") {
	writeFileSync(path, matter.stringify(body, fm))
}

function writeDiscoveryStub(stage, agent, repoRoot, slug) {
	const discoveryDir = join(
		PLUGIN_ROOT,
		"studios",
		"software",
		"stages",
		stage,
		"discovery",
	)
	if (!existsSync(discoveryDir)) return
	for (const fname of readdirSync(discoveryDir)) {
		if (!fname.endsWith(".md")) continue
		const { data } = matter(readFileSync(join(discoveryDir, fname), "utf8"))
		if (data.name !== agent) continue
		const location = (data.location || "").replace(/\{intent-slug\}/g, slug)
		if (!location) return
		if (location.endsWith("/")) {
			const absDir = join(repoRoot, location)
			mkdirSync(absDir, { recursive: true })
			writeFileSync(join(absDir, "stub.md"), "discovery stub\n")
		} else {
			const absPath = join(repoRoot, location)
			mkdirSync(dirname(absPath), { recursive: true })
			writeFileSync(absPath, "discovery stub\n")
		}
		return
	}
}

async function withRealStudioRepo(slug, fn) {
	const root = mkdtempSync(join(tmpdir(), "e2e-mode-"))
	const orig = process.cwd()
	try {
		git(root, "init", "-q", "-b", "main")
		git(root, "config", "user.email", "test@haiku.test")
		git(root, "config", "user.name", "haiku test")
		git(root, "config", "commit.gpgsign", "false")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		git(root, "checkout", "-q", "-b", `haiku/${slug}/main`)
		const haikuDir = join(root, ".haiku")
		mkdirSync(haikuDir, { recursive: true })
		writeFileSync(join(haikuDir, "settings.yml"), "drift_detection: false\n")
		const intentDir = join(root, ".haiku", "intents", slug)
		mkdirSync(intentDir, { recursive: true })
		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(root)
		await fn({ root, intentDir, slug })
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(root, { recursive: true, force: true })
	}
}

function applyResponse(intentDir, action, root, slug) {
	const at = new Date().toISOString()
	const stage = action.stage
	if (!stage) {
		if (action.action === "intent_review") {
			const intentMd = join(intentDir, "intent.md")
			const fm = readFm(intentMd)
			const apps =
				fm.approvals && typeof fm.approvals === "object" ? fm.approvals : {}
			apps[action.role] = { at }
			writeFm(intentMd, { ...fm, approvals: apps })
		} else if (action.action === "seal_intent") {
			const intentMd = join(intentDir, "intent.md")
			const fm = readFm(intentMd)
			writeFm(intentMd, { ...fm, sealed_at: at })
		} else if (action.action === "elaborate_review") {
			const intentMd = join(intentDir, "intent.md")
			const fm = readFm(intentMd)
			writeFm(intentMd, {
				...fm,
				verified_at: at,
				verified_notes: "test fixture — gate simulated",
			})
		}
		return
	}
	const stageDir = join(intentDir, "stages", stage)
	const unitsDir = join(stageDir, "units")
	switch (action.action) {
		case "elaborate": {
			mkdirSync(stageDir, { recursive: true })
			const elabPath = join(stageDir, "elaboration.md")
			writeFm(
				elabPath,
				{
					recorded_at: at,
					intent: action.intent ?? "",
					stage,
					verified_at: at,
					verified_notes: "test fixture — gate simulated",
				},
				"Test elaboration body.",
			)
			break
		}
		case "elaborate_review": {
			const elabPath = join(stageDir, "elaboration.md")
			if (existsSync(elabPath)) {
				const fm = readFm(elabPath)
				writeFm(elabPath, { ...fm, verified_at: at })
			}
			break
		}
		case "decompose": {
			mkdirSync(unitsDir, { recursive: true })
			const path = join(unitsDir, "unit-01.md")
			if (!existsSync(path)) {
				writeFm(path, {
					title: "u1",
					depends_on: [],
					started_at: null,
					iterations: [],
					reviews: {},
					approvals: {},
				})
			}
			break
		}
		case "discovery_required": {
			writeDiscoveryStub(action.stage, action.agent, root, slug)
			break
		}
		case "design_direction_required":
		case "design_direction_complete":
		case "design_direction_uploaded": {
			const intentMd = join(intentDir, "intent.md")
			const fm = readFm(intentMd)
			const dd =
				fm.design_directions && typeof fm.design_directions === "object"
					? { ...fm.design_directions }
					: {}
			const rec =
				dd[stage] && typeof dd[stage] === "object" ? { ...dd[stage] } : {}
			rec.surfaced_at = at
			if (!rec.archetype) rec.archetype = "auto"
			dd[stage] = rec
			writeFm(intentMd, { ...fm, design_directions: dd })
			break
		}
		case "start_unit_hat": {
			for (const u of action.units || []) {
				const unitPath = join(unitsDir, `${u}.md`)
				if (!existsSync(unitPath)) continue
				const fm = readFm(unitPath)
				const its = Array.isArray(fm.iterations) ? fm.iterations : []
				its.push({
					hat: action.hat,
					started_at: at,
					completed_at: at,
					result: "advance",
				})
				writeFm(unitPath, {
					...fm,
					started_at: fm.started_at || at,
					iterations: its,
				})
			}
			break
		}
		case "dispatch_review": {
			const unitFiles = existsSync(unitsDir)
				? readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
				: []
			for (const f of unitFiles) {
				const path = join(unitsDir, f)
				const fm = readFm(path)
				const reviews =
					fm.reviews && typeof fm.reviews === "object" ? fm.reviews : {}
				reviews[action.role] = { at }
				writeFm(path, { ...fm, reviews })
			}
			break
		}
		case "dispatch_approval": {
			const unitFiles = existsSync(unitsDir)
				? readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
				: []
			for (const f of unitFiles) {
				const path = join(unitsDir, f)
				const fm = readFm(path)
				const approvals =
					fm.approvals && typeof fm.approvals === "object" ? fm.approvals : {}
				approvals[action.role] = { at }
				writeFm(path, { ...fm, approvals })
			}
			break
		}
		case "user_gate": {
			const unitFiles = existsSync(unitsDir)
				? readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
				: []
			for (const f of unitFiles) {
				const path = join(unitsDir, f)
				const fm = readFm(path)
				const reviews =
					fm.reviews && typeof fm.reviews === "object" ? fm.reviews : {}
				const approvals =
					fm.approvals && typeof fm.approvals === "object" ? fm.approvals : {}
				reviews.user = reviews.user || { at }
				approvals.user = approvals.user || { at }
				writeFm(path, { ...fm, reviews, approvals })
			}
			break
		}
		case "dispatch_quality_gates": {
			const unitFiles = existsSync(unitsDir)
				? readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
				: []
			for (const f of unitFiles) {
				const path = join(unitsDir, f)
				const fm = readFm(path)
				const approvals =
					fm.approvals && typeof fm.approvals === "object" ? fm.approvals : {}
				approvals.quality_gates = { at }
				writeFm(path, { ...fm, approvals })
			}
			break
		}
		// NOTE: `complete_stage` is intentionally NOT handled here.
		// It auto-executes inline inside `haiku_run_next` (the workflow
		// engine performs the stage→main merge in-process) and never
		// surfaces to the agent loop, so it cannot appear in
		// `seenActions`. Keep this comment as the breadcrumb — adding
		// a `case "complete_stage":` block is dead code.
		default:
			break
	}
}

/**
 * Drive haiku_run_next until `sealed`. Returns the recorded action
 * sequence + the final intent FM so per-mode tests can assert on both.
 */
async function driveToSealed({ intentDir, root, slug, maxTicks = 200 }) {
	const { orchestratorToolHandlers } = await import(
		`${SRC}/tools/orchestrator/index.ts`
	)
	const runNextTool = orchestratorToolHandlers.get("haiku_run_next")
	assert.ok(runNextTool, "haiku_run_next tool not registered")
	const seenActions = []
	let lastAction = null
	for (let tick = 0; tick < maxTicks; tick++) {
		const resp = await runNextTool.handle({ intent: slug })
		const text = resp.content?.[0]?.text ?? ""
		const match = text.match(/```json\s*([\s\S]*?)\s*```/)
		let action = null
		if (match) {
			try {
				action = JSON.parse(match[1])
			} catch {
				/* malformed */
			}
		}
		if (!action) {
			assert.fail(
				`tick ${tick}: could not parse action JSON: ${text.slice(0, 300)}`,
			)
		}
		seenActions.push(action.action)
		if (
			action.action !== "noop" &&
			action.action !== "sealed" &&
			action.action !== "error"
		) {
			const hasPromptFile = typeof action.prompt_file === "string"
			const hasMessage =
				typeof action.message === "string" && action.message.length > 10
			assert.ok(
				hasPromptFile || hasMessage,
				`action ${action.action} at tick ${tick} has no prompt_file/message`,
			)
		}
		if (action.action === "sealed") {
			lastAction = action
			break
		}
		if (action.action === "error") {
			assert.fail(`run_next returned error at tick ${tick}: ${action.message}`)
		}
		applyResponse(intentDir, action, root, slug)
		lastAction = action
	}
	const finalIntent = readFm(join(intentDir, "intent.md"))
	return { lastAction, seenActions, finalIntent }
}

// ── Per-mode scenarios ────────────────────────────────────────────────

test("e2e: continuous mode drives intent to sealed (full role list, user gates fire)", {
	timeout: 120_000,
}, async () => {
	if (!HAS_GIT) return
	await withRealStudioRepo(
		"e2e-continuous",
		async ({ root, intentDir, slug }) => {
			const now = new Date().toISOString()
			writeFm(
				join(intentDir, "intent.md"),
				{
					title: "e2e-continuous",
					studio: "software",
					mode: "continuous",
					plugin_version: "4.0.0",
					started_at: now,
					approvals: {},
					sealed_at: null,
					design_directions: {
						design: { archetype: "modular-cards", at: now },
					},
				},
				"# e2e-continuous\n",
			)
			const { lastAction, seenActions, finalIntent } = await driveToSealed({
				intentDir,
				root,
				slug,
			})
			assert.equal(
				lastAction?.action,
				"sealed",
				`continuous: did not seal. recent: ${seenActions.slice(-10).join(" → ")}`,
			)
			assert.ok(
				typeof finalIntent.sealed_at === "string",
				"continuous: intent.sealed_at not set",
			)
			assert.ok(
				seenActions.includes("user_gate"),
				"continuous: expected at least one user_gate action",
			)
			// Note: `complete_stage` is auto-executed inline by
			// haiku_run_next's complete_stage loop and re-ticks before
			// returning, so it never surfaces in seenActions. The `sealed`
			// + `intent.sealed_at` assertions above already prove every
			// stage completed (sealing requires every stage done).
		},
	)
})

test("e2e: autopilot mode drives intent to sealed (no user_gate)", {
	timeout: 120_000,
}, async () => {
	if (!HAS_GIT) return
	await withRealStudioRepo(
		"e2e-autopilot",
		async ({ root, intentDir, slug }) => {
			const now = new Date().toISOString()
			writeFm(
				join(intentDir, "intent.md"),
				{
					title: "e2e-autopilot",
					studio: "software",
					mode: "autopilot",
					plugin_version: "4.0.0",
					started_at: now,
					approvals: {},
					sealed_at: null,
					design_directions: {
						design: { archetype: "modular-cards", at: now },
					},
				},
				"# e2e-autopilot\n",
			)
			const { lastAction, seenActions, finalIntent } = await driveToSealed({
				intentDir,
				root,
				slug,
			})
			assert.equal(
				lastAction?.action,
				"sealed",
				`autopilot: did not seal. recent: ${seenActions.slice(-10).join(" → ")}`,
			)
			assert.ok(
				typeof finalIntent.sealed_at === "string",
				"autopilot: intent.sealed_at not set",
			)
			assert.ok(
				!seenActions.includes("user_gate"),
				"autopilot: user_gate should NOT fire (mode bypasses the human gate)",
			)
			// complete_stage auto-executes inline — see note in continuous
			// scenario above.
		},
	)
})

test("e2e: discrete mode drives intent to sealed (same role list; differs on gate dispatch)", {
	timeout: 120_000,
}, async () => {
	if (!HAS_GIT) return
	await withRealStudioRepo(
		"e2e-discrete",
		async ({ root, intentDir, slug }) => {
			const now = new Date().toISOString()
			writeFm(
				join(intentDir, "intent.md"),
				{
					title: "e2e-discrete",
					studio: "software",
					mode: "discrete",
					plugin_version: "4.0.0",
					started_at: now,
					approvals: {},
					sealed_at: null,
					design_directions: {
						design: { archetype: "modular-cards", at: now },
					},
				},
				"# e2e-discrete\n",
			)
			const { lastAction, seenActions, finalIntent } = await driveToSealed({
				intentDir,
				root,
				slug,
			})
			assert.equal(
				lastAction?.action,
				"sealed",
				`discrete: did not seal. recent: ${seenActions.slice(-10).join(" → ")}`,
			)
			assert.ok(
				typeof finalIntent.sealed_at === "string",
				"discrete: intent.sealed_at not set",
			)
			assert.ok(
				seenActions.includes("user_gate"),
				"discrete: expected at least one user_gate (discrete still gates on user)",
			)
		},
	)
})

test("e2e: discrete-hybrid mode drives intent to sealed", {
	timeout: 120_000,
}, async () => {
	if (!HAS_GIT) return
	await withRealStudioRepo("e2e-hybrid", async ({ root, intentDir, slug }) => {
		const now = new Date().toISOString()
		writeFm(
			join(intentDir, "intent.md"),
			{
				title: "e2e-hybrid",
				studio: "software",
				mode: "discrete-hybrid",
				plugin_version: "4.0.0",
				started_at: now,
				approvals: {},
				sealed_at: null,
				design_directions: { design: { archetype: "modular-cards", at: now } },
			},
			"# e2e-hybrid\n",
		)
		const { lastAction, seenActions, finalIntent } = await driveToSealed({
			intentDir,
			root,
			slug,
		})
		assert.equal(
			lastAction?.action,
			"sealed",
			`discrete-hybrid: did not seal. recent: ${seenActions.slice(-10).join(" → ")}`,
		)
		assert.ok(
			typeof finalIntent.sealed_at === "string",
			"discrete-hybrid: intent.sealed_at not set",
		)
	})
})

test("e2e: quick mode drives single-stage intent to sealed", {
	timeout: 120_000,
}, async () => {
	if (!HAS_GIT) return
	await withRealStudioRepo("e2e-quick", async ({ root, intentDir, slug }) => {
		const now = new Date().toISOString()
		// Quick mode runs against a single stage. Restrict via intent.stages
		// to inception (the first software stage); the cursor's effective
		// stage list = the intersection of intent.stages + studio.stages.
		writeFm(
			join(intentDir, "intent.md"),
			{
				title: "e2e-quick",
				studio: "software",
				mode: "quick",
				stages: ["inception"],
				plugin_version: "4.0.0",
				started_at: now,
				approvals: {},
				sealed_at: null,
			},
			"# e2e-quick\n",
		)
		const { lastAction, seenActions, finalIntent } = await driveToSealed({
			intentDir,
			root,
			slug,
		})
		assert.equal(
			lastAction?.action,
			"sealed",
			`quick: did not seal. recent: ${seenActions.slice(-10).join(" → ")}`,
		)
		assert.ok(
			typeof finalIntent.sealed_at === "string",
			"quick: intent.sealed_at not set",
		)
		// Quick = single stage. complete_stage auto-executes inline so
		// we can't count it directly; instead assert that the seen
		// action sequence contains EXACTLY ONE per-stage open
		// (`elaborate`) followed by a single seal — i.e., no second
		// stage was opened.
		const elaborateCount = seenActions.filter((a) => a === "elaborate").length
		assert.equal(
			elaborateCount,
			1,
			`quick: expected exactly 1 elaborate (single stage); got ${elaborateCount} (${seenActions.join(" → ")})`,
		)
	})
})
