#!/usr/bin/env npx tsx
// post-migration-merge-debt-noop.test.mjs
//
// Pins the wedge reported 2026-05-12 in
// HAIKU-BUG-merge-loop-after-v0-to-v4-migration.md on plugin 4.4.1
// (and 4.4.0, in a different form).
//
// Shape:
//   1. v3 intent migrated to v4: inception fully complete, units have
//      approval stamps backfilled, design mid-flight.
//   2. The agent is on `haiku/<slug>/inception` (where the migration
//      ran). intent main and inception have ALREADY been merged in a
//      previous v3 cycle — their trees are identical though commit IDs
//      differ.
//   3. Pre-cursor sync: trees match at every hop, no-op (good).
//   4. Cursor walks: `findCurrentStage` walks past fully-complete
//      inception, returns `design`. `walkIntentTrack(design)` emits a
//      design-stage action (e.g., `dispatch_review` for design units).
//   5. Post-walk merge-debt synthesis sees:
//        - here is `inception` branch
//        - result.stage is `design`
//        - inception isStageComplete
//      and rewrites the result to `merge_stage(inception)`.
//   6. The merge_stage handler calls `mergeStageBranchIntoMain` which
//      short-circuits as `noop: true` (trees identical) and
//      re-dispatches the cursor. The cursor returns the same design
//      action. The synthesis re-fires. Loop guard fires.
//
// The fix: the synthesis must check tree-equality BEFORE rewriting.
// If inception's tree already matches intent main's tree, there's no
// merge debt — fall through to the post-cursor branch switch instead
// of looping on a no-op merge.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Point CLAUDE_PLUGIN_ROOT at the repo's plugin/ so the software
// studio can be resolved (resolveStudio walks process.cwd() first,
// then this env var). Without this, resolveIntentStages returns []
// and findCurrentStage returns null, which would short-circuit
// derivePosition past the intent track entirely.
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

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

