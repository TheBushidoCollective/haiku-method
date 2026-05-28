#!/usr/bin/env npx tsx
// engine-never-merges-mainline.test.mjs
//
// TRUST CHECKPOINT (2026-05-28): the engine must NEVER merge an intent's
// work into the repo's real mainline. Delivery is open-a-PR-and-wait — the
// USER's merge is the only close signal (see `workflowIntentComplete` +
// `reconcileIntentBranches`). The engine consolidates ephemeral/stage
// branches into the intent's OWN branch (`haiku/<slug>/main`) and may
// fast-forward that intent branch DOWNSTREAM from mainline, but it never
// advances mainline itself and never runs `gh pr merge`.
//
// This pins both halves against a real repo + bare remote:
//   1. Driving the pre-tick branch reconciliation with intent work ahead of
//      mainline leaves mainline (local + origin) byte-identical — the engine
//      authored no merge onto it.
//   2. When the PR is merged EXTERNALLY (a human merges `haiku/<slug>/main`
//      into mainline), the engine recognizes it as merged (`isBranchMerged`
//      → true, the close signal) and, on the next reconciliation, still adds
//      NOTHING to mainline — the mainline tip stays the human's merge commit,
//      never an engine-authored one.
//
// If a future change ever makes the engine push intent work onto mainline,
// one of these assertions fails.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { reconcileIntentBranches, isBranchMerged } = await import(
	"../src/git-worktree.ts"
)
const { _resetIsGitRepoForTests } = await import("../src/state/shared.ts")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

let passed = 0
let failed = 0
function test(name, fn) {
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

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
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

/** Real working repo + a bare `origin`, with `haiku/<slug>/main` already a
 *  commit ahead of `main` (a completed intent awaiting delivery). */
function setup(label) {
	const bare = mkdtempSync(join(tmpdir(), `haiku-mainline-origin-${label}-`))
	execFileSync("git", ["init", "-q", "--bare", bare], { stdio: "pipe" })
	const root = mkdtempSync(join(tmpdir(), `haiku-mainline-work-${label}-`))
	git(root, "init", "-q", "-b", "main")
	git(root, "config", "user.email", "human@dev")
	git(root, "config", "user.name", "Human Dev")
	git(root, "config", "commit.gpgsign", "false")
	writeFileSync(join(root, "README.md"), "# t\n")
	git(root, "add", "-A")
	git(root, "commit", "-q", "-m", "init")
	git(root, "remote", "add", "origin", bare)
	git(root, "push", "-q", "-u", "origin", "main")

	const slug = `deliver-${label}`
	const intentMain = `haiku/${slug}/main`
	git(root, "checkout", "-q", "-b", intentMain)
	writeFileSync(join(root, "feature.txt"), "intent deliverable\n")
	git(root, "add", "-A")
	git(root, "commit", "-q", "-m", "intent work (ahead of mainline)")
	git(root, "push", "-q", "-u", "origin", intentMain)
	git(root, "fetch", "-q", "origin")
	return { bare, root, slug, intentMain }
}

function cleanup({ bare, root }) {
	rmSync(bare, { recursive: true, force: true })
	rmSync(root, { recursive: true, force: true })
}

console.log("\n=== engine never merges to mainline ===")

test("reconciliation with intent work ahead leaves mainline untouched (no engine merge)", () => {
	if (!HAS_GIT) return
	const ctx = setup("ahead")
	try {
		withCwd(ctx.root, () => {
			_resetIsGitRepoForTests()
			git(ctx.root, "checkout", "-q", ctx.intentMain)
			const originMainBefore = git(ctx.root, "rev-parse", "origin/main")
			const localMainBefore = git(ctx.root, "rev-parse", "main")

			reconcileIntentBranches(ctx.slug)

			git(ctx.root, "fetch", "-q", "origin")
			assert.equal(
				git(ctx.root, "rev-parse", "origin/main"),
				originMainBefore,
				"engine must NOT advance origin/main",
			)
			assert.equal(
				git(ctx.root, "rev-parse", "main"),
				localMainBefore,
				"engine must NOT advance local main",
			)
			// The intent is NOT merged — because the engine never merges it.
			assert.equal(
				isBranchMerged(ctx.intentMain, "main"),
				false,
				"intent branch must read as un-merged — the engine doesn't merge it",
			)
		})
	} finally {
		cleanup(ctx)
	}
})

test("external PR merge is the close signal; engine adds nothing to mainline", () => {
	if (!HAS_GIT) return
	const ctx = setup("external")
	try {
		withCwd(ctx.root, () => {
			_resetIsGitRepoForTests()
			// Simulate the USER merging the delivery PR: a human merges the
			// intent branch into mainline and pushes. (No `gh` — the merge IS
			// the provider-free close signal the engine reads via ancestry.)
			git(ctx.root, "checkout", "-q", "main")
			git(
				ctx.root,
				"merge",
				"--no-ff",
				ctx.intentMain,
				"-m",
				"Merge PR #999 — delivered (human)",
			)
			git(ctx.root, "push", "-q", "origin", "main")
			const externalSha = git(ctx.root, "rev-parse", "origin/main")
			const externalAuthor = git(
				ctx.root,
				"log",
				"-1",
				"--format=%an",
				"origin/main",
			)
			assert.equal(externalAuthor, "Human Dev", "fixture sanity: human merged")

			// The engine now SEES it as merged — that's the close signal.
			_resetIsGitRepoForTests()
			assert.equal(
				isBranchMerged(ctx.intentMain, "main"),
				true,
				"engine must recognize the external merge as the close signal",
			)

			// Next tick reconciles. It may FF the intent branch DOWNSTREAM from
			// mainline, but it must add nothing to mainline.
			git(ctx.root, "checkout", "-q", ctx.intentMain)
			_resetIsGitRepoForTests()
			reconcileIntentBranches(ctx.slug)

			git(ctx.root, "fetch", "-q", "origin")
			assert.equal(
				git(ctx.root, "rev-parse", "origin/main"),
				externalSha,
				"mainline must stay exactly the human's merge — engine pushed nothing",
			)
			assert.equal(
				git(ctx.root, "log", "-1", "--format=%an", "origin/main"),
				"Human Dev",
				"mainline tip stays the human merge — engine authored no merge commit",
			)
		})
	} finally {
		cleanup(ctx)
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
