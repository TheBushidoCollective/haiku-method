#!/usr/bin/env npx tsx
// execute-phase-iterations-guard.test.mjs — Task #28.
//
// The cursor must refuse to advance from execute to the review track
// when any unit declares non-empty `outputs:` but has `iterations: []`
// — the per-unit builder hats never ran. Reported 2026-05-13: 9
// simultaneous `unit_outputs_empty` FBs because units 03-11 on a
// stage had empty iterations and spec review ran against empty
// artifacts.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"
import {
	initTestRepo,
	makeIntent,
	makeStudio,
	onStageBranch,
	runTickWithBranchAlignment,
	seedVerifiedElaboration,
} from "./_v4-fixtures.mjs"

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

async function withTmpRepo(slug, fn) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-iterations-guard-"))
	const stableCwd = tmpdir()
	const origCwd = process.cwd()
	try {
		const repo = initTestRepo({ repoRoot: dir, slug })
		return await fn(repo)
	} finally {
		try {
			process.chdir(origCwd)
		} catch {
			process.chdir(stableCwd)
		}
		rmSync(dir, { recursive: true, force: true })
	}
}

function writeUnit(intentDir, stage, name, fm, body = "") {
	const slug = intentDir.split("/").pop() ?? ""
	const repoRoot = intentDir.split("/").slice(0, -3).join("/")
	const path = join(intentDir, "stages", stage, "units", `${name}.md`)
	onStageBranch(repoRoot, slug, stage, () => {
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		writeFileSync(path, matter.stringify(body || `# ${name}\n`, fm))
	})
	return path
}

async function runTick(repoRoot, slug) {
	return runTickWithBranchAlignment(repoRoot, slug)
}

test("cursor: stranded started-without-iterations + outputs declared → does NOT advance to review", async () => {
	// A unit with `started_at` set and `iterations: []` would normally
	// be treated as a v3-migrated placeholder (`isUnitComplete` path
	// (b)) and let the cursor walk past the stage as complete. Task
	// #28: when such a unit declares non-empty `outputs:`, it is
	// unbuilt — not migrated — and the cursor must refuse to advance.
	if (!HAS_GIT) return
	await withTmpRepo(
		"iter-guard-stranded",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test" })
			seedVerifiedElaboration({ intentDir, stage: "design" })

			writeUnit(intentDir, "design", "unit-01-stranded", {
				title: "stranded",
				depends_on: [],
				inputs: [],
				outputs: ["artifacts/something.md"],
				started_at: "2026-04-01T00:00:00Z",
				iterations: [],
				reviews: {},
				approvals: {},
				discovery: {},
			})

			const action = await runTick(repoRoot, slug)
			// MUST NOT advance into the review/approval track. Acceptable
			// answers: re-dispatch the hat sequence (start_unit_hat), or
			// surface the structural problem
			// (unit_outputs_empty_iterations). The forbidden answer is
			// `dispatch_review` / `dispatch_approval` / `complete_stage`.
			assert.notStrictEqual(
				action.action,
				"dispatch_review",
				`must not dispatch review with empty iterations; got: ${action.action}`,
			)
			assert.notStrictEqual(
				action.action,
				"dispatch_approval",
				`must not dispatch approval with empty iterations; got: ${action.action}`,
			)
			assert.notStrictEqual(
				action.action,
				"complete_stage",
				`must not complete stage with empty iterations; got: ${action.action}`,
			)
			// We expect either a re-dispatch (preferred — picks up first
			// hat for the started-with-empty-iterations unit) or the
			// structural surface.
			assert.ok(
				action.action === "start_unit_hat" ||
					action.action === "unit_outputs_empty_iterations",
				`expected dispatch or structural surface, got: ${action.action} — ${action.message ?? ""}`,
			)
		},
	)
})

test("cursor: empty outputs: + empty iterations + started_at → v3-migrated placeholder path still works", async () => {
	// Regression: the task #28 narrowing must NOT break legitimate v3
	// migrated placeholders. A unit with `started_at` set, empty
	// iterations, AND no outputs declared is the canonical migrated
	// shape and should still count as complete.
	if (!HAS_GIT) return
	await withTmpRepo(
		"iter-guard-v3-migrated",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test" })
			seedVerifiedElaboration({ intentDir, stage: "design" })

			writeUnit(intentDir, "design", "unit-01-v3", {
				title: "v3-migrated",
				depends_on: [],
				inputs: [],
				outputs: [], // explicit no-outputs declaration
				started_at: "2026-04-01T00:00:00Z",
				iterations: [],
				reviews: {},
				approvals: {},
				discovery: {},
			})

			const action = await runTick(repoRoot, slug)
			// V3-migrated placeholder: stage walks past, lands on
			// downstream review/approval/complete actions or noop.
			// The unbuilt-with-outputs surface must NOT fire here.
			assert.notStrictEqual(
				action.action,
				"unit_outputs_empty_iterations",
				`v3-migrated placeholder must not trip task #28 guard; got: ${action.action}`,
			)
		},
	)
})

test("cursor: multiple units with declared outputs + empty iterations → all listed in the guard action", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"iter-guard-multi",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test" })
			seedVerifiedElaboration({ intentDir, stage: "design" })

			// Three units, all stranded (started but never ran a hat),
			// each declares outputs. Without the task #28 fix, all three
			// would silently pass via the v3-migrated placeholder path,
			// the stage would advance to spec review, and spec review
			// would file 3x `unit_outputs_empty` FBs.
			for (const n of ["03", "04", "05"]) {
				writeUnit(intentDir, "design", `unit-${n}-stranded`, {
					title: `stranded ${n}`,
					depends_on: [],
					inputs: [],
					outputs: [`artifacts/${n}.md`],
					started_at: "2026-04-01T00:00:00Z",
					iterations: [],
					reviews: {},
					approvals: {},
					discovery: {},
				})
			}

			const action = await runTick(repoRoot, slug)
			// One of two acceptable outcomes — both indicate the stage
			// is NOT advancing to review with unbuilt units.
			if (action.action === "unit_outputs_empty_iterations") {
				assert.strictEqual(action.stage, "design")
				assert.deepStrictEqual([...(action.units ?? [])].sort(), [
					"unit-03-stranded",
					"unit-04-stranded",
					"unit-05-stranded",
				])
			} else {
				// Re-dispatch — also acceptable. The first hat picks up
				// the empty-iterations units.
				assert.strictEqual(
					action.action,
					"start_unit_hat",
					`expected guard or dispatch; got: ${action.action} — ${action.message ?? ""}`,
				)
			}
		},
	)
})
