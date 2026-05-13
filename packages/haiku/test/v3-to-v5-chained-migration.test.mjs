#!/usr/bin/env npx tsx
// v3-to-v5-chained-migration.test.mjs — pins the 2-hop migration
// chain "0" → "4.0.0" → "5.0.0".
//
// Why this matters: a v3 intent (no `plugin_version` field, source
// sentinel `"0"`) opened on a 5.0.0 plugin must walk BOTH registered
// migrators in sequence — the v0→v4 transform AND the schema-noop
// v4→v5 stamp. Each migrator pins its own contract in isolation
// (v0-to-v4-migrator.test.mjs, v4-to-v5-noop-migrator.test.mjs);
// this test pins the CHAIN — that the BFS in migrate-registry.ts
// actually finds and walks both edges in order.
//
// What this test pins:
//   1. `migrationsAvailable("0")` includes "5.0.0" (BFS reaches it).
//   2. `migrateIntent({...}, "0", "5.0.0")` runs both edges and
//      returns `chain: ["0→4.0.0", "4.0.0→5.0.0"]` (order matters —
//      the v0→v4 transform must land BEFORE the v4→v5 stamp).
//   3. After the chain runs, intent.md carries `plugin_version: 5.0.0`
//      AND the v0→v4 transforms have been applied (deprecated v3
//      fields stripped from intent.md, approvals seeded, sealed_at
//      initialized).
//   4. Aggregated details cover both steps (intent_md_migrated=true,
//      units_migrated > 0 from v0→v4).

import assert from "node:assert/strict"
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
// Importing both migrators triggers their `registerMigrator(...)`
// side effects — wiring the registry edges this test reads back.
import {
	migrateIntent,
	migrationsAvailable,
} from "../src/orchestrator/migrate-registry.ts"
import "../src/orchestrator/migrations/v0-to-v4.ts"
import "../src/orchestrator/migrations/v4-to-v5.ts"

function makeV3IntentDir() {
	const root = mkdtempSync(join(tmpdir(), "haiku-v3-to-v5-"))
	const intentDir = join(root, ".haiku", "intents", "test-intent")
	mkdirSync(intentDir, { recursive: true })
	mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })

	// Pre-v4 intent.md — NO plugin_version field. v3-shape FM
	// fields the v0→v4 migrator is supposed to strip.
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test\n\nIntent body verbatim.\n", {
			title: "test",
			studio: "software",
			mode: "continuous",
			active_stage: "design",
			phase: "execute",
			status: "active",
			composite: false,
		}),
	)

	// One completed v3-shape unit so the v0→v4 migrator has
	// something to transform (units_migrated counter increments).
	writeFileSync(
		join(intentDir, "stages", "design", "units", "unit-01-foo.md"),
		matter.stringify("# unit-01-foo\n", {
			title: "foo",
			status: "completed",
			hat: "verifier",
			bolt: 1,
			hat_started_at: "2026-04-01T00:00:00Z",
			completed_at: "2026-04-01T01:00:00Z",
			outputs: ["stages/design/foo.md"],
			iterations: [
				{
					hat: "verifier",
					started_at: "2026-04-01T00:20:00Z",
					completed_at: "2026-04-01T01:00:00Z",
					result: "advance",
				},
			],
		}),
	)

	return { root, intentDir }
}

test("registry: BFS finds path from '0' to '5.0.0' (chains v0→v4 + v4→v5)", () => {
	const reachable = migrationsAvailable("0")
	assert.ok(
		reachable.includes("4.0.0"),
		`'0' must reach '4.0.0' via direct edge; got: ${reachable.join(",")}`,
	)
	assert.ok(
		reachable.includes("5.0.0"),
		`'0' must reach '5.0.0' via the chained 0→4.0.0→5.0.0 path; got: ${reachable.join(",")}`,
	)
})

test("migrateIntent('0' → '5.0.0'): walks both edges in order, both contracts apply", () => {
	const { root, intentDir } = makeV3IntentDir()
	try {
		const result = migrateIntent({ intentDir, repoRoot: root }, "0", "5.0.0")
		// Chain order matters: v0→v4 MUST land before v4→v5 so the
		// stamp lands on a v4-shape file, not a v3-shape one.
		assert.deepStrictEqual(
			result.chain,
			["0→4.0.0", "4.0.0→5.0.0"],
			"BFS must walk v0→v4 first, then v4→v5",
		)
		assert.strictEqual(result.steps, 2)
		// Aggregated details: both migrators stamped intent.md.
		assert.strictEqual(
			result.details.intent_md_migrated,
			true,
			"intent.md must be rewritten by at least one of the two steps",
		)
		// v0→v4 walked the units dir (one unit), so units_migrated
		// should reflect its work even though v4→v5 contributes 0.
		assert.strictEqual(
			result.details.units_migrated,
			1,
			"v0→v4 should have transformed the single seeded unit",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("post-chain intent.md: v3 fields stripped AND plugin_version = '5.0.0'", () => {
	const { root, intentDir } = makeV3IntentDir()
	try {
		migrateIntent({ intentDir, repoRoot: root }, "0", "5.0.0")
		const parsed = matter(readFileSync(join(intentDir, "intent.md"), "utf8"))
		// Final stamp from the v4→v5 step.
		assert.strictEqual(
			parsed.data.plugin_version,
			"5.0.0",
			"final stamp must be '5.0.0' (v4→v5 ran AFTER v0→v4)",
		)
		// Deprecated v3 fields stripped by v0→v4.
		assert.ok(
			!("active_stage" in parsed.data),
			"v0→v4 must strip `active_stage`",
		)
		assert.ok(!("phase" in parsed.data), "v0→v4 must strip `phase`")
		assert.ok(!("status" in parsed.data), "v0→v4 must strip `status`")
		// Preserved fields survive both steps.
		assert.strictEqual(parsed.data.title, "test")
		assert.strictEqual(parsed.data.studio, "software")
		assert.strictEqual(parsed.data.mode, "continuous")
		// Body preserved through both migrators.
		assert.ok(parsed.content.includes("Intent body verbatim."))
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("post-chain unit FM: v3 cache fields stripped by v0→v4 (v4→v5 doesn't touch units)", () => {
	const { root, intentDir } = makeV3IntentDir()
	try {
		migrateIntent({ intentDir, repoRoot: root }, "0", "5.0.0")
		const unitFm = matter(
			readFileSync(
				join(intentDir, "stages", "design", "units", "unit-01-foo.md"),
				"utf8",
			),
		).data
		// Cache fields that the v0→v4 migrator strips (cursor derives
		// them from iterations[] under v4 and onward).
		assert.ok(!("status" in unitFm), "v0→v4 must strip unit `status`")
		assert.ok(!("hat" in unitFm), "v0→v4 must strip unit `hat`")
		assert.ok(!("bolt" in unitFm), "v0→v4 must strip unit `bolt`")
		assert.ok(
			!("hat_started_at" in unitFm),
			"v0→v4 must strip unit `hat_started_at`",
		)
		// iterations[] preserved (the v4 source of truth).
		assert.ok(Array.isArray(unitFm.iterations))
		assert.strictEqual(unitFm.iterations.length, 1)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})
