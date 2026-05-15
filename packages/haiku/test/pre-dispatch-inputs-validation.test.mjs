#!/usr/bin/env npx tsx
// pre-dispatch-inputs-validation.test.mjs — Task #25.
//
// The cursor must refuse to dispatch a hat for a unit whose
// frontmatter has no `inputs:` field at all on a non-first stage.
// `haiku_repair` flags this drift with the message "Unit has no
// inputs: — execution will be blocked"; the engine catches it
// natively here so repair never has to be a normal recovery step.
//
// Distinct from `unit_inputs_missing` (declared paths that don't
// exist on disk — that gate fires inside `haiku_unit_start`). This
// gate fires earlier, on `haiku_run_next`, when the field itself
// is absent.

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

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

async function withTmpRepo(slug, fn) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-inputs-gate-"))
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

function twoStageStudio({ repoRoot }) {
	return makeStudio({
		repoRoot,
		studio: "test",
		stages: [
			{
				name: "design",
				hats: ["planner", "builder", "verifier"],
				fix_hats: ["builder", "feedback-assessor"],
				review: "ask",
				review_agents: ["code-reviewer"],
			},
			{
				name: "build",
				hats: ["planner", "builder", "verifier"],
				fix_hats: ["builder", "feedback-assessor"],
				review: "ask",
				review_agents: ["code-reviewer"],
			},
		],
	})
}

/**
 * Merge the `design` stage branch into intent main so the cursor
 * walks past it on subsequent ticks. The test fixtures put unit
 * writes on the stage branch; `findCurrentStage` walks intent main's
 * tree, so without an explicit merge the stage stays "active" on
 * main even when it's "complete" on the stage branch.
 */
function mergeStageToMain(repoRoot, slug, stage) {
	const stageBranch = `haiku/${slug}/${stage}`
	const mainBranch = `haiku/${slug}/main`
	const origBranch = (() => {
		try {
			return git(repoRoot, "branch", "--show-current")
		} catch {
			return ""
		}
	})()
	try {
		git(repoRoot, "checkout", "-q", stageBranch)
		try {
			git(repoRoot, "add", "-A")
			git(repoRoot, "commit", "-m", `seed ${stage}`)
		} catch {
			/* nothing to commit */
		}
		git(repoRoot, "checkout", "-q", mainBranch)
		git(
			repoRoot,
			"merge",
			"--no-ff",
			"--no-edit",
			"-m",
			`merge ${stage}`,
			stageBranch,
		)
	} finally {
		if (origBranch) {
			try {
				git(repoRoot, "checkout", "-q", origBranch)
			} catch {}
		}
	}
}

/**
 * Seed a "stage 0 complete" state: design has a verified
 * elaboration, one fully-stamped unit, and its branch is merged
 * into intent main. The cursor walks past design on the next tick.
 */
function seedCompleteDesign({ intentDir, repoRoot, slug }) {
	seedVerifiedElaboration({ intentDir, stage: "design" })
	writeUnit(intentDir, "design", "unit-01-done", {
		title: "done",
		depends_on: [],
		inputs: [],
		outputs: [],
		started_at: "2026-04-01T00:00:00Z",
		iterations: [
			{
				hat: "planner",
				started_at: "2026-04-01T00:00:00Z",
				completed_at: "2026-04-01T00:01:00Z",
				result: "advance",
			},
			{
				hat: "builder",
				started_at: "2026-04-01T00:01:00Z",
				completed_at: "2026-04-01T00:02:00Z",
				result: "advance",
			},
			{
				hat: "verifier",
				started_at: "2026-04-01T00:02:00Z",
				completed_at: "2026-04-01T00:03:00Z",
				result: "advance",
			},
		],
		reviews: {
			spec: { at: "2026-04-01T00:04:00Z" },
			"code-reviewer": { at: "2026-04-01T00:05:00Z" },
			user: { at: "2026-04-01T00:06:00Z" },
		},
		approvals: {
			spec: { at: "2026-04-01T00:07:00Z" },
			quality_gates: { at: "2026-04-01T00:08:00Z" },
			"code-reviewer": { at: "2026-04-01T00:09:00Z" },
			user: { at: "2026-04-01T00:10:00Z" },
		},
		discovery: {},
	})
	mergeStageToMain(repoRoot, slug, "design")
}

