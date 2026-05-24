#!/usr/bin/env npx tsx
// downstream-sync-clobber.test.mjs — Regression for the bug report's BUG-2/3:
// the per-tick `syncBranchDownstream` (intent-main → active stage branch) is a
// `.haiku`-bearing `--no-ff` merge with NO engine-state guard. The two
// PROTECTED merge paths (mergeUnitWorktree, mergeFixChainWorktree) re-assert
// engine state from the authoritative base via restoreEngineStateFromBase, but
// the downstream sync — which runs on EVERY haiku_run_next tick — did not.
//
// The stage branch is always AHEAD of intent main (the stage-branch invariant),
// so the stage's copy of a unit/feedback/intent file is authoritative. When
// intent main carries a diverged (e.g. skeleton) copy of a unit the stage did
// NOT touch since the fork, git's 3-way merge silently auto-resolves to main's
// side — reverting the stage's rich frontmatter. A clobbered unit comes back as
// the `status:`-bearing v3 skeleton, which then re-fires the migrator on every
// subsequent tick ("migrated every tick" in the report). This is also the
// amplifier behind BUG-3 (closed fixes reverting) and BUG-4 (stale reads — the
// fix really WAS reverted).
//
// This test forks a stage off rich intent-main, diverges main's copy of a unit
// to the skeleton, then runs the real syncBranchDownstream and asserts the
// stage keeps its authoritative rich frontmatter.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

const richUnit = (title) =>
	matter.stringify(`# ${title}\n\nUnit spec body.\n`, {
		title,
		description: "Acceptance criteria + Gherkin.",
		model: "sonnet",
		inputs: ["product/ACCEPTANCE-CRITERIA.md"],
		outputs: ["features/thing.feature"],
		quality_gates: [{ name: "g", command: "true" }],
		iterations: [],
		reviews: {},
		approvals: {},
	})

const skeletonUnit = (title) =>
	matter.stringify(`# ${title}\n\nUnit spec body.\n`, {
		status: "pending",
		title,
	})

function fmOnBranch(repo, branch, relPath) {
	return matter(git(repo, "show", `${branch}:${relPath}`)).data
}

test("syncBranchDownstream keeps the stage's authoritative unit FM (intent main can't clobber it)", async () => {
	if (!HAS_GIT) return
	const slug = "test-downstream-clobber"
	const stage = "development"
	const unit = "unit-002-data-contracts"
	const unitsRel = `.haiku/intents/${slug}/stages/${stage}/units`
	const unitRel = `${unitsRel}/${unit}.md`

	const tmp = mkdtempSync(join(tmpdir(), "haiku-ds-clobber-"))
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

		// Common base: rich unit on intent main.
		const intentDir = join(tmp, ".haiku", "intents", slug)
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
			join(intentDir, "stages", stage, "units", `${unit}.md`),
			richUnit("Data Contracts"),
		)
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "decompose: rich unit on intent main")

		// Fork the stage branch off rich intent main. The stage does NOT touch
		// this unit again (its work is elsewhere) — so its copy stays at the
		// rich fork point and is authoritative.
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)
		writeFileSync(join(tmp, "stage-work.txt"), "stage advanced other units\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "stage: unrelated work")

		// Intent main diverges the unit to the skeleton (models the stale/
		// migrated/fix-chain-clobbered copy that ends up on main). The stage
		// never touched the unit, so a naive merge silently takes main's side.
		git(tmp, "checkout", "-q", `haiku/${slug}/main`)
		writeFileSync(
			join(intentDir, "stages", stage, "units", `${unit}.md`),
			skeletonUnit("Data Contracts"),
		)
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "main: skeleton copy of the unit")

		// Back on the stage branch — the position the agent's checkout is in
		// when haiku_run_next fires the pre-cursor downstream sync.
		git(tmp, "checkout", "-q", `haiku/${slug}/${stage}`)

		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		const { syncBranchDownstream } = await import(`${SRC}/git-worktree.ts`)

		const res = syncBranchDownstream(slug)
		assert.ok(res.ok, `downstream sync should succeed; got: ${res.message}`)

		// THE FIX: the stage's authoritative rich frontmatter must survive the
		// intent-main → stage sync. Before the guard, the merge silently took
		// main's skeleton and the unit reverted to `status: pending` + title.
		const after = fmOnBranch(tmp, `haiku/${slug}/${stage}`, unitRel)
		assert.ok(
			Array.isArray(after.quality_gates) && after.quality_gates.length === 1,
			`stage unit lost its quality_gates through syncBranchDownstream; keys: ${Object.keys(after).join(", ")}`,
		)
		assert.ok(
			Array.isArray(after.inputs) && after.inputs.length > 0,
			"stage unit lost its declared inputs through syncBranchDownstream",
		)
		assert.equal(
			after.status,
			undefined,
			"stage unit reverted to the v3 `status` skeleton — this is the blob that re-fires the migrator every tick",
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
