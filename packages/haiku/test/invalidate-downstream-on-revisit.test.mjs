#!/usr/bin/env npx tsx
// invalidate-downstream-on-revisit.test.mjs
//
// Pins the 2026-05-13 contract:
//
//   When complete_stage fires on a stage that's earlier than the
//   highest-approved stage, every downstream stage's per-unit
//   reviews + approvals get cleared. The cursor's next tick will
//   re-fire dispatch_review / dispatch_approval / user_gate against
//   the cleared units.
//
// This is the engine-side enforcement of "upstream changed,
// downstream's reviews don't reflect the current content." Without
// it, approve → approve → revisit upstream → re-approve upstream
// silently walks past downstream stamps that were locked in BEFORE
// upstream changed.

import assert from "node:assert"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

import { invalidateDownstreamApprovals } from "../src/orchestrator/workflow/invalidate-downstream.ts"

function findRepoRoot() {
	let dir = resolve(dirname(fileURLToPath(import.meta.url)))
	while (dir !== "/") {
		if (existsSync(join(dir, "plugin", "studios", "software"))) return dir
		dir = resolve(dir, "..")
	}
	throw new Error("could not find repo root with plugin/studios/software/")
}
process.env.CLAUDE_PLUGIN_ROOT = join(findRepoRoot(), "plugin")

function stamp(t = "2026-05-13T08:00:00Z") {
	return { at: t }
}

function writeUnit(intentDir, stage, file, fm) {
	const dir = join(intentDir, "stages", stage, "units")
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, file), matter.stringify("# unit\n", fm))
}

function readUnitFm(intentDir, stage, file) {
	const raw = readFileSync(
		join(intentDir, "stages", stage, "units", file),
		"utf8",
	)
	return matter(raw).data
}

function setup() {
	const root = mkdtempSync(join(tmpdir(), "invalidate-downstream-"))
	const intentDir = join(root, ".haiku", "intents", "demo")
	mkdirSync(intentDir, { recursive: true })
	// Intent declares the software studio's first three stages.
	const intentFm = {
		title: "demo",
		studio: "software",
		mode: "continuous",
		stages: ["inception", "design", "product"],
	}
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# demo\n", intentFm),
	)
	return { root, intentDir, intentFm }
}

