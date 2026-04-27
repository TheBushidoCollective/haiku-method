#!/usr/bin/env npx tsx
// Tests for the workflow state-derivation function. Each test sets up a
// minimal on-disk intent fixture in tmpdir, calls deriveCurrentState,
// and asserts the returned state name matches the expected coarse
// state.
//
// Fixture shape: just intent.md + (optionally) stages/<stage>/state.json.
// Intentionally minimal — derivation only reads the fields it
// branches on, so over-specifying fixtures hides which fields are
// load-bearing.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { deriveCurrentState } from "../src/orchestrator/workflow/derive-state.ts"

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

/** Create a minimal intent fixture. Returns the haiku root. */
function fixture(slug, frontmatter, stages = {}) {
	const root = mkdtempSync(join(tmpdir(), "haiku-derive-"))
	const haikuRoot = join(root, ".haiku")
	const iDir = join(haikuRoot, "intents", slug)
	mkdirSync(iDir, { recursive: true })

	const fmLines = ["---"]
	for (const [key, value] of Object.entries(frontmatter)) {
		if (value === null || value === undefined) continue
		if (typeof value === "boolean") {
			fmLines.push(`${key}: ${value}`)
		} else if (Array.isArray(value)) {
			fmLines.push(`${key}: [${value.map((v) => `"${v}"`).join(", ")}]`)
		} else {
			fmLines.push(`${key}: "${value}"`)
		}
	}
	fmLines.push("---", "", "# Intent body")

	writeFileSync(join(iDir, "intent.md"), fmLines.join("\n"))

	for (const [stageName, stageState] of Object.entries(stages)) {
		const stageDir = join(iDir, "stages", stageName)
		mkdirSync(stageDir, { recursive: true })
		writeFileSync(
			join(stageDir, "state.json"),
			JSON.stringify(stageState, null, 2),
		)
	}

	return {
		haikuRoot,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	}
}

console.log("=== Top-level state derivation ===")

test("missing intent returns null", () => {
	const { haikuRoot, cleanup } = fixture("nonexistent", { studio: "software" })
	rmSync(join(haikuRoot, "intents", "nonexistent"), {
		recursive: true,
		force: true,
	})
	const result = deriveCurrentState("nonexistent", haikuRoot)
	cleanup()
	assert.strictEqual(result, null)
})

test("archived intent → error (matches runNext orchestrator.ts:2214)", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		archived: true,
	})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "error")
})

test("status=archived → error (legacy, matches runNext orchestrator.ts:2207)", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		status: "archived",
	})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "error")
})

test("status=completed → complete", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		status: "completed",
	})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "complete")
})

test("no studio → select_studio", () => {
	const { haikuRoot, cleanup } = fixture("test", {})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "select_studio")
	assert.strictEqual(result.context.studio, "")
})

test("studio set, no active_stage → start_stage", () => {
	const { haikuRoot, cleanup } = fixture("test", { studio: "software" })
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "start_stage")
	assert.strictEqual(result.context.studio, "software")
	assert.strictEqual(result.context.currentStage, "")
})

test("intent.phase=intent_review → gate_review", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		phase: "intent_review",
	})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "gate_review")
})

test("intent.phase=intent_completion (not dispatched) → intent_completion_review", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		phase: "intent_completion",
	})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "intent_completion_review")
})

test("intent.phase=intent_completion + dispatched → intent_completion_fix", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		phase: "intent_completion",
		completion_review_dispatched: true,
	})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "intent_completion_fix")
})

console.log("\n=== Stage-driven phases ===")

test("active_stage with no state.json → start_stage", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		active_stage: "design",
	})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "start_stage")
	assert.strictEqual(result.context.currentStage, "design")
})

test("stage status=pending → start_stage", () => {
	const { haikuRoot, cleanup } = fixture(
		"test",
		{ studio: "software", active_stage: "design" },
		{ design: { status: "pending" } },
	)
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "start_stage")
})

test("stage phase=elaborate → elaborate", () => {
	const { haikuRoot, cleanup } = fixture(
		"test",
		{ studio: "software", active_stage: "design" },
		{ design: { status: "active", phase: "elaborate" } },
	)
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "elaborate")
	assert.strictEqual(result.context.currentStage, "design")
	assert.strictEqual(result.context.currentPhase, "elaborate")
})

test("stage phase=execute → execute", () => {
	const { haikuRoot, cleanup } = fixture(
		"test",
		{ studio: "software", active_stage: "development" },
		{ development: { status: "active", phase: "execute" } },
	)
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "execute")
})

test("stage phase=review → review", () => {
	const { haikuRoot, cleanup } = fixture(
		"test",
		{ studio: "software", active_stage: "development" },
		{ development: { status: "active", phase: "review" } },
	)
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "review")
})

test("stage phase=gate → gate_review", () => {
	const { haikuRoot, cleanup } = fixture(
		"test",
		{ studio: "software", active_stage: "development" },
		{ development: { status: "active", phase: "gate" } },
	)
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "gate_review")
})

test("unknown phase → error", () => {
	const { haikuRoot, cleanup } = fixture(
		"test",
		{ studio: "software", active_stage: "development" },
		{ development: { status: "active", phase: "garbage" } },
	)
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.state, "error")
})

console.log("\n=== Context shape ===")

test("derived context carries intent frontmatter", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		title: "My Intent",
		mode: "continuous",
	})
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.context.intent.title, "My Intent")
	assert.strictEqual(result.context.intent.mode, "continuous")
})

test("derived context carries stage state.json contents", () => {
	const { haikuRoot, cleanup } = fixture(
		"test",
		{ studio: "software", active_stage: "design" },
		{
			design: {
				status: "active",
				phase: "execute",
				iteration: 2,
				custom_field: "value",
			},
		},
	)
	const result = deriveCurrentState("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.context.stageState.iteration, 2)
	assert.strictEqual(result.context.stageState.custom_field, "value")
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
