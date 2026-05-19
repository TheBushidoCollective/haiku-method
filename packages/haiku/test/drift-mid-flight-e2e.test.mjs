// E2E: drift introduced mid-flight → engine files FB → cursor walks
// Track B → fix loop → pipeline seals.
//
// Drift-scenarios.test.mjs covers the sweep in isolation. This test
// drives the full lifecycle end-to-end: a real out-of-band edit to a
// signed unit produces a drift sweep event, which the engine handler
// (engineHandleDriftEvents) immediately restamps the witnesses for
// AND files a single deduped FB. The FB routes through the fix loop
// like any other FB; once it closes, the pipeline reaches sealed.
//
// 2026-05-17: refactored to expect engine-emitted FBs instead of a
// `drift_detected` action. The pre-refactor model returned events to
// the agent and asked it to translate them into FBs; the new model
// does that translation in-engine for dedup + restamp-at-detect
// reasons. See orchestrator/workflow/drift-handle-events.ts.

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
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"
import { initTestRepo, makeIntent, makeStudio } from "./_v4-fixtures.mjs"

// Promoted to module scope so applyResponse and helpers can use it
// without re-importing per call.
const { buildApprovalRecord, buildReviewRecord } = await import(
	`${join(dirname(fileURLToPath(import.meta.url)), "..", "src")}/orchestrator/workflow/sign-slot.ts`
)

const HERE = dirname(fileURLToPath(import.meta.url))
const _SRC = join(HERE, "..", "src")

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

async function withRepo(slug, fn) {
	const repoRoot = mkdtempSync(join(tmpdir(), `drift-mid-${slug}-`))
	const orig = process.cwd()
	process.chdir(repoRoot)
	try {
		const { intentDir } = initTestRepo({ repoRoot, slug })
		git(repoRoot, "config", "commit.gpgsign", "false")
		// Drift detection ON for this test.
		await fn({ repoRoot, intentDir, slug })
	} finally {
		process.chdir(orig)
		rmSync(repoRoot, { recursive: true, force: true })
	}
}

