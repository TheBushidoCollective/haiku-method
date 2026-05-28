// current-state-matches-cursor.test.mjs
//
// Regression for haiku-bug-report-2026-05-19 (round 3) — the SPA's
// stepper diamond highlighted a different stage than the engine cursor
// was actually working on. Reported: navigated to /stages/development
// while the diamond was still on INCEPTION. Root cause: `getCurrentState`
// ran a parallel walk based on `deriveStageState` + `isBranchMerged`
// (waiting for the stage branch to merge into intent main), while the
// cursor's `findCurrentStage` only checks per-unit FM signatures and
// moves past a fully-signed stage immediately.
//
// Fix: `getCurrentState` now delegates stage selection to
// `findCurrentStage`. Same disk signal in both places — the diamond
// and the cursor can never disagree again.

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

function git(repoRoot, ...args) {
	return execFileSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

function makeRepo() {
	const dir = mkdtempSync(join(tmpdir(), "haiku-current-state-cursor-"))
	if (HAS_GIT) {
		execFileSync("git", ["init", "-q", "-b", "main", dir], { stdio: "ignore" })
		git(dir, "config", "user.email", "t@t")
		git(dir, "config", "user.name", "t")
		git(dir, "config", "commit.gpgsign", "false")
	}
	return dir
}

function seedSignedStage(repoRoot, slug, stageName, hats) {
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stageName)
	const unitsDir = join(stageDir, "units")
	mkdirSync(unitsDir, { recursive: true })
	const at = "2026-05-19T00:00:00Z"
	writeFileSync(
		join(stageDir, "elaboration.md"),
		matter.stringify(`# Elaboration ${stageName}\n`, {
			title: stageName,
			verified_at: at,
		}),
	)
	writeFileSync(
		join(unitsDir, "unit-01-work.md"),
		matter.stringify(`# unit-01\n`, {
			title: "u1",
			started_at: at,
			iterations: hats.map((hat) => ({
				hat,
				started_at: at,
				completed_at: at,
				result: "advance",
			})),
			reviews: { spec: { at }, user: { at }, "code-reviewer": { at } },
			approvals: {
				spec: { at },
				quality_gates: { at },
				user: { at },
				"code-reviewer": { at },
			},
		}),
	)
	return { intentDir, stageDir }
}

test("getCurrentState delegates stage selection to findCurrentStage", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo()
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const slug = "diamond-mismatch"
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		mkdirSync(intentDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "Diamond mismatch repro",
				studio: "software",
				mode: "continuous",
				stages: ["inception", "design", "product"],
			}),
		)

		// Inception fully signed on disk. Hats match real software/
		// inception STAGE.md so isStageComplete sees a signed stage.
		const inceptionHats = ["researcher", "distiller", "verifier"]
		seedSignedStage(repoRoot, slug, "inception", inceptionHats)

		// Commit + set up branches so the divergent merge-check path
		// would fire pre-fix: intent main exists, inception branch
		// exists, but inception is NOT merged into main. Pre-fix the
		// SPA pinned on inception waiting for merge; the cursor moved
		// past. Post-fix both agree on the cursor's view.
		git(repoRoot, "add", "-A")
		git(repoRoot, "commit", "-m", "seed")
		git(repoRoot, "branch", `haiku/${slug}/main`)
		git(repoRoot, "checkout", "-b", `haiku/${slug}/inception`)
		writeFileSync(join(repoRoot, "marker.txt"), "diverge\n")
		git(repoRoot, "add", "-A")
		git(repoRoot, "commit", "-m", "diverge inception")
		git(repoRoot, "checkout", `haiku/${slug}/main`)

		const { getCurrentState } = await import(`${SRC}current-state.ts`)
		const { findCurrentStage } = await import(
			`${SRC}orchestrator/workflow/cursor.ts`
		)

		const cursorView = findCurrentStage(slug, "software", intentDir)
		const apiView = getCurrentState(slug)
		assert.ok(apiView, "expected a current state for this intent")
		assert.strictEqual(
			apiView.stage,
			cursorView,
			`getCurrentState (${apiView.stage}) and findCurrentStage (${cursorView}) must agree on the active stage`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
