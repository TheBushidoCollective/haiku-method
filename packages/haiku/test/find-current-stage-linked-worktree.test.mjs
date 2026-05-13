#!/usr/bin/env npx tsx
// find-current-stage-linked-worktree.test.mjs — Pins the linked-worktree
// path-resolution fix in `findCurrentStage` (cursor.ts).
//
// Setup: a primary git repo + a linked worktree (`git worktree add`).
// The linked worktree carries `.haiku/intents/<slug>/` (the intent).
// The primary worktree does NOT carry that intent dir (it's on a
// different branch that pre-dates the intent).
//
// Pre-fix, `findCurrentStage(slug, studio)` used `primaryRepoRoot()` to
// re-resolve the intent dir. `primaryRepoRoot()` keys off
// `git rev-parse --git-common-dir`, which returns the SHARED `.git`
// path even when called from a linked worktree — its parent is the
// PRIMARY worktree path. So the function looked for the intent in a
// directory where it didn't exist, every per-stage `isStageComplete`
// answered "false" (no unit dir), and the walk pinned on the first
// studio stage forever — reproducing the
// `admin-portal-reimagine` merge_stage loop reported 2026-05-12.
//
// Post-fix, the fallback walks up from `process.cwd()` via
// `findHaikuRoot()` (the same resolver the rest of the engine uses).
// Inside a linked worktree, cwd-walk finds the linked worktree's
// `.haiku/` and the cursor pins on the right stage.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"

import { findCurrentStage } from "../src/orchestrator/workflow/cursor.ts"
import { _resetIsGitRepoForTests } from "../src/state-tools.ts"

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "pipe" })
		return true
	} catch {
		return false
	}
})()

function findRepoRoot() {
	let dir = resolve(import.meta.dirname ?? __dirname)
	while (dir !== "/") {
		if (existsSync(join(dir, "plugin", "studios", "software"))) return dir
		dir = resolve(dir, "..")
	}
	throw new Error("could not find repo root with plugin/studios/software/")
}
const REPO_ROOT = findRepoRoot()
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

/**
 * Build a primary repo + linked worktree where the intent lives ONLY
 * in the linked worktree. Returns both paths so the test can drive
 * cwd from either.
 */
function setupLinkedWorktreeRepo(slug) {
	const primary = mkdtempSync(join(tmpdir(), "haiku-linked-primary-"))
	git(primary, "init", "--initial-branch=main")
	git(primary, "config", "user.email", "test@haiku")
	git(primary, "config", "user.name", "haiku-test")
	git(primary, "config", "commit.gpgsign", "false")
	writeFileSync(join(primary, "README.md"), "# primary tree\n")
	git(primary, "add", "-A")
	git(primary, "commit", "-m", "initial")

	// Create the intent branch and check it out into a linked worktree
	// living UNDER the primary tree (mirrors how H·AI·K·U organises its
	// per-intent worktrees in `.claude/worktrees/<name>/`).
	git(primary, "branch", `haiku/${slug}/main`)
	const linked = join(primary, ".claude", "worktrees", `${slug}-tree`)
	mkdirSync(join(primary, ".claude", "worktrees"), { recursive: true })
	git(primary, "worktree", "add", linked, `haiku/${slug}/main`)

	// Plant the intent state in the LINKED worktree only. The intent
	// declares all six software stages and ships one fully-approved
	// inception unit; design is wave-ready (no units). The cursor must
	// pin on `design` once it correctly resolves the linked worktree's
	// `.haiku/`.
	const intentDir = join(linked, ".haiku", "intents", slug)
	const inceptionUnits = join(intentDir, "stages", "inception", "units")
	const designUnits = join(intentDir, "stages", "design", "units")
	mkdirSync(inceptionUnits, { recursive: true })
	mkdirSync(designUnits, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# linked-worktree intent\n", {
			title: "linked worktree pinning test",
			studio: "software",
			mode: "continuous",
			stages: [
				"inception",
				"design",
				"product",
				"development",
				"operations",
				"security",
			],
		}),
	)
	const stamp = "2026-05-12T19:00:00Z"
	const ref = { at: stamp, migrated: true }
	writeFileSync(
		join(inceptionUnits, "unit-01-origin.md"),
		matter.stringify("# inception unit\n", {
			title: "Origin",
			started_at: stamp,
			iterations: [
				{
					hat: "researcher",
					started_at: stamp,
					completed_at: stamp,
					result: "advance",
				},
				{
					hat: "distiller",
					started_at: stamp,
					completed_at: stamp,
					result: "advance",
				},
				{
					hat: "verifier",
					started_at: stamp,
					completed_at: stamp,
					result: "advance",
				},
			],
			reviews: { spec: ref, completeness: ref, feasibility: ref, user: ref },
			approvals: {
				spec: ref,
				quality_gates: ref,
				completeness: ref,
				feasibility: ref,
				user: ref,
			},
		}),
	)

	return { primary, linked, intentDir }
}