function applyResponse(intentDir, action, repoRoot, slug) {
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
	const fbDir = join(stageDir, "feedback")
	switch (action.action) {
		case "elaborate_loop": {
			// Post-Option-A: walk the signals. For this drift test we
			// only need to seed a unit and stamp the verifier signals;
			// the conversation gate is handled by the existing seeded
			// elaboration.md when present.
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
								verified_notes: "drift e2e fixture",
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
								discovery: {},
							})
						}
						break
					}
				}
			}
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
		case "start_feedback_hat": {
			for (const fbId of action.feedback_ids || []) {
				const files = readdirSync(fbDir).filter((f) => {
					const n = Number.parseInt(String(fbId).replace(/^FB-/i, ""), 10)
					const m = f.match(/^(\d+)-/)
					return m && Number.parseInt(m[1], 10) === n
				})
				for (const f of files) {
					const path = join(fbDir, f)
					const fm = readFm(path)
					const its = Array.isArray(fm.iterations) ? fm.iterations : []
					its.push({
						hat: action.hat,
						started_at: at,
						completed_at: at,
						result: "advance",
					})
					writeFm(path, { ...fm, iterations: its })
				}
			}
			break
		}
		case "close_feedback": {
			const files = readdirSync(fbDir).filter((f) => {
				const n = Number.parseInt(
					String(action.feedback_id).replace(/^FB-/i, ""),
					10,
				)
				const m = f.match(/^(\d+)-/)
				return m && Number.parseInt(m[1], 10) === n
			})
			for (const f of files) {
				const path = join(fbDir, f)
				const fm = readFm(path)
				writeFm(path, { ...fm, closed_at: at })
				// Mirror haiku_run_next's drift-close behavior: refresh
				// witnessed signed_at on the targeted unit so the drift
				// sweep stops flagging the same commit.
				if (fm.origin === "drift") {
					const targetUnit = fm.targets?.unit
					if (targetUnit) {
						const unitPath = join(unitsDir, `${targetUnit}.md`)
						if (existsSync(unitPath)) {
							const ufm = readFm(unitPath)
							const reviews = ufm.reviews ? { ...ufm.reviews } : {}
							for (const role of Object.keys(reviews)) reviews[role] = { at }
							const approvals = ufm.approvals ? { ...ufm.approvals } : {}
							for (const role of Object.keys(approvals))
								approvals[role] = { at }
							writeFm(unitPath, { ...ufm, reviews, approvals })
						}
					}
				}
			}
			break
		}
		// drift_detected case retired 2026-05-17 — engine handles drift
		// internally (see orchestrator/workflow/drift-handle-events.ts).
		case "dispatch_review": {
			const unitFiles = existsSync(unitsDir)
				? readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
				: []
			for (const f of unitFiles) {
				const path = join(unitsDir, f)
				const fm = readFm(path)
				const reviews =
					fm.reviews && typeof fm.reviews === "object" ? fm.reviews : {}
				reviews[action.role] = buildReviewRecord(path)
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
				const outputs = Array.isArray(fm.outputs) ? fm.outputs : []
				const approvals =
					fm.approvals && typeof fm.approvals === "object" ? fm.approvals : {}
				approvals[action.role] = buildApprovalRecord(intentDir, outputs)
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
				const outputs = Array.isArray(fm.outputs) ? fm.outputs : []
				const reviews =
					fm.reviews && typeof fm.reviews === "object" ? fm.reviews : {}
				const approvals =
					fm.approvals && typeof fm.approvals === "object" ? fm.approvals : {}
				reviews.user = reviews.user || buildReviewRecord(path)
				approvals.user =
					approvals.user || buildApprovalRecord(intentDir, outputs)
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
				const outputs = Array.isArray(fm.outputs) ? fm.outputs : []
				const approvals =
					fm.approvals && typeof fm.approvals === "object" ? fm.approvals : {}
				approvals.quality_gates = buildApprovalRecord(intentDir, outputs)
				writeFm(path, { ...fm, approvals })
			}
			break
		}
		case "complete_stage": {
			const stageBranch = `haiku/${slug}/${stage}`
			const mainBranch = `haiku/${slug}/main`
			try {
				try {
					git(repoRoot, "checkout", "-q", stageBranch)
				} catch {
					git(repoRoot, "checkout", "-q", "-b", stageBranch)
				}
				try {
					git(repoRoot, "add", "-A")
					git(repoRoot, "commit", "-m", `complete ${stage}`)
				} catch {
					git(
						repoRoot,
						"commit",
						"--allow-empty",
						"-m",
						`complete ${stage} (sentinel)`,
					)
				}
				git(repoRoot, "checkout", "-q", mainBranch)
				git(
					repoRoot,
					"merge",
					"--no-ff",
					"--no-edit",
					"-m",
					`merge ${stage}`,
					stageBranch,
				)
			} catch {
				/* may already be merged */
			}
			break
		}
		default:
			break
	}
}

async function runTick(slug) {
	const { runTickWithBranchAlignment } = await import("./_v4-fixtures.mjs")
	return runTickWithBranchAlignment(slug)
}

function buildThreeStageStudio(repoRoot) {
	makeStudio({
		repoRoot,
		studio: "drift3",
		stages: [
			{
				name: "a",
				hats: ["planner", "builder", "verifier"],
				fix_hats: ["builder", "feedback-assessor"],
				review: "ask",
				review_agents: ["code-reviewer"],
			},
			{
				name: "b",
				hats: ["planner", "builder", "verifier"],
				fix_hats: ["builder", "feedback-assessor"],
				review: "ask",
				review_agents: ["code-reviewer"],
			},
		],
	})
}

