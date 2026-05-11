#!/usr/bin/env npx tsx
// merge-stage-malformed-iteration.test.mjs — Regression for the
// v3→v4 migrator backfill bug surfaced by the admin-portal-reimagine
// intent at v4.3.0.
//
// Scenario: the v3→v4 migrator's `backfillCompletedUnitStamps` stamps
// every approval role on units that had `status: completed` in v3.
// But if a v3 unit's iterations[] ended with a hat that had no
// `result:` field set (e.g. the verifier was started but the
// completion write never landed before the migration ran), the
// iteration shape is malformed:
//
//   iterations:
//     - hat: distiller
//       result: advance
//     - hat: verifier         # ← no `result:` field
//
// Pre-fix, `isUnitComplete` strict-checked `last.result === "advance"`,
// which failed for `result: undefined`. The unit looked "mid-flight"
// to the cursor, BUT `nextHatForUnit` also strict-checked
// `result === null` for in-flight detection — `undefined !== null` so
// the unit wasn't considered in-flight either. The cursor walked
// PAST the wave logic, found every review/approval stamped, and
// emitted `merge_stage`. The engine merged inception → main. The
// unit FM was unchanged, so the next tick re-emitted merge_stage.
// Loop guard fired after RUN_NEXT_LOOP_CAP iterations.
//
// The contract this test pins: a unit with every required approval
// role stamped is COMPLETE, regardless of iteration shape. The
// approval stamps are the user's / engine's explicit sign-off — the
// cursor must trust them.

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

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

function findRepoRoot() {
	let dir = resolve(import.meta.dirname ?? __dirname)
	while (dir !== "/") {
		if (existsSync(join(dir, "plugin", "studios", "software"))) return dir
		dir = resolve(dir, "..")
	}
	throw new Error("could not find repo root")
}
const PLUGIN_ROOT = join(findRepoRoot(), "plugin")

const origCwd = process.cwd()
function restoreCwd() {
	try {
		process.chdir(origCwd)
	} catch {
		process.chdir(tmpdir())
	}
	_resetIsGitRepoForTests()
}

/**
 * Build a software-studio repo where inception has units that are
 * fully approved but carry a malformed last iteration (verifier hat
 * with no `result:` field). Mirrors what `backfillCompletedUnitStamps`
 * produces for a v3 `status: completed` unit whose iterations[] was
 * left half-finished.
 */
function setupMalformedMigratedIntent(slug) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-malformed-it-"))
	git(tmp, "init", "--initial-branch=main")
	git(tmp, "config", "user.email", "test@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	git(tmp, "config", "commit.gpgsign", "false")
	git(tmp, "config", "tag.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "# malformed-iteration regression\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-m", "initial")
	git(tmp, "branch", `haiku/${slug}/main`, "main")

	const intentDir = join(tmp, ".haiku", "intents", slug)
	const inceptionUnitsDir = join(intentDir, "stages", "inception", "units")
	mkdirSync(inceptionUnitsDir, { recursive: true })

	// intent.md: v4-stamped continuous software intent.
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# malformed-iteration\n", {
			title: "malformed iteration",
			studio: "software",
			mode: "continuous",
			plugin_version: "4.0.0",
			verified_at: "2026-04-27T19:22:00Z",
		}),
	)

	const at = "2026-04-27T19:25:58Z"
	const approvalStamp = { at, migrated: true }
	// Malformed unit: every approval stamped, last iteration missing
	// `result`. Matches the shape produced by the v3 migrator's
	// backfillCompletedUnitStamps when the v3 unit's iterations[]
	// ended with a half-finished verifier hat.
	writeFileSync(
		join(inceptionUnitsDir, "unit-01-malformed.md"),
		matter.stringify("# malformed\n", {
			title: "malformed",
			started_at: "2026-04-27T19:22:30Z",
			iterations: [
				{
					hat: "researcher",
					started_at: "2026-04-27T19:22:30Z",
					completed_at: "2026-04-27T19:23:37Z",
					result: "advance",
				},
				{
					hat: "distiller",
					started_at: "2026-04-27T19:23:37Z",
					completed_at: "2026-04-27T19:25:58Z",
					result: "advance",
				},
				// Verifier started but never finished — the bug.
				{
					hat: "verifier",
					started_at: "2026-04-27T19:25:58Z",
					// no completed_at, no result
				},
			],
			reviews: {
				spec: approvalStamp,
				completeness: approvalStamp,
				feasibility: approvalStamp,
				user: approvalStamp,
			},
			approvals: {
				spec: approvalStamp,
				quality_gates: approvalStamp,
				completeness: approvalStamp,
				feasibility: approvalStamp,
				user: approvalStamp,
			},
		}),
	)

	git(tmp, "add", "-A")
	git(tmp, "commit", "-m", "v3-migrated malformed-iteration unit")

	return { tmp, intentDir }
}

test("findCurrentStage walks past a fully-approved unit even when its last iteration is malformed (no result:)", () => {
	_resetIsGitRepoForTests()
	const slug = "malformed-it"
	const { tmp } = setupMalformedMigratedIntent(slug)
	const origPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		process.chdir(tmp)
		// inception's only unit has every approval role stamped but the
		// last iteration is a verifier hat with no `result:` field. Pre-
		// fix, isUnitComplete returned false (result !== "advance") and
		// findCurrentStage pinned on inception. walkIntentTrack then
		// emitted merge_stage forever because no review/approval was
		// missing. Post-fix, the "all approvals stamped" check trumps
		// iteration shape — inception is past, cursor advances to design.
		const result = findCurrentStage(slug, "software")
		assert.notStrictEqual(
			result,
			"inception",
			`expected findCurrentStage to walk past inception (every approval stamped trumps malformed iteration); got: ${result}`,
		)
		assert.strictEqual(
			result,
			"design",
			`expected design (next stage after inception in software studio); got: ${result}`,
		)
	} finally {
		restoreCwd()
		if (origPluginRoot === undefined) {
			delete process.env.CLAUDE_PLUGIN_ROOT
		} else {
			process.env.CLAUDE_PLUGIN_ROOT = origPluginRoot
		}
		rmSync(tmp, { recursive: true, force: true })
	}
})
