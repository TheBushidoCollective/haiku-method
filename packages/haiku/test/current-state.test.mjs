#!/usr/bin/env npx tsx
// Unit tests for getCurrentState — the unified resolver every consumer
// (orchestrator pre-tick, HTTP API, browse SPA) reads to answer "where
// is this intent right now?". The function is now load-bearing for
// UI/engine consistency, so these tests pin every resolution branch.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { getCurrentState } = await import("../src/current-state.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}`)
		console.log(`    ${err.message}`)
	}
}

/** Build a temp .haiku root with intent.md + per-stage state.json. */
function fixture(slug, frontmatter, stages = {}) {
	const root = mkdtempSync(join(tmpdir(), "haiku-current-state-"))
	const haikuRoot = join(root, ".haiku")
	const iDir = join(haikuRoot, "intents", slug)
	mkdirSync(iDir, { recursive: true })

	const fmLines = ["---"]
	for (const [k, v] of Object.entries(frontmatter)) {
		if (v == null) continue
		if (typeof v === "boolean") fmLines.push(`${k}: ${v}`)
		else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
			fmLines.push(`${k}: [${v.map((x) => `"${x}"`).join(", ")}]`)
		else if (Array.isArray(v) || (typeof v === "object" && v !== null))
			fmLines.push(`${k}: ${JSON.stringify(v)}`)
		else fmLines.push(`${k}: "${v}"`)
	}
	fmLines.push("---", "", "# Intent body")
	writeFileSync(join(iDir, "intent.md"), fmLines.join("\n"))

	for (const [stageName, stageState] of Object.entries(stages)) {
		const sd = join(iDir, "stages", stageName)
		mkdirSync(sd, { recursive: true })
		// Allow raw string for parse-error fixture; otherwise stringify.
		const body =
			typeof stageState === "string"
				? stageState
				: JSON.stringify(stageState, null, 2)
		writeFileSync(join(sd, "state.json"), body)
	}

	return {
		haikuRoot,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	}
}

console.log("=== getCurrentState ===")

test("returns null when intent.md does not exist", () => {
	assert.strictEqual(getCurrentState("nope", "/tmp/does-not-exist"), null)
})

test("returns null when studio frontmatter is empty", () => {
	const { haikuRoot, cleanup } = fixture("no-studio", { studio: "" })
	try {
		assert.strictEqual(getCurrentState("no-studio", haikuRoot), null)
	} finally {
		cleanup()
	}
})

test("returns null when intent is composite", () => {
	const { haikuRoot, cleanup } = fixture("composite-intent", {
		studio: "software",
		composite: [{ studio: "software", stages: ["design"] }],
	})
	try {
		assert.strictEqual(getCurrentState("composite-intent", haikuRoot), null)
	} finally {
		cleanup()
	}
})

test("returns first stage when first stage is not done", () => {
	const { haikuRoot, cleanup } = fixture(
		"first-active",
		{ studio: "software" },
		{
			inception: { stage: "inception", status: "active", phase: "elaborate" },
		},
	)
	try {
		const r = getCurrentState("first-active", haikuRoot)
		assert.ok(r)
		assert.strictEqual(r.studio, "software")
		assert.strictEqual(r.stage, "inception")
		assert.strictEqual(r.phase, "elaborate")
	} finally {
		cleanup()
	}
})

test("returns second stage when first is done and second is active", () => {
	const { haikuRoot, cleanup } = fixture(
		"second-active",
		{ studio: "software" },
		{
			inception: { stage: "inception", status: "completed", phase: "gate" },
			design: { stage: "design", status: "active", phase: "execute" },
		},
	)
	try {
		const r = getCurrentState("second-active", haikuRoot)
		assert.ok(r)
		assert.strictEqual(r.stage, "design")
		assert.strictEqual(r.phase, "execute")
	} finally {
		cleanup()
	}
})

test("returns last stage when every stage is done", () => {
	const { haikuRoot, cleanup } = fixture(
		"all-done",
		{ studio: "software" },
		{
			inception: { stage: "inception", status: "completed", phase: "gate" },
			design: { stage: "design", status: "completed", phase: "gate" },
			product: { stage: "product", status: "completed", phase: "gate" },
			development: {
				stage: "development",
				status: "completed",
				phase: "gate",
			},
			operations: { stage: "operations", status: "completed", phase: "gate" },
			security: { stage: "security", status: "completed", phase: "gate" },
		},
	)
	try {
		const r = getCurrentState("all-done", haikuRoot)
		assert.ok(r)
		assert.strictEqual(r.stage, "security")
	} finally {
		cleanup()
	}
})

test("status=completed + gate_outcome=blocked counts as not done", () => {
	const { haikuRoot, cleanup } = fixture(
		"blocked-gate",
		{ studio: "software" },
		{
			inception: {
				stage: "inception",
				status: "completed",
				phase: "gate",
				gate_outcome: "blocked",
			},
		},
	)
	try {
		const r = getCurrentState("blocked-gate", haikuRoot)
		assert.ok(r)
		// Blocked stage is treated as still active per the external-gate
		// contract (completion lives in the merge).
		assert.strictEqual(r.stage, "inception")
	} finally {
		cleanup()
	}
})

test("malformed state.json is treated as not done — stage stays current", () => {
	const { haikuRoot, cleanup } = fixture(
		"parse-error",
		{ studio: "software" },
		{
			inception: "{this is not json",
		},
	)
	try {
		const r = getCurrentState("parse-error", haikuRoot)
		assert.ok(r)
		// parse error -> readJson catch returns {} -> status defaults
		// to "pending" -> stage is not done -> selected as current.
		assert.strictEqual(r.stage, "inception")
		// phase falls back to "" because the parsed object has no phase.
		assert.strictEqual(r.phase, "")
	} finally {
		cleanup()
	}
})

test("phase strings outside the valid set normalize to empty", () => {
	const { haikuRoot, cleanup } = fixture(
		"unknown-phase",
		{ studio: "software" },
		{
			inception: { stage: "inception", status: "active", phase: "boom" },
		},
	)
	try {
		const r = getCurrentState("unknown-phase", haikuRoot)
		assert.ok(r)
		assert.strictEqual(r.phase, "")
	} finally {
		cleanup()
	}
})

test("ignores intent.md.active_stage — derives from state.json only", () => {
	// intent.md says active_stage=design but state.json shows inception is
	// still active. The whole point of this resolver is that state.json
	// wins; if we accidentally read the cache, this test catches it.
	const { haikuRoot, cleanup } = fixture(
		"stale-cache",
		{ studio: "software", active_stage: "design" },
		{
			inception: { stage: "inception", status: "active", phase: "elaborate" },
			design: { stage: "design", status: "pending", phase: "" },
		},
	)
	try {
		const r = getCurrentState("stale-cache", haikuRoot)
		assert.ok(r)
		assert.strictEqual(r.stage, "inception")
	} finally {
		cleanup()
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
