#!/usr/bin/env npx tsx
// elaborate-gate.test.mjs — Dedicated coverage for the 2026-05-08
// elaborate-gate model: per-stage conversation gate, substance
// verifier, mode-aware bypass, grandfather rule, pre-intent verifier,
// and tool-driven discovery firing pre-units.
//
// These tests are intentionally narrow — each one targets ONE branch
// of the new cursor logic. The broader e2e walks in
// multi-tick-pipeline.test.mjs and real-intent-dry-run.test.mjs
// exercise the full pipeline against the new gates; this file is
// the targeted regression suite for the gate behavior itself.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"
import {
	assertLoopSignal,
	assertNotLoopSignal,
} from "./_elaborate-loop-helpers.mjs"
import { initTestRepo, makeIntent, makeStudio } from "./_v4-fixtures.mjs"

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

async function withTmpRepo(slug, fn) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-elab-gate-"))
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

async function runTick(repoRoot, slug) {
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const { dispatchOrchestratorAction } = await import(
			"../src/orchestrator/workflow/run-tick.js"
		)
		const { clearStudioCache } = await import("../src/studio-reader.js")
		clearStudioCache()
		return dispatchOrchestratorAction(slug, "")
	} finally {
		process.chdir(origCwd)
	}
}

function writeElaboration(intentDir, stage, { verified = false } = {}) {
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(stageDir, { recursive: true })
	const at = new Date().toISOString()
	const fm = {
		recorded_at: at,
		intent: "test-intent",
		stage,
		...(verified ? { verified_at: at, verified_notes: "test" } : {}),
	}
	writeFileSync(
		join(stageDir, "elaboration.md"),
		matter.stringify("Captured conversation body.", fm),
	)
}

// ── Per-stage elaborate gate ─────────────────────────────────────────

test("elaborate gate: fires on fresh stage when mode is continuous", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"elab-gate-fresh",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test", mode: "continuous" })
			const action = await runTick(repoRoot, slug)
			assertLoopSignal(action, "conversation")
			assert.strictEqual(action.stage, "design")
		},
	)
})

test("elaborate gate: bypassed in autopilot mode", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"elab-gate-autopilot",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({
				intentDir,
				slug,
				studio: "test",
				mode: "autopilot",
			})
			const action = await runTick(repoRoot, slug)
			// Autopilot skips the conversation gate AND the verify_conversation
			// gate. The elaborate_loop may still fire for decompose if no
			// units exist, but neither human-conversation signal appears.
			assertNotLoopSignal(action, "conversation")
			assertNotLoopSignal(action, "verify_conversation")
		},
	)
})

test("elaborate_review: fires when artifact exists but unverified", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"elab-review-unverified",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test", mode: "continuous" })
			writeElaboration(intentDir, "design", { verified: false })
			const action = await runTick(repoRoot, slug)
			assertLoopSignal(action, "verify_conversation")
			assert.strictEqual(action.stage, "design")
		},
	)
})

test("elaborate gate: clears when artifact is verified", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"elab-gate-verified",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test", mode: "continuous" })
			writeElaboration(intentDir, "design", { verified: true })
			const action = await runTick(repoRoot, slug)
			// Artifact verified — cursor advances. With no units and no
			// tool-driven discovery, the loop now carries only `decompose`.
			assertLoopSignal(action, "decompose")
			assertNotLoopSignal(action, "verify_conversation")
		},
	)
})

test("elaborate gate: grandfathered when units already exist", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"elab-gate-grandfather",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test", mode: "continuous" })
			// Plant a unit but NO elaboration artifact. Legacy intent
			// pattern: work was done before the gate existed.
			const unitsDir = join(intentDir, "stages", "design", "units")
			mkdirSync(unitsDir, { recursive: true })
			writeFileSync(
				join(unitsDir, "unit-01.md"),
				matter.stringify("u1\n", {
					title: "u1",
					depends_on: [],
					started_at: null,
					iterations: [],
					reviews: {},
					approvals: {},
				}),
			)
			const action = await runTick(repoRoot, slug)
			// Gate skipped — neither conversation nor verify_conversation
			// signal appears on the loop (the cursor falls through past
			// elaborate_loop entirely once the grandfather rule applies).
			assertNotLoopSignal(action, "conversation")
			assertNotLoopSignal(action, "verify_conversation")
		},
	)
})

// ── Pre-intent verifier ──────────────────────────────────────────────

test("pre-intent verifier: fires when intent.md lacks verified_at", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"preintent-verify",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			// Create intent WITHOUT verified_at — explicit opt-out so we can
			// exercise the pre-intent gate.
			makeIntent({
				intentDir,
				slug,
				studio: "test",
				mode: "continuous",
				verifyOnCreate: false,
			})
			const action = await runTick(repoRoot, slug)
			// elaborate_loop with NO stage = pre-intent scope, carrying a
			// single verify_conversation signal.
			assertLoopSignal(action, "verify_conversation")
			assert.strictEqual(action.stage, undefined)
		},
	)
})

test("pre-intent verifier: bypassed in autopilot mode", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"preintent-autopilot",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({
				intentDir,
				slug,
				studio: "test",
				mode: "autopilot",
				verifyOnCreate: false,
			})
			const action = await runTick(repoRoot, slug)
			// Autopilot skips both pre-intent verifier AND per-stage gate.
			assertNotLoopSignal(action, "verify_conversation")
		},
	)
})

