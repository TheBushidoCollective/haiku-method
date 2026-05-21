// unit-worktree-push.test.mjs — Phase 2 durability: a unit's in-progress
// worktree is pushed to origin on advance (so a CC restart / cross-machine
// pickup keeps the loop's work), and the unit branch is deleted local AND
// remote once the unit integrates at terminal. Uses a real bare remote so
// the push + remote-delete actually fire (they no-op in no-remote tests).

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

test("unit worktree: pushed on advance, deleted local+remote at terminal merge", async () => {
	if (!HAS_GIT) return
	const slug = "wt-push"
	const stage = "security"
	const unit = "unit-01-a"
	const unitBranch = `haiku/${slug}/${unit}`

	const bare = mkdtempSync(join(tmpdir(), "haiku-bare-"))
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-wtpush-"))
	const orig = process.cwd()
	try {
		execFileSync("git", ["init", "-q", "--bare", bare], { stdio: "ignore" })
		const git = (...a) => execFileSync("git", a, { cwd: repoRoot, stdio: "ignore" })
		execFileSync("git", ["init", "-q", "-b", "main", repoRoot], { stdio: "ignore" })
		git("config", "user.email", "t@t")
		git("config", "user.name", "t")
		git("config", "commit.gpgsign", "false")
		git("remote", "add", "origin", bare)

		// Seed intent + a unit, on the stage branch.
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("b\n", {
				title: "wt push",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
				plugin_version: "9.0.0",
			}),
		)
		writeFileSync(
			join(stageDir, "units", `${unit}.md`),
			matter.stringify("# a\n", {
				title: unit,
				started_at: null,
				inputs: [],
				outputs: [],
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)
		git("add", "-A")
		git("commit", "-q", "-m", "seed")
		git("branch", `haiku/${slug}/main`)
		git("checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		process.chdir(repoRoot)
		const { _resetIsGitRepoForTests } = await import(`${SRC}state-tools.ts`)
		_resetIsGitRepoForTests()
		const { createUnitWorktree, pushUnitWorktree, mergeUnitWorktree } =
			await import(`${SRC}git-worktree.ts`)

		const wt = createUnitWorktree(slug, unit, stage)
		assert.ok(wt, "worktree created")

		// Subagent writes code in the worktree, then advance pushes the branch.
		writeFileSync(join(wt, "work.txt"), "hat-1 output\n")
		pushUnitWorktree(slug, unit)
		assert.ok(
			remoteHasBranch(bare, unitBranch),
			"unit branch should be pushed to origin on advance (durability)",
		)

		// Terminal merge integrates + reaps the branch local AND remote.
		const merged = mergeUnitWorktree(slug, unit, stage)
		assert.ok(merged.success, `merge should succeed; got: ${merged.message}`)
		assert.ok(
			!remoteHasBranch(bare, unitBranch),
			"unit branch should be deleted from origin once integrated",
		)
	} finally {
		process.chdir(orig)
		const { _resetIsGitRepoForTests } = await import(`${SRC}state-tools.ts`)
		_resetIsGitRepoForTests()
		rmSync(repoRoot, { recursive: true, force: true })
		rmSync(bare, { recursive: true, force: true })
	}
})
