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
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs"
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
	const res = await fetch(`${baseUrl}/api/debug/intents/${intentSlug}/cursor`)
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

// Bug-report §3 + §4 — FB lookup must accept legacy 2-digit padding AND
// filename-stem form, mirroring `findFeedbackFile` in state-tools.ts.
await test("mutate_feedback: lookup accepts 2-digit-padded legacy filenames", async () => {
	// Set up a 2-digit-padded FB on the test intent (legacy shape).
	const fbDir = join(intentDirPath, "stages", "design", "feedback")
	mkdirSync(fbDir, { recursive: true })
	writeFileSync(
		join(fbDir, "07-legacy-padded.md"),
		`---
title: Legacy padded
origin: agent
created_at: 2026-04-01T10:00:00Z
---
body
`,
	)
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/mutate_feedback`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				stage: "design",
				feedback_id: "FB-007",
				patch: { closed_at: "2026-05-15T12:00:00Z" },
			}),
		},
	)
	assert.strictEqual(res.status, 200)
	const data = await res.json()
	assert.strictEqual(data.result.ok, true)
	assert.deepStrictEqual(data.result.written_keys, ["closed_at"])
})

await test("mutate_feedback: lookup accepts filename-stem form (07-legacy-padded)", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/mutate_feedback`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				stage: "design",
				feedback_id: "07-legacy-padded",
				patch: { closed_by: "force_complete" },
			}),
		},
	)
	assert.strictEqual(res.status, 200)
	const data = await res.json()
	assert.strictEqual(data.result.ok, true)
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

await test("set_unit_iterations auto-synthesizes one advance entry per hat", async () => {
	// resolveStageHats walks the plugin's bundled studios; the test
	// fixture lives in a temp dir, so we stand up a local studio with
	// a known hats sequence to drive the auto-synthesis path.
	mkdirSync(join(haikuRoot, "studios", "software", "stages", "design"), {
		recursive: true,
	})
	writeFileSync(
		join(haikuRoot, "studios", "software", "STUDIO.md"),
		`---\nname: software\nslug: software\ndescription: test\nstages: [design, development]\ncategory: testing\ndefault_model: sonnet\n---\nTest studio.\n`,
	)
	writeFileSync(
		join(haikuRoot, "studios", "software", "stages", "design", "STAGE.md"),
		`---\nname: design\nhats: [planner, implementer, verifier]\n---\nTest stage.\n`,
	)
	// Set up a unit with NO iterations[] — the legacy-recovery scenario.
	const unitsDir = join(intentDirPath, "stages", "design", "units")
	const unitFile = join(unitsDir, "unit-99-legacy-no-iters.md")
	writeFileSync(
		unitFile,
		`---
unit_id: unit-99
title: legacy-no-iters
---
body that exists on disk but no iterations were recorded
`,
	)
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/set_unit_iterations`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				stage: "design",
				unit: "unit-99-legacy-no-iters",
			}),
		},
	)
	assert.strictEqual(res.status, 200)
	const data = await res.json()
	assert.strictEqual(
		data.result.ok,
		true,
		`expected ok:true, got ${JSON.stringify(data.result)}`,
	)
	assert.ok(
		data.result.iterations_written >= 1,
		"at least one iteration entry must be synthesized",
	)
	// Verify on disk: iterations[] now present.
	const after = readFileSync(unitFile, "utf8")
	assert.match(after, /^iterations:/m)
	assert.match(after, /result: advance/)
})

await test("set_unit_iterations rejects missing stage_or_unit", async () => {
	const res = await fetch(
		`${baseUrl}/api/debug/intents/${intentSlug}/ops/set_unit_iterations`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stage: "design" }),
		},
	)
	assert.strictEqual(res.status, 400)
	const data = await res.json()
	assert.strictEqual(data.error, "missing_stage_or_unit")
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