test("pre-intent verifier: clears when verified_at is stamped", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"preintent-verified",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({
				intentDir,
				slug,
				studio: "test",
				mode: "continuous",
				verifyOnCreate: true, // default: stamps verified_at
			})
			const action = await runTick(repoRoot, slug)
			// Pre-intent verified — cursor walks into the first stage's
			// elaborate gate (conversation signal).
			assertLoopSignal(action, "conversation")
			assert.strictEqual(action.stage, "design")
		},
	)
})

test("pre-intent verifier: grandfathered when first stage already has units", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"preintent-grandfather",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			// Legacy intent: created before this PR (no verified_at) but
			// the first stage already has unit work on disk. Migration
			// path — gate must NOT block, otherwise every existing
			// non-autopilot intent gets stuck on plugin upgrade.
			makeIntent({
				intentDir,
				slug,
				studio: "test",
				mode: "continuous",
				verifyOnCreate: false,
			})
			const unitsDir = join(intentDir, "stages", "design", "units")
			mkdirSync(unitsDir, { recursive: true })
			writeFileSync(
				join(unitsDir, "unit-01.md"),
				matter.stringify("u1\n", {
					title: "u1",
					depends_on: [],
					started_at: null,
					iterations: [],
					reviews: {},
					approvals: {},
				}),
			)
			const action = await runTick(repoRoot, slug)
			// Pre-intent gate is grandfathered. Cursor walks straight into
			// the per-stage flow (which itself is grandfathered too because
			// elaboration.md is missing AND units exist).
			assertNotLoopSignal(action, "verify_conversation")
		},
	)
})

// ── Tool-driven discovery (design-direction reframe) ─────────────────

test("tool-driven discovery: fires pre-units when template declares tool:", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"tool-discovery-pre-units",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test", mode: "continuous" })
			writeElaboration(intentDir, "design", { verified: true })
			// Plant a tool-driven discovery template.
			const discoveryDir = join(
				repoRoot,
				".haiku",
				"studios",
				"test",
				"stages",
				"design",
				"discovery",
			)
			mkdirSync(discoveryDir, { recursive: true })
			writeFileSync(
				join(discoveryDir, "design-direction.md"),
				"---\nname: design-direction\nlocation: .haiku/intents/{intent-slug}/stages/design/artifacts/design-direction.md\nrequired: true\ntool: pick_design_direction\n---\n\n# Design Direction\n\nUse the picker to capture the user's choice.\n",
			)
			const action = await runTick(repoRoot, slug)
			// Discovery fires before decompose — units don't exist yet, but
			// the tool-driven discovery clause unblocks pre-units dispatch.
			const entry = assertLoopSignal(action, "discovery")
			assert.strictEqual(entry.agent, "design-direction")
			assert.deepStrictEqual(entry.units, [])
		},
	)
})

test("tool-driven discovery: clears when artifact lands at location:", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"tool-discovery-cleared",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test", mode: "continuous" })
			writeElaboration(intentDir, "design", { verified: true })
			const discoveryDir = join(
				repoRoot,
				".haiku",
				"studios",
				"test",
				"stages",
				"design",
				"discovery",
			)
			mkdirSync(discoveryDir, { recursive: true })
			writeFileSync(
				join(discoveryDir, "design-direction.md"),
				"---\nname: design-direction\nlocation: .haiku/intents/{intent-slug}/stages/design/artifacts/design-direction.md\nrequired: true\ntool: pick_design_direction\n---\n\nbody\n",
			)
			// Write the artifact at the declared location — gate clears.
			const artifactsDir = join(intentDir, "stages", "design", "artifacts")
			mkdirSync(artifactsDir, { recursive: true })
			writeFileSync(
				join(artifactsDir, "design-direction.md"),
				"---\nintent: test\nstage: design\n---\n\n# Direction picked\n",
			)
			const action = await runTick(repoRoot, slug)
			// Artifact present — cursor walks past discovery. The loop may
			// still carry `decompose` (no units exist) but `discovery`
			// should be absent.
			assertNotLoopSignal(action, "discovery")
		},
	)
})

test("non-tool discovery: still gates on units > 0", async () => {
	if (!HAS_GIT) return
	await withTmpRepo(
		"research-discovery",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({ repoRoot, studio: "test" })
			makeIntent({ intentDir, slug, studio: "test", mode: "continuous" })
			writeElaboration(intentDir, "design", { verified: true })
			// Plant a NON-tool discovery template (research-style).
			const discoveryDir = join(
				repoRoot,
				".haiku",
				"studios",
				"test",
				"stages",
				"design",
				"discovery",
			)
			mkdirSync(discoveryDir, { recursive: true })
			writeFileSync(
				join(discoveryDir, "tokens.md"),
				"---\nname: tokens\nlocation: stages/design/TOKENS.md\nrequired: true\n---\n\nResearch\n",
			)
			// No units yet — non-tool discovery should NOT fire.
			const action = await runTick(repoRoot, slug)
			// Cursor falls through to decompose (units don't exist).
			assertLoopSignal(action, "decompose")
			assertNotLoopSignal(action, "discovery")
		},
	)
})
