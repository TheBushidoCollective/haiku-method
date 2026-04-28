#!/usr/bin/env npx tsx
// Regression tests for issue #262 concern 3: `.haiku/worktrees/<...>` gitlinks
// leaking into commits via gitCommitState / gitCommitStateBackgroundPush.
//
// Two scenarios are exercised against a real git repo:
//   (a) FRESH — a worktree is registered under `.haiku/worktrees/`, then a
//       state commit fires. The commit must NOT contain any mode-160000
//       entries under `.haiku/worktrees/`.
//   (b) LEGACY — a previous commit on this branch already has a gitlink
//       under `.haiku/worktrees/`. The next state commit must untrack it
//       (no more gitlink in HEAD), without nuking the worktree itself.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
	_resetIsGitRepoForTests,
	gitCommitState,
	gitCommitStateBackgroundPush,
} from "../src/state-tools.ts"

function git(cwd, ...args) {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

function setupRepo() {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-leak-test-"))
	git(tmp, "init", "--initial-branch=main")
	git(tmp, "config", "user.email", "test@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	git(tmp, "commit", "--allow-empty", "-m", "initial")
	mkdirSync(join(tmp, ".haiku", "intents", "demo"), { recursive: true })
	writeFileSync(join(tmp, ".haiku", "intents", "demo", "intent.md"), "seed\n")
	git(tmp, "add", ".haiku")
	git(tmp, "commit", "-m", "seed haiku state")
	return tmp
}

function cleanupRepo(tmp) {
	try {
		// Reap haiku-registered worktrees only (paths under `.haiku/worktrees/`)
		// so we don't try to remove the main working tree itself, which fatals
		// noisily on macOS where /var → /private/var symlink resolution makes a
		// naive equality check unreliable.
		const list = git(tmp, "worktree", "list", "--porcelain")
		for (const line of list.split("\n")) {
			if (!line.startsWith("worktree ")) continue
			const path = line.slice("worktree ".length)
			if (!path.includes("/.haiku/worktrees/")) continue
			try {
				git(tmp, "worktree", "remove", "--force", path)
			} catch {
				/* best effort */
			}
		}
	} catch {
		/* best effort */
	}
	rmSync(tmp, { recursive: true, force: true })
}

/** True if HEAD's tree has any mode-160000 (gitlink) entry under prefix. */
function hasGitlinkUnder(cwd, prefix) {
	const tree = git(cwd, "ls-tree", "-r", "HEAD")
	for (const line of tree.split("\n")) {
		if (!line) continue
		const [mode, , , ...rest] = line.split(/\s+/)
		const path = rest.join(" ")
		if (mode === "160000" && path.startsWith(prefix)) return true
	}
	return false
}

let passed = 0
let failed = 0

async function test(name, fn) {
	const origCwd = process.cwd()
	_resetIsGitRepoForTests()
	try {
		await fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (process.env.VERBOSE) console.error(e)
	} finally {
		process.chdir(origCwd)
		_resetIsGitRepoForTests()
	}
}

console.log("\n=== gitCommitState: worktree-gitlink leak guard (#262) ===")

await test("fresh: registered worktree under .haiku/worktrees/ doesn't leak as gitlink", () => {
	const tmp = setupRepo()
	try {
		process.chdir(tmp)
		// Register a real worktree under `.haiku/worktrees/<slug>/<unit>` —
		// exactly the layout haiku creates for unit / fix-chain branches.
		git(tmp, "branch", "haiku/demo/main", "main")
		const wtPath = join(tmp, ".haiku", "worktrees", "demo", "unit-01")
		mkdirSync(join(tmp, ".haiku", "worktrees"), { recursive: true })
		git(tmp, "worktree", "add", wtPath, "haiku/demo/main")

		// Mutate state so there's actually something to commit.
		writeFileSync(
			join(tmp, ".haiku", "intents", "demo", "intent.md"),
			"changed\n",
		)
		const res = gitCommitState("haiku: state change")
		assert.ok(res.committed, "commit happened")
		assert.ok(
			!hasGitlinkUnder(tmp, ".haiku/worktrees/"),
			"no mode-160000 entry leaked under .haiku/worktrees/",
		)
	} finally {
		cleanupRepo(tmp)
	}
})

await test("legacy: pre-existing gitlink under .haiku/worktrees/ is untracked on next commit", () => {
	const tmp = setupRepo()
	try {
		process.chdir(tmp)
		// Forge a legacy commit that already contains a gitlink at the path,
		// simulating a tree written before the leak guard existed.
		const otherSha = git(tmp, "rev-parse", "HEAD")
		git(
			tmp,
			"update-index",
			"--add",
			"--cacheinfo",
			`160000,${otherSha},.haiku/worktrees/legacy-slug/legacy-unit`,
		)
		git(tmp, "commit", "-m", "legacy: leaked gitlink")
		assert.ok(
			hasGitlinkUnder(tmp, ".haiku/worktrees/"),
			"precondition: legacy gitlink is in HEAD",
		)

		// Mutate state and commit again — the guard should untrack the gitlink.
		writeFileSync(
			join(tmp, ".haiku", "intents", "demo", "intent.md"),
			"post-legacy\n",
		)
		const res = gitCommitState("haiku: post-legacy state change")
		assert.ok(res.committed, "follow-up commit happened")
		assert.ok(
			!hasGitlinkUnder(tmp, ".haiku/worktrees/"),
			"legacy gitlink no longer in HEAD after guarded commit",
		)
	} finally {
		cleanupRepo(tmp)
	}
})

await test("background-push variant applies the same leak guard", () => {
	const tmp = setupRepo()
	try {
		process.chdir(tmp)
		git(tmp, "branch", "haiku/demo/main", "main")
		const wtPath = join(tmp, ".haiku", "worktrees", "demo", "unit-02")
		mkdirSync(join(tmp, ".haiku", "worktrees"), { recursive: true })
		git(tmp, "worktree", "add", wtPath, "haiku/demo/main")

		writeFileSync(
			join(tmp, ".haiku", "intents", "demo", "intent.md"),
			"bg variant\n",
		)
		const res = gitCommitStateBackgroundPush("haiku: bg state change")
		assert.ok(res.committed, "commit happened")
		assert.ok(
			!hasGitlinkUnder(tmp, ".haiku/worktrees/"),
			"background-push variant also blocks gitlink leak",
		)
	} finally {
		cleanupRepo(tmp)
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
