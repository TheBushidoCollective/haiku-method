#!/usr/bin/env npx tsx
// fix-chain-merge-on-close.test.mjs — Phase 6 integration: when a fix-chain's
// terminal hat closes the FB via haiku_feedback_advance_hat, the engine merges
// the chain's isolation worktree into the base (stage) branch and reaps the
// worktree. Drives the REAL advance handler (not a simulation) with a
// fix-chain worktree carrying code, and asserts the code lands on the stage
// branch + the worktree is gone. Mirrors the unit terminal-merge contract.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

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

test("fix-chain terminal close merges the worktree's code onto the stage branch + reaps the worktree", async () => {
	if (!HAS_GIT) return
	const slug = "test-fc-merge-close"
	const stage = "design"
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fc-close-"))
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
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "feedback"), { recursive: true })
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				mode: "continuous",
				plugin_version: "9.0.0",
				stages: [stage],
			}),
		)
		writeFileSync(
			join(intentDir, "stages", stage, "units", "unit-01-stub.md"),
			matter.stringify("stub\n", {
				title: "stub",
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)

		const stageFm = matter(
			(await import("node:fs")).readFileSync(
				join(PLUGIN_ROOT, "studios", "software", "stages", stage, "STAGE.md"),
				"utf8",
			),
		).data
		const fixHats = Array.isArray(stageFm.fix_hats) ? stageFm.fix_hats : []
		if (fixHats.length < 2) return // need a terminal hat distinct from the first

		// Seed the FB at the SECOND-TO-LAST hat so the next advance is TERMINAL
		// (callingHat = last fix-hat → closes the FB).
		writeFileSync(
			join(intentDir, "stages", stage, "feedback", "001-test-fb.md"),
			matter.stringify("Test finding body.\n", {
				id: "FB-001",
				title: "test finding",
				status: "addressed",
				origin: "agent",
				author: "test",
				stage,
				hat: fixHats[fixHats.length - 2],
				bolt: 1,
				created_at: "2026-05-13T00:00:00Z",
				triaged_at: "2026-05-13T00:00:00Z",
				iterations: [],
				reviews: {},
				approvals: {},
				targets: { unit: "unit-01-stub", invalidates: [] },
			}),
		)
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "seed fb")

		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { _resetIsGitRepoForTests, handleStateTool } = await import(
			`${SRC}/state-tools.ts`
		)
		_resetIsGitRepoForTests()
		const { createFixChainWorktree, fixChainWorktreePath } = await import(
			`${SRC}/git-worktree.ts`
		)

		// The fix-chain ran its hats in an isolation worktree and left a code
		// correction there (committed, not pushed) — exactly what the subagent
		// template directs.
		const wt = createFixChainWorktree(slug, stage, "FB-001")
		assert.ok(wt, "fix-chain worktree created")
		writeFileSync(join(wt, "fix.txt"), "fix-chain correction\n")
		git(wt, "add", "-A")
		git(wt, "commit", "-q", "-m", "haiku: builder fix for FB-001")

		// Terminal close: advance the last hat. Requires a reply.
		const resp = handleStateTool("haiku_feedback_advance_hat", {
			intent: slug,
			stage,
			feedback_id: 1,
			reply: "Corrected the finding.",
		})
		const text = resp.content?.[0]?.text ?? ""
		const parsed = (() => {
			try {
				return JSON.parse(text)
			} catch {
				return null
			}
		})()

		// Clean merge → NOT a conflict/failure action.
		assert.ok(
			!resp.isError,
			`terminal close with a clean fix-chain merge must not error; got: ${text.slice(0, 300)}`,
		)
		if (parsed?.action) {
			assert.notStrictEqual(
				parsed.action,
				"integrate_fix_chains",
				"a clean fix-chain merge must not surface integrate_fix_chains",
			)
			assert.notStrictEqual(parsed.action, "merge_failed", "merge must succeed")
		}

		// The fix code landed on the stage branch.
		const onStage = git(tmp, "show", `haiku/${slug}/${stage}:fix.txt`)
		assert.match(onStage, /fix-chain correction/, "fix code merged onto the stage branch")

		// The worktree was reaped.
		assert.ok(
			!existsSync(fixChainWorktreePath(slug, stage, "FB-001")),
			"fix-chain worktree should be reaped after the terminal merge",
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