const origCwd = process.cwd()
function restoreCwd() {
	try {
		process.chdir(origCwd)
	} catch {
		process.chdir(tmpdir())
	}
	_resetIsGitRepoForTests()
}

test("findCurrentStage: resolves linked-worktree .haiku/ via cwd walk (not primary worktree)", () => {
	if (!HAS_GIT) return
	_resetIsGitRepoForTests()
	const slug = "linked-wt"
	const { primary, linked } = setupLinkedWorktreeRepo(slug)
	const origPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		// Sanity: primary worktree does NOT carry the intent dir.
		assert.strictEqual(
			existsSync(join(primary, ".haiku", "intents", slug)),
			false,
			"precondition: primary worktree must not carry the intent",
		)
		// Sanity: linked worktree DOES carry the intent dir.
		assert.strictEqual(
			existsSync(join(linked, ".haiku", "intents", slug)),
			true,
			"precondition: linked worktree must carry the intent",
		)

		// Run cursor FROM the linked worktree. Pre-fix `primaryRepoRoot()`
		// returned the primary path, the cursor missed the intent dir,
		// and pinned on `inception`. Post-fix the cwd-walking
		// `findHaikuRoot()` fallback returns the linked `.haiku/` and
		// the cursor correctly pins on `design`.
		process.chdir(linked)
		const result = findCurrentStage(slug, "software")
		assert.strictEqual(
			result,
			"design",
			`findCurrentStage from linked worktree should return 'design' (first stage with no approved units); got: ${result}`,
		)
	} finally {
		restoreCwd()
		if (origPluginRoot === undefined) {
			delete process.env.CLAUDE_PLUGIN_ROOT
		} else {
			process.env.CLAUDE_PLUGIN_ROOT = origPluginRoot
		}
		rmSync(primary, { recursive: true, force: true })
	}
})

test("findCurrentStage: caller-provided intentDir overrides cwd walk", () => {
	if (!HAS_GIT) return
	_resetIsGitRepoForTests()
	const slug = "linked-wt-explicit"
	const { primary, intentDir } = setupLinkedWorktreeRepo(slug)
	const origPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		// Run from a completely unrelated cwd (`tmpdir()`). Without
		// `intentDir`, the cursor cannot find the intent (`findHaikuRoot`
		// would throw walking up from tmpdir). With `intentDir` passed
		// explicitly, the cursor reads from the supplied path and pins
		// on the right stage.
		process.chdir(tmpdir())
		const result = findCurrentStage(slug, "software", intentDir)
		assert.strictEqual(
			result,
			"design",
			`findCurrentStage with explicit intentDir should return 'design'; got: ${result}`,
		)
	} finally {
		restoreCwd()
		if (origPluginRoot === undefined) {
			delete process.env.CLAUDE_PLUGIN_ROOT
		} else {
			process.env.CLAUDE_PLUGIN_ROOT = origPluginRoot
		}
		rmSync(primary, { recursive: true, force: true })
	}
})
