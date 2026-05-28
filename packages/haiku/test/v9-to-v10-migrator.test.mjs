#!/usr/bin/env npx tsx
// v9-to-v10-migrator.test.mjs — canonical intent.stages cleanup (2026-05-27).
//
// What this pins:
//   1. Edge exists — registry has a 9.0.0 → 10.0.0 edge.
//   2. Strip — a legacy `skip_stages` field is deleted.
//   3. Preserve — an already-materialized `stages` is left untouched.
//   4. Backfill honoring skip_stages — a legacy intent with skip_stages and NO
//      materialized stages gets stages = studio stages MINUS the skipped ones
//      (the deny-list semantics, applied during migration even though
//      resolveIntentStages no longer honors skip_stages at runtime).
//   5. Idempotent re-run is a no-op.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import matter from "gray-matter"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { migrateIntent, migrationsAvailable } = await import(
	"../src/orchestrator/migrate-registry.ts"
)
// Named import executes the module's registerMigrator side effect.
const { v9ToV10 } = await import("../src/orchestrator/migrations/v9-to-v10.ts")

function setupIntent(fm) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-v9-to-v10-"))
	const intentDir = join(tmp, ".haiku", "intents", "test-intent")
	mkdirSync(intentDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test intent\n\nBody.\n", fm),
	)
	return { tmp, intentDir }
}

function readIntentFm(intentDir) {
	return matter(readFileSync(join(intentDir, "intent.md"), "utf8")).data
}

test("registry has a 9.0.0 → 10.0.0 edge", () => {
	assert.ok(
		migrationsAvailable("9.0.0").includes("10.0.0"),
		"migrationsAvailable('9.0.0') must include '10.0.0'",
	)
})

test("strips skip_stages, preserves an already-materialized stages", () => {
	const { tmp, intentDir } = setupIntent({
		title: "t",
		studio: "software",
		mode: "continuous",
		plugin_version: "9.0.0",
		stages: ["inception", "development", "security"],
		skip_stages: ["design", "product"],
	})
	try {
		const result = migrateIntent({ intentDir, repoRoot: tmp }, "9.0.0", "10.0.0")
		assert.strictEqual(result.to, "10.0.0")
		const fm = readIntentFm(intentDir)
		assert.strictEqual(fm.skip_stages, undefined, "skip_stages must be stripped")
		assert.deepStrictEqual(
			fm.stages,
			["inception", "development", "security"],
			"materialized stages must be preserved verbatim",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("backfills stages honoring skip_stages when stages is absent", () => {
	const { tmp, intentDir } = setupIntent({
		title: "t",
		studio: "software",
		mode: "continuous",
		plugin_version: "9.0.0",
		skip_stages: ["design", "product", "operations", "release"],
		// no stages: — legacy pre-materialization intent
	})
	try {
		migrateIntent({ intentDir, repoRoot: tmp }, "9.0.0", "10.0.0")
		const fm = readIntentFm(intentDir)
		assert.strictEqual(fm.skip_stages, undefined, "skip_stages must be stripped")
		// software = [inception, design, product, development, operations,
		// security, release]; minus the four skipped → [inception, development,
		// security]. The skipped stages must NOT silently reappear.
		assert.deepStrictEqual(fm.stages, ["inception", "development", "security"])
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("idempotent — a second run changes nothing", () => {
	const { tmp, intentDir } = setupIntent({
		title: "t",
		studio: "software",
		mode: "continuous",
		plugin_version: "9.0.0",
		stages: ["inception", "development"],
		skip_stages: ["design"],
	})
	try {
		migrateIntent({ intentDir, repoRoot: tmp }, "9.0.0", "10.0.0")
		const afterFirst = readFileSync(join(intentDir, "intent.md"), "utf8")
		const details = v9ToV10({ intentDir, repoRoot: tmp })
		assert.strictEqual(
			details.intent_md_migrated,
			false,
			"second run must not migrate",
		)
		assert.strictEqual(
			readFileSync(join(intentDir, "intent.md"), "utf8"),
			afterFirst,
			"intent.md must be byte-stable on idempotent re-run",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
