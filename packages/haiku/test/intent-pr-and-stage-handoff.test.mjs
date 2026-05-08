#!/usr/bin/env npx tsx
// Unit tests for the intent draft-PR + stage-branch handoff helpers.
//
// These tests cover the paths that don't shell out to gh / glab:
//   - openIntentDraftPullRequest's no-git-repo path
//   - markPullRequestReady's URL parsing + provider detection
//   - pushStageBranch's no-remote / no-branch / disabled-by-env skips
//   - branchAheadOfOrigin's basic logic in a fresh repo
//
// We don't shim gh / glab here — there's no existing pattern in the
// suite for that, and the helpers are written so the no-CLI / no-remote
// paths are the ones most likely to wedge a real user. Coverage of the
// happy-path PR creation lives at the integration level (a real repo
// with gh on PATH).

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const {
	branchAheadOfOrigin,
	markPullRequestReady,
	openIntentDraftPullRequest,
	pushStageBranch,
} = await import("../src/git-worktree.ts")
const { _resetIsGitRepoForTests } = await import("../src/state/shared.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	// isGitRepo is module-cached on first hit. Reset between tests so
	// each one's chdir() into a fresh repo / non-repo gets re-detected.
	_resetIsGitRepoForTests()
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}`)
		console.log(`    ${err.message}`)
		if (err.stack)
			console.log(`    ${err.stack.split("\n").slice(1, 4).join("\n    ")}`)
	}
}

function withCwd(dir, fn) {
	const prev = process.cwd()
	process.chdir(dir)
	try {
		return fn()
	} finally {
		process.chdir(prev)
	}
}

function makeRepo() {
	const dir = mkdtempSync(join(tmpdir(), "haiku-pr-handoff-"))
	execFileSync("git", ["init", "--initial-branch=main"], {
		cwd: dir,
		stdio: "pipe",
	})
	execFileSync("git", ["config", "user.email", "test@example.com"], {
		cwd: dir,
		stdio: "pipe",
	})
	execFileSync("git", ["config", "user.name", "test"], {
		cwd: dir,
		stdio: "pipe",
	})
	writeFileSync(join(dir, "README.md"), "# test\n")
	execFileSync("git", ["add", "."], { cwd: dir, stdio: "pipe" })
	execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "pipe" })
	return dir
}

function makeNonRepo() {
	return mkdtempSync(join(tmpdir(), "haiku-pr-not-repo-"))
}

console.log("=== openIntentDraftPullRequest ===")

test("no-git-repo path returns benign message, no exception", () => {
	const dir = makeNonRepo()
	withCwd(dir, () => {
		const r = openIntentDraftPullRequest({ slug: "test-intent" })
		assert.strictEqual(r.branch, "haiku/test-intent/main")
		assert.match(r.message, /Not a git repo/i)
		// No createdUrl, no compareUrl, no error explosion.
		assert.strictEqual(r.createdUrl, undefined)
	})
	rmSync(dir, { recursive: true, force: true })
})

console.log("\n=== markPullRequestReady ===")

test("empty url returns benign error", () => {
	const r = markPullRequestReady("")
	assert.strictEqual(r.ok, false)
	assert.match(r.error, /empty url/i)
})

test("invalid url returns benign error (no throw)", () => {
	const r = markPullRequestReady("not a url at all")
	assert.strictEqual(r.ok, false)
	assert.match(r.error, /not a valid URL/i)
})

test("unrecognised provider host surfaces in error", () => {
	const r = markPullRequestReady("https://example.com/foo/bar")
	assert.strictEqual(r.ok, false)
	assert.match(r.error, /unrecognised provider host/i)
})

test("gitlab URL without iid returns parse error", () => {
	const r = markPullRequestReady("https://gitlab.com/owner/project/-/branches")
	assert.strictEqual(r.ok, false)
	assert.match(r.error, /could not parse MR iid/i)
})

console.log("\n=== pushStageBranch ===")

test("not-a-git-repo skips cleanly", () => {
	const dir = makeNonRepo()
	withCwd(dir, () => {
		const r = pushStageBranch("test-intent", "design")
		assert.strictEqual(r.ok, true)
		assert.strictEqual(r.skipped, true)
	})
	rmSync(dir, { recursive: true, force: true })
})

test("HAIKU_NO_AUTO_PUSH=1 short-circuits the push", () => {
	const dir = makeRepo()
	withCwd(dir, () => {
		const prev = process.env.HAIKU_NO_AUTO_PUSH
		process.env.HAIKU_NO_AUTO_PUSH = "1"
		try {
			const r = pushStageBranch("test-intent", "design")
			assert.strictEqual(r.ok, true)
			assert.strictEqual(r.skipped, true)
		} finally {
			if (prev === undefined) delete process.env.HAIKU_NO_AUTO_PUSH
			else process.env.HAIKU_NO_AUTO_PUSH = prev
		}
	})
	rmSync(dir, { recursive: true, force: true })
})

test("missing branch skips cleanly (no error)", () => {
	const dir = makeRepo()
	withCwd(dir, () => {
		// haiku/test-intent/design doesn't exist in this fresh repo.
		const r = pushStageBranch("test-intent", "design")
		assert.strictEqual(r.ok, true)
		assert.strictEqual(r.skipped, true)
	})
	rmSync(dir, { recursive: true, force: true })
})

test("no-origin-remote skips cleanly even when branch exists", () => {
	const dir = makeRepo()
	withCwd(dir, () => {
		execFileSync("git", ["branch", "haiku/test-intent/design"], {
			cwd: dir,
			stdio: "pipe",
		})
		// No `git remote add origin` — push should skip without erroring.
		const r = pushStageBranch("test-intent", "design")
		assert.strictEqual(r.ok, true)
		assert.strictEqual(r.skipped, true)
	})
	rmSync(dir, { recursive: true, force: true })
})

console.log("\n=== branchAheadOfOrigin ===")

test("no-git-repo returns false (treats as nothing-to-push)", () => {
	const dir = makeNonRepo()
	withCwd(dir, () => {
		assert.strictEqual(branchAheadOfOrigin("any-branch"), false)
	})
	rmSync(dir, { recursive: true, force: true })
})

test("missing branch returns false", () => {
	const dir = makeRepo()
	withCwd(dir, () => {
		assert.strictEqual(branchAheadOfOrigin("nonexistent-branch"), false)
	})
	rmSync(dir, { recursive: true, force: true })
})

test("local branch with no origin counterpart returns true (push needed)", () => {
	const dir = makeRepo()
	withCwd(dir, () => {
		execFileSync("git", ["branch", "haiku/test/design"], {
			cwd: dir,
			stdio: "pipe",
		})
		// origin doesn't exist → origin/haiku/test/design doesn't exist
		// → branchAheadOfOrigin returns true (push would create it).
		assert.strictEqual(branchAheadOfOrigin("haiku/test/design"), true)
	})
	rmSync(dir, { recursive: true, force: true })
})

test("local branch in sync with origin returns false (nothing to push)", () => {
	// Set up a "remote" by cloning the source repo into a bare counterpart
	// and adding it as origin. Local branch HEAD === origin's HEAD →
	// branchAheadOfOrigin must return false (no push needed).
	const src = makeRepo()
	const bare = mkdtempSync(join(tmpdir(), "haiku-bare-"))
	rmSync(bare, { recursive: true, force: true })
	execFileSync("git", ["clone", "--bare", src, bare], { stdio: "pipe" })
	withCwd(src, () => {
		execFileSync("git", ["remote", "add", "origin", bare], {
			cwd: src,
			stdio: "pipe",
		})
		execFileSync("git", ["branch", "haiku/test/design"], {
			cwd: src,
			stdio: "pipe",
		})
		execFileSync(
			"git",
			["push", "origin", "haiku/test/design:haiku/test/design"],
			{ cwd: src, stdio: "pipe" },
		)
		execFileSync("git", ["fetch", "origin"], { cwd: src, stdio: "pipe" })
		// Local and origin pointing at the same SHA — not ahead.
		assert.strictEqual(branchAheadOfOrigin("haiku/test/design"), false)
	})
	rmSync(src, { recursive: true, force: true })
	rmSync(bare, { recursive: true, force: true })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
