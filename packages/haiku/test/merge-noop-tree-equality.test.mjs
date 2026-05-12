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
