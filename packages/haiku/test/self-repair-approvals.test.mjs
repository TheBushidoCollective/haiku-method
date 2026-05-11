#!/usr/bin/env npx tsx
// self-repair-approvals.test.mjs
//
// Covers `selfRepairMissingApprovals`: pre-tick gate that synthesizes
// review/approval stamps on stages whose units are iteration-complete
// but have no stamps AND have demonstrably been moved past (a later
// stage has on-disk work).
//
// Real-world reproducer: a v3 intent migrated to v4 whose migrator
// writes never landed on the cursor-reachable copy of the unit files,
// leaving inception/design with terminal-advance iterations but no
// reviews/approvals. The cursor pins on the earliest such stage and
// re-emits `dispatch_review(spec)` every tick.

import assert from "node:assert"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"
import { initTestRepo, makeIntent, makeStudio } from "./_v4-fixtures.mjs"

async function withTmpRepo(slug, fn) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-self-repair-"))
	const stableCwd = tmpdir()
	const origCwd = process.cwd()
	try {
		const repo = initTestRepo({ repoRoot: dir, slug })
		// `selfRepairMissingApprovals` reads via cwd-driven studio
		// resolvers. Tests must chdir into the repo so resolveStageHats
		// finds the studio definitions written by makeStudio.
		process.chdir(dir)
		// Clear the studio resolver cache so a prior test's studio
		// definitions at a (now-deleted) tmp path don't shadow this
		// test's freshly-written studio.
		const { clearStudioCache } = await import("../src/studio-reader.js")
		clearStudioCache()
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

// Writes a unit with terminal-advance iterations but no review/approval
// stamps — the "migrated, stamps never landed" shape.
function writeIterationCompleteUnit(intentDir, stage, name) {
	const unitsDir = join(intentDir, "stages", stage, "units")
	mkdirSync(unitsDir, { recursive: true })
	const at = "2026-04-27T19:00:00Z"
	const fm = {
		title: name,
		started_at: at,
		iterations: [
			{ hat: "planner", started_at: at, completed_at: at, result: "advance" },
			{ hat: "builder", started_at: at, completed_at: at, result: "advance" },
			{ hat: "verifier", started_at: at, completed_at: at, result: "advance" },
		],
		// No reviews:, no approvals: — the migrator-skipped shape.
	}
	writeFileSync(
		join(unitsDir, `${name}.md`),
		matter.stringify(`# ${name}\n`, fm),
	)
	return join(unitsDir, `${name}.md`)
}

// Mark a later stage as "has work" so the self-repair trigger fires.
function markStageVisited(intentDir, stage) {
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(stageDir, { recursive: true })
	writeFileSync(join(stageDir, "elaboration.md"), "stage visited\n")
}

test("self-repair: backfills stamps when later stage has work", async () => {
	await withTmpRepo("self-repair-basic", async ({ repoRoot, intentDir }) => {
		makeStudio({
			repoRoot,
			studio: "ms",
			stages: ["a", "b"].map((name) => ({
				name,
				hats: ["planner", "builder", "verifier"],
				fix_hats: ["builder", "feedback-assessor"],
				review: "auto",
				review_agents: ["code-reviewer"],
			})),
		})
		makeIntent({
			intentDir,
			slug: "self-repair-basic",
			studio: "ms",
			extraFm: { stages: ["a", "b"] },
		})

		const unitPath = writeIterationCompleteUnit(intentDir, "a", "unit-01-foo")
		markStageVisited(intentDir, "b")

		const { selfRepairMissingApprovals } = await import(
			"../src/orchestrator/workflow/self-repair-approvals.js"
		)
		const result = selfRepairMissingApprovals(intentDir, "ms", "continuous")

		assert.deepStrictEqual(result.stagesRepaired, ["a"])
		assert.strictEqual(result.unitsTouched, 1)
		assert.ok(result.reviewsAdded > 0, "reviews should be stamped")
		assert.ok(result.approvalsAdded > 0, "approvals should be stamped")

		// Verify on disk: stamps land with `migrated: true` flag.
		const fm = matter(readFileSync(unitPath, "utf8")).data
		assert.ok(fm.reviews.spec, "spec review stamped")
		assert.strictEqual(fm.reviews.spec.migrated, true)
		assert.ok(fm.approvals.spec, "spec approval stamped")
		assert.strictEqual(fm.approvals.spec.migrated, true)
		assert.ok(fm.approvals.quality_gates, "quality_gates approval stamped")
		// Configured agent (code-reviewer) gets stamped too.
		assert.ok(fm.reviews["code-reviewer"], "review-agent review stamped")
		assert.ok(fm.approvals["code-reviewer"], "review-agent approval stamped")
	})
})

test("self-repair: skips when no later stage has work", async () => {
	await withTmpRepo(
		"self-repair-no-later-work",
		async ({ repoRoot, intentDir }) => {
			makeStudio({
				repoRoot,
				studio: "ms",
				stages: ["a", "b"].map((name) => ({
					name,
					hats: ["planner", "builder", "verifier"],
					fix_hats: ["builder", "feedback-assessor"],
					review: "auto",
					review_agents: [],
				})),
			})
			makeIntent({
				intentDir,
				slug: "self-repair-no-later-work",
				studio: "ms",
				extraFm: { stages: ["a", "b"] },
			})

			const unitPath = writeIterationCompleteUnit(intentDir, "a", "unit-01-foo")
			// Don't mark b visited.

			const { selfRepairMissingApprovals } = await import(
				"../src/orchestrator/workflow/self-repair-approvals.js"
			)
			const result = selfRepairMissingApprovals(intentDir, "ms", "continuous")

			assert.deepStrictEqual(result.stagesRepaired, [])
			assert.strictEqual(result.unitsTouched, 0)

			// Verify on disk: unit still has no stamps (cursor should walk
			// it normally as "missing review").
			const fm = matter(readFileSync(unitPath, "utf8")).data
			assert.deepStrictEqual(fm.reviews ?? {}, {})
			assert.deepStrictEqual(fm.approvals ?? {}, {})
		},
	)
})

test("self-repair: fills in missing roles on partially-stamped units", async () => {
	await withTmpRepo("self-repair-partial", async ({ repoRoot, intentDir }) => {
		makeStudio({
			repoRoot,
			studio: "ms",
			stages: ["a", "b"].map((name) => ({
				name,
				hats: ["planner", "builder", "verifier"],
				fix_hats: ["builder", "feedback-assessor"],
				review: "auto",
				review_agents: [],
			})),
		})
		makeIntent({
			intentDir,
			slug: "self-repair-partial",
			studio: "ms",
			extraFm: { stages: ["a", "b"] },
		})

		// Unit with ONE existing review stamp (spec) — missing user.
		// Migrator-half-completed shape. Self-repair fills the gaps.
		const unitsDir = join(intentDir, "stages", "a", "units")
		mkdirSync(unitsDir, { recursive: true })
		const at = "2026-04-27T19:00:00Z"
		const existingStamp = { at: "2026-04-27T19:30:00Z" }
		const fm = {
			title: "foo",
			started_at: at,
			iterations: [
				{ hat: "planner", started_at: at, completed_at: at, result: "advance" },
				{ hat: "builder", started_at: at, completed_at: at, result: "advance" },
				{
					hat: "verifier",
					started_at: at,
					completed_at: at,
					result: "advance",
				},
			],
			reviews: { spec: existingStamp },
			approvals: {},
		}
		const unitPath = join(unitsDir, "unit-01-foo.md")
		writeFileSync(unitPath, matter.stringify("# foo\n", fm))
		markStageVisited(intentDir, "b")

		const { selfRepairMissingApprovals } = await import(
			"../src/orchestrator/workflow/self-repair-approvals.js"
		)
		const result = selfRepairMissingApprovals(intentDir, "ms", "continuous")

		assert.deepStrictEqual(result.stagesRepaired, ["a"])
		assert.strictEqual(result.unitsTouched, 1)

		// Existing spec stamp preserved as-is; missing user role +
		// approval roles synthesized.
		const fmAfter = matter(readFileSync(unitPath, "utf8")).data
		assert.deepStrictEqual(
			fmAfter.reviews.spec,
			existingStamp,
			"existing stamp must not be overwritten",
		)
		assert.ok(fmAfter.reviews.user, "missing review role gets synthesized")
		assert.strictEqual(fmAfter.reviews.user.migrated, true)
		assert.ok(fmAfter.approvals.spec, "spec approval gets synthesized")
		assert.ok(fmAfter.approvals.user, "user approval gets synthesized")
	})
})

test("self-repair: half-stamped stages — some units bare, some fully stamped", async () => {
	// Real-world reproducer (admin-portal-reimagine on 2026-05-11):
	// migrator stamped some inception units but not others. The cursor
	// pins on the un-stamped ones forever. Self-repair must stamp those
	// without touching the units that already have stamps.
	await withTmpRepo(
		"self-repair-half-stamped",
		async ({ repoRoot, intentDir }) => {
			makeStudio({
				repoRoot,
				studio: "ms",
				stages: ["a", "b"].map((name) => ({
					name,
					hats: ["planner", "builder", "verifier"],
					fix_hats: ["builder", "feedback-assessor"],
					review: "auto",
					review_agents: [],
				})),
			})
			makeIntent({
				intentDir,
				slug: "self-repair-half-stamped",
				studio: "ms",
				extraFm: { stages: ["a", "b"] },
			})

			const unitsDir = join(intentDir, "stages", "a", "units")
			mkdirSync(unitsDir, { recursive: true })
			const at = "2026-04-27T19:00:00Z"
			const fullyStamped = {
				at: "2026-04-27T19:30:00Z",
				migrated: true,
			}
			const bareIterations = [
				{ hat: "planner", started_at: at, completed_at: at, result: "advance" },
				{ hat: "builder", started_at: at, completed_at: at, result: "advance" },
				{
					hat: "verifier",
					started_at: at,
					completed_at: at,
					result: "advance",
				},
			]

			// Unit 1: bare (no stamps)
			const bareFm = {
				title: "bare",
				started_at: at,
				iterations: bareIterations,
			}
			const barePath = join(unitsDir, "unit-01-bare.md")
			writeFileSync(barePath, matter.stringify("# bare\n", bareFm))

			// Unit 2: fully stamped already
			const stampedFm = {
				title: "stamped",
				started_at: at,
				iterations: bareIterations,
				reviews: { spec: fullyStamped, user: fullyStamped },
				approvals: {
					spec: fullyStamped,
					quality_gates: fullyStamped,
					user: fullyStamped,
				},
			}
			const stampedPath = join(unitsDir, "unit-02-stamped.md")
			writeFileSync(stampedPath, matter.stringify("# stamped\n", stampedFm))

			markStageVisited(intentDir, "b")

			const { selfRepairMissingApprovals } = await import(
				"../src/orchestrator/workflow/self-repair-approvals.js"
			)
			const result = selfRepairMissingApprovals(intentDir, "ms", "continuous")

			assert.deepStrictEqual(result.stagesRepaired, ["a"])
			assert.strictEqual(
				result.unitsTouched,
				1,
				"only the bare unit should be touched",
			)

			// Bare unit: now has stamps.
			const bareAfter = matter(readFileSync(barePath, "utf8")).data
			assert.ok(bareAfter.reviews.spec)
			assert.ok(bareAfter.approvals.spec)
			assert.strictEqual(bareAfter.reviews.spec.migrated, true)

			// Stamped unit: unchanged. The `migrated: true` flag from
			// setup is preserved (not overwritten with a fresh stamp).
			const stampedAfter = matter(readFileSync(stampedPath, "utf8")).data
			assert.deepStrictEqual(stampedAfter.reviews.spec, fullyStamped)
		},
	)
})

test("self-repair: skips units mid-iteration (no terminal advance)", async () => {
	await withTmpRepo(
		"self-repair-midflight",
		async ({ repoRoot, intentDir }) => {
			makeStudio({
				repoRoot,
				studio: "ms",
				stages: ["a", "b"].map((name) => ({
					name,
					hats: ["planner", "builder", "verifier"],
					fix_hats: ["builder", "feedback-assessor"],
					review: "auto",
					review_agents: [],
				})),
			})
			makeIntent({
				intentDir,
				slug: "self-repair-midflight",
				studio: "ms",
				extraFm: { stages: ["a", "b"] },
			})

			// Unit with iterations stopped at "builder" (mid-flight).
			const unitsDir = join(intentDir, "stages", "a", "units")
			mkdirSync(unitsDir, { recursive: true })
			const at = "2026-04-27T19:00:00Z"
			const fm = {
				title: "foo",
				started_at: at,
				iterations: [
					{
						hat: "planner",
						started_at: at,
						completed_at: at,
						result: "advance",
					},
					{
						hat: "builder",
						started_at: at,
						completed_at: at,
						result: "advance",
					},
				],
			}
			const unitPath = join(unitsDir, "unit-01-foo.md")
			writeFileSync(unitPath, matter.stringify("# foo\n", fm))
			markStageVisited(intentDir, "b")

			const { selfRepairMissingApprovals } = await import(
				"../src/orchestrator/workflow/self-repair-approvals.js"
			)
			const result = selfRepairMissingApprovals(intentDir, "ms", "continuous")

			assert.deepStrictEqual(result.stagesRepaired, [])
			assert.strictEqual(result.unitsTouched, 0)

			// Disk unchanged.
			const fmAfter = matter(readFileSync(unitPath, "utf8")).data
			assert.strictEqual(fmAfter.reviews, undefined)
			assert.strictEqual(fmAfter.approvals, undefined)
		},
	)
})

test("self-repair: never touches the last stage (no later stage by definition)", async () => {
	await withTmpRepo(
		"self-repair-last-stage",
		async ({ repoRoot, intentDir }) => {
			makeStudio({
				repoRoot,
				studio: "ms",
				stages: ["a", "b"].map((name) => ({
					name,
					hats: ["planner", "builder", "verifier"],
					fix_hats: ["builder", "feedback-assessor"],
					review: "auto",
					review_agents: [],
				})),
			})
			makeIntent({
				intentDir,
				slug: "self-repair-last-stage",
				studio: "ms",
				extraFm: { stages: ["a", "b"] },
			})

			// Iteration-complete unit on the LAST stage. No "later stage"
			// exists, so the trigger never fires — self-repair must leave
			// it alone so the cursor can drive the real review track.
			writeIterationCompleteUnit(intentDir, "b", "unit-01-bar")

			const { selfRepairMissingApprovals } = await import(
				"../src/orchestrator/workflow/self-repair-approvals.js"
			)
			const result = selfRepairMissingApprovals(intentDir, "ms", "continuous")

			assert.deepStrictEqual(result.stagesRepaired, [])
			assert.strictEqual(result.unitsTouched, 0)
		},
	)
})

test("self-repair: autopilot mode synthesizes trimmed role set (spec + quality_gates only)", async () => {
	// In autopilot mode the role lists are intentionally trimmed:
	//   reviewRoles    = ["spec"]
	//   approvalRoles  = ["spec", "quality_gates"]
	// No agent reviewers, no user gate. This test pins that behavior so
	// future role-list changes don't silently broaden the autopilot
	// surface (which would stamp gates that autopilot is supposed to
	// skip entirely).
	await withTmpRepo(
		"self-repair-autopilot",
		async ({ repoRoot, intentDir }) => {
			makeStudio({
				repoRoot,
				studio: "ms",
				stages: ["a", "b"].map((name) => ({
					name,
					hats: ["planner", "builder", "verifier"],
					fix_hats: ["builder", "feedback-assessor"],
					review: "auto",
					review_agents: ["code-reviewer"], // present in studio
				})),
			})
			makeIntent({
				intentDir,
				slug: "self-repair-autopilot",
				studio: "ms",
				mode: "autopilot",
				extraFm: { stages: ["a", "b"] },
			})

			const unitPath = writeIterationCompleteUnit(intentDir, "a", "unit-01-foo")
			markStageVisited(intentDir, "b")

			const { selfRepairMissingApprovals } = await import(
				"../src/orchestrator/workflow/self-repair-approvals.js"
			)
			const result = selfRepairMissingApprovals(intentDir, "ms", "autopilot")
			assert.deepStrictEqual(result.stagesRepaired, ["a"])

			const fm = matter(readFileSync(unitPath, "utf8")).data
			// Autopilot reviews: spec only.
			assert.ok(fm.reviews.spec, "spec review stamped")
			assert.strictEqual(
				fm.reviews.user,
				undefined,
				"autopilot must NOT synthesize user review",
			)
			assert.strictEqual(
				fm.reviews["code-reviewer"],
				undefined,
				"autopilot must NOT synthesize review-agent reviews",
			)
			// Autopilot approvals: spec + quality_gates only.
			assert.ok(fm.approvals.spec, "spec approval stamped")
			assert.ok(fm.approvals.quality_gates, "quality_gates approval stamped")
			assert.strictEqual(
				fm.approvals.user,
				undefined,
				"autopilot must NOT synthesize user approval",
			)
			assert.strictEqual(
				fm.approvals["code-reviewer"],
				undefined,
				"autopilot must NOT synthesize review-agent approvals",
			)
		},
	)
})
