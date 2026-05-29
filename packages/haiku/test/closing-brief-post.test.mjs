#!/usr/bin/env npx tsx
// closing-brief-post.test.mjs — the POST-execute closing BRIEF (#17).
//
// The pre-execute BRIEF ("this is what I am going to do") is written in the
// review walk, keyed on BRIEF.md absence (covered in cursor-walk.test.mjs).
// This file pins the POST-execute counterpart ("this is what I did"): the
// engine rewrites the SAME BRIEF.md once the work has landed, ONCE, keyed on
// the brief's OWN frontmatter `phase:` (BRIEF.md already exists from the pre
// firing, so absence can't gate the closing brief — and a sibling marker file
// could drift from the content, so the signal lives inside the artifact). The
// pre brief stamps `phase: pre`; the closing brief rewrites the file and
// stamps `phase: post`; once the on-disk brief reads `post`, the gate is off.
//
// Per the 2-gate design there are TWO reachable surfaces, because once a
// stage's `user` approval is signed its units are complete and
// findCurrentStage advances PAST it — the per-stage cursor walk never runs for
// the just-finished stage again. So:
//
//   (A) NON-AUTOPILOT — user approval still PENDING. The stage is the frontier
//       stage; the cursor walk reaches step 8's approval track, and right
//       before the `user_gate` return (every adversarial approval + the
//       quality gate already signed) it emits write_brief(post). The human
//       then reviews the post-execution summary. Asserted via the cursor walk
//       (cursorOnStageBranch).
//
//   (B) AUTOPILOT / PRIOR-STAGE-MERGE — user approval signed (autopilot omits
//       the `user` role; or a non-frontier prior stage is merging). The stage
//       completes, findCurrentStage advances, and run_next synthesizes
//       complete_stage(stage). The closing brief fires there, BEFORE the
//       observations gate. Asserted via the real haiku_run_next handler
//       (runNextOnce), the same surface the obs-gate test in
//       cursor-walk.test.mjs uses.
//
// Studios are TWO-stage (design + build) so "design" is NON-terminal — a
// terminal stage routes to the intent-completion track, a separate scope that
// doesn't carry the per-stage closing brief. The observations gate has the
// same two-stage shape (cursor-walk.test.mjs).

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"
import {
	initTestRepo,
	makeIntent,
	makeStudio,
	onStageBranch,
	seedVerifiedElaboration,
} from "./_v4-fixtures.mjs"

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

async function withTmpRepo(slug, fn) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-closing-brief-"))
	const stableCwd = tmpdir()
	const origCwd = process.cwd()
	try {
		const repo = initTestRepo({ repoRoot: dir, slug })
		return await fn(repo)
	} finally {
		try {
			process.chdir(origCwd)
		} catch {
			process.chdir(stableCwd)
		}
		rmSync(dir, { recursive: true, force: true })
	}
}

// Build a unit file on the stage branch (mirrors cursor-walk's writeUnit).
function writeUnit(intentDir, stage, name, fm, body = "") {
	const slug = intentDir.split("/").pop() ?? ""
	const repoRoot = intentDir.split("/").slice(0, -3).join("/")
	const path = join(intentDir, "stages", stage, "units", `${name}.md`)
	onStageBranch(repoRoot, slug, stage, () => {
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		writeFileSync(path, matter.stringify(body || `# ${name}\n`, fm))
	})
	return path
}

// Two-stage studio so "design" is non-terminal — the per-stage walk runs its
// tail (approval track → observations → closing brief → complete_stage).
function twoStageStudio(repoRoot) {
	const stage = (name) => ({
		name,
		hats: ["planner", "builder", "verifier"],
		fix_hats: ["builder", "feedback-assessor"],
		review: "ask",
		review_agents: ["code-reviewer"],
	})
	return makeStudio({
		repoRoot,
		studio: "test",
		stages: [stage("design"), stage("build")],
	})
}

// Drive the cursor walk directly on the stage branch. dispatchOrchestratorAction
// reads the current working tree, so we check out the stage branch first (where
// writeUnit committed the unit) — exactly the branch the engine is on when it
// reaches the post-execute approval track.
async function cursorOnStageBranch(repoRoot, slug, stage) {
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		execFileSync("git", ["checkout", "-q", `haiku/${slug}/${stage}`], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		const { clearStudioCache } = await import("../src/studio-reader.js")
		const { dispatchOrchestratorAction } = await import(
			"../src/orchestrator/workflow/run-tick.js"
		)
		clearStudioCache()
		return dispatchOrchestratorAction(slug, "")
	} finally {
		process.chdir(origCwd)
	}
}

