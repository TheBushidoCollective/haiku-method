#!/usr/bin/env npx tsx
// merge-noop-tree-equality.test.mjs
//
// Replay test for the alternating no-op merge wedge reported in
// HAIKU-BUG-merge-loop-after-v0-to-v4-migration.md on 2026-05-11.
//
// Symptom: post-migration on admin-portal-reimagine, haiku_run_next
// emitted alternating merge commits:
//   - merge intent-main → stage inception
//   - merge stage inception into main
// every tick, even though `git diff main..inception --stat` was
// EMPTY. Loop guard fired forever.
//
// Root cause: both ensureOnStageBranch and mergeStageBranchIntoMain
// decided whether to merge using commit-ID comparison (rev-list
// --count) without checking tree contents. With `--no-ff`, each
// merge minted a new no-op merge commit on the target. The new
// commit made the OTHER side look "behind," triggering the
// opposite-direction merge on the next tick.
//
// Fix: tree-equality short-circuit. If both refs point at identical
// trees (`<ref>^{tree}` hashes match), skip the merge entirely. This
// test pins both halves: stage→main short-circuit in
// mergeStageBranchIntoMain, and main→stage short-circuit in
// ensureOnStageBranch.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

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

function setupRepoWithNoopMergeShape() {
	// Build: intent main and stage inception that point at DIFFERENT
	// commits but IDENTICAL trees. This is the exact post-migration
	// shape that triggered the wedge: main has a "merge stage X into
	// main" commit on top, the stage has a "merge main → stage" commit
	// on top, neither changed any tracked file.
	const repo = mkdtempSync(join(tmpdir(), "haiku-noop-merge-"))
	git(repo, "init", "-q")
	git(repo, "config", "user.email", "test@haiku.test")
	git(repo, "config", "user.name", "test")

	const slug = "noop-merge-intent"
	const intentDir = join(repo, ".haiku/intents", slug)
	mkdirSync(join(intentDir, "stages/inception/units"), { recursive: true })
	writeFileSync(join(intentDir, "intent.md"), "---\ntitle: x\n---\nbody\n")
	writeFileSync(
		join(intentDir, "stages/inception/units/unit-01.md"),
		"---\ntitle: u1\n---\n",
	)
	git(repo, "add", "-A")
	git(repo, "commit", "-qm", "seed")
	git(repo, "checkout", "-qb", `haiku/${slug}/main`)
	git(repo, "checkout", "-qb", `haiku/${slug}/inception`)
	git(repo, "checkout", "-q", `haiku/${slug}/main`)
	// Mint an empty commit on main so the topology differs from
	// inception (different commit IDs) while trees stay identical.
	git(repo, "commit", "--allow-empty", "-qm", "haiku: noop on main")
	git(repo, "checkout", "-q", `haiku/${slug}/inception`)
	git(repo, "commit", "--allow-empty", "-qm", "haiku: noop on inception")
	// Sanity: trees identical, commit IDs differ.
	const tA = git(repo, "rev-parse", `haiku/${slug}/main^{tree}`)
	const tB = git(repo, "rev-parse", `haiku/${slug}/inception^{tree}`)
	assert.strictEqual(tA, tB, "fixture setup: trees must be identical")
	const cA = git(repo, "rev-parse", `haiku/${slug}/main`)
	const cB = git(repo, "rev-parse", `haiku/${slug}/inception`)
	assert.notStrictEqual(cA, cB, "fixture setup: commit IDs must differ")
	return { repo, slug }
}