test("post-walk merge_stage synthesis: no-op when previous stage's tree already matches intent main", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const repo = mkdtempSync(join(tmpdir(), "haiku-postmig-noop-"))
	const origCwd = process.cwd()
	try {
		git(repo, "init", "-q", "-b", "main")
		git(repo, "config", "user.email", "test@haiku.test")
		git(repo, "config", "user.name", "test")

		const slug = "admin-portal-reimagine"
		const intentDir = join(repo, ".haiku/intents", slug)
		const inceptionUnitsDir = join(intentDir, "stages/inception/units")
		const designUnitsDir = join(intentDir, "stages/design/units")
		mkdirSync(inceptionUnitsDir, { recursive: true })
		mkdirSync(designUnitsDir, { recursive: true })

		writeFileSync(
			join(intentDir, "intent.md"),
			`---
title: Admin portal reimagine
studio: software
mode: continuous
plugin_version: 4.0.0
stages: [inception, design]
verified_at: '2026-04-27T19:00:00Z'
---
body
`,
		)
		// Inception unit: fully approved (post-migration backfill shape).
		// Use minimal approval-role set ['spec', 'quality_gates', 'user']
		// which is the autopilot/minimal-continuous overlap; the test
		// only needs the cursor to walk past inception, and the post-
		// walk synthesis check is the actual subject under test.
		// Software studio's inception stage has review-agents
		// completeness + feasibility on top of the [spec, quality_gates,
		// user] baseline, so `approvalRolesFor(software, inception,
		// continuous)` returns all five. Stamp every one so
		// `isUnitFullyApproved` returns true and findCurrentStage
		// walks past inception to design.
		const fullyApprovedUnitFm = `---
title: inception unit 1
started_at: '2026-04-27T19:00:00Z'
iterations:
  - hat: researcher
    started_at: '2026-04-27T19:00:00Z'
    completed_at: '2026-04-27T19:01:00Z'
    result: advance
  - hat: verifier
    started_at: '2026-04-27T19:01:00Z'
    completed_at: '2026-04-27T19:02:00Z'
    result: advance
reviews:
  spec:
    at: '2026-04-27T19:03:00Z'
  completeness:
    at: '2026-04-27T19:03:30Z'
  feasibility:
    at: '2026-04-27T19:03:45Z'
approvals:
  spec:
    at: '2026-04-27T19:04:00Z'
  quality_gates:
    at: '2026-04-27T19:05:00Z'
  completeness:
    at: '2026-04-27T19:05:30Z'
  feasibility:
    at: '2026-04-27T19:05:45Z'
  user:
    at: '2026-04-27T19:06:00Z'
---
inception unit body
`
		writeFileSync(
			join(inceptionUnitsDir, "unit-01-foo.md"),
			fullyApprovedUnitFm,
		)
		// Design unit: bare, wave-ready (cursor will emit start_unit_hat
		// for design — the action's `stage` is `design`, distinct from
		// the agent's checked-out `inception`). Omit `started_at`
		// entirely (vs. `started_at: null`) because the cursor's
		// `hasStarted` check uses `typeof fm.started_at === "string"`;
		// a YAML null still survives parsing as `null`, but a missing
		// key reads as `undefined`. Both should be "not started" but
		// being explicit by omission removes ambiguity.
		writeFileSync(
			join(designUnitsDir, "unit-01-bar.md"),
			`---
title: design unit 1
iterations: []
depends_on: []
inputs: ['.haiku/intents/admin-portal-reimagine/intent.md']
---
design unit body
`,
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "seed (post-migration state)")
		// Mirror the user's branch topology: intent main, inception, and
		// design all carry the same tree (the v3 merge already landed
		// inception's units on intent main). Mint distinct empty
		// commits so commit IDs differ but trees stay identical.
		git(repo, "checkout", "-qb", `haiku/${slug}/main`)
		git(repo, "commit", "--allow-empty", "-qm", "haiku: previous v3 merge")
		git(repo, "checkout", "-qb", `haiku/${slug}/inception`)
		git(repo, "commit", "--allow-empty", "-qm", "haiku: inception tip")
		git(repo, "checkout", "-qb", `haiku/${slug}/design`)
		// Pin the topology assumption: inception's tree == intent main's tree.
		const inceptionTree = git(
			repo,
			"rev-parse",
			`haiku/${slug}/inception^{tree}`,
		)
		const mainTree = git(repo, "rev-parse", `haiku/${slug}/main^{tree}`)
		assert.strictEqual(
			inceptionTree,
			mainTree,
			"fixture: inception and intent main must have identical trees (already-merged shape)",
		)
		const inceptionCommit = git(repo, "rev-parse", `haiku/${slug}/inception`)
		const mainCommit = git(repo, "rev-parse", `haiku/${slug}/main`)
		assert.notStrictEqual(
			inceptionCommit,
			mainCommit,
			"fixture: inception and intent main must have different commit IDs (the wedge's signature)",
		)

		// Agent is on inception's branch (where the migration ran).
		git(repo, "checkout", "-q", `haiku/${slug}/inception`)

		// Drive a single workflow tick. The post-walk synthesis should
		// NOT rewrite the result to merge_stage(inception) — there's no
		// merge debt (trees identical).
		process.chdir(repo)
		// run-tick is the closest harness-testable surface that exercises
		// derivePosition; for post-walk synthesis we need haiku_run_next's
		// loop. We assert by topology instead: drive several ticks and
		// verify NO new "merge stage inception into main" commits land
		// on intent main. The fix only matters if the synthesis was
		// re-firing on every tick, so even 3-5 ticks is enough signal.
		const beforeTicks = git(repo, "rev-parse", `haiku/${slug}/main`)
		const { dispatchOrchestratorAction } = await import(
			"../src/orchestrator/workflow/run-tick.ts"
		)
		// run-tick alone doesn't trigger the synthesis (the synthesis
		// lives in haiku_run_next.ts post-cursor-walk). But the wedge
		// was the loop guard firing inside haiku_run_next's
		// merge_stage handler's while-loop. We import haiku_run_next
		// and invoke it directly.
		// (Just call the handler twice; the second call replicates the
		// "re-run" path the user reported.)
		// Sanity-check the fixture: findCurrentStage walks past
		// fully-approved inception and lands on design (this confirms
		// the post-walk synthesis path is reachable — result.stage will
		// be "design" while the agent is checked out on "inception").
		const { findCurrentStage, isStageComplete } = await import(
			"../src/orchestrator/workflow/cursor.ts"
		)
		assert.strictEqual(
			findCurrentStage(slug, "software"),
			"design",
			"fixture: cursor must walk past fully-approved inception to design",
		)
		assert.strictEqual(
			isStageComplete(intentDir, "software", "inception", "continuous"),
			true,
			"fixture: inception must read as complete (synthesis precondition)",
		)

		const { orchestratorToolHandlers } = await import(
			"../src/tools/orchestrator/index.ts"
		)
		const runNextTool = orchestratorToolHandlers.get("haiku_run_next")
		assert.ok(runNextTool, "expected haiku_run_next to be registered")
		const responses = []
		for (let i = 0; i < 3; i++) {
			responses.push(await runNextTool.handle({ intent: slug }))
		}
		const afterTicks = git(repo, "rev-parse", `haiku/${slug}/main`)

		// Assertion 1: no commits land on intent main. The wedge driver
		// in 4.4.0 piled up merge commits; my tree-equality short-
		// circuit in mergeStageBranchIntoMain prevents that part. This
		// pins it.
		assert.strictEqual(
			afterTicks,
			beforeTicks,
			`intent main HEAD must NOT move across ticks when inception's tree already matches main (no merge debt). Saw ${beforeTicks} → ${afterTicks}.`,
		)

		// Assertion 2: NO response should be the loop-guard error. The
		// 4.4.1 wedge: tree-equality stopped new commits but the
		// merge_stage handler's re-dispatch loop kept the cursor
		// returning the same action signature, tripping the loop guard.
		// The fix (tree-equality check in the synthesis itself) means
		// the synthesis no longer rewrites the result when there's no
		// merge debt, so the loop guard never fires.
		for (let i = 0; i < responses.length; i++) {
			const resp = responses[i]
			const text = resp?.content?.[0]?.text ?? ""
			assert.ok(
				!text.includes("loop guard fired"),
				`tick ${i + 1}: response must NOT be a loop guard fire. This is the admin-portal-reimagine wedge of 2026-05-12: post-walk merge_stage synthesis re-firing on an already-merged stage. Response text: ${text.slice(0, 400)}`,
			)
			assert.ok(
				!text.includes("internal loop"),
				`tick ${i + 1}: response must NOT mention internal loop. Response text: ${text.slice(0, 400)}`,
			)
		}

		// And dispatchOrchestratorAction (the cursor walk alone, no
		// synthesis) must NOT itself emit merge_stage(inception). It
		// should emit a design-stage action since findCurrentStage
		// walks past fully-approved inception.
		const cursorResult = dispatchOrchestratorAction(slug)
		assert.notStrictEqual(
			cursorResult.action,
			"complete_stage",
			`Cursor walk must not emit merge_stage when inception is complete and the active stage is design. Saw: ${JSON.stringify(cursorResult)}`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})
