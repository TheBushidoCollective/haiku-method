#!/usr/bin/env npx tsx
// unit-merge-recovers-unmerged-branch.test.mjs — Regression for the
// "marked complete, never merged" bug (report 2026-05-24,
// admin-portal-reimagine/security: units 003/004/008 reached `done` with
// their unit branches NEVER merged into the stage branch — blocker-level
// deliverables physically absent from the built tree, caught only by chance
// at a later approval role).
//
// Root cause: mergeUnitWorktree short-circuited `{success: true}` whenever the
// unit's isolation worktree was gone (`!existsSync(worktreePath)`) — without
// checking whether the unit BRANCH still carried unmerged commits. A worktree
// reaped before its terminal merge landed (or recreated-from-remote on a
// cross-machine pickup) left the branch's code stranded while the unit was
// stamped complete.
//
// Fix: on the no-worktree path, only short-circuit when there is genuinely
// nothing to merge (no branch, or already an ancestor of the stage branch);
// otherwise merge the durable branch directly.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
const REPO_ROOT = resolve(HERE, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")

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

test("mergeUnitWorktree recovers an unmerged unit branch when the worktree is gone", async () => {
	if (!HAS_GIT) return
	const slug = "test-unmerged-recovery"
	const stage = "security"
	const unit = "unit-003-rate-limit"
	const stageBranch = `haiku/${slug}/${stage}`
	const unitBranch = `haiku/${slug}/${unit}`
	const deliverable = "lib/rate_limit.ex"

	const tmp = mkdtempSync(join(tmpdir(), "haiku-unmerged-"))
	const orig = process.cwd()
	try {
		git(tmp, "init", "-q", "-b", "main")
		git(tmp, "config", "user.email", "test@haiku")
		git(tmp, "config", "user.name", "haiku-test")
		git(tmp, "config", "commit.gpgsign", "false")
		writeFileSync(join(tmp, "README.md"), "# test\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "init")
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(intentDir, { recursive: true })
		writeFileSync(join(intentDir, "intent.md"), "---\ntitle: t\n---\n# t\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "intent")
		git(tmp, "checkout", "-q", "-b", stageBranch)

		// The unit branch forks off the stage branch and lands its deliverable
		// (a real code file). NO worktree is created — modelling a reaped /
		// cross-machine-recreated branch. The branch is NOT merged into stage.
		git(tmp, "checkout", "-q", "-b", unitBranch)
		mkdirSync(join(tmp, "lib"), { recursive: true })
		writeFileSync(join(tmp, deliverable), "defmodule RateLimit do\nend\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "unit-003: rate limit control")
		// Back on the stage branch — the deliverable is NOT here yet.
		git(tmp, "checkout", "-q", stageBranch)
		assert.throws(
			() => git(tmp, "cat-file", "-e", `${stageBranch}:${deliverable}`),
			"deliverable must be absent from the stage branch before merge",
		)

		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		const { mergeUnitWorktree } = await import(`${SRC}/git-worktree.ts`)

		const res = mergeUnitWorktree(slug, unit, stage)
		assert.ok(
			res.success,
			`merge should recover + succeed; got: ${res.message}`,
		)

		// The deliverable must now be on the stage branch — recovered, not
		// silently skipped. Before the fix this threw (file absent).
		const onStage = git(tmp, "show", `${stageBranch}:${deliverable}`)
		assert.match(
			onStage,
			/defmodule RateLimit/,
			"unit deliverable must land on the stage branch via the recovery merge",
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("mergeUnitWorktree still short-circuits cleanly when the branch is already merged / absent", async () => {
	if (!HAS_GIT) return
	const slug = "test-already-merged"
	const stage = "security"
	const unit = "unit-004-noop"
	const stageBranch = `haiku/${slug}/${stage}`

	const tmp = mkdtempSync(join(tmpdir(), "haiku-merged-"))
	const orig = process.cwd()
	try {
		git(tmp, "init", "-q", "-b", "main")
		git(tmp, "config", "user.email", "test@haiku")
		git(tmp, "config", "user.name", "haiku-test")
		git(tmp, "config", "commit.gpgsign", "false")
		writeFileSync(join(tmp, "README.md"), "# test\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "init")
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
		git(tmp, "checkout", "-q", "-b", stageBranch)

		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		const { mergeUnitWorktree } = await import(`${SRC}/git-worktree.ts`)

		// No unit branch, no worktree → genuinely nothing to merge.
		const res = mergeUnitWorktree(slug, unit, stage)
		assert.ok(res.success, `clean short-circuit expected; got: ${res.message}`)
		assert.match(res.message, /no worktree/)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		rmSync(tmp, { recursive: true, force: true })
	}
})
