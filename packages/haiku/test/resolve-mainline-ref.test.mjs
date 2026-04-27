#!/usr/bin/env npx tsx
// Tests for resolveMainlineRef — fork-source resolution for new branches.
// Uses real git repos so the rev-parse fallbacks behave authentically.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { resolveMainlineRef } from "../src/git-worktree.ts"
import { _resetIsGitRepoForTests } from "../src/state-tools.ts"

function git(cwd, ...args) {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

function seedRepo(tmp, branch = "main") {
	git(tmp, "init", `--initial-branch=${branch}`)
	git(tmp, "config", "user.email", "test@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	writeFileSync(join(tmp, "README.md"), "# test\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-m", "initial")
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

// Run the non-git test FIRST so the isGitRepo cache doesn't have a stale
// `true` from an earlier test.
console.log("\n=== resolveMainlineRef ===")

await test("returns empty string outside a git repository", () => {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-mainline-nogit-"))
	try {
		process.chdir(tmp)
		assert.strictEqual(resolveMainlineRef(), "")
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

await test("returns local mainline name when it exists locally", () => {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-mainline-local-"))
	try {
		seedRepo(tmp, "main")
		process.chdir(tmp)
		assert.strictEqual(resolveMainlineRef(), "main")
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

await test("returns origin/<mainline> when only the remote ref exists", () => {
	const remote = mkdtempSync(join(tmpdir(), "haiku-mainline-remote-"))
	const seed = mkdtempSync(join(tmpdir(), "haiku-mainline-seed-"))
	const client = mkdtempSync(join(tmpdir(), "haiku-mainline-client-"))
	try {
		// Set up a bare remote with a `main` branch and one commit.
		git(remote, "init", "--bare", "--initial-branch=main")
		seedRepo(seed, "main")
		git(seed, "remote", "add", "origin", remote)
		git(seed, "push", "origin", "main")

		// Client repo: different local branch, no local `main`. Fetch from
		// the remote so `origin/main` exists, and set origin/HEAD so
		// getMainlineBranch's first lookup picks up `main`.
		seedRepo(client, "feat/work")
		git(client, "remote", "add", "origin", remote)
		git(client, "fetch", "origin")
		git(client, "remote", "set-head", "origin", "main")
		process.chdir(client)
		assert.strictEqual(resolveMainlineRef(), "origin/main")
	} finally {
		rmSync(remote, { recursive: true, force: true })
		rmSync(seed, { recursive: true, force: true })
		rmSync(client, { recursive: true, force: true })
	}
})

await test("returns empty string when no main/master ref exists locally or on origin", () => {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-mainline-missing-"))
	try {
		// Initial branch is `feat/work` so neither `main` nor `master`
		// exists, and there's no remote — both fallbacks should fail.
		seedRepo(tmp, "feat/work")
		process.chdir(tmp)
		assert.strictEqual(resolveMainlineRef(), "")
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