test("clears reviews + approvals on every unit of every downstream stage", () => {
	const { root, intentDir, intentFm } = setup()
	try {
		writeUnit(intentDir, "inception", "unit-01.md", {
			title: "inception u1",
			reviews: { user: stamp() },
			approvals: { user: stamp(), spec: stamp(), quality_gates: stamp() },
		})
		writeUnit(intentDir, "design", "unit-01.md", {
			title: "design u1",
			reviews: { user: stamp(), accessibility: stamp() },
			approvals: { user: stamp(), accessibility: stamp() },
		})
		writeUnit(intentDir, "design", "unit-02.md", {
			title: "design u2",
			reviews: { user: stamp() },
			approvals: { user: stamp() },
		})
		writeUnit(intentDir, "product", "unit-01.md", {
			title: "product u1",
			reviews: { user: stamp(), spec: stamp() },
			approvals: { user: stamp(), spec: stamp() },
		})

		const result = invalidateDownstreamApprovals({
			intentDir,
			intentFm,
			studio: "software",
			completedStage: "inception",
		})

		assert.deepStrictEqual(result.stages_cleared.sort(), ["design", "product"])
		assert.strictEqual(result.units_cleared, 3)

		// inception (the completed stage) is untouched.
		const inception = readUnitFm(intentDir, "inception", "unit-01.md")
		assert.deepStrictEqual(inception.reviews, { user: stamp() })
		assert.deepStrictEqual(inception.approvals, {
			user: stamp(),
			spec: stamp(),
			quality_gates: stamp(),
		})

		// design + product units have NO `reviews` / `approvals` keys
		// (the helper deletes them rather than writing empty objects so
		// the YAML doesn't carry stale empty bag keys).
		for (const [stage, file] of [
			["design", "unit-01.md"],
			["design", "unit-02.md"],
			["product", "unit-01.md"],
		]) {
			const fm = readUnitFm(intentDir, stage, file)
			assert.strictEqual(
				fm.reviews,
				undefined,
				`${stage}/${file} reviews should be removed, not set to {}`,
			)
			assert.strictEqual(
				fm.approvals,
				undefined,
				`${stage}/${file} approvals should be removed, not set to {}`,
			)
		}
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("no-op when completedStage is the last stage", () => {
	const { root, intentDir, intentFm } = setup()
	try {
		writeUnit(intentDir, "product", "unit-01.md", {
			title: "product u1",
			reviews: { user: stamp() },
			approvals: { user: stamp() },
		})
		const result = invalidateDownstreamApprovals({
			intentDir,
			intentFm,
			studio: "software",
			completedStage: "product",
		})
		assert.deepStrictEqual(result.stages_cleared, [])
		assert.strictEqual(result.units_cleared, 0)
		// Product's stamps are untouched.
		const fm = readUnitFm(intentDir, "product", "unit-01.md")
		assert.deepStrictEqual(fm.reviews, { user: stamp() })
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("no-op when downstream stages have no stamps to clear", () => {
	const { root, intentDir, intentFm } = setup()
	try {
		writeUnit(intentDir, "design", "unit-01.md", {
			title: "design u1",
			// No reviews / approvals — wave-ready unit.
		})
		const result = invalidateDownstreamApprovals({
			intentDir,
			intentFm,
			studio: "software",
			completedStage: "inception",
		})
		assert.deepStrictEqual(result.stages_cleared, [])
		assert.strictEqual(result.units_cleared, 0)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("idempotent — second call clears nothing more", () => {
	const { root, intentDir, intentFm } = setup()
	try {
		writeUnit(intentDir, "design", "unit-01.md", {
			title: "design u1",
			reviews: { user: stamp() },
			approvals: { user: stamp() },
		})
		const first = invalidateDownstreamApprovals({
			intentDir,
			intentFm,
			studio: "software",
			completedStage: "inception",
		})
		assert.strictEqual(first.units_cleared, 1)

		const second = invalidateDownstreamApprovals({
			intentDir,
			intentFm,
			studio: "software",
			completedStage: "inception",
		})
		assert.strictEqual(second.units_cleared, 0)
		assert.deepStrictEqual(second.stages_cleared, [])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("per-unit error isolation: one unreadable unit doesn't abort downstream walk", () => {
	const { root, intentDir, intentFm } = setup()
	try {
		// design has three units: unit-01 is a DIRECTORY named like a
		// .md file (readdirSync still lists it because the filter only
		// checks the `.md` suffix; readFileSync on a directory throws
		// EISDIR — a guaranteed-throw scenario that doesn't depend on
		// gray-matter's YAML strictness). unit-02 is valid + has
		// stamps. product/unit-01 is valid + has stamps.
		//
		// Before the fix, readFileSync's EISDIR on unit-01 would bubble
		// out of the for-loop and silently skip every remaining design
		// unit AND the entire product stage. After the fix, the per-
		// unit try/catch isolates the failure to that one file —
		// design/unit-02 + product/unit-01 still clear.
		const designUnitsDir = join(intentDir, "stages", "design", "units")
		mkdirSync(designUnitsDir, { recursive: true })
		mkdirSync(join(designUnitsDir, "unit-01.md"), { recursive: true })
		writeUnit(intentDir, "design", "unit-02.md", {
			title: "design u2",
			reviews: { user: stamp() },
			approvals: { user: stamp() },
		})
		writeUnit(intentDir, "product", "unit-01.md", {
			title: "product u1",
			reviews: { user: stamp() },
			approvals: { user: stamp() },
		})
		const result = invalidateDownstreamApprovals({
			intentDir,
			intentFm,
			studio: "software",
			completedStage: "inception",
		})
		assert.deepStrictEqual(result.stages_cleared.sort(), ["design", "product"])
		assert.strictEqual(result.units_cleared, 2)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("skips stages whose units dir doesn't exist on disk", () => {
	const { root, intentDir, intentFm } = setup()
	try {
		// design has units, product doesn't (stage dir not yet created).
		writeUnit(intentDir, "design", "unit-01.md", {
			title: "design u1",
			reviews: { user: stamp() },
			approvals: { user: stamp() },
		})
		const result = invalidateDownstreamApprovals({
			intentDir,
			intentFm,
			studio: "software",
			completedStage: "inception",
		})
		assert.deepStrictEqual(result.stages_cleared, ["design"])
		assert.strictEqual(result.units_cleared, 1)
		// product still has no units dir — the helper didn't create it.
		assert.strictEqual(
			existsSync(join(intentDir, "stages", "product", "units")),
			false,
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})
