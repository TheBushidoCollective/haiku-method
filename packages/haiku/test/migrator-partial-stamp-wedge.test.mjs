#!/usr/bin/env npx tsx
// migrator-partial-stamp-wedge.test.mjs
//
// Replay test for the actual wedge reported on 2026-05-11 by Chris's
// `rate-limit-travel-time-via-oban` session and the user's
// `admin-portal-reimagine` monorepo intent.
//
// The wedge:
//   1. A v3-to-v4 migration ran but only partially completed —
//      stamps landed on some units in a stage, others stayed v3.
//   2. On a subsequent tick, `hasV3CruftInIntent` checks the cruft
//      sentinel by reading the FIRST unit file in each stage's
//      units/ directory only (via `.find()`).
//   3. If `readdirSync` happens to return one of the already-migrated
//      units first, the sentinel sees v4 shape, returns "no cruft,"
//      and the migrator is SKIPPED entirely for the rest of the
//      session.
//   4. The bare units stay in v3 shape with `status:completed` but no
//      `reviews:`/`approvals:` blocks. The cursor walks them, sees no
//      approval stamps, and emits `dispatch_review(spec)` every tick.
//      Loop guard fires.
//
// The fix (commit on this branch): hasV3CruftInIntent walks EVERY
// unit file in each stage, not just the first. As long as ANY unit
// has v3 fields, the migrator re-runs and finishes the job.
//
// This test pins both halves:
//   - hasV3CruftInIntent returns true on a partial-stamp stage where
//     a v4-shape unit is alphabetically first.
//   - migrateIntent completes the backfill on all units.

