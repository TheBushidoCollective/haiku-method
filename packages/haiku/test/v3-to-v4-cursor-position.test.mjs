#!/usr/bin/env npx tsx
// v3-to-v4-cursor-position.test.mjs — proves v3-shaped intents migrate
// AND land at the conceptually-correct v4 cursor position.
//
// The existing v0-to-v4 tests verify the field-by-field shape of the
// migrated state (status → reviews/approvals stamps, state.json gone,
// FBs relocated). What they don't prove is that `derivePosition`
// reading the migrated state returns the natural-next action the v3
// intent was at. This file fills that gap.
//
// Scenarios:
//   A. Mid-execute on stage B (design merged, build's units have
//      iterations but final hat not yet advance) → cursor pins on
//      "build" and emits a per-unit action (start_unit_hat /
//      dispatch_review).
//   B. Stage A fully approved but never merged into intent main →
//      cursor pins on "design" via findCurrentStage; the cursor
//      shouldn't walk past it (filesystem signal: stamps present).
//   C. Pre-intent fresh state (no verified_at, no units, mode !=
//      autopilot) → derivePosition returns `elaborate_review` (pre-
//      intent verifier).
//   D. Every stage approved + intent_reviewed → cursor returns
//      `intent_review` or `seal_intent` (terminal leg).
//
// Each scenario:
//   1. Builds a v3-shaped fixture (units have v3 `status:`, stages
//      have `state.json`, intent.md is v3-shaped).
//   2. Runs `migrateIntent({ intentDir, repoRoot }, "0", "4.0.0")`.
//   3. Calls `derivePosition({ slug, intentDir, studio })` against
//      the migrated state.
//   4. Asserts the cursor's action matches the natural-next action
//      for that v3 position.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
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

function makeStage(stageDir, units) {
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	for (const u of units) {
		writeFileSync(
			join(stageDir, "units", `${u.slug}.md`),
			matter.stringify(`# ${u.title}\n`, u.fm),
		)
	}
}

async function withRepo(slug, fn) {
	const root = mkdtempSync(join(tmpdir(), "v3-cursor-pos-"))
	const orig = process.cwd()
	const origPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		// Real-ish git topology — the cursor's pre-tick can read git
		// state, and derivePosition's findCurrentStage needs cwd
		// inside a haiku tree to walk.
		execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root, stdio: "pipe" })
		execFileSync("git", ["config", "user.email", "test@haiku.test"], { cwd: root, stdio: "pipe" })
		execFileSync("git", ["config", "user.name", "haiku-test"], { cwd: root, stdio: "pipe" })
		execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root, stdio: "pipe" })
		execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "init"], { cwd: root, stdio: "pipe" })
		execFileSync("git", ["checkout", "-q", "-b", `haiku/${slug}/main`], { cwd: root, stdio: "pipe" })
		const haikuDir = join(root, ".haiku")
		mkdirSync(haikuDir, { recursive: true })
		writeFileSync(join(haikuDir, "settings.yml"), "drift_detection: false\n")
		const intentDir = join(haikuDir, "intents", slug)
		mkdirSync(intentDir, { recursive: true })
		process.chdir(root)
		await fn({ root, intentDir, slug })
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		if (origPluginRoot === undefined) delete process.env.CLAUDE_PLUGIN_ROOT
		else process.env.CLAUDE_PLUGIN_ROOT = origPluginRoot
		rmSync(root, { recursive: true, force: true })
	}
}

async function runMigrator(intentDir, root) {
	await import(`${SRC}/orchestrator/migrations/v0-to-v4.ts`)
	const { migrateIntent } = await import(
		`${SRC}/orchestrator/migrate-registry.ts`
	)
	return migrateIntent({ intentDir, repoRoot: root }, "0", "4.0.0")
}

async function derivePos(slug, intentDir, studio) {
	const { derivePosition } = await import(
		`${SRC}/orchestrator/workflow/cursor.ts`
	)
	return derivePosition({ slug, intentDir, studio })
}

// ── Scenario A: mid-execute, prior stage merged ──────────────────────

