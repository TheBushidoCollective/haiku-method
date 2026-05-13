#!/usr/bin/env npx tsx
// worktree-lock-guard.test.mjs — locked-worktree branch-switch contract.
//
// Original 2026-05-06 contract: `ensureOnStageBranch` refused every
// branch switch on a locked worktree to block a hijack scenario. That
// turned out to be the wrong cut. `git worktree lock` only protects
// the worktree from `git worktree remove` / pruning — branch switching
// inside a locked worktree is a normal, supported operation. The
// engine's per-intent worktree pattern parks intents under
// `.claude/worktrees/<slug>/` (always locked) and runs ticks against
// them, each tick needing branch switches as the cursor advances.
// The 2026-05-06 hard-refuse made every parked-intent tick fail with
// `worktree_locked`. Removed 2026-05-13.
//
// This file now pins the inverse: `isCurrentWorktreeLocked` still
// reports lock state (so callers that care for OTHER reasons — e.g.
// "don't auto-`git worktree remove` this" — can check), but
// `ensureOnStageBranch` no longer hard-refuses on locked worktrees.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

async function withLockedWorktree(fn) {
	const root = mkdtempSync(join(tmpdir(), "haiku-lock-guard-"))
	const orig = process.cwd()
	try {
		git(root, "init", "-q")
		git(root, "config", "user.email", "test@haiku.test")
		git(root, "config", "user.name", "haiku test")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		git(root, "checkout", "-q", "-b", "haiku/test-intent/main")
		// Mark the primary worktree as locked. The lock file path is
		// <git-dir>/locked for the primary repo (vs added worktrees
		// where it's <git-dir>/worktrees/<name>/locked).
		const gitDir = git(root, "rev-parse", "--git-dir")
		const lockedPath = join(
			gitDir.startsWith("/") ? gitDir : join(root, gitDir),
			"locked",
		)
		writeFileSync(lockedPath, "v4-engine-refactor in flight\n")
		process.chdir(root)
		await fn(root)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(root, { recursive: true, force: true })
	}
}

test("isCurrentWorktreeLocked reads the lock file", async () => {
	if (!HAS_GIT) return
	await withLockedWorktree(async () => {
		const { isCurrentWorktreeLocked } = await import("../src/git-worktree.ts")
		assert.strictEqual(isCurrentWorktreeLocked(), true)
	})
})

test("ensureOnStageBranch allows checkout on a locked worktree (locked != frozen)", async () => {
	if (!HAS_GIT) return
	await withLockedWorktree(async (root) => {
		// Per the 2026-05-13 contract: `git worktree lock` only blocks
		// `git worktree remove`. Branch switching is supported. The
		// engine's parked-intent worktrees are always locked AND
		// constantly switch branches as ticks advance — refusing the
		// switch would wedge every parked intent.
		git(root, "branch", "haiku/foreign-intent/main")
		const { ensureOnStageBranch } = await import("../src/git-worktree.ts")
		const result = ensureOnStageBranch("foreign-intent", undefined)
		assert.strictEqual(result.ok, true)
		// Block field must NOT be `worktree_locked` (no such block any more).
		assert.notStrictEqual(result.block, "worktree_locked")
		const cur = git(root, "rev-parse", "--abbrev-ref", "HEAD")
		assert.strictEqual(cur, "haiku/foreign-intent/main")
	})
})

test("ensureOnStageBranch on locked worktree already on target branch is a no-op success", async () => {
	if (!HAS_GIT) return
	await withLockedWorktree(async () => {
		const { ensureOnStageBranch } = await import("../src/git-worktree.ts")
		// Current branch IS haiku/test-intent/main. Asking for that
		// same branch should succeed (no checkout needed).
		const result = ensureOnStageBranch("test-intent", undefined)
		assert.strictEqual(result.ok, true)
		assert.strictEqual(result.switched, false)
	})
})

test("ensureOnStageBranch on UNLOCKED worktree allows checkout (sanity baseline)", async () => {
	if (!HAS_GIT) return
	const root = mkdtempSync(join(tmpdir(), "haiku-unlocked-"))
	const orig = process.cwd()
	try {
		git(root, "init", "-q")
		git(root, "config", "user.email", "test@haiku.test")
		git(root, "config", "user.name", "haiku test")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		git(root, "checkout", "-q", "-b", "haiku/foreign/main")
		git(root, "branch", "haiku/test-intent/main")
		process.chdir(root)
		const { ensureOnStageBranch } = await import("../src/git-worktree.ts")
		const result = ensureOnStageBranch("test-intent", undefined)
		// Either ok: true switched or ok: false with a non-locked block.
		// What we're proving is: if it failed, it's NOT because of the
		// lock guard.
		if (!result.ok) {
			assert.notStrictEqual(result.block, "worktree_locked")
		}
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(root, { recursive: true, force: true })
	}
})
