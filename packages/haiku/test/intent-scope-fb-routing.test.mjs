// intent-scope-fb-routing.test.mjs
//
// Regression for haiku-bug-report-2026-05-19 (round 2) — intent-scope
// FBs filed by an intent-completion reviewer (cross-stage-consistency)
// were routed through the current stage's fix-hat chain. The dispatched
// classifier subagents read `{stage: <currentStage>, feedback_id: N}`
// and got `not_found` because the FB lives at intent scope, then
// terminated without closure → cursor re-emitted the same dispatch
// forever.
//
// Fix: walkFeedbackTrack passes `stage: ""` for intent-scope FBs;
// `nextActionForFeedback` resolves the studio-level `fix_hats:` chain
// when the stage is empty.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = fileURLToPath(new URL(".", import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function makeRepo(label) {
	const dir = mkdtempSync(join(tmpdir(), `haiku-intent-fb-${label}-`))
	if (HAS_GIT) {
		execFileSync("git", ["init", "-q", "-b", "main", dir], { stdio: "ignore" })
	}
	return dir
}

/** Seed an intent with the bug-report's shape: stages complete, last
 *  stage `security` still active, and an intent-scope FB filed by the
 *  `cross-stage-consistency` reviewer. */
function seedBugRepro(repoRoot) {
	const slug = "twelve-week-plan-accountability-app"
	const stage = "security"
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(intentDir, "feedback"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	mkdirSync(join(stageDir, "units"), { recursive: true })

	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "Test intent",
			studio: "software",
			mode: "continuous",
			stages: [
				"inception",
				"design",
				"product",
				"development",
				"operations",
				"security",
			],
		}),
	)
	writeFileSync(
		join(stageDir, "state.json"),
		JSON.stringify({
			stage,
			status: "active",
			phase: "review",
			started_at: "2026-05-19T00:00:00Z",
			completed_at: null,
		}),
	)
	// Intent-scope FB filed by the studio-level intent reviewer.
	writeFileSync(
		join(intentDir, "feedback", "001-cross-stage-drift.md"),
		matter.stringify("body\n", {
			title: "Cross-stage drift",
			status: "pending",
			origin: "studio-review",
			author: "cross-stage-consistency",
			author_type: "agent",
			created_at: "2026-05-19T10:00:00Z",
			triaged_at: "2026-05-19T10:00:00Z",
			stage: null,
			targets: { unit: null, invalidates: [] },
			iterations: [],
		}),
	)
	return { intentDir, slug, stage }
}

test("walkFeedbackTrack emits intent-scope dispatch (stage:'') for intent-scope FBs", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("intent-scope-dispatch")
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const { intentDir, stage } = seedBugRepro(repoRoot)
		const cursor = await import(`${SRC}orchestrator/workflow/cursor.ts`)
		const action = cursor.__testOnly.walkFeedbackTrack({
			intentDir,
			studio: "software",
			currentStage: stage,
			intent: { studio: "software" },
		})
		assert.ok(action, "expected a dispatch action for the open intent-scope FB")
		assert.strictEqual(action.kind, "start_feedback_hat")
		assert.strictEqual(action.dispatches.length, 1)
		const d = action.dispatches[0]
		assert.strictEqual(
			d.feedback_id,
			"FB-001",
			"intent-scope FB-001 must be in the dispatch",
		)
		assert.strictEqual(
			d.stage,
			"",
			`intent-scope FB must dispatch with empty stage so the subagent reads it at intent scope; got stage="${d.stage}"`,
		)
		// Hat must come from the studio fix-hats list. The software studio
		// ships `fix-hats/reconciler.md` + `fix-hats/validator.md`; the
		// first (alphabetical) is `reconciler` — pre-fix the cursor
		// returned the stage chain's first hat (`classifier`) instead.
		assert.notStrictEqual(
			d.hat,
			"classifier",
			"intent-scope FB must NOT route through the stage's fix-hat chain (would land on classifier)",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("nextActionForFeedback uses studio fix-hats when stage is empty", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("next-action")
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const { intentDir } = seedBugRepro(repoRoot)
		const cursor = await import(`${SRC}orchestrator/workflow/cursor.ts`)
		const fbPath = join(intentDir, "feedback", "001-cross-stage-drift.md")
		const action = cursor.__testOnly.nextActionForFeedback(
			"",
			fbPath,
			"software",
		)
		assert.ok(action, "expected an action for an open intent-scope FB")
		assert.strictEqual(action.kind, "start_feedback_hat")
		const d = action.dispatches[0]
		assert.strictEqual(d.stage, "")
		assert.ok(
			d.hat,
			"intent-scope dispatch must name a fix-hat from the studio chain",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