test("mergeStageBranchIntoMain: trees identical → returns noop, no new commit minted", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug } = setupRepoWithNoopMergeShape()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		const { mergeStageBranchIntoMain } = await import("../src/git-worktree.ts")
		const before = git(repo, "rev-parse", `haiku/${slug}/main`)
		const result = mergeStageBranchIntoMain(slug, "inception")
		const after = git(repo, "rev-parse", `haiku/${slug}/main`)
		assert.strictEqual(result.success, true)
		assert.strictEqual(
			result.noop,
			true,
			"identical trees must return noop=true",
		)
		assert.strictEqual(
			before,
			after,
			"no commit must be minted when trees are identical — the wedge driver was --no-ff minting a fresh commit on every tick",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("ensureOnStageBranch: trees identical → skips main→stage merge, no new commit minted", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug } = setupRepoWithNoopMergeShape()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		const { ensureOnStageBranch } = await import("../src/git-worktree.ts")
		// Start on main so ensureOnStageBranch has work to do (switching
		// to the stage branch). The merge-from-main check fires only on
		// the "stage is behind main" path.
		git(repo, "checkout", "-q", `haiku/${slug}/main`)
		const beforeStage = git(repo, "rev-parse", `haiku/${slug}/inception`)
		const result = ensureOnStageBranch(slug, "inception")
		const afterStage = git(repo, "rev-parse", `haiku/${slug}/inception`)
		assert.strictEqual(
			result.ok,
			true,
			`expected ok=true; got: ${result.message}`,
		)
		assert.strictEqual(
			beforeStage,
			afterStage,
			"no commit must be minted on the stage branch when trees are identical — the wedge driver was the merge minting a fresh commit on every tick",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("ensureOnStageBranch + pre-tick: agent on a LATER stage is never switched backwards to an earlier one", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	// Verbatim from project memory (feedback_v4_cursor_algorithm.md +
	// feedback_no_backward_branch_switch.md):
	//   "I merge in main, figure out if I am on the right stage and
	//    ONLY CHANGE if I am on the wrong stage."
	//
	// "Wrong stage" means BEHIND where the cursor walked, not ahead of
	// it. If we're physically on `design` and the cursor's walk says
	// `inception` is current (because some upstream FM hasn't caught
	// up), the agent has ALREADY moved past inception — switching back
	// produces the no-op merge loop reported on 2026-05-11.
	//
	// This test sets up the exact shape: stages [inception, design],
	// agent on design, intent.md FM such that findCurrentStage would
	// return inception (its units lack approval stamps). The pre-tick
	// in haiku_run_next must NOT call ensureOnStageBranch(slug,
	// "inception") — it must leave the agent on design and let the
	// cursor walk produce design's next action.
	const repo = mkdtempSync(join(tmpdir(), "haiku-forward-only-"))
	try {
		git(repo, "init", "-q")
		git(repo, "config", "user.email", "test@haiku.test")
		git(repo, "config", "user.name", "test")
		const slug = "forward-only"
		const intentDir = join(repo, ".haiku/intents", slug)
		const inceptionUnitsDir = join(intentDir, "stages/inception/units")
		const designUnitsDir = join(intentDir, "stages/design/units")
		mkdirSync(inceptionUnitsDir, { recursive: true })
		mkdirSync(designUnitsDir, { recursive: true })

		writeFileSync(
			join(intentDir, "intent.md"),
			`---
title: Forward-only test
studio: software
mode: continuous
plugin_version: 4.0.0
stages: [inception, design]
---
body
`,
		)
		// Inception unit with iterations terminal-advance BUT no
		// approval stamps. findCurrentStage will see this as "not
		// complete" and return inception.
		writeFileSync(
			join(inceptionUnitsDir, "unit-01-foo.md"),
			`---
title: foo
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
---
`,
		)
		// Design unit so the cursor knows design is real and in-flight.
		writeFileSync(
			join(designUnitsDir, "unit-01-bar.md"),
			`---
title: bar
started_at: null
iterations: []
---
`,
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "seed")
		git(repo, "checkout", "-qb", `haiku/${slug}/main`)
		git(repo, "checkout", "-qb", `haiku/${slug}/inception`)
		git(repo, "checkout", "-qb", `haiku/${slug}/design`)

		// Agent is on design. Run a workflow tick and inspect the
		// resulting branch state. The forward-only rule means:
		// regardless of what the cursor returns, the agent's branch
		// must NOT be `haiku/<slug>/inception` after the tick.
		process.chdir(repo)
		const { dispatchOrchestratorAction } = await import(
			"../src/orchestrator/workflow/run-tick.ts"
		)
		await import("../src/orchestrator/migrations/v0-to-v4.ts")
		dispatchOrchestratorAction(slug)
		const finalBranch = git(repo, "rev-parse", "--abbrev-ref", "HEAD")
		assert.notStrictEqual(
			finalBranch,
			`haiku/${slug}/inception`,
			"pre-tick switched agent BACKWARDS from design to inception — forward-only rule violated. " +
				`Final branch: ${finalBranch}`,
		)
	} finally {
		process.chdir(tmpdir())
		rmSync(repo, { recursive: true, force: true })
	}
})

// 2026-05-12 sibling bug: trees differ AND the merge is still a no-op
// because the stage is already an ancestor of intent main.
//
// Topology: intent main has accreted commits from elsewhere (e.g., a
// downstream `dev` sync merged into intent main). Intent main now
// contains everything the stage has PLUS additional content from the
// downstream sync. Trees differ (intent main is a strict superset),
// but `git merge inception` against intent main reports "Already up
// to date" — there is no merge debt. PR #347's tree-equality
// short-circuit caught the prior shape but not this one; the cursor
// kept emitting `merge_stage(inception)` and the loop guard fired
// after 2 iterations.
//
// Fix: `hasNoMergeDebt` also checks `git merge-base --is-ancestor
// stageBranch intentMain`. Either signal kills the no-op merge loop.
function setupRepoWithAncestorOfMainShape() {
	const repo = mkdtempSync(join(tmpdir(), "haiku-ancestor-merge-"))
	git(repo, "init", "-q")
	git(repo, "config", "user.email", "test@haiku.test")
	git(repo, "config", "user.name", "test")

	const slug = "ancestor-of-main"
	const intentDir = join(repo, ".haiku/intents", slug)
	mkdirSync(join(intentDir, "stages/inception/units"), { recursive: true })
	writeFileSync(join(intentDir, "intent.md"), "---\ntitle: x\n---\nbody\n")
	writeFileSync(
		join(intentDir, "stages/inception/units/unit-01.md"),
		"---\ntitle: u1\n---\n",
	)
	git(repo, "add", "-A")
	git(repo, "commit", "-qm", "seed")
	git(repo, "checkout", "-qb", `haiku/${slug}/main`)
	// Fork inception from the seed commit. Inception holds the
	// original tree; main will diverge ahead via new content.
	git(repo, "checkout", "-qb", `haiku/${slug}/inception`)
	git(repo, "checkout", "-q", `haiku/${slug}/main`)
	// Accrete real content on main from "elsewhere" (simulating a
	// mainline → intent-main downstream sync). Inception is now a
	// proper ancestor of main; trees differ because main has new
	// blobs inception doesn't.
	writeFileSync(
		join(repo, "downstream-sync.md"),
		"content from downstream dev sync\n",
	)
	git(repo, "add", "-A")
	git(repo, "commit", "-qm", "haiku: merge dev → intent main (downstream sync)")
	writeFileSync(
		join(repo, "downstream-sync.md"),
		"content from downstream dev sync, second commit\n",
	)
	git(repo, "add", "-A")
	git(repo, "commit", "-qm", "haiku: another downstream commit on intent main")

	// Sanity: trees DIFFER, inception is ancestor of main, no merge debt.
	const tA = git(repo, "rev-parse", `haiku/${slug}/main^{tree}`)
	const tB = git(repo, "rev-parse", `haiku/${slug}/inception^{tree}`)
	assert.notStrictEqual(tA, tB, "fixture setup: trees must differ")
	const inceptionBehindMain = git(
		repo,
		"rev-list",
		"--count",
		`haiku/${slug}/inception..haiku/${slug}/main`,
	)
	assert.notStrictEqual(
		inceptionBehindMain,
		"0",
		"fixture setup: main must have commits inception doesn't",
	)
	const mainBehindInception = git(
		repo,
		"rev-list",
		"--count",
		`haiku/${slug}/main..haiku/${slug}/inception`,
	)
	assert.strictEqual(
		mainBehindInception,
		"0",
		"fixture setup: inception must have NOTHING main doesn't (ancestor topology)",
	)
	return { repo, slug }
}

test("mergeStageBranchIntoMain: stage is ancestor of main → returns noop, no new commit minted", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug } = setupRepoWithAncestorOfMainShape()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		const { mergeStageBranchIntoMain } = await import("../src/git-worktree.ts")
		const before = git(repo, "rev-parse", `haiku/${slug}/main`)
		const result = mergeStageBranchIntoMain(slug, "inception")
		const after = git(repo, "rev-parse", `haiku/${slug}/main`)
		assert.strictEqual(result.success, true)
		assert.strictEqual(
			result.noop,
			true,
			"stage-is-ancestor-of-main must return noop=true — without this guard, the cursor loops on merge_stage forever (admin-portal-reimagine 2026-05-12)",
		)
		assert.strictEqual(
			before,
			after,
			"no commit must be minted when the stage is already an ancestor of main — the merge_stage handler must short-circuit before the --no-ff merge runs",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("isAncestor: detects ancestor relationship from exit code, not stdout", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug } = setupRepoWithAncestorOfMainShape()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		const { isAncestor, hasNoMergeDebt, refsHaveIdenticalTrees } = await import(
			"../src/git-worktree.ts"
		)
		const inception = `haiku/${slug}/inception`
		const intentMain = `haiku/${slug}/main`
		assert.strictEqual(
			isAncestor(inception, intentMain),
			true,
			"inception must be detected as ancestor of intent main",
		)
		assert.strictEqual(
			isAncestor(intentMain, inception),
			false,
			"intent main is NOT an ancestor of inception (main has accreted commits)",
		)
		assert.strictEqual(
			refsHaveIdenticalTrees(inception, intentMain),
			false,
			"trees differ in this topology — the pre-2026-05-12 short-circuit would have missed this case",
		)
		assert.strictEqual(
			hasNoMergeDebt(inception, intentMain),
			true,
			"hasNoMergeDebt must return true when stage is ancestor of main, even though trees differ",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("findCurrentStage: walks past stage with no merge debt even when FM looks incomplete", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	// Force plugin-root resolution to the in-tree plugin so
	// `resolveStudioStages("software")` returns the real stage list.
	// In production this is auto-resolved from `import.meta.url`; under
	// `node --test --import tsx` the resolver doesn't find the plugin
	// from the test file's path. Reset the module-level cache before
	// setting the env so the next `resolvePluginRoot` call picks it up.
	const pluginRoot = join(import.meta.dirname, "..", "..", "..", "plugin")
	const prevPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
	process.env.CLAUDE_PLUGIN_ROOT = pluginRoot
	const { _resetPluginRootForTests } = await import("../src/config.ts")
	_resetPluginRootForTests()
	// The architectural fix: even when per-unit FM in an upstream stage
	// looks "incomplete" (post-migration drift, malformed approval
	// shape, a fix-loop unit that never got re-approved), if the stage
	// branch has NO merge debt against intent main, findCurrentStage
	// MUST walk past it — otherwise the cursor pins on the stage, emits
	// merge_stage, the handler short-circuits as noop, re-tick returns
	// the same action, loop guard fires.
	const repo = mkdtempSync(join(tmpdir(), "haiku-cursor-walks-past-"))
	try {
		git(repo, "init", "-q")
		git(repo, "config", "user.email", "test@haiku.test")
		git(repo, "config", "user.name", "test")
		const slug = "cursor-walks-past-merged"
		const intentDir = join(repo, ".haiku/intents", slug)
		const inceptionUnitsDir = join(intentDir, "stages/inception/units")
		const designUnitsDir = join(intentDir, "stages/design/units")
		mkdirSync(inceptionUnitsDir, { recursive: true })
		mkdirSync(designUnitsDir, { recursive: true })

		writeFileSync(
			join(intentDir, "intent.md"),
			`---
title: Cursor walks past merged stage
studio: software
mode: continuous
plugin_version: 4.0.0
stages: [inception, design]
---
body
`,
		)
		// Inception unit with iterations AND a backfilled approval stamp
		// in a shape that `isUnitFullyApproved` rejects (missing `.at`,
		// boolean instead of object — the v0→v4 backfill drift shape
		// reported on 2026-05-12). FM-only `isStageComplete` says "not
		// complete." But the stage WAS migrated and HAS at least one
		// approval marker, so the corroborating git "no merge debt"
		// signal lets the cursor walk past.
		writeFileSync(
			join(inceptionUnitsDir, "unit-01-foo.md"),
			`---
title: foo
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
approvals:
  spec: true
  user: true
---
`,
		)
		// Design unit so design is the next real stage.
		writeFileSync(
			join(designUnitsDir, "unit-01-bar.md"),
			`---
title: bar
started_at: null
iterations: []
---
`,
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "seed")
		git(repo, "checkout", "-qb", `haiku/${slug}/main`)
		// Inception forks from main and makes its OWN commit, simulating
		// the v3 lifecycle where stage branches accumulate per-unit work
		// commits before merging back. Without this commit, the stage
		// branch would track main exactly and stageWasMergedIntoMain
		// would refuse to walk past it (the test wouldn't exercise the
		// post-migration topology — it'd exercise a fresh-fork topology
		// that should NOT be walked past).
		git(repo, "checkout", "-qb", `haiku/${slug}/inception`)
		writeFileSync(
			join(inceptionUnitsDir, "unit-01-foo-work.md"),
			"# inception's per-unit work\n",
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "haiku(inception): unit-01 work")
		const inceptionWorkHead = git(repo, "rev-parse", "HEAD")
		// Switch back to main and "merge in" inception's history so
		// inception is now an ancestor of main. (Real v3 merge would
		// add a merge commit; for this test a fast-forward is fine —
		// the topology we care about is `is-ancestor` + HEAD difference.)
		git(repo, "checkout", "-q", `haiku/${slug}/main`)
		git(repo, "merge", "--ff-only", "-q", `haiku/${slug}/inception`)
		// Accrete content on main from "downstream sync." Inception is
		// now a proper ancestor of main; trees differ; no merge debt;
		// inception HEAD differs from main HEAD.
		writeFileSync(
			join(repo, "downstream-sync.md"),
			"content from downstream dev sync\n",
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "haiku: merge dev → intent main")
		git(repo, "checkout", "-qb", `haiku/${slug}/design`)
		// Sanity: inception HEAD (frozen at the work commit) ≠ main HEAD.
		assert.strictEqual(
			git(repo, "rev-parse", `haiku/${slug}/inception`),
			inceptionWorkHead,
			"inception branch must hold its own work commit",
		)
		assert.notStrictEqual(
			git(repo, "rev-parse", `haiku/${slug}/inception`),
			git(repo, "rev-parse", `haiku/${slug}/main`),
			"inception HEAD must differ from main HEAD (proves stage had its own history)",
		)

		process.chdir(repo)
		const { findCurrentStage } = await import(
			"../src/orchestrator/workflow/cursor.ts"
		)
		const active = findCurrentStage(slug, "software")
		assert.strictEqual(
			active,
			"design",
			`findCurrentStage must walk past inception (no merge debt) and return design. Got: ${active}. ` +
				"Pre-fix behaviour: returned inception even though git topology showed inception fully reachable from intent main; cursor then emitted merge_stage(inception); handler short-circuited noop; loop guard fired.",
		)
	} finally {
		if (prevPluginRoot === undefined) {
			delete process.env.CLAUDE_PLUGIN_ROOT
		} else {
			process.env.CLAUDE_PLUGIN_ROOT = prevPluginRoot
		}
		process.chdir(tmpdir())
		rmSync(repo, { recursive: true, force: true })
	}
})

test("mergeStageBranchIntoMain: trees DIFFER → merge proceeds normally", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	// Real divergence case — stage has new content. Tree-equality
	// short-circuit must NOT fire; the merge must run and produce a
	// commit on main that captures the stage's new content.
	const repo = mkdtempSync(join(tmpdir(), "haiku-real-merge-"))
	try {
		git(repo, "init", "-q")
		git(repo, "config", "user.email", "test@haiku.test")
		git(repo, "config", "user.name", "test")
		const slug = "real-merge"
		const intentDir = join(repo, ".haiku/intents", slug)
		mkdirSync(join(intentDir, "stages/inception/units"), { recursive: true })
		writeFileSync(join(intentDir, "intent.md"), "---\ntitle: x\n---\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "seed")
		git(repo, "checkout", "-qb", `haiku/${slug}/main`)
		git(repo, "checkout", "-qb", `haiku/${slug}/inception`)
		writeFileSync(
			join(intentDir, "stages/inception/units/unit-01.md"),
			"# real new content\n",
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "stage adds real content")
		process.chdir(repo)
		const { mergeStageBranchIntoMain } = await import("../src/git-worktree.ts")
		const before = git(repo, "rev-parse", `haiku/${slug}/main`)
		const result = mergeStageBranchIntoMain(slug, "inception")
		const after = git(repo, "rev-parse", `haiku/${slug}/main`)
		assert.strictEqual(result.success, true)
		assert.notStrictEqual(
			result.noop,
			true,
			"real divergence must NOT short-circuit as noop",
		)
		assert.notStrictEqual(
			before,
			after,
			"real divergence must produce a merge commit on main",
		)
	} finally {
		process.chdir(tmpdir())
		rmSync(repo, { recursive: true, force: true })
	}
})