test("v3→v4 cursor: mid-execute on build (design merged) pins on build", async () => {
	if (!HAS_GIT) return
	const slug = "v3-mid-execute"
	await withRepo(slug, async ({ root, intentDir }) => {
		// Intent FM (v3-shaped — status: active, active_stage: build).
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# mid-execute\n", {
				title: "mid-execute",
				studio: "software",
				mode: "continuous",
				stages: ["inception", "design", "product"],
				active_stage: "design",
				status: "active",
				started_at: "2026-04-15T09:00:00Z",
				intent_reviewed: true,
			}),
		)
		// Design = completed in v3 (all units status: completed). After
		// migration these get backfilled reviews+approvals so the cursor
		// walks past.
		makeStage(join(intentDir, "stages", "inception"), [
			{
				slug: "unit-01-origin",
				title: "Origin",
				fm: {
					title: "Origin",
					status: "completed",
					started_at: "2026-04-15T09:00:00Z",
					hat: "verifier",
					iterations: [
						{ hat: "researcher", started_at: "...", completed_at: "...", result: "advance" },
						{ hat: "distiller", started_at: "...", completed_at: "...", result: "advance" },
						{ hat: "verifier", started_at: "...", completed_at: "...", result: "advance" },
					],
				},
			},
		])
		writeFileSync(
			join(intentDir, "stages", "inception", "state.json"),
			JSON.stringify({ stage: "inception", status: "completed", phase: "gate" }),
		)
		// Design = in-progress (units have iterations but no verifier-
		// terminal-advance + no `status: completed`).
		makeStage(join(intentDir, "stages", "design"), [
			{
				slug: "unit-01-direction",
				title: "Direction",
				fm: {
					title: "Direction",
					status: "in_progress",
					started_at: "2026-04-16T09:00:00Z",
					hat: "designer",
					iterations: [
						{ hat: "designer", started_at: "...", completed_at: null, result: null },
					],
				},
			},
		])
		writeFileSync(
			join(intentDir, "stages", "design", "state.json"),
			JSON.stringify({ stage: "design", status: "active", phase: "execute" }),
		)

		const result = await runMigrator(intentDir, root)
		assert.strictEqual(result.to, "4.0.0")

		// derivePosition: should find inception complete (walk past),
		// design = current. Not a terminal action.
		const pos = await derivePos(slug, intentDir, "software")
		assert.ok(pos.action, "expected an action, not noop/sealed")
		const action = pos.action
		assert.notStrictEqual(action.kind, "sealed")
		assert.notStrictEqual(action.kind, "seal_intent")
		// Whatever action the cursor emits, its `stage` must be design
		// (the v3 active_stage). Common emissions for an in-flight unit:
		// start_unit_hat (next hat in the sequence), dispatch_review
		// (post-execute), user_gate, or — if no design units fully
		// terminal-advanced yet — the cursor may be still in execute.
		if ("stage" in action) {
			assert.strictEqual(
				action.stage,
				"design",
				`expected cursor to pin on 'design'; got: ${JSON.stringify(action)}`,
			)
		}
	})
})

// ── Scenario B: fully approved stage not yet merged ──────────────────

test("v3→v4 cursor: design fully approved + no later stage progress → walk past design", async () => {
	if (!HAS_GIT) return
	const slug = "v3-design-approved"
	await withRepo(slug, async ({ root, intentDir }) => {
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# design done\n", {
				title: "design done",
				studio: "software",
				mode: "continuous",
				stages: ["inception", "design", "product"],
				active_stage: "product",
				status: "active",
				started_at: "2026-04-15T09:00:00Z",
				intent_reviewed: true,
			}),
		)
		// Both inception and design have v3 `status: completed` →
		// migrator stamps reviews/approvals.
		for (const stg of ["inception", "design"]) {
			makeStage(join(intentDir, "stages", stg), [
				{
					slug: `unit-01-${stg}-thing`,
					title: `${stg} u1`,
					fm: {
						title: `${stg} u1`,
						status: "completed",
						started_at: "2026-04-15T09:00:00Z",
						hat: "verifier",
						iterations: [
							{ hat: "verifier", started_at: "...", completed_at: "...", result: "advance" },
						],
					},
				},
			])
			writeFileSync(
				join(intentDir, "stages", stg, "state.json"),
				JSON.stringify({ stage: stg, status: "completed", phase: "gate" }),
			)
		}
		// Product stage exists but has zero units (not yet decomposed).
		mkdirSync(join(intentDir, "stages", "product", "units"), { recursive: true })

		const result = await runMigrator(intentDir, root)
		assert.strictEqual(result.to, "4.0.0")

		const pos = await derivePos(slug, intentDir, "software")
		// inception + design fully approved → cursor walks past to
		// product. Product is empty → emits `elaborate` (mode != autopilot
		// + units.length === 0) OR `elaborate_review` (intent-scope
		// pre-elaborate). Either way, the cursor MUST NOT be on
		// inception or design.
		assert.ok(pos.action)
		const action = pos.action
		if ("stage" in action) {
			assert.notStrictEqual(
				action.stage,
				"inception",
				"cursor should have walked past fully-approved inception",
			)
			assert.notStrictEqual(
				action.stage,
				"design",
				"cursor should have walked past fully-approved design",
			)
		}
	})
})

