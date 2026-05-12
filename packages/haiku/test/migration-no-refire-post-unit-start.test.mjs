#!/usr/bin/env npx tsx
// migration-no-refire-post-unit-start.test.mjs
//
// Pins bug A from session.txt 2026-05-12: every wave's re-tick was
// firing the migrator because `haiku_unit_start` writes `status`,
// `bolt`, `hat`, `hat_started_at` — fields that were also in
// `DEPRECATED_UNIT_FIELDS`. The cruft sentinel `hasV3CruftInIntent`
// matched on those fields and treated the unit as v3 cruft, even
// though v4 itself wrote the values.
//
// Result: migration fired on every tick, consuming the engine's
// dispatch instruction. Agent had to dispatch each hat manually.
//
// Fix: split DEPRECATED_*_FIELDS (strip set) from V3_ONLY_*_FIELDS
// (sentinel set). The sentinel must be strict — only fields v4
// NEVER writes. Add a value-shape check (`status === "completed"`)
// to catch v3 units by value when key-presence is ambiguous.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"

const { hasV3CruftInIntent } = await import(
	"../src/orchestrator/migrations/v0-to-v4.ts"
)

function makeIntentDir() {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-migration-norefire-"))
	const intentDir = join(tmp, ".haiku/intents/test-intent")
	mkdirSync(join(intentDir, "stages/inception/units"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "Test",
			studio: "software",
			mode: "continuous",
			plugin_version: "4.0.0",
			stages: ["inception"],
		}),
	)
	return intentDir
}

test("post-unit-start: v4 unit FM has NO status/bolt/hat/hat_started_at (Invariant 1 closure)", () => {
	const intentDir = makeIntentDir()
	try {
		// Contract revised 2026-05-12 (Invariant 1 closure per
		// V4-ALIGNMENT-AUDIT.md): `haiku_unit_start` no longer writes
		// `status`, `bolt`, `hat`, or `hat_started_at` on the unit FM.
		// Only `started_at` + the first iteration entry get written.
		// Consumers that need status / hat / bolt derive them from
		// `iterations[]` + `started_at` (deriveUnitState in
		// orchestrator/units.ts). The cruft sentinel CORRECTLY fires
		// on v3-shape units containing those fields — they're now
		// genuinely v3-only.
		//
		// The v4-canonical unit FM after haiku_unit_start:
		writeFileSync(
			join(intentDir, "stages/inception/units/unit-01-foo.md"),
			matter.stringify("# foo\n", {
				title: "foo",
				started_at: "2026-05-12T12:00:00Z",
				iterations: [
					{
						hat: "researcher",
						started_at: "2026-05-12T12:00:00Z",
						completed_at: null,
						result: null,
					},
				],
			}),
		)
		assert.strictEqual(
			hasV3CruftInIntent(intentDir),
			false,
			"v4-canonical unit FM (started_at + iterations only) MUST NOT trip the v3 cruft sentinel.",
		)
	} finally {
		rmSync(intentDir.replace("/.haiku/intents/test-intent", ""), {
			recursive: true,
			force: true,
		})
	}
})

test("post-unit-start: a unit with v3-shape `hat`/`bolt` cache fields DOES trip the sentinel", () => {
	const intentDir = makeIntentDir()
	try {
		// Post-2026-05-12 Invariant 1 closure: v4 stops writing
		// `hat`/`bolt`/`hat_started_at`/`status` on units. A unit
		// carrying those fields is unambiguously v3-shape (or has been
		// merged in from a pre-v4 branch). The sentinel SHOULD fire to
		// force re-migration.
		writeFileSync(
			join(intentDir, "stages/inception/units/unit-01-foo.md"),
			matter.stringify("# foo\n", {
				title: "foo",
				status: "active",
				bolt: 1,
				hat: "researcher",
				hat_started_at: "2026-04-27T19:00:00Z",
				started_at: "2026-04-27T19:00:00Z",
			}),
		)
		assert.strictEqual(
			hasV3CruftInIntent(intentDir),
			true,
			"Unit FM carrying any of {status, bolt, hat, hat_started_at} is v3-shape — sentinel must fire to force re-migration.",
		)
	} finally {
		rmSync(intentDir.replace("/.haiku/intents/test-intent", ""), {
			recursive: true,
			force: true,
		})
	}
})

test("post-gate-review-prep: hasV3CruftInIntent does NOT fire on v4-written gate_review_* on intent.md", () => {
	const intentDir = makeIntentDir()
	try {
		// What `haiku_run_next`'s gate_review handler writes to intent.md
		// when opening a review session.
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "Test",
				studio: "software",
				mode: "continuous",
				plugin_version: "4.0.0",
				stages: ["inception"],
				gate_review_session_inception: "abc123",
				gate_review_url_inception: "http://localhost/review/abc123",
				gate_review_context: "stage_gate",
			}),
		)
		assert.strictEqual(
			hasV3CruftInIntent(intentDir),
			false,
			"v4-written gate_review_* pointers on intent.md MUST NOT trip the v3 cruft sentinel.",
		)
	} finally {
		rmSync(intentDir.replace("/.haiku/intents/test-intent", ""), {
			recursive: true,
			force: true,
		})
	}
})

test("real v3 cruft (status: completed on unit): hasV3CruftInIntent FIRES", () => {
	const intentDir = makeIntentDir()
	try {
		writeFileSync(
			join(intentDir, "stages/inception/units/unit-01-foo.md"),
			matter.stringify("# foo\n", {
				title: "foo",
				status: "completed", // ← v3-only value; v4 never writes this
				bolt: 1,
				hat: "verifier",
				started_at: "2026-04-27T19:22:30Z",
				hat_started_at: "2026-04-27T19:25:58Z",
				completed_at: "2026-04-27T19:27:17Z",
				iterations: [
					{ hat: "verifier", result: "advance", completed_at: "..." },
				],
			}),
		)
		assert.strictEqual(
			hasV3CruftInIntent(intentDir),
			true,
			"v3 unit FM (status: 'completed', completed_at at root) MUST trip the sentinel — that's real cruft requiring re-migration.",
		)
	} finally {
		rmSync(intentDir.replace("/.haiku/intents/test-intent", ""), {
			recursive: true,
			force: true,
		})
	}
})

test("real v3 cruft (singular iteration on unit): hasV3CruftInIntent FIRES", () => {
	const intentDir = makeIntentDir()
	try {
		writeFileSync(
			join(intentDir, "stages/inception/units/unit-01-foo.md"),
			matter.stringify("# foo\n", {
				title: "foo",
				iteration: 1, // ← v3 singular; v4 uses plural `iterations`
			}),
		)
		assert.strictEqual(
			hasV3CruftInIntent(intentDir),
			true,
			"singular `iteration` field on a unit is v3-only — must trip the sentinel.",
		)
	} finally {
		rmSync(intentDir.replace("/.haiku/intents/test-intent", ""), {
			recursive: true,
			force: true,
		})
	}
})

test("real v3 cruft (intent_reviewed on intent.md): hasV3CruftInIntent FIRES", () => {
	const intentDir = makeIntentDir()
	try {
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "Test",
				studio: "software",
				mode: "continuous",
				plugin_version: "4.0.0",
				stages: ["inception"],
				intent_reviewed: true, // ← v3-only
			}),
		)
		assert.strictEqual(
			hasV3CruftInIntent(intentDir),
			true,
			"v3-only intent.md field (`intent_reviewed`) must trip the sentinel.",
		)
	} finally {
		rmSync(intentDir.replace("/.haiku/intents/test-intent", ""), {
			recursive: true,
			force: true,
		})
	}
})
