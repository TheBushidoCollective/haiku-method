#!/usr/bin/env npx tsx
// Test suite for /haiku:debug HTTP endpoints.
//
// Covers:
//  1. GET /api/debug/intents — lists every intent on disk.
//  2. GET /api/debug/intents/:intent — intent metadata + stages.
//  3. GET /api/debug/intents/:intent/cursor — preview_cursor pass-through.
//  4. POST /api/debug/intents/:intent/ops/reset_drift — round-trips through
//     the same debug-ops the MCP path uses.
//  5. POST /api/debug/intents/:intent/ops/set_intent_field — writes the
//     field to disk and the next read returns the new value.
//  6. POST .../ops/<bad> — rejects unsupported ops with 400.
//  7. SPA shells at /debug + /debug/:slug return HTML (the bundled SPA).
//
// Real HTTP server, real on-disk intent. No mocks of the mutation surface
// — the routes call `debug-ops.ts` directly so the tests prove both layers
// in one pass.
//
// Run: npx tsx test/debug-routes.test.mjs

import assert from "node:assert"
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// ── Test environment setup ─────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), "haiku-debug-routes-test-"))
const projDir = join(tmp, "project")
const haikuRoot = join(projDir, ".haiku")
const intentSlug = "debug-routes-test"
const intentDirPath = join(haikuRoot, "intents", intentSlug)

mkdirSync(join(intentDirPath, "stages", "design", "units"), { recursive: true })
mkdirSync(join(intentDirPath, "stages", "development", "units"), {
	recursive: true,
})

writeFileSync(
	join(intentDirPath, "intent.md"),
	`---
title: Debug routes test
studio: software
mode: continuous
status: active
stages:
  - design
  - development
created_at: 2026-05-15T12:00:00Z
---

Body.
`,
)

// Stub git so any state-tools call that shells out doesn't blow up.
const fakeBinDir = join(tmp, "fake-bin")
mkdirSync(fakeBinDir, { recursive: true })
writeFileSync(join(fakeBinDir, "git"), "#!/bin/sh\nexit 0\n")
chmodSync(join(fakeBinDir, "git"), 0o755)
process.env.PATH = `${fakeBinDir}:${process.env.PATH}`

process.chdir(projDir)

const { startHttpServer } = await import("../src/http.ts")

let passed = 0
let failed = 0

async function test(name, fn) {
	try {
		await fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (process.env.VERBOSE) console.log(e.stack)
	}
}

const port = await startHttpServer()
const baseUrl = `http://127.0.0.1:${port}`

console.log("\n=== /haiku:debug HTTP endpoints ===")

await test("GET /api/debug/intents lists the test intent", async () => {
	const res = await fetch(`${baseUrl}/api/debug/intents`)
	assert.strictEqual(res.status, 200)
	const data = await res.json()
	assert.ok(Array.isArray(data.intents), "intents must be an array")
	const found = data.intents.find((i) => i.slug === intentSlug)
	assert.ok(found, `expected to find ${intentSlug} in intents`)
	assert.strictEqual(found.studio, "software")
	assert.strictEqual(found.mode, "continuous")
	assert.strictEqual(found.archived, false)
})

await test("GET /api/debug/intents/:intent returns metadata + stages", async () => {
	const res = await fetch(`${baseUrl}/api/debug/intents/${intentSlug}`)
	assert.strictEqual(res.status, 200)
	const data = await res.json()
	assert.strictEqual(data.slug, intentSlug)
	assert.deepStrictEqual(data.stages_present, ["design", "development"])
	assert.ok(data.frontmatter, "frontmatter object must be present")
	assert.strictEqual(data.frontmatter.title, "Debug routes test")
})

await test("GET /api/debug/intents/:intent 404 on unknown slug", async () => {
	const res = await fetch(`${baseUrl}/api/debug/intents/no-such-intent`)
	assert.strictEqual(res.status, 404)
	const data = await res.json()
	assert.strictEqual(data.error, "intent_not_found")
})

await test("GET /api/debug/intents/:intent/cursor returns derivePosition shape", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/cursor`,
	)
	// derivePosition may return ok:true with a position, or a structured
	// error if the intent isn't drivable yet. Either way we expect JSON
	// with `ok` field — not an HTML 500 page.
	const data = await res.json()
	assert.ok("ok" in data, "response must include ok field")
})

await test("POST /api/debug/.../ops/reset_drift returns ok:true", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/reset_drift`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		},
	)
	assert.strictEqual(res.status, 200)
	const data = await res.json()
	assert.strictEqual(data.op, "reset_drift")
	assert.strictEqual(data.intent, intentSlug)
	assert.ok(data.result, "must include result")
	assert.strictEqual(data.result.ok, true)
})

await test("POST .../ops/set_intent_field writes the field to disk", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/set_intent_field`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ field: "mode", value: "autopilot" }),
		},
	)
	assert.strictEqual(res.status, 200)
	const data = await res.json()
	assert.strictEqual(data.result.ok, true)

	// Read back via the GET endpoint.
	const reread = await fetch(`${baseUrl}/api/debug/intents/${intentSlug}`)
	const detail = await reread.json()
	assert.strictEqual(detail.mode, "autopilot")
})

await test("POST .../ops/<bad> rejects unsupported op with 400", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/wipe_disk`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		},
	)
	assert.strictEqual(res.status, 400)
	const data = await res.json()
	assert.strictEqual(data.error, "unsupported_op")
})

await test("POST .../ops/force_stage_complete missing stage returns 400", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/force_stage_complete`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		},
	)
	assert.strictEqual(res.status, 400)
	const data = await res.json()
	assert.strictEqual(data.error, "missing_stage")
})

await test("POST .../ops/mutate_feedback missing feedback_id returns 400", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/mutate_feedback`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ patch: { status: "closed" } }),
		},
	)
	assert.strictEqual(res.status, 400)
	const data = await res.json()
	assert.strictEqual(data.error, "missing_feedback_id")
})

await test("POST .../ops/force_stage_complete rejects path-traversal stage with 400", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/force_stage_complete`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stage: "../../etc" }),
		},
	)
	assert.strictEqual(res.status, 400)
	const data = await res.json()
	assert.strictEqual(data.error, "invalid_stage")
})

await test("POST .../ops/mutate_feedback rejects path-traversal stage with 400", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/mutate_feedback`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				stage: "../../etc",
				feedback_id: "FB-001",
				patch: { status: "closed" },
			}),
		},
	)
	assert.strictEqual(res.status, 400)
	const data = await res.json()
	assert.strictEqual(data.error, "invalid_stage")
})

await test("GET /debug serves the SPA shell HTML", async () => {
	const res = await fetch(`${baseUrl}/debug`)
	assert.strictEqual(res.status, 200)
	assert.match(res.headers.get("content-type") || "", /text\/html/)
	const html = await res.text()
	assert.ok(html.includes("<html"), "must look like an HTML document")
})

await test("GET /debug/:slug serves the SPA shell HTML", async () => {
	const res = await fetch(`${baseUrl}/debug/${intentSlug}`)
	assert.strictEqual(res.status, 200)
	assert.match(res.headers.get("content-type") || "", /text\/html/)
})

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
