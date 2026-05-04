#!/usr/bin/env npx tsx
// Tests for plugin-self-repair detection.
//
// `attemptSelfRepair` invokes `npm install` and copies trees onto disk —
// covering it directly here would mutate the user's real
// ~/.claude/plugins/ directory or require shelling out to npm. The
// repair path is exercised through the wired-up integration in
// server.ts (which fires Sentry on every detection AND every repair
// attempt — that telemetry IS the contract the user asked for).
//
// What this test covers: the pure-fs detection logic. We pass an
// explicit root override so the cached resolvePluginRoot() value
// doesn't fight the test fixture.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { detectPluginRemoval } = await import("../src/plugin-self-repair.ts")

let passed = 0
let failed = 0
function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}: ${err.message}`)
	}
}

function fakePluginRoot(opts = {}) {
	const root = mkdtempSync(join(tmpdir(), "haiku-plugin-fake-"))
	if (opts.studios !== false)
		mkdirSync(join(root, "studios"), { recursive: true })
	if (opts.schemas !== false)
		mkdirSync(join(root, "schemas"), { recursive: true })
	if (opts.pluginJson !== false) {
		mkdirSync(join(root, ".claude-plugin"), { recursive: true })
		writeFileSync(join(root, ".claude-plugin", "plugin.json"), "{}")
	}
	return root
}

console.log("=== detectPluginRemoval ===")

test("intact plugin (production root) reports not-removed", () => {
	const r = detectPluginRemoval()
	assert.strictEqual(r.removed, false, JSON.stringify(r))
	assert.strictEqual(r.missingPaths.length, 0)
})

test("intact fake root reports not-removed", () => {
	const root = fakePluginRoot()
	try {
		const r = detectPluginRemoval(root)
		assert.strictEqual(r.removed, false, JSON.stringify(r))
		assert.strictEqual(r.missingPaths.length, 0)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("missing studios/ → removed=true with exact path", () => {
	const root = fakePluginRoot({ studios: false })
	try {
		const r = detectPluginRemoval(root)
		assert.strictEqual(r.removed, true)
		assert.deepStrictEqual(r.missingPaths, ["studios"])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("missing schemas/ → removed=true", () => {
	const root = fakePluginRoot({ schemas: false })
	try {
		const r = detectPluginRemoval(root)
		assert.strictEqual(r.removed, true)
		assert.deepStrictEqual(r.missingPaths, ["schemas"])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("missing plugin.json → removed=true", () => {
	const root = fakePluginRoot({ pluginJson: false })
	try {
		const r = detectPluginRemoval(root)
		assert.strictEqual(r.removed, true)
		assert.deepStrictEqual(r.missingPaths, [".claude-plugin/plugin.json"])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("entire root missing → all subpaths flagged", () => {
	const root = mkdtempSync(join(tmpdir(), "haiku-plugin-fake-"))
	rmSync(root, { recursive: true, force: true })
	const r = detectPluginRemoval(root)
	assert.strictEqual(r.removed, true)
	// All three CRITICAL_SUBPATHS get flagged.
	assert.strictEqual(r.missingPaths.length, 3)
})

test("empty root override → 'plugin root unresolvable' marker", () => {
	const r = detectPluginRemoval("")
	assert.strictEqual(r.removed, true)
	assert.strictEqual(r.root, "")
	assert.deepStrictEqual(r.missingPaths, ["<plugin root unresolvable>"])
})

console.log("")
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
