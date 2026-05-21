// unit-branch-recovery.test.mjs — Phase 2b case-b: a worktree-isolated unit
// whose worktree AND branch (local + remote) are all gone has lost its
// hat-loop code; resetLostUnits clears its iterations so the cursor
// re-dispatches the first hat. A unit that still has its worktree (in-flight)
// or a recreatable branch is left alone.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

const AT = "2026-05-21T00:00:00Z"

test("resetLostUnits resets a lost unit, leaves an in-flight (worktree-present) one", async () => {
	if (!HAS_GIT) return
	const slug = "rec"
	const stage = "security"
	const bare = mkdtempSync(join(tmpdir(), "haiku-rec-bare-"))
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-rec-"))
	const orig = process.cwd()
	try {
		execFileSync("git", ["init", "-q", "--bare", bare], { stdio: "ignore" })
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("b\n", {
				title: "rec",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
				plugin_version: "9.0.0",
			}),
		)
		const stageFm = matter(
			readFileSync(
				join(REPO_ROOT, "plugin", "studios", "software", "stages", stage, "STAGE.md"),
				"utf8",
			),
		).data
		const hats = Array.isArray(stageFm.hats) ? stageFm.hats : []
		if (hats.length < 2) return
		// Both units: started, mid-loop (hats[0] advanced, on hats[1]), NOT complete.
		const midIters = [{ hat: hats[0], started_at: AT, completed_at: AT, result: "advance" }]
		for (const u of ["unit-01-lost", "unit-02-live"]) {
			writeFileSync(
				join(stageDir, "units", `${u}.md`),
				matter.stringify(`# ${u}\n`, {
					title: u,
					started_at: AT,
					inputs: [],
					iterations: midIters,
					reviews: {},
					approvals: {},
				}),
			)
		}
		const git = (...a) => execFileSync("git", a, { cwd: repoRoot, stdio: "ignore" })
		git("init", "-q", "-b", "main")
		git("config", "user.email", "t@t")
		git("config", "user.name", "t")
		git("config", "commit.gpgsign", "false")
		git("remote", "add", "origin", bare)
		git("add", "-A")
		git("commit", "-q", "-m", "seed")
		git("branch", `haiku/${slug}/main`)
		git("checkout", "-q", "-b", `haiku/${slug}/${stage}`)
		// Push the stage branch so origin is a real remote — but neither unit's
		// branch is ever pushed, so unit-01-lost is genuinely missing everywhere.
		git("push", "-q", "origin", `haiku/${slug}/${stage}`)

		process.chdir(repoRoot)
		const { _resetIsGitRepoForTests } = await import(`${SRC}state-tools.ts`)
		_resetIsGitRepoForTests()
		const { createUnitWorktree } = await import(`${SRC}git-worktree.ts`)
		const { resetLostUnits } = await import(
			`${SRC}orchestrator/workflow/unit-branch-recovery.ts`
		)

		// unit-02-live keeps a worktree (genuinely in-flight). unit-01-lost has
		// no worktree + no branch (local or remote) → lost.
		assert.ok(createUnitWorktree(slug, "unit-02-live", stage), "live worktree created")

		const { reset } = resetLostUnits(slug, "software")
		assert.deepEqual(reset, ["unit-01-lost"], `only the lost unit resets; got ${reset}`)

		const lost = matter(readFileSync(join(stageDir, "units", "unit-01-lost.md"), "utf8")).data
		assert.deepEqual(lost.iterations, [], "lost unit iterations cleared")
		assert.ok(!lost.started_at, "lost unit started_at cleared")

		const live = matter(readFileSync(join(stageDir, "units", "unit-02-live.md"), "utf8")).data
		assert.equal(live.iterations.length, 1, "in-flight (worktree-present) unit untouched")
		assert.equal(live.started_at, AT, "in-flight unit started_at preserved")
	} finally {
		process.chdir(orig)
		const { _resetIsGitRepoForTests } = await import(`${SRC}state-tools.ts`)
		_resetIsGitRepoForTests()
		rmSync(repoRoot, { recursive: true, force: true })
		rmSync(bare, { recursive: true, force: true })
	}
})