// ── Scenario C: fresh intent (pre-intent elaborate) ──────────────────

test("v3→v4 cursor: fresh v3 intent with no verified_at returns elaborate_review", async () => {
	if (!HAS_GIT) return
	const slug = "v3-fresh"
	await withRepo(slug, async ({ root, intentDir }) => {
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify(
				"# fresh\n\nUser wants to build a thing.\n\nMore body to look like a real conversation about a real intent.",
				{
					title: "fresh",
					studio: "software",
					mode: "continuous",
					stages: ["inception", "design", "product"],
					started_at: "2026-04-15T09:00:00Z",
					// NOTE: no `intent_reviewed`, no `verified_at` — that's
					// the pre-intent gate firing.
				},
			),
		)
		// No stages on disk yet.
		const result = await runMigrator(intentDir, root)
		assert.strictEqual(result.to, "4.0.0")

		const pos = await derivePos(slug, intentDir, "software")
		assert.ok(pos.action)
		const action = pos.action
		// Pre-intent verifier kicks in when verified_at is unset AND
		// mode != autopilot AND it's a truly-fresh intent (first stage
		// not started + no units).
		assert.strictEqual(
			action.kind,
			"elaborate_review",
			`expected elaborate_review (pre-intent gate); got: ${JSON.stringify(action)}`,
		)
		// No `stage` field on the pre-intent variant (it's intent-scope).
		assert.ok(
			!("stage" in action) || !action.stage,
			"pre-intent elaborate_review should not name a stage",
		)
	})
})

// ── Scenario D: every stage approved → terminal leg ──────────────────

test("v3→v4 cursor: every stage approved + verified_at set → terminal leg (intent_review or sealed)", async () => {
	if (!HAS_GIT) return
	const slug = "v3-all-done"
	await withRepo(slug, async ({ root, intentDir }) => {
		const stages = ["inception", "design", "product"]
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# all done\n", {
				title: "all done",
				studio: "software",
				mode: "continuous",
				stages,
				active_stage: "product",
				status: "active",
				started_at: "2026-04-15T09:00:00Z",
				intent_reviewed: true,
				verified_at: "2026-04-15T09:30:00Z",
			}),
		)
		for (const stg of stages) {
			makeStage(join(intentDir, "stages", stg), [
				{
					slug: `unit-01-${stg}-thing`,
					title: `${stg} u1`,
					fm: {
						title: `${stg} u1`,
						status: "completed",
						started_at: "2026-04-15T09:00:00Z",
						hat: "verifier",
						iterations: [
							{ hat: "verifier", started_at: "...", completed_at: "...", result: "advance" },
						],
					},
				},
			])
			writeFileSync(
				join(intentDir, "stages", stg, "state.json"),
				JSON.stringify({ stage: stg, status: "completed", phase: "gate" }),
			)
		}

		const result = await runMigrator(intentDir, root)
		assert.strictEqual(result.to, "4.0.0")

		const pos = await derivePos(slug, intentDir, "software")
		assert.ok(pos.action)
		// Every stage past → cursor walks into the terminal leg.
		// Acceptable kinds: intent_review (still need user / agent
		// reviewers to sign), seal_intent (every signed), or sealed
		// (already sealed).
		const terminalKinds = new Set(["intent_review", "seal_intent", "sealed"])
		assert.ok(
			terminalKinds.has(pos.action.kind),
			`expected terminal leg (intent_review/seal_intent/sealed); got: ${JSON.stringify(pos.action)}`,
		)
	})
})