import assert from "node:assert"
import {
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

// Point CLAUDE_PLUGIN_ROOT at the repo's plugin/ so the migrator can
// resolve review-agent paths for the software studio.
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { hasV3CruftInIntent } = await import(
	"../src/orchestrator/migrations/v0-to-v4.ts"
)
const { migrateIntent } = await import(
	"../src/orchestrator/migrate-registry.ts"
)
// Importing the migrator file registers the v0→4.0.0 edge in the
// registry (side-effect import).
await import("../src/orchestrator/migrations/v0-to-v4.ts")

function setupPartialStampIntent() {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-replay-"))
	const projDir = join(tmp, "project")
	const intentDir = join(projDir, ".haiku/intents/admin-portal-reimagine")
	const unitsDir = join(intentDir, "stages/inception/units")
	mkdirSync(unitsDir, { recursive: true })

	// intent.md is clean v4 — no DEPRECATED_INTENT_FIELDS keys
	// (active_stage, status, phase). This is deliberate: the wedge
	// under test is specifically about the UNIT sentinel skipping
	// the cruft check when the first unit happens to be v4-shape.
	// If intent.md itself contained v3 fields, the sentinel would
	// fire on intent.md before even reaching the unit walk, and
	// the test would pass even if the unit-walk fix was reverted.
	writeFileSync(
		join(intentDir, "intent.md"),
		`---
title: Reimagine admin portal as operator-first tool
studio: software
mode: continuous
plugin_version: 4.0.0
stages: [inception, design, product, development, operations, security]
---

body
`,
	)

	// Unit that ALREADY got migrated (v4 shape, no v3 fields). This is
	// what fooled the prior `hasV3CruftInIntent` into thinking the
	// stage was clean. Alphabetically first under readdirSync on most
	// filesystems.
	const stampedAt = "2026-04-27T19:29:24Z"
	const stampedRef = { at: stampedAt, migrated: true }
	writeFileSync(
		join(unitsDir, "unit-01-already-migrated.md"),
		matter.stringify("# already migrated\n", {
			title: "Already migrated",
			started_at: "2026-04-27T19:22:30Z",
			iterations: [
				{
					hat: "researcher",
					started_at: "2026-04-27T19:22:30Z",
					completed_at: "2026-04-27T19:23:37Z",
					result: "advance",
				},
				{
					hat: "verifier",
					started_at: "2026-04-27T19:25:58Z",
					completed_at: "2026-04-27T19:27:17Z",
					result: "advance",
				},
			],
			reviews: { spec: stampedRef, user: stampedRef },
			approvals: {
				spec: stampedRef,
				quality_gates: stampedRef,
				user: stampedRef,
			},
		}),
	)

	// Unit that DID NOT get migrated — still has v3 fields (`status`,
	// `bolt`, `hat`, `hat_started_at`). This is the wedge driver: cursor
	// walks it, sees no approval stamps, emits dispatch_review(spec)
	// forever.
	writeFileSync(
		join(unitsDir, "unit-02-bare-v3.md"),
		matter.stringify("# bare v3\n", {
			title: "Bare v3 unit",
			status: "completed",
			bolt: 1,
			hat: "verifier",
			started_at: "2026-04-27T19:22:30Z",
			hat_started_at: "2026-04-27T19:25:58Z",
			completed_at: "2026-04-27T19:27:17Z",
			iterations: [
				{
					hat: "researcher",
					started_at: "2026-04-27T19:22:30Z",
					completed_at: "2026-04-27T19:23:37Z",
					result: "advance",
				},
				{
					hat: "verifier",
					started_at: "2026-04-27T19:25:58Z",
					completed_at: "2026-04-27T19:27:17Z",
					result: "advance",
				},
			],
		}),
	)

	return { tmp, projDir, intentDir, unitsDir }
}

test("replay: hasV3CruftInIntent detects v3 cruft even when a v4 unit comes alphabetically first", () => {
	const { tmp, intentDir } = setupPartialStampIntent()
	try {
		// Before the fix: .find() returned unit-01-already-migrated (no
		// v3 fields) and short-circuited to false. The migrator was
		// skipped and the bare v3 unit stayed wedged forever.
		// After the fix: walk every unit; unit-02-bare-v3 has v3 fields
		// → returns true → migrator re-runs.
		const cruft = hasV3CruftInIntent(intentDir)
		assert.strictEqual(
			cruft,
			true,
			"hasV3CruftInIntent must detect v3 cruft when a sibling v4 unit comes first under readdirSync",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("replay: migrator completes the backfill on the bare v3 unit when re-run", () => {
	const { tmp, projDir, intentDir, unitsDir } = setupPartialStampIntent()
	const origCwd = process.cwd()
	try {
		process.chdir(projDir)
		const result = migrateIntent({ intentDir, repoRoot: projDir }, "0", "4.0.0")
		// The migration must report at least one migrated unit; the v3
		// one needed work.
		assert.ok(
			result.details.units_migrated >= 1,
			`expected ≥ 1 unit_migrated, got ${result.details.units_migrated}`,
		)
		// After migration, the bare unit must have synthesized stamps
		// with `migrated: true`. This is the cursor-unblocking outcome.
		const bare = matter(
			readFileSync(join(unitsDir, "unit-02-bare-v3.md"), "utf8"),
		).data
		assert.ok(bare.reviews, "bare unit should now have reviews block")
		assert.ok(bare.reviews.spec, "bare unit should have spec review stamp")
		assert.strictEqual(
			bare.reviews.spec.migrated,
			true,
			"synthesized stamp should carry migrated: true",
		)
		assert.ok(bare.approvals.spec, "bare unit should have spec approval stamp")
		assert.ok(
			bare.approvals.quality_gates,
			"bare unit should have quality_gates approval stamp",
		)
		// v3 fields must be stripped.
		assert.strictEqual(bare.status, undefined, "v3 status field stripped")
		assert.strictEqual(bare.bolt, undefined, "v3 bolt field stripped")
		assert.strictEqual(bare.hat, undefined, "v3 hat field stripped")

		// The already-migrated unit must be UNCHANGED — no double-stamping.
		const already = matter(
			readFileSync(join(unitsDir, "unit-01-already-migrated.md"), "utf8"),
		).data
		assert.strictEqual(
			already.reviews.spec.at,
			"2026-04-27T19:29:24Z",
			"existing stamps must not be overwritten by re-migration",
		)
	} finally {
		try {
			process.chdir(origCwd)
		} catch {
			/* origCwd might be deleted; ignore */
		}
		rmSync(tmp, { recursive: true, force: true })
	}
})