// Drive the REAL haiku_run_next handler (not just the cursor walk) so the
// closing-brief gate that lives in run_next's complete_stage path — alongside
// the observations gate, not in derivePosition — is exercised. Mirrors the
// runNextOnce helper in cursor-walk.test.mjs.
async function runNextOnce(slug) {
	const { orchestratorToolHandlers } = await import(
		"../src/tools/orchestrator/index.js"
	)
	const tool = orchestratorToolHandlers.get("haiku_run_next")
	const resp = await tool.handle({ intent: slug })
	const txt = resp.content?.[0]?.text ?? ""
	const m = txt.match(/```json\s*([\s\S]*?)\s*```/)
	if (m) {
		try {
			return JSON.parse(m[1])
		} catch {
			/* fall through */
		}
	}
	const head = txt.split("\n\n---")[0].trim()
	try {
		return JSON.parse(head)
	} catch {
		return { action: "unparsed", raw: txt.slice(0, 200) }
	}
}

// A unit signed on everything EXCEPT the user approval — the NON-AUTOPILOT
// precondition. reviews fully signed (pre-execute review walk satisfied),
// approvals signed for every adversarial role + the quality gate but NOT
// `user`, so the post-execute approval walk stops at the user gate and the
// stage stays the frontier (findCurrentStage does NOT advance past it).
function signedExceptUser() {
	return {
		title: "u1",
		depends_on: [],
		started_at: "t",
		iterations: [
			{ hat: "planner", started_at: "t", completed_at: "t", result: "advance" },
			{ hat: "builder", started_at: "t", completed_at: "t", result: "advance" },
			{ hat: "verifier", started_at: "t", completed_at: "t", result: "advance" },
		],
		reviews: {
			spec: { at: "t" },
			continuity: { at: "t" },
			"cross-stage-consistency": { at: "t" },
			"code-reviewer": { at: "t" },
			user: { at: "t" },
		},
		// Every adversarial approval + the quality gate is signed. ONLY the
		// `user` approval is pending — so the post-execute approval walk
		// (approvalRoles = [spec, continuity, cross-stage-consistency,
		// code-reviewer, quality_gates, user]) stops at the user branch, and
		// the stage stays the frontier (findCurrentStage does NOT advance).
		approvals: {
			spec: { at: "t" },
			continuity: { at: "t" },
			"cross-stage-consistency": { at: "t" },
			"code-reviewer": { at: "t" },
			quality_gates: { at: "t" },
			// user intentionally absent — the human gate is still pending.
		},
		discovery: {},
	}
}

// A fully-signed, quality-gated unit INCLUDING the user approval — the
// AUTOPILOT / prior-stage-merge precondition. With user signed the stage
// completes and findCurrentStage advances, so run_next synthesizes
// complete_stage(design) and the closing brief fires on that path.
function fullySignedUnit() {
	const u = signedExceptUser()
	u.approvals.user = { at: "t" }
	return u
}

// ── Surface A: non-autopilot, before the user gate ──────────────────────────

test("cursor (non-autopilot): adversarial+qg signed, user pending, BRIEF exists, no marker → write_brief(post) before user_gate", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("closing-brief", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		makeIntent({ intentDir, slug, studio: "test" })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", signedExceptUser())
		// BRIEF.md exists with `phase: pre` (the pre-execute brief wrote it) —
		// so the closing-brief gate keys on the frontmatter not yet being post.
		onStageBranch(repoRoot, slug, "design", () => {
			writeFileSync(
				join(intentDir, "stages", "design", "BRIEF.md"),
				"---\nphase: pre\n---\n# Brief\nWhat this stage will deliver.\n",
			)
		})

		const action = await cursorOnStageBranch(repoRoot, slug, "design")
		assert.strictEqual(
			action.action,
			"write_brief",
			`expected closing write_brief before the user gate; got: ${action.action} — ${action.message ?? ""}`,
		)
		assert.strictEqual(action.phase, "post", "closing brief must carry phase: post")
		assert.strictEqual(action.stage, "design")
	})
})

test("cursor (non-autopilot): once BRIEF.md frontmatter is phase: post → falls through to user_gate, does NOT re-emit write_brief", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("closing-brief-done", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		makeIntent({ intentDir, slug, studio: "test" })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", signedExceptUser())
		onStageBranch(repoRoot, slug, "design", () => {
			// BRIEF.md already rewritten with `phase: post` — the in-content
			// signal that flips the closing-brief gate off.
			writeFileSync(
				join(intentDir, "stages", "design", "BRIEF.md"),
				"---\nphase: post\n---\n# Brief\nWhat this stage delivered.\n",
			)
		})

		const action = await cursorOnStageBranch(repoRoot, slug, "design")
		assert.notStrictEqual(
			action.action,
			"write_brief",
			`phase: post stamped: closing brief must not re-emit; got: ${action.action}`,
		)
		assert.strictEqual(
			action.action,
			"user_gate",
			`expected the human approval gate after the closing brief is finalized; got: ${action.action} — ${action.message ?? ""}`,
		)
		assert.strictEqual(action.stage, "design")
	})
})

