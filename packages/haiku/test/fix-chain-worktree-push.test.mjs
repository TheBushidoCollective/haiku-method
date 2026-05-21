// fix-chain-worktree-push.test.mjs — Phase 6 durability: a fix-chain's
// in-progress worktree is pushed to origin on advance (so a CC restart /
// cross-machine pickup keeps the loop's work), and the fix-chain branch is
// deleted local AND remote once the chain integrates at terminal close. The
// FB analog of unit-worktree-push. Uses a real bare remote so the push +
// remote-delete actually fire.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = fileURLToPath(new URL(".", import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function remoteHasBranch(bare, branch) {
	const out = execFileSync("git", ["-C", bare, "branch", "--list", branch], {
		encoding: "utf8",
	})
	return out.includes(branch)
}

test("fix-chain worktree: pushed on advance, deleted local+remote at terminal merge", async () => {
	if (!HAS_GIT) return
	const slug = "fc-push"
	const stage = "security"
	const feedbackId = "FB-001"
	const fixBranch = `haiku/${slug}/fix-${stage}-${feedbackId}`

	const bare = mkdtempSync(join(tmpdir(), "haiku-fc-bare-"))
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-fcpush-"))
	const orig = process.cwd()
	try {
		execFileSync("git", ["init", "-q", "--bare", bare], { stdio: "ignore" })
		const git = (...a) => execFileSync("git", a, { cwd: repoRoot, stdio: "ignore" })
		execFileSync("git", ["init", "-q", "-b", "main", repoRoot], { stdio: "ignore" })
		git("config", "user.email", "t@t")
		git("config", "user.name", "t")
		git("config", "commit.gpgsign", "false")
		git("remote", "add", "origin", bare)

		// Seed intent on the stage branch (the fix-chain's base).
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("b\n", {
				title: "fc push",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
				plugin_version: "9.0.0",
			}),
		)
		git("add", "-A")
		git("commit", "-q", "-m", "seed")
		git("branch", `haiku/${slug}/main`)
		git("checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		process.chdir(repoRoot)
		const { _resetIsGitRepoForTests } = await import(`${SRC}state-tools.ts`)
		_resetIsGitRepoForTests()
		const { createFixChainWorktree, pushFixChainWorktree, mergeFixChainWorktree } =
			await import(`${SRC}git-worktree.ts`)

		const wt = createFixChainWorktree(slug, stage, feedbackId)
		assert.ok(wt, "fix-chain worktree created")

		// Fixer hat lands a code correction in the worktree, then advance pushes
		// (pushFixChainWorktree commits the worktree's dirty files itself).
		writeFileSync(join(wt, "fix.txt"), "fix-hat correction\n")
		pushFixChainWorktree(slug, stage, feedbackId)
		assert.ok(
			remoteHasBranch(bare, fixBranch),
			"fix-chain branch should be pushed to origin on advance (durability)",
		)

		// Cross-machine pickup: drop the local worktree + branch (a fresh clone
		// would lack them), keeping only the pushed remote. createFixChainWorktree
		// must recreate FROM THE REMOTE so the loop's code survives.
		execFileSync("git", ["worktree", "remove", wt, "--force"], { cwd: repoRoot, stdio: "ignore" })
		execFileSync("git", ["branch", "-D", fixBranch], { cwd: repoRoot, stdio: "ignore" })
		const wt2 = createFixChainWorktree(slug, stage, feedbackId)
		assert.ok(wt2, "fix-chain worktree recreated")
		assert.ok(
			existsSync(join(wt2, "fix.txt")),
			"recreated worktree must restore the pushed code (resume, not fork-fresh)",
		)

		// Terminal close integrates the chain + reaps the branch local AND remote.
		const merged = mergeFixChainWorktree(slug, stage, feedbackId)
		assert.ok(merged.success, `merge should succeed; got: ${merged.message}`)
		assert.ok(
			!remoteHasBranch(bare, fixBranch),
			"fix-chain branch should be deleted from origin once integrated",
		)
		// The fix code landed on the stage branch.
		const onStage = execFileSync(
			"git",
			["show", `haiku/${slug}/${stage}:fix.txt`],
			{ cwd: repoRoot, encoding: "utf8" },
		)
		assert.match(onStage, /fix-hat correction/, "fix code merged onto the stage branch")
	} finally {
		process.chdir(orig)
		const { _resetIsGitRepoForTests } = await import(`${SRC}state-tools.ts`)
		_resetIsGitRepoForTests()
		rmSync(repoRoot, { recursive: true, force: true })
		rmSync(bare, { recursive: true, force: true })
	}
})
