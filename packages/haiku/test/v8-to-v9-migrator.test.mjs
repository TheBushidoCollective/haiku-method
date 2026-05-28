#!/usr/bin/env npx tsx
// v8-to-v9-migrator.test.mjs — exercises the four distinct behaviors of
// the premise-witness cleanup migration in isolation. Added 2026-05-21
// in response to PR #372 review (the migration shipped without a
// dedicated test).
//
// What this pins:
//   1. Backfill — a signed `reviews.<role>` slot with no
//      `input_witnesses` gains the block built from the unit's current
//      `inputs:`, and the slot's `at` audit timestamp is PRESERVED.
//   2. Strip — `approvals.<role>.witnesses` (the legacy output-witness
//      map) is deleted; the approval `at` survives.
//   3. Message migration — iteration `reason` → unified `message`.
//   4. Purge — the dead drift-baseline sidecar files are deleted.
//   5. The new counts surface in `details`
//      (review_slots_backfilled / approval_slots_stripped /
//      iterations_message_migrated / drift_artifacts_deleted).
//   6. Idempotent re-run is a no-op.

import assert from "node:assert/strict"
import {
	existsSync,
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
import {
	migrateIntent,
	migrationsAvailable,
} from "../src/orchestrator/migrate-registry.ts"
// Named import executes the module's `registerMigrator("8.0.0","9.0.0",…)`
// side effect (ES module cache dedups by specifier).
import { v8ToV9 } from "../src/orchestrator/migrations/v8-to-v9.ts"

const SIGN_AT = "2026-05-01T10:00:00.000Z"
const HEX64 = "a".repeat(64)

function setupIntent() {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-v8-to-v9-"))
	const intentDir = join(tmp, ".haiku", "intents", "test-intent")
	const stageDir = join(intentDir, "stages", "design")
	const unitsDir = join(stageDir, "units")
	const discoveryDir = join(stageDir, "discovery")
	mkdirSync(unitsDir, { recursive: true })
	mkdirSync(discoveryDir, { recursive: true })

	// intent.md (the implicit input witness) + a declared input file.
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test intent\n\nPremise body.\n", {
			title: "test intent",
			studio: "software",
			mode: "continuous",
			plugin_version: "8.0.0",
			stages: ["design"],
		}),
	)
	writeFileSync(
		join(discoveryDir, "research.md"),
		matter.stringify("# research\n\nFindings.\n", { title: "research" }),
	)

	// A unit with: a signed review missing input_witnesses, an approval
	// carrying a legacy witnesses map, and a legacy `reason` iteration.
	const unitPath = join(unitsDir, "unit-01-build.md")
	writeFileSync(
		unitPath,
		matter.stringify("# unit body\n\nSpec text.\n", {
			title: "build it",
			inputs: ["stages/design/discovery/research.md"],
			outputs: ["src/feature.ts"],
			started_at: SIGN_AT,
			iterations: [{ hat: "builder", result: "reject", reason: "redo the edge case" }],
			reviews: { spec: { at: SIGN_AT, body_sha256: HEX64 } },
			approvals: { spec: { at: SIGN_AT, witnesses: { "src/feature.ts": HEX64 } } },
		}),
	)

	// Dead drift-baseline sidecars the purge must delete.
	writeFileSync(join(intentDir, "drift-markers.json"), "{}")
	writeFileSync(join(stageDir, "baseline.json"), "{}")
	mkdirSync(join(stageDir, "baseline-content"), { recursive: true })
	writeFileSync(join(stageDir, "baseline-content", "x.txt"), "x")
	writeFileSync(join(stageDir, ".baseline-ack"), "")
	writeFileSync(join(stageDir, "baseline-thrash.json"), "{}")

	return { tmp, intentDir, stageDir, unitPath }
}

function readUnitFm(unitPath) {
	return matter(readFileSync(unitPath, "utf8")).data
}

test("registry has an 8.0.0 → 9.0.0 edge", () => {
	assert.ok(
		migrationsAvailable("8.0.0").includes("9.0.0"),
		"migrationsAvailable('8.0.0') must include '9.0.0'",
	)
})

test("v8→v9 backfills witnesses, strips, migrates messages, purges, and surfaces counts", () => {
	const { tmp, intentDir, stageDir, unitPath } = setupIntent()
	try {
		const result = migrateIntent({ intentDir, repoRoot: tmp }, "8.0.0", "9.0.0")
		assert.strictEqual(result.to, "9.0.0")

		const fm = readUnitFm(unitPath)

		// (1) Backfill — review slot gained input_witnesses, `at` preserved.
		assert.ok(fm.reviews.spec.input_witnesses, "review slot must gain input_witnesses")
		assert.strictEqual(fm.reviews.spec.at, SIGN_AT, "review `at` must be preserved")
		assert.ok(
			fm.reviews.spec.input_witnesses.files["intent.md"],
			"implicit intent.md witness must be present",
		)
		assert.ok(
			fm.reviews.spec.input_witnesses.files["stages/design/discovery/research.md"],
			"declared input must be witnessed",
		)

		// (2) Strip — approval witnesses gone, `at` preserved.
		assert.strictEqual(
			fm.approvals.spec.witnesses,
			undefined,
			"approval witnesses map must be stripped",
		)
		assert.strictEqual(fm.approvals.spec.at, SIGN_AT, "approval `at` must be preserved")

		// (3) Message migration — reason → message.
		assert.strictEqual(fm.iterations[0].reason, undefined, "legacy reason must be dropped")
		assert.strictEqual(fm.iterations[0].message, "redo the edge case")

		// (4) Purge — every dead sidecar gone.
		assert.ok(!existsSync(join(intentDir, "drift-markers.json")))
		assert.ok(!existsSync(join(stageDir, "baseline.json")))
		assert.ok(!existsSync(join(stageDir, "baseline-content")))
		assert.ok(!existsSync(join(stageDir, ".baseline-ack")))
		assert.ok(!existsSync(join(stageDir, "baseline-thrash.json")))

		// (5) Counts surfaced in details.
		assert.strictEqual(result.details.review_slots_backfilled, 1)
		assert.strictEqual(result.details.approval_slots_stripped, 1)
		assert.strictEqual(result.details.iterations_message_migrated, 1)
		assert.strictEqual(result.details.drift_artifacts_deleted, 5)
		assert.strictEqual(result.details.units_migrated, 1)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("v8→v9 is idempotent — a second run changes nothing", () => {
	const { tmp, intentDir, unitPath } = setupIntent()
	try {
		migrateIntent({ intentDir, repoRoot: tmp }, "8.0.0", "9.0.0")
		const afterFirst = readFileSync(unitPath, "utf8")

		// Re-running the migrator directly (intent is already 9.0.0).
		const details = v8ToV9({ intentDir, repoRoot: tmp })
		assert.strictEqual(details.review_slots_backfilled, 0)
		assert.strictEqual(details.approval_slots_stripped, 0)
		assert.strictEqual(details.iterations_message_migrated, 0)
		assert.strictEqual(details.drift_artifacts_deleted, 0)
		assert.strictEqual(
			readFileSync(unitPath, "utf8"),
			afterFirst,
			"unit file must be byte-stable on idempotent re-run",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
