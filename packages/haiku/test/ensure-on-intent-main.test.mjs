#!/usr/bin/env npx tsx
// Tests for `ensureOnIntentMain` — the defensive checkout that re-asserts
// `haiku/<slug>/main` on terminal intent paths (intent_complete, already-
// completed). Uses a REAL git repo in a temp dir so the helper's shell-out
// to `git checkout` is exercised end-to-end.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { ensureOnIntentMain } from "../src/git-worktree.ts"
import { _resetIsGitRepoForTests } from "../src/state-tools.ts"

function git(cwd, ...args) {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

function setupRepo() {
	const root = mkdtempSync(join(tmpdir(), "haiku-ensure-main-"))
	git(root, "init", "-q", "-b", "main")
	git(root, "config", "user.email", "test@test")
	git(root, "config", "user.name", "test")
	writeFileSync(join(root, "seed"), "x")
	git(root, "add", "-A")
	git(root, "commit", "-q", "-m", "seed")
	return root
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

console.log("\n=== ensureOnIntentMain ===")

await test("no-op when already on intent main", () => {
	const root = setupRepo()
	try {
		process.chdir(root)
		git(root, "branch", "haiku/foo/main")
		git(root, "checkout", "-q", "haiku/foo/main")
		const ok = ensureOnIntentMain("foo")
		assert.strictEqual(ok, true)
		assert.strictEqual(
			git(root, "rev-parse", "--abbrev-ref", "HEAD"),
			"haiku/foo/main",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

await test("switches from a stage branch to intent main", () => {
	const root = setupRepo()
	try {
		process.chdir(root)
		git(root, "branch", "haiku/foo/main")
		git(root, "checkout", "-q", "-b", "haiku/foo/development")
		assert.strictEqual(
			git(root, "rev-parse", "--abbrev-ref", "HEAD"),
			"haiku/foo/development",
		)
		const ok = ensureOnIntentMain("foo")
		assert.strictEqual(ok, true)
		assert.strictEqual(
			git(root, "rev-parse", "--abbrev-ref", "HEAD"),
			"haiku/foo/main",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

await test("no-op when intent main does not exist", () => {
	const root = setupRepo()
	try {
		process.chdir(root)
		git(root, "checkout", "-q", "-b", "haiku/foo/development")
		const startingBranch = git(root, "rev-parse", "--abbrev-ref", "HEAD")
		const ok = ensureOnIntentMain("foo")
		// Helper returns true (no-op) and HEAD stays put when intent main
		// doesn't exist — caller is responsible for branch creation.
		assert.strictEqual(ok, true)
		assert.strictEqual(
			git(root, "rev-parse", "--abbrev-ref", "HEAD"),
			startingBranch,
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
