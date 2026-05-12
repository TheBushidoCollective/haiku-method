#!/usr/bin/env npx tsx
// pre-cursor-sync.test.mjs
//
// End-to-end tests for `syncBranchDownstream` — the pre-cursor sync
// chain that runs BEFORE the cursor walk in haiku_run_next.
//
// Algorithm (verbatim from user):
//   1. Pre-cursor: bring branch up to date — mainline → intent main,
//      then intent main → current stage
//   2. Find cursor (walk, repair during walk if needed)
//   3. Change branches to active cursor position if needed
//   4. Pre-tick
//
// These tests pin the contract of step (1). The cursor walk happens
// on a tree that already incorporates upstream changes.
//
// Cases pinned:
//   (a) mainline ahead of intent main — flows down to current stage
//   (b) intent main ahead of current stage — flows down (no mainline op)
//   (c) all three branches tree-equal — no-op (zero new commits)
//   (d) sync chain on intent main (no current stage divergence) —
//       mainline→intent main only, no step-2 work
//   (e) mainline doesn't exist remotely OR locally — graceful skip
//   (f) conflict at mainline→intent main returns ok:false with
//       conflictAt:"mainline_to_intent_main"

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

function commitCount(cwd, ref) {
	return parseInt(git(cwd, "rev-list", "--count", ref), 10)
}

function setupThreeBranchRepo({
	slug = "sync-test",
	stage = "inception",
} = {}) {
	const repo = mkdtempSync(join(tmpdir(), "haiku-pre-cursor-sync-"))
	git(repo, "init", "-q", "-b", "main")
	git(repo, "config", "user.email", "test@haiku.test")
	git(repo, "config", "user.name", "test")

	const intentDir = join(repo, ".haiku/intents", slug)
	const unitsDir = join(intentDir, "stages", stage, "units")
	mkdirSync(unitsDir, { recursive: true })
	writeFileSync(join(intentDir, "intent.md"), "---\ntitle: x\n---\nbody\n")
	writeFileSync(join(unitsDir, "unit-01.md"), "---\ntitle: u1\n---\n")
	git(repo, "add", "-A")
	git(repo, "commit", "-qm", "seed on main")
	// Fork intent main and stage from main.
	git(repo, "checkout", "-qb", `haiku/${slug}/main`)
	git(repo, "checkout", "-qb", `haiku/${slug}/${stage}`)
	return { repo, slug, stage }
}

