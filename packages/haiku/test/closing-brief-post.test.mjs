#!/usr/bin/env npx tsx
// closing-brief-post.test.mjs — the POST-execute closing BRIEF (#17).
//
// The pre-execute BRIEF ("this is what I am going to do") is written in the
// review walk, keyed on BRIEF.md absence (covered in cursor-walk.test.mjs).
// This file pins the POST-execute counterpart: after every approval is
// signed, the quality gates have run, and observations are recorded, the
// cursor must emit `write_brief` with `phase: "post"` ("this is what I did")
// ONCE — keyed on a one-shot `.brief-finalized` marker (BRIEF.md already
// exists from the pre firing, so absence can't gate the closing brief).
// Once the marker is stamped, the cursor falls through to complete_stage and
// does NOT re-emit. The pre-execute brief must still fire as before.
//
// These tests drive the CURSOR WALK directly via dispatchOrchestratorAction
// (sitting on the stage branch), NOT the runTickWithBranchAlignment fixture.
// That fixture synthesizes a pre-merge `complete_stage` from a units-only
// isStageComplete BEFORE the cursor walk runs — a test-harness shortcut that
// would preempt the closing-brief gate that lives inside derivePosition's
// per-stage walk. The real haiku_run_next runs the cursor walk, so the walk
// (and the gate) is the authoritative surface to assert against.
//
// Studios are TWO-stage (design + build) so "design" is NON-terminal. The
// closing brief is a per-stage CLOSE behavior: it fires in the per-stage
// walk just before complete_stage. A studio's TERMINAL stage, once its units
// finish, makes findCurrentStage return null and routes to the
// intent-completion track — a separate scope that doesn't carry the
// per-stage closing brief. The existing observations gate has the same shape
// (see the obs-gate test's two-stage setup in cursor-walk.test.mjs).

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

// A fully-approved, quality-gated unit — the post-execute precondition.
// reflection OFF (autotune defaults off in fixtures) so the observations
// gate doesn't precede the closing brief; that isolates the closing brief as
// the action just before complete_stage.
function fullySignedUnit() {
	return {
		title: "u1",
		depends_on: [],
		started_at: "t",
		iterations: [
			{ hat: "planner", started_at: "t", completed_at: "t", result: "advance" },
			{ hat: "builder", started_at: "t", completed_at: "t", result: "advance" },
			{ hat: "verifier", started_at: "t", completed_at: "t", result: "advance" },
		],
		reviews: { spec: { at: "t" }, "code-reviewer": { at: "t" }, user: { at: "t" } },
		approvals: {
			spec: { at: "t" },
			"code-reviewer": { at: "t" },
			user: { at: "t" },
			quality_gates: { at: "t" },
		},
		discovery: {},
	}
}

test("cursor: all approvals + qg signed, BRIEF exists, no marker → write_brief(post) before complete_stage", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("closing-brief", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		makeIntent({ intentDir, slug, studio: "test" })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", fullySignedUnit())
		// BRIEF.md already exists (the pre-execute brief wrote it) — so the
		// closing-brief gate can only be the `.brief-finalized` marker.
		onStageBranch(repoRoot, slug, "design", () => {
			writeFileSync(
				join(intentDir, "stages", "design", "BRIEF.md"),
				"# Brief\nWhat this stage will deliver.\n",
			)
		})

		const action = await cursorOnStageBranch(repoRoot, slug, "design")
		assert.strictEqual(
			action.action,
			"write_brief",
			`expected closing write_brief before complete_stage; got: ${action.action} — ${action.message ?? ""}`,
		)
		assert.strictEqual(action.phase, "post", "closing brief must carry phase: post")
		assert.strictEqual(action.stage, "design")
	})
})

test("cursor: once .brief-finalized is stamped → falls through to complete_stage, does NOT re-emit write_brief", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("closing-brief-done", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		makeIntent({ intentDir, slug, studio: "test" })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", fullySignedUnit())
		onStageBranch(repoRoot, slug, "design", () => {
			writeFileSync(
				join(intentDir, "stages", "design", "BRIEF.md"),
				"# Brief\nWhat this stage delivered.\n",
			)
			// The closing-brief dispatch's marker — its presence flips the gate off.
			writeFileSync(
				join(intentDir, "stages", "design", ".brief-finalized"),
				new Date().toISOString(),
			)
		})

		const action = await cursorOnStageBranch(repoRoot, slug, "design")
		assert.notStrictEqual(
			action.action,
			"write_brief",
			`marker stamped: closing brief must not re-emit; got: ${action.action}`,
		)
		assert.strictEqual(
			action.action,
			"complete_stage",
			`expected complete_stage after the closing brief is finalized; got: ${action.action} — ${action.message ?? ""}`,
		)
		assert.strictEqual(action.stage, "design")
	})
})

test("cursor: closing brief opt-out (brief: false) → straight to complete_stage, no closing write_brief", async () => {
	if (!HAS_GIT) return
	await withTmpRepo("closing-brief-opt", async ({ repoRoot, intentDir, slug }) => {
		twoStageStudio(repoRoot)
		makeIntent({ intentDir, slug, studio: "test", extraFm: { brief: false } })
		seedVerifiedElaboration({ intentDir, stage: "design" })
		writeUnit(intentDir, "design", "unit-01", fullySignedUnit())
		// brief:false — no BRIEF.md, no marker; the closing-brief gate is off.
		const action = await cursorOnStageBranch(repoRoot, slug, "design")
		assert.strictEqual(
			action.action,
			"complete_stage",
			`brief:false must skip the closing brief; got: ${action.action}`,
		)
	})
})

// Regression: the PRE-execute brief still fires as before (no marker, no
// BRIEF.md, units not started, reviews signed) and carries phase: "pre".
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