// 2026-05-07: drift sweep dedups against open drift FBs by source_ref.
// Once the agent files an FB with `origin: "drift"` and
// `source_ref: "drift:<kind>:<file>"`, the sweep filters that event
// from subsequent ticks until the FB closes. That lets Track B (the
// fix loop) actually run instead of Track C looping on the same
// drift commit forever.
test("e2e: drift introduced after stage A signed → FB → fix loop → seal", async () => {
	if (!HAS_GIT) return
	await withRepo("drift-mid", async ({ repoRoot, intentDir, slug }) => {
		buildThreeStageStudio(repoRoot)
		makeIntent({
			intentDir,
			slug,
			studio: "drift3",
			mode: "continuous",
			extraFm: { stages: ["a", "b"] },
		})

		const seen = []
		let driftInjected = false
		let fbClosed = false
		const MAX_TICKS = 200

		// Helper: scan stage A's feedback dir for engine-emitted drift FBs.
		// Under the new model the engine files the FB silently on the
		// tick following the drift commit — no agent-facing action to
		// observe, just an on-disk artifact.
		const driftFbsOnDisk = () => {
			const dir = join(intentDir, "stages", "a", "feedback")
			if (!existsSync(dir)) return []
			return readdirSync(dir)
				.filter((f) => f.endsWith(".md"))
				.map((f) => {
					const fm = readFm(join(dir, f))
					return { name: f, origin: fm.origin, author: fm.author }
				})
				.filter((fb) => fb.origin === "drift" && fb.author === "engine")
		}

		for (let i = 0; i < MAX_TICKS; i++) {
			const action = await runTick(slug)
			seen.push(
				`${action.action}/${action.stage ?? ""}/${action.hat ?? action.role ?? action.agent ?? ""}`,
			)

			// Inject out-of-band drift while stage A is still the active
			// stage (drift sweep is per active stage; once stage A
			// merges into main the active stage advances to B and A's
			// drift would be invisible). dispatch_quality_gates is the
			// last per-unit action before merge_stage and reviews/
			// approvals are stamped on the unit by then.
			if (
				!driftInjected &&
				action.action === "dispatch_quality_gates" &&
				action.stage === "a"
			) {
				applyResponse(intentDir, action, repoRoot, slug)
				// Stage the unit signing as a real commit so the drift
				// sweep has a baseline timestamp to compare against.
				git(repoRoot, "add", "-A")
				git(repoRoot, "commit", "-m", "stage a unit signed")
				// Now wait one second so the drift commit's timestamp
				// is strictly after the signing.
				await new Promise((r) => setTimeout(r, 1100))
				// Out-of-band edit + commit. This is the drift.
				const unitPath = join(intentDir, "stages", "a", "units", "unit-01.md")
				const raw = readFileSync(unitPath, "utf8")
				writeFileSync(
					unitPath,
					`${raw}\n\nOut-of-band note (drift simulation).\n`,
				)
				git(repoRoot, "add", "-A")
				git(repoRoot, "commit", "-m", "drift: edit unit-01 after signing")
				driftInjected = true
				continue
			}
			if (action.action === "close_feedback") fbClosed = true
			if (action.action === "sealed") break
			applyResponse(intentDir, action, repoRoot, slug)
			if (action.action === "seal_intent") {
				const intentMd = join(intentDir, "intent.md")
				const fm = readFm(intentMd)
				writeFm(intentMd, { ...fm, sealed_at: new Date().toISOString() })
			}
		}

		assert.ok(
			driftInjected,
			`drift never injected (test setup bug). recent: ${seen.slice(-20).join(" → ")}`,
		)
		const driftFbs = driftFbsOnDisk()
		assert.ok(
			driftFbs.length >= 1,
			`engine MUST file at least one drift FB after the drift commit. recent: ${seen.slice(-15).join(" → ")}; fbs: ${JSON.stringify(driftFbs)}`,
		)
		assert.ok(
			fbClosed,
			`close_feedback never fired — fix loop didn't terminate. recent: ${seen.slice(-30).join(" → ")}`,
		)
		assert.equal(
			seen[seen.length - 1],
			"sealed//",
			`pipeline did not seal after drift→FB→fix loop. recent: ${seen.slice(-10).join(" → ")}`,
		)
		const fbTicks = seen.filter((t) => t.startsWith("start_feedback_hat/a/"))
		assert.ok(
			fbTicks.length >= 2,
			`expected ≥2 fix-hat ticks on stage a; got ${fbTicks.length}: ${fbTicks.join(", ")}`,
		)
	})
})
