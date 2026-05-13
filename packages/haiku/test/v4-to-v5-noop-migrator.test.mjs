#!/usr/bin/env npx tsx
// v4-to-v5-noop-migrator.test.mjs — regression pin for the 5.0.0
// migration-path bug reported 2026-05-13.
//
// Context: 5.0.0 was an auto-generated major-version bump triggered
// by the `/haiku:reset` skill split. No on-disk schema changed — but
// the migration registry's `sourceMajor !== targetMajor` gate fires
// regardless. Without a registered 4 → 5 edge, every existing 4.x
// intent on 5.0.0 saw "Migration failed: no migration path from
// 4.0.0 to 5.0.0" and the engine refused to advance.
//
// The fix registers a schema-noop migrator (v4-to-v5.ts) that
// stamps `plugin_version: "5.0.0"` on intent.md and returns without
// touching any other state.
//
// What this test pins:
//   1. The registry has an edge from "4.0.0" to "5.0.0".
//   2. Running the edge stamps the new version on intent.md.
//   3. No other intent FM fields are altered.
//   4. Re-running the migrator (idempotent) keeps the file stable.

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
import {
	migrateIntent,
	migrationsAvailable,
} from "../src/orchestrator/migrate-registry.ts"
// The named import below executes the module — including its
// `registerMigrator("4.0.0", "5.0.0", v4ToV5)` side effect. No
// separate bare side-effect import is needed (ES module cache
// deduplicates by specifier anyway).
import { v4ToV5 } from "../src/orchestrator/migrations/v4-to-v5.ts"

function setupIntent(overrideFm = {}) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-v4-to-v5-"))
	const intentDir = join(tmp, ".haiku", "intents", "test-intent")
	mkdirSync(intentDir, { recursive: true })
	const intentFile = join(intentDir, "intent.md")
	writeFileSync(
		intentFile,
		matter.stringify("# test intent\n\nBody preserved verbatim.\n", {
			title: "test intent",
			studio: "software",
			mode: "continuous",
			plugin_version: "4.0.0",
			stages: ["inception", "design"],
			...overrideFm,
		}),
	)
	return { tmp, intentDir, intentFile }
}

test("registry has a 4.0.0 → 5.0.0 edge", () => {
	const reachable = migrationsAvailable("4.0.0")
	assert.ok(
		reachable.includes("5.0.0"),
		`migrationsAvailable("4.0.0") must include "5.0.0"; got: ${reachable.join(",")}`,
	)
})

test("migrateIntent(4.0.0 → 5.0.0) completes without throwing", () => {
	const { tmp, intentDir } = setupIntent()
	try {
		const result = migrateIntent({ intentDir, repoRoot: tmp }, "4.0.0", "5.0.0")
		assert.strictEqual(result.from, "4.0.0")
		assert.strictEqual(result.to, "5.0.0")
		assert.strictEqual(result.steps, 1, "should run exactly the 4→5 edge")
		assert.deepStrictEqual(result.chain, ["4.0.0→5.0.0"])
		assert.strictEqual(
			result.details.intent_md_migrated,
			true,
			"intent.md should have been re-stamped",
		)
		// No other state was touched.
		assert.strictEqual(result.details.units_migrated, 0)
		assert.strictEqual(result.details.feedback_migrated, 0)
		assert.strictEqual(result.details.state_json_deleted, 0)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("migration stamps `plugin_version: 5.0.0` on intent.md and preserves everything else", () => {
	const { tmp, intentDir, intentFile } = setupIntent({
		title: "kept",
		studio: "software",
		mode: "continuous",
		stages: ["inception", "design", "product"],
		sealed_at: null,
	})
	try {
		v4ToV5({ intentDir, repoRoot: tmp })
		const parsed = matter(readFileSync(intentFile, "utf8"))
		assert.strictEqual(parsed.data.plugin_version, "5.0.0")
		// Other FM fields untouched.
		assert.strictEqual(parsed.data.title, "kept")
		assert.strictEqual(parsed.data.studio, "software")
		assert.strictEqual(parsed.data.mode, "continuous")
		assert.deepStrictEqual(parsed.data.stages, [
			"inception",
			"design",
			"product",
		])
		assert.ok("sealed_at" in parsed.data, "sealed_at must survive")
		// Body preserved verbatim.
		assert.ok(parsed.content.includes("Body preserved verbatim."))
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("migration is idempotent — re-running on already-stamped intent is a no-op", () => {
	const { tmp, intentDir, intentFile } = setupIntent({
		plugin_version: "5.0.0",
	})
	try {
		const before = readFileSync(intentFile, "utf8")
		const details = v4ToV5({ intentDir, repoRoot: tmp })
		const after = readFileSync(intentFile, "utf8")
		assert.strictEqual(
			after,
			before,
			"file content must not change when already at target version",
		)
		assert.strictEqual(
			details.intent_md_migrated,
			false,
			"intent_md_migrated must report false on no-op re-runs",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("missing intent.md is a graceful no-op (defensive)", () => {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-v4-to-v5-missing-"))
	try {
		// No intent dir created.
		const details = v4ToV5({
			intentDir: join(tmp, ".haiku", "intents", "nonexistent"),
			repoRoot: tmp,
		})
		assert.strictEqual(details.intent_md_migrated, false)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