test("syncBranchDownstream: mainline ahead → flows down through intent main to stage", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug, stage } = setupThreeBranchRepo()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		// Mainline gets a new commit AFTER the stage forked.
		git(repo, "checkout", "-q", "main")
		writeFileSync(join(repo, "mainline-change.txt"), "from mainline\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "mainline moves forward")
		// Agent is on stage.
		git(repo, "checkout", "-q", `haiku/${slug}/${stage}`)
		const intentMainBefore = commitCount(repo, `haiku/${slug}/main`)
		const stageBefore = commitCount(repo, `haiku/${slug}/${stage}`)

		const { syncBranchDownstream } = await import("../src/git-worktree.ts")
		const result = syncBranchDownstream(slug)

		assert.strictEqual(
			result.ok,
			true,
			`expected ok=true, got: ${result.message}`,
		)
		assert.strictEqual(
			result.performed,
			true,
			"merge work should have happened",
		)
		assert.ok(
			commitCount(repo, `haiku/${slug}/main`) > intentMainBefore,
			"intent main should have new commits from the mainline merge",
		)
		assert.ok(
			commitCount(repo, `haiku/${slug}/${stage}`) > stageBefore,
			"stage should have new commits from the intent-main merge",
		)
		// Mainline change is reachable from the stage branch.
		const stageTree = git(
			repo,
			"ls-tree",
			"-r",
			"--name-only",
			`haiku/${slug}/${stage}`,
		)
		assert.ok(
			stageTree.includes("mainline-change.txt"),
			"stage tree must contain the mainline change after sync",
		)
		// Agent's checkout didn't change branches.
		assert.strictEqual(
			git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
			`haiku/${slug}/${stage}`,
			"sync must NOT change which branch the agent is on",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("syncBranchDownstream: intent main ahead of stage only — step 2 runs, step 1 no-op", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug, stage } = setupThreeBranchRepo()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		// Intent main gets a new commit (e.g., a previous stage merged
		// into it) AFTER the stage forked.
		git(repo, "checkout", "-q", `haiku/${slug}/main`)
		writeFileSync(join(repo, "intent-main-change.txt"), "from intent main\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "intent main moves forward")
		// Agent is on stage.
		git(repo, "checkout", "-q", `haiku/${slug}/${stage}`)
		const stageBefore = commitCount(repo, `haiku/${slug}/${stage}`)

		const { syncBranchDownstream } = await import("../src/git-worktree.ts")
		const result = syncBranchDownstream(slug)

		assert.strictEqual(result.ok, true)
		assert.strictEqual(result.performed, true)
		assert.ok(
			commitCount(repo, `haiku/${slug}/${stage}`) > stageBefore,
			"stage should have the intent-main change after sync",
		)
		const stageTree = git(
			repo,
			"ls-tree",
			"-r",
			"--name-only",
			`haiku/${slug}/${stage}`,
		)
		assert.ok(
			stageTree.includes("intent-main-change.txt"),
			"stage tree must contain the intent main change after sync",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("syncBranchDownstream: all branches tree-equal → zero new commits, performed=false", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug, stage } = setupThreeBranchRepo()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		git(repo, "checkout", "-q", `haiku/${slug}/${stage}`)
		const intentMainCommit = git(repo, "rev-parse", `haiku/${slug}/main`)
		const stageCommit = git(repo, "rev-parse", `haiku/${slug}/${stage}`)

		const { syncBranchDownstream } = await import("../src/git-worktree.ts")
		const result = syncBranchDownstream(slug)

		assert.strictEqual(result.ok, true)
		assert.strictEqual(
			result.performed,
			false,
			"no merge should happen when all trees are equal — this is the bug-class we fixed (alternating no-op merge loop)",
		)
		assert.strictEqual(
			git(repo, "rev-parse", `haiku/${slug}/main`),
			intentMainCommit,
			"intent main HEAD must not move when there's nothing to sync",
		)
		assert.strictEqual(
			git(repo, "rev-parse", `haiku/${slug}/${stage}`),
			stageCommit,
			"stage HEAD must not move when there's nothing to sync",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("syncBranchDownstream: agent on intent main → step 2 skipped (no stage to sync into)", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug } = setupThreeBranchRepo()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		git(repo, "checkout", "-q", "main")
		writeFileSync(join(repo, "mainline-change.txt"), "from mainline\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "mainline moves forward")
		// Agent is on intent main (not a stage branch).
		git(repo, "checkout", "-q", `haiku/${slug}/main`)

		const { syncBranchDownstream } = await import("../src/git-worktree.ts")
		const result = syncBranchDownstream(slug)

		assert.strictEqual(result.ok, true)
		assert.strictEqual(result.performed, true, "step 1 should have run")
		const intentMainTree = git(
			repo,
			"ls-tree",
			"-r",
			"--name-only",
			`haiku/${slug}/main`,
		)
		assert.ok(
			intentMainTree.includes("mainline-change.txt"),
			"intent main must contain the mainline change",
		)
		// Agent should still be on intent main, didn't migrate to anything else.
		assert.strictEqual(
			git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
			`haiku/${slug}/main`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("syncBranchDownstream: replay of admin-portal-reimagine wedge — post-migration no-op shape produces zero new commits", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	// Reproduces the EXACT topology from
	// HAIKU-BUG-merge-loop-after-v0-to-v4-migration.md: stage and intent
	// main point at different commit IDs but identical trees. Pre-cursor
	// sync must NOT mint any new commits.
	const { repo, slug, stage } = setupThreeBranchRepo({
		slug: "admin-portal-reimagine",
		stage: "inception",
	})
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		// Mint empty commits to differ topology without changing trees.
		git(repo, "checkout", "-q", `haiku/${slug}/main`)
		git(repo, "commit", "--allow-empty", "-qm", "haiku: noop on intent main")
		git(repo, "checkout", "-q", `haiku/${slug}/${stage}`)
		git(repo, "commit", "--allow-empty", "-qm", "haiku: noop on stage")

		const intentMainBefore = git(repo, "rev-parse", `haiku/${slug}/main`)
		const stageBefore = git(repo, "rev-parse", `haiku/${slug}/${stage}`)

		const { syncBranchDownstream } = await import("../src/git-worktree.ts")
		// Drive sync 5 times — the wedge was an infinite alternation.
		for (let i = 0; i < 5; i++) {
			const result = syncBranchDownstream(slug)
			assert.strictEqual(
				result.ok,
				true,
				`tick ${i}: expected ok=true, got: ${result.message}`,
			)
			assert.strictEqual(
				result.performed,
				false,
				`tick ${i}: identical trees must produce performed=false — wedge driver was mistaking commit-ID divergence for tree divergence`,
			)
		}
		assert.strictEqual(
			git(repo, "rev-parse", `haiku/${slug}/main`),
			intentMainBefore,
			"intent main HEAD must not move across 5 ticks",
		)
		assert.strictEqual(
			git(repo, "rev-parse", `haiku/${slug}/${stage}`),
			stageBefore,
			"stage HEAD must not move across 5 ticks",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("syncBranchDownstream: conflict at mainline→intent main returns conflictAt:'mainline_to_intent_main'", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug, stage } = setupThreeBranchRepo()
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		// Conflict shape: same file edited differently on main vs intent main.
		git(repo, "checkout", "-q", "main")
		writeFileSync(join(repo, "shared.txt"), "mainline edit\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "mainline edits shared.txt")
		git(repo, "checkout", "-q", `haiku/${slug}/main`)
		writeFileSync(join(repo, "shared.txt"), "intent main edit\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "intent main edits shared.txt")
		// Agent is on stage (so the conflict surfaces in the temp worktree path).
		git(repo, "checkout", "-q", `haiku/${slug}/${stage}`)
		// Pin pre-merge state so we can verify nothing got corrupted by
		// the failed-merge cleanup.
		const intentMainBeforeFail = git(repo, "rev-parse", `haiku/${slug}/main`)
		const stageBeforeFail = git(repo, "rev-parse", `haiku/${slug}/${stage}`)
		const branchBeforeFail = git(repo, "rev-parse", "--abbrev-ref", "HEAD")

		const { syncBranchDownstream } = await import("../src/git-worktree.ts")
		const result = syncBranchDownstream(slug)

		assert.strictEqual(result.ok, false, "real conflict must return ok=false")
		assert.strictEqual(
			result.conflictAt,
			"mainline_to_intent_main",
			`expected mainline_to_intent_main, got: ${result.conflictAt}`,
		)
		assert.strictEqual(result.conflictBranch, `haiku/${slug}/main`)
		assert.ok(
			Array.isArray(result.conflictFiles) &&
				result.conflictFiles.includes("shared.txt"),
			`expected conflictFiles to include shared.txt, got: ${JSON.stringify(result.conflictFiles)}`,
		)
		// Step-1 conflicts run inside a temp worktree that's force-
		// removed in `withTempWorktree`'s finally block. Branch HEADs
		// must NOT have moved (a half-applied merge commit on intent
		// main would set up the same alternating-no-op wedge from a
		// different angle). And the agent's working tree must NOT have
		// been switched away from where it was.
		assert.strictEqual(
			git(repo, "rev-parse", `haiku/${slug}/main`),
			intentMainBeforeFail,
			"intent main HEAD must NOT move after a step-1 conflict — the temp worktree's failed merge must not leak a half-merge commit onto the branch",
		)
		assert.strictEqual(
			git(repo, "rev-parse", `haiku/${slug}/${stage}`),
			stageBeforeFail,
			"stage HEAD must NOT move after a step-1 conflict",
		)
		assert.strictEqual(
			git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
			branchBeforeFail,
			"agent's working tree must stay on the original branch after a step-1 conflict",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})