test("cursor: wave-ready unit on non-first stage with missing inputs: field → unit_inputs_not_declared", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"inputs-gate-wave",
		async ({ repoRoot, intentDir, slug }) => {
			twoStageStudio({ repoRoot })
			makeIntent({ intentDir, slug, studio: "test" })

			seedCompleteDesign({ intentDir, repoRoot, slug })

			// On `build` (non-first stage), seed a wave-ready unit that
			// omits the `inputs:` field entirely. Cursor should refuse.
			seedVerifiedElaboration({ intentDir, stage: "build" })
			writeUnit(intentDir, "build", "unit-01-no-inputs", {
				title: "missing inputs",
				depends_on: [],
				// inputs: <-- intentionally absent
				started_at: null,
				iterations: [],
				reviews: {},
				approvals: {},
				discovery: {},
			})

			const action = await runTick(repoRoot, slug)
			assert.strictEqual(
				action.action,
				"unit_inputs_not_declared",
				`expected unit_inputs_not_declared, got: ${action.action} — ${action.message ?? ""}`,
			)
			assert.strictEqual(action.stage, "build")
			assert.deepStrictEqual(action.units, ["unit-01-no-inputs"])
		},
	)
})

test("cursor: started unit on non-first stage with missing inputs: field → unit_inputs_not_declared (needNextHat path)", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"inputs-gate-started",
		async ({ repoRoot, intentDir, slug }) => {
			twoStageStudio({ repoRoot })
			makeIntent({ intentDir, slug, studio: "test" })

			seedCompleteDesign({ intentDir, repoRoot, slug })

			seedVerifiedElaboration({ intentDir, stage: "build" })
			writeUnit(intentDir, "build", "unit-01-mid", {
				title: "mid-flight no inputs",
				depends_on: [],
				// inputs: <-- absent
				started_at: "2026-04-01T00:00:00Z",
				iterations: [
					{
						hat: "planner",
						started_at: "2026-04-01T00:00:00Z",
						completed_at: "2026-04-01T00:10:00Z",
						result: "advance",
					},
				],
				reviews: {},
				approvals: {},
				discovery: {},
			})

			const action = await runTick(repoRoot, slug)
			assert.strictEqual(
				action.action,
				"unit_inputs_not_declared",
				`expected unit_inputs_not_declared, got: ${action.action} — ${action.message ?? ""}`,
			)
			assert.strictEqual(action.stage, "build")
			assert.ok(
				(action.units ?? []).includes("unit-01-mid"),
				`units should list the offending one; got: ${JSON.stringify(action.units)}`,
			)
		},
	)
})

test("cursor: explicit empty inputs: [] on non-first stage is a valid declaration → start_unit_hat", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"inputs-gate-empty-ok",
		async ({ repoRoot, intentDir, slug }) => {
			twoStageStudio({ repoRoot })
			makeIntent({ intentDir, slug, studio: "test" })

			seedCompleteDesign({ intentDir, repoRoot, slug })

			seedVerifiedElaboration({ intentDir, stage: "build" })
			writeUnit(intentDir, "build", "unit-01-empty", {
				title: "empty inputs",
				depends_on: [],
				inputs: [], // explicit "no inputs" — valid
				started_at: null,
				iterations: [],
				reviews: {},
				approvals: {},
				discovery: {},
			})

			const action = await runTick(repoRoot, slug)
			assert.strictEqual(
				action.action,
				"start_unit_hat",
				`expected start_unit_hat, got: ${action.action} — ${action.message ?? ""}`,
			)
			assert.strictEqual(action.stage, "build")
		},
	)
})

test("cursor: first stage exempted — missing inputs: does NOT trigger the gate", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"inputs-gate-first-stage-exempt",
		async ({ repoRoot, intentDir, slug }) => {
			twoStageStudio({ repoRoot })
			makeIntent({ intentDir, slug, studio: "test" })

			seedVerifiedElaboration({ intentDir, stage: "design" })
			// First stage (design): wave-ready unit with no inputs:
			// field. Should still dispatch — first stage has nothing
			// upstream to draw inputs from.
			writeUnit(intentDir, "design", "unit-01-first", {
				title: "first stage",
				depends_on: [],
				// inputs: <-- absent, but design is the first stage
				started_at: null,
				iterations: [],
				reviews: {},
				approvals: {},
				discovery: {},
			})

			const action = await runTick(repoRoot, slug)
			assert.strictEqual(
				action.action,
				"start_unit_hat",
				`first stage exempt; expected start_unit_hat, got: ${action.action} — ${action.message ?? ""}`,
			)
			assert.strictEqual(action.stage, "design")
		},
	)
})