test("cursor (non-autopilot): closing brief opt-out (brief: false) → straight to user_gate, no closing write_brief", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("closing-brief-opt", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		makeIntent({ intentDir, slug, studio: "test", extraFm: { brief: false } })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", signedExceptUser())
		// brief:false — no BRIEF.md; the closing-brief gate is off entirely.
		const action = await cursorOnStageBranch(repoRoot, slug, "design")
		assert.strictEqual(
			action.action,
			"user_gate",
			`brief:false must skip the closing brief; got: ${action.action}`,
		)
	})
})

// ── Surface B: autopilot / prior-stage merge, in run_next's complete_stage ──

test("run_next (autopilot): user signed, BRIEF exists, no marker → write_brief(post) before the stage merges", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("closing-brief-merge", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		// autotune:true => reflection on, so the observations gate sits just
		// AFTER the closing-brief gate — proving the brief fires first.
		makeIntent({ intentDir, slug, studio: "test", extraFm: { autotune: true } })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", fullySignedUnit())
		onStageBranch(repoRoot, slug, "design", () => {
			writeFileSync(
				join(intentDir, "stages", "design", "BRIEF.md"),
				"---\nphase: pre\n---\n# Brief\nWhat this stage will deliver.\n",
			)
		})

		// Sit on the design branch where the signed unit lives, like a real run.
		process.chdir(repoRoot)
		execFileSync("git", ["checkout", "-q", `haiku/${slug}/design`], {
			cwd: repoRoot,
			stdio: "ignore",
		})

		// design is fully signed and build is next → run_next synthesizes
		// complete_stage(design); the closing-brief gate must fire before the
		// observations gate and before the merge.
		const first = await runNextOnce(slug)
		assert.strictEqual(
			first.action,
			"write_brief",
			`expected closing write_brief before merge; got: ${first.action} — ${JSON.stringify(first).slice(0, 200)}`,
		)
		assert.strictEqual(first.phase, "post", "closing brief must carry phase: post")
		assert.strictEqual(first.stage, "design")
	})
})

test("run_next (autopilot): once BRIEF.md frontmatter is phase: post → closing brief does NOT re-emit; the observations gate takes over", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("closing-brief-merge-done", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		makeIntent({ intentDir, slug, studio: "test", extraFm: { autotune: true } })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", fullySignedUnit())
		onStageBranch(repoRoot, slug, "design", () => {
			// BRIEF.md already rewritten with `phase: post` — the in-content
			// signal that flips the closing-brief gate off on the merge path.
			writeFileSync(
				join(intentDir, "stages", "design", "BRIEF.md"),
				"---\nphase: post\n---\n# Brief\nWhat this stage delivered.\n",
			)
		})

		process.chdir(repoRoot)
		execFileSync("git", ["checkout", "-q", `haiku/${slug}/design`], {
			cwd: repoRoot,
			stdio: "ignore",
		})

		// marker stamped → the closing brief is done; the next gate on the
		// complete_stage path (observations, since reflection is on) takes over.
		const action = await runNextOnce(slug)
		assert.notStrictEqual(
			action.action,
			"write_brief",
			`marker stamped: closing brief must not re-emit on the merge path; got: ${action.action}`,
		)
		assert.strictEqual(
			action.action,
			"record_observations",
			`expected the observations gate after the closing brief is finalized; got: ${action.action} — ${JSON.stringify(action).slice(0, 200)}`,
		)
		assert.strictEqual(action.stage, "design")
	})
})

// ── Regression: the PRE-execute brief still fires as before ─────────────────

test("cursor: pre-execute brief still fires with phase: pre (no regression)", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("pre-brief-regression", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		makeIntent({ intentDir, slug, studio: "test" })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", {
			title: "u1",
			depends_on: [],
			started_at: null,
			iterations: [],
			reviews: {
				spec: { at: "t" },
				continuity: { at: "t" },
				"cross-stage-consistency": { at: "t" },
				"code-reviewer": { at: "t" },
			},
			approvals: {},
			discovery: {},
		})
		const action = await cursorOnStageBranch(repoRoot, slug, "design")
		assert.strictEqual(
			action.action,
			"write_brief",
			`pre-execute brief must still fire; got: ${action.action} — ${action.message ?? ""}`,
		)
		assert.strictEqual(action.phase, "pre", "pre-execute brief must carry phase: pre")
		assert.strictEqual(action.stage, "design")
	})
})

// existsSync imported for parity with the run_next surface helpers; referenced
// here to keep the import meaningful if future assertions check landed files.
void existsSync
