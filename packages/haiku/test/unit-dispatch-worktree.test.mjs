// unit-dispatch-worktree.test.mjs — Phase 1a: the unit hat dispatch forks a
// per-unit worktree (haiku/<slug>/<unit>) off the stage branch, mirroring the
// discovery worktree pattern. Idempotent across hats; graceful in non-git
// (filesystem) mode.

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

function seed(repoRoot, slug, stage) {
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "wt",
			studio: "software",
			mode: "autopilot",
			stages: [stage],
			plugin_version: "9.0.0",
		}),
	)
	writeFileSync(
		join(stageDir, "units", "unit-01-a.md"),
		matter.stringify("# a\n", {
			title: "unit-01-a",
			started_at: null,
			inputs: [],
			iterations: [],
			reviews: {},
			approvals: {},
		}),
	)
}

async function withCwd(dir, fn) {
	const orig = process.cwd()
	process.chdir(dir)
	// isGitRepo() caches globally; reset so it re-detects for THIS cwd
	// (the git test repo vs the non-git fixture).
	const { _resetIsGitRepoForTests } = await import(`${SRC}state-tools.ts`)
	_resetIsGitRepoForTests()
	try {
		return await fn()
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		_resetIsGitRepoForTests()
	}
}

test("buildUnitHatDispatchBlock forks a per-unit worktree off the stage branch", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-wt-"))
	try {
		const slug = "wt-intent"
		const stage = "security"
		seed(repoRoot, slug, stage)
		const git = (...a) => execFileSync("git", a, { cwd: repoRoot, stdio: "ignore" })
		git("init", "-q", "-b", "main")
		git("config", "user.email", "t@t")
		git("config", "user.name", "t")
		git("config", "commit.gpgsign", "false")
		git("add", "-A")
		git("commit", "-q", "-m", "seed")
		git("branch", `haiku/${slug}/main`)
		git("checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		const stageFm = matter(
			(await import("node:fs")).readFileSync(
				join(REPO_ROOT, "plugin", "studios", "software", "stages", stage, "STAGE.md"),
				"utf8",
			),
		).data
		const hat = (Array.isArray(stageFm.hats) ? stageFm.hats : [])[0]
		if (!hat) return

		const { buildUnitHatDispatchBlock } = await import(
			`${SRC}orchestrator/unit-dispatch-builder.ts`
		)
		const block = await withCwd(repoRoot, () =>
			buildUnitHatDispatchBlock({
				slug,
				studio: "software",
				unit: "unit-01-a",
				stage,
				hat,
				terminal: false,
			}),
		)

		const wtPath = join(repoRoot, ".haiku", "worktrees", slug, "unit-01-a")
		assert.ok(existsSync(wtPath), "unit worktree dir should be created at dispatch")

		// The dispatched subagent prompt directs work INTO the worktree.
		const pf = block.match(/prompt_file="([^"]+)"/)?.[1]
		assert.ok(pf && existsSync(pf), "dispatch emits a prompt_file")
		const prompt = (await import("node:fs")).readFileSync(pf, "utf8")
		assert.ok(
			prompt.includes(wtPath) && /isolation worktree/i.test(prompt),
			"subagent prompt must direct file work into the unit worktree",
		)
		const branches = execFileSync("git", ["branch", "--list", `haiku/${slug}/unit-01-a`], {
			cwd: repoRoot,
			encoding: "utf8",
		})
		assert.ok(
			branches.includes(`haiku/${slug}/unit-01-a`),
			`unit branch should exist; got: ${branches}`,
		)

		// Idempotent — a second dispatch (e.g. relay / next hat) reuses it.
		await withCwd(repoRoot, () =>
			buildUnitHatDispatchBlock({
				slug,
				studio: "software",
				unit: "unit-01-a",
				stage,
				hat,
				terminal: false,
			}),
		)
		assert.ok(existsSync(wtPath), "worktree still present after a second dispatch")
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("buildUnitHatDispatchBlock is graceful in filesystem (non-git) mode", async () => {
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-wt-nogit-"))
	try {
		const slug = "wt-fs"
		const stage = "security"
		seed(repoRoot, slug, stage)
		const stageFm = matter(
			(await import("node:fs")).readFileSync(
				join(REPO_ROOT, "plugin", "studios", "software", "stages", stage, "STAGE.md"),
				"utf8",
			),
		).data
		const hat = (Array.isArray(stageFm.hats) ? stageFm.hats : [])[0]
		if (!hat) return
		const { buildUnitHatDispatchBlock } = await import(
			`${SRC}orchestrator/unit-dispatch-builder.ts`
		)
		// No git init → createUnitWorktree returns null; dispatch must not throw.
		const block = await withCwd(repoRoot, () =>
			buildUnitHatDispatchBlock({
				slug,
				studio: "software",
				unit: "unit-01-a",
				stage,
				hat,
				terminal: false,
			}),
		)
		assert.ok(typeof block === "string" && block.length > 0, "dispatch block still builds")
		assert.ok(
			!existsSync(join(repoRoot, ".haiku", "worktrees")),
			"no worktree created in filesystem mode",
		)
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
