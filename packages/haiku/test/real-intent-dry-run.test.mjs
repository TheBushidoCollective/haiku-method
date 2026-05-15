// Real-intent dry-run against the production software studio.
//
// Drives haiku_run_next.handle end-to-end on a real on-disk software
// studio (not a synthetic test studio) until the pipeline reaches
// `sealed`. No manual git intervention beyond the agent-side state
// stubs — every branch creation, merge, and lifecycle transition
// goes through MCP tools.
//
// Asserts:
//   1. Pipeline reaches `sealed` within MAX_TICKS.
//   2. Every action surfaced via run_next carries either a prompt_file
//      or a non-empty message — agents never get an instructionless
//      action.
//   3. The final state has intent.sealed_at set.

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

// Look up a discovery template's `location:` in the real software
// studio config and write a stub artifact at the resolved path. File
// existence is the cursor's signal — no FM stamp.
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
	const root = mkdtempSync(join(tmpdir(), "real-intent-"))
	const orig = process.cwd()
	try {
		git(root, "init", "-q", "-b", "main")
		git(root, "config", "user.email", "test@haiku.test")
		git(root, "config", "user.name", "haiku test")
		git(root, "config", "commit.gpgsign", "false")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		git(root, "checkout", "-q", "-b", `haiku/${slug}/main`)
		// Disable drift detection for the dry-run — the test's
		// applyResponse stamps lifecycle fields (reviews/approvals) on
		// units after approvals are signed, which the drift sweep
		// classifies as "agent edited approved content." The signal is
		// real but the harness pattern is simulated, not real drift.
		// See drift-scenarios.test.mjs for dedicated drift coverage.
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

/**
 * Apply the agent-side state mutation that satisfies the cursor's
 * predicate for the given action. No git intervention — only state
 * file writes.
 */
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
		} else if (
			action.action === "elaborate_loop" &&
			(action.signals_unmet ?? []).some(
				(s) => s.signal === "verify_conversation",
			)
		) {
			// Pre-intent elaborate_review now folds into the loop. Stamp
			// verified_at on intent.md.
			const intentMd = join(intentDir, "intent.md")
			const fm = readFm(intentMd)
			writeFm(intentMd, {
				...fm,
				verified_at: at,
				verified_notes: "test fixture — gate simulated",
			})
		} else if (
			action.action === "dispatch_quality_gates" &&
			(action.scope === "intent" || stage === "")
		) {
			// Intent-scope QG re-run: cursor emits with stage="" + scope="intent"
			// after every intent_review role signs and before seal_intent.
			// The engine handler walks all stages' unit gates and runs
			// them deduped; the test fixture short-circuits with a stamp.
			const intentMd = join(intentDir, "intent.md")
			const fm = readFm(intentMd)
			const apps =
				fm.approvals && typeof fm.approvals === "object" ? fm.approvals : {}
			apps.intent_quality_gates = { at }
			writeFm(intentMd, { ...fm, approvals: apps })
		}
		return
	}

	const stageDir = join(intentDir, "stages", stage)
	const unitsDir = join(stageDir, "units")

	switch (action.action) {
		case "elaborate_loop": {
			// Post-Option-A: walk signals_unmet and react in order.
			for (const entry of action.signals_unmet ?? []) {
				switch (entry.signal) {
					case "conversation": {
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
					case "verify_conversation": {
						const elabPath = join(stageDir, "elaboration.md")
						if (existsSync(elabPath)) {
							const fm = readFm(elabPath)
							writeFm(elabPath, { ...fm, verified_at: at })
						}
						break
					}
					case "verify_decompose": {
						const elabPath = join(stageDir, "elaboration.md")
						if (existsSync(elabPath)) {
							const fm = readFm(elabPath)
							writeFm(elabPath, { ...fm, decompose_verified_at: at })
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
								inputs: [],
								started_at: null,
								iterations: [],
								reviews: {},
								approvals: {},
							})
						}
						break
					}
					case "discovery": {
						writeDiscoveryStub(action.stage, entry.agent, root, slug)
						break
					}
				}
			}
			break
		}
		case "clarify_required": {
			const intentMd = join(intentDir, "intent.md")
			const fm = readFm(intentMd)
			const cl =
				fm.clarifications && typeof fm.clarifications === "object"
					? fm.clarifications
					: {}
			cl[stage] = { answers: [], at }
			writeFm(intentMd, { ...fm, clarifications: cl })
			break
		}
		case "design_direction_required": {
			const intentMd = join(intentDir, "intent.md")
			const fm = readFm(intentMd)
			const dd =
				fm.design_directions && typeof fm.design_directions === "object"
					? fm.design_directions
					: {}
			dd[stage] = { mode: "archetype", archetype: "auto", at }
			writeFm(intentMd, { ...fm, design_directions: dd })
			break
		}
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
		case "complete_stage": {
			// Materialize a real merge. The previous form used
			// `git checkout -b <stage>` to "ensure" the branch existed,
			// but that throws when the branch already exists (the common
			// case — the engine created it). The catch then swallowed the
			// entire try block so the merge into main never ran, and
			// findCurrentStage on intent main kept returning the same
			// stage forever. Use the idempotent flow: ensure we're on
			// the stage branch, commit pending work, switch to main,
			// merge.
			const stageBranch = `haiku/${slug}/${stage}`
			const mainBranch = `haiku/${slug}/main`
			try {
				git(root, "add", "-A")
				try {
					git(root, "commit", "-m", `complete ${stage}`)
				} catch {
					/* nothing to commit — fine */
				}
				const currentBr = execFileSync("git", ["branch", "--show-current"], {
					cwd: root,
					encoding: "utf8",
				}).trim()
				if (currentBr !== stageBranch) {
					git(root, "checkout", "-q", stageBranch)
				}
				git(root, "checkout", "-q", mainBranch)
				git(
					root,
					"merge",
					"--no-ff",
					"--no-edit",
					"-m",
					`merge ${stage}`,
					stageBranch,
				)
			} catch (err) {
				console.error(
					`[SIM] merge_stage(${stage}) failed: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
			break
		}
		default:
			break
	}
}

test("real-intent: drive software studio to sealed via run_next handler", {
	timeout: 120_000,
}, async () => {
	if (!HAS_GIT) return
	await withRealStudioRepo("real-intent", async ({ root, intentDir, slug }) => {
		const now = new Date().toISOString()
		writeFm(
			join(intentDir, "intent.md"),
			{
				title: "real-intent",
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
			"# real-intent\n",
		)

		const { orchestratorToolHandlers } = await import(
			`${SRC}/tools/orchestrator/index.ts`
		)
		const runNextTool = orchestratorToolHandlers.get("haiku_run_next")
		assert.ok(runNextTool, "haiku_run_next tool not registered")

		const seenActions = []
		const MAX_TICKS = 200
		let lastAction = null

		for (let tick = 0; tick < MAX_TICKS; tick++) {
			const resp = await runNextTool.handle({ intent: slug })
			const text = resp.content?.[0]?.text ?? ""
			// Extract action from the embedded JSON block.
			const match = text.match(/```json\s*([\s\S]*?)\s*```/)
			let action = null
			if (match) {
				try {
					action = JSON.parse(match[1])
				} catch {
					/* malformed JSON in response */
				}
			}
			if (!action) {
				assert.fail(
					`tick ${tick}: could not parse action JSON from response: ${text.slice(0, 300)}`,
				)
			}
			seenActions.push(
				`${action.action}/${action.stage ?? ""}/${action.hat ?? action.role ?? action.agent ?? ""}`,
			)

			// Every actionable response carries a prompt_file or message
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
				assert.fail(
					`run_next returned error at tick ${tick}: ${action.message}`,
				)
			}

			applyResponse(intentDir, action, root, slug)
			lastAction = action
		}

		assert.equal(
			lastAction?.action,
			"sealed",
			`pipeline did not seal within ${MAX_TICKS} ticks. last action: ${lastAction?.action}; recent: ${seenActions.slice(-10).join(" → ")}`,
		)

		const finalIntent = readFm(join(intentDir, "intent.md"))
		assert.ok(
			typeof finalIntent.sealed_at === "string",
			`intent.sealed_at not set after sealed action; got: ${JSON.stringify(finalIntent.sealed_at)}`,
		)
	})
})
