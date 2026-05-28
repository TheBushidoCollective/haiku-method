#!/usr/bin/env npx tsx
// Coverage for haiku_zap — the stateless single-task hat-loop tool that
// backs the /haiku:haiku-zap skill. The tool resolves studio/stage,
// reads the REAL STAGE.md + hat bodies via the cascade, assigns
// plan/build/verify roles, and returns ready-to-run markdown
// instructions. It writes NO files and tracks NO state.
//
// We assert on the resolved hat names + role labels in the returned
// message, the stable named error codes (zap_studio_not_found /
// zap_stage_not_found) with their valid_* lists, and the AJV input
// gate (haiku_zap_input_invalid) when `task` is missing.

import assert from "node:assert"
import { join } from "node:path"

// Point CLAUDE_PLUGIN_ROOT at the real plugin dir so the studio/stage/hat
// cascade resolves the shipped software studio (mirrors skill-list.test.mjs).
process.env.CLAUDE_PLUGIN_ROOT = join(process.cwd(), "..", "..", "plugin")

const { handleStateTool } = await import("../src/state-tools.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		const msg = e instanceof Error ? e.message : String(e)
		console.log(`  ✗ ${name}: ${msg}`)
	}
}

function getTextResult(result) {
	const block = result.content?.find((c) => c.type === "text")
	return block?.text ?? ""
}

function callZap(args) {
	const r = handleStateTool("haiku_zap", args)
	return { raw: r, payload: JSON.parse(getTextResult(r)) }
}

console.log("\n── haiku_zap ─────────────────────────────────────────────")

// ── happy path: software / development (stage omitted) ──────────────

// The shipped software studio has canonical slug `appdev` with alias
// `software`. The tool echoes the canonical slug; passing either resolves.

test("resolves software + default development stage with hats in order", () => {
	const { payload } = callZap({ task: "fix a typo in the README" })
	assert.strictEqual(payload.error, undefined, "no error on happy path")
	assert.strictEqual(payload.studio, "appdev")
	assert.strictEqual(payload.stage, "development")
	assert.ok(typeof payload.message === "string" && payload.message.length > 200)
	const m = payload.message
	// software/development hats: [planner, builder, reviewer]
	assert.match(m, /\*\*planner\*\*/, "planner hat named")
	assert.match(m, /\*\*builder\*\*/, "builder hat named")
	assert.match(m, /\*\*reviewer\*\*/, "reviewer hat named")
	// role labels present
	assert.match(m, /planner role/, "planner role label")
	assert.match(m, /builder role/, "builder role label")
	// reviewer name → verifier role (name override)
	assert.match(m, /reviewer.*verifier role/, "reviewer assigned verifier role")
	// the task text is interpolated into the per-hat prompts
	assert.match(m, /fix a typo in the README/, "task interpolated")
	// procedure faithful to the old skill
	assert.match(m, /PASS/, "PASS verdict parsing present")
	assert.match(m, /FAIL/, "FAIL verdict path present")
	assert.match(m, /git status --porcelain/, "preflight clean-tree check present")
})

test("explicit studio alias + stage echoes the canonical slug", () => {
	const { payload } = callZap({
		task: "tweak config",
		studio: "software",
		stage: "development",
	})
	assert.strictEqual(payload.studio, "appdev")
	assert.strictEqual(payload.stage, "development")
	assert.strictEqual(payload.error, undefined)
})

// ── bad studio ──────────────────────────────────────────────────────

test("bad studio → zap_studio_not_found with valid_studios", () => {
	const { raw, payload } = callZap({
		task: "do a thing",
		studio: "not-a-real-studio",
	})
	assert.strictEqual(payload.error, "zap_studio_not_found")
	assert.ok(Array.isArray(payload.valid_studios), "valid_studios is an array")
	assert.ok(payload.valid_studios.length > 0, "valid_studios populated")
	// `software` is an alias of the appdev studio; both surface as pickable.
	assert.ok(payload.valid_studios.includes("software"), "software alias present")
	assert.ok(payload.valid_studios.includes("appdev"), "appdev slug present")
	assert.ok(typeof payload.message === "string" && payload.message.length > 0)
	assert.strictEqual(raw.isError, true, "error response flagged")
})

// ── bad stage on a valid studio ─────────────────────────────────────

test("bad stage on valid studio → zap_stage_not_found with valid_stages", () => {
	const { raw, payload } = callZap({
		task: "do a thing",
		studio: "software",
		stage: "not-a-real-stage",
	})
	assert.strictEqual(payload.error, "zap_stage_not_found")
	assert.strictEqual(payload.studio, "appdev")
	assert.ok(Array.isArray(payload.valid_stages), "valid_stages is an array")
	assert.ok(payload.valid_stages.length > 0, "valid_stages populated")
	assert.ok(
		payload.valid_stages.includes("development"),
		"development listed among valid stages",
	)
	assert.ok(typeof payload.message === "string" && payload.message.length > 0)
	assert.strictEqual(raw.isError, true, "error response flagged")
})

// ── input gate: missing task ────────────────────────────────────────

test("missing task → haiku_zap_input_invalid (AJV gate)", () => {
	const r = handleStateTool("haiku_zap", { studio: "software" })
	const payload = JSON.parse(getTextResult(r))
	assert.strictEqual(payload.error, "haiku_zap_input_invalid")
	assert.ok(Array.isArray(payload.errors), "gate returns errors[]")
	assert.strictEqual(r.isError, true, "input-invalid is flagged as error")
})

console.log(`\n── Result: ${passed} passed, ${failed} failed ──────────────`)
process.exit(failed > 0 ? 1 : 0)
