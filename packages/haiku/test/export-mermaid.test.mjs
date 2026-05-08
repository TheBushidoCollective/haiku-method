#!/usr/bin/env npx tsx
// Tests for the Mermaid export — verify the rendered string has
// the expected structural properties for the real software studio.
//
// We don't try to validate Mermaid syntax exhaustively (that's
// what the Mermaid renderer does). The tests check:
//   - Every studio stage appears in the diagram
//   - Every hat per stage gets enumerated in execute
//   - Every fix-hat × bolt combination appears in review_fix
//   - Terminal markers + transitions are present
//   - The output is non-empty + has the stateDiagram-v2 header

import assert from "node:assert"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { buildStudioConfig } = await import(
	"../src/orchestrator/workflow/build-studio-config.ts"
)
const { exportStudioMermaid } = await import(
	"../src/orchestrator/workflow/export-mermaid.ts"
)

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

const config = buildStudioConfig("software")
assert.ok(config, "software studio should resolve")
const mermaid = exportStudioMermaid(config)

console.log("=== Mermaid: structure ===")

test("output starts with stateDiagram-v2", () => {
	assert.ok(
		mermaid.startsWith("stateDiagram-v2"),
		`expected stateDiagram-v2 header, got: ${mermaid.slice(0, 40)}`,
	)
})

test("output is multi-line markdown-friendly", () => {
	const lines = mermaid.split("\n")
	assert.ok(lines.length > 50, `expected >50 lines, got ${lines.length}`)
})

test("includes every studio stage as a top-level state", () => {
	for (const stageName of config.defaultStages) {
		assert.ok(
			mermaid.includes(`  state ${stageName} {`),
			`stage block '${stageName}' missing`,
		)
	}
})

test("first stage links from select_studio", () => {
	const first = config.defaultStages[0]
	assert.ok(
		mermaid.includes(`select_studio --> ${first}`),
		`select_studio → ${first} edge missing`,
	)
})

test("non-final stage advances to next stage", () => {
	const a = config.defaultStages[0]
	const b = config.defaultStages[1]
	assert.ok(
		mermaid.includes(`  ${a} --> ${b}`),
		`stage advance ${a} → ${b} missing`,
	)
})

test("final stage advances to intent_completion_review", () => {
	const last = config.defaultStages[config.defaultStages.length - 1]
	assert.ok(
		mermaid.includes(`  ${last} --> intent_completion_review`),
		`${last} → intent_completion_review missing`,
	)
})

console.log("\n=== Mermaid: per-stage details ===")

test("development stage enumerates each hat in execute sub-machine", () => {
	for (const hat of config.stages.development.hats.map((h) => h.name)) {
		assert.ok(
			mermaid.includes(`development_execute_${hat}`),
			`development.execute.${hat} missing`,
		)
	}
})

test("development stage enumerates each fix-hat × bolt in review_fix", () => {
	for (let bolt = 1; bolt <= 3; bolt++) {
		for (const hat of config.stages.development.fixHats.map((h) => h.name)) {
			const id = `development_review_fix_bolt_${bolt}_${hat.replace(/-/g, "_")}`
			assert.ok(mermaid.includes(id), `${id} missing`)
		}
	}
})

test("review_fix has done + escalated terminals", () => {
	assert.ok(
		mermaid.includes("development_review_fix_done"),
		"done terminal missing",
	)
	assert.ok(
		mermaid.includes("development_review_fix_escalated"),
		"escalated terminal missing",
	)
})

test("phase progression: start_stage → elaborate → elaborate_review → decompose → execute → review → gate", () => {
	for (const phase of [
		"development_start_stage --> development_elaborate",
		"development_elaborate --> development_elaborate_review",
		"development_elaborate_review --> development_decompose",
		"development_decompose --> development_execute",
		"development_review --> development_gate",
	]) {
		assert.ok(mermaid.includes(phase), `transition '${phase}' missing`)
	}
})

console.log("\n=== Mermaid: intent-completion layer ===")

test("intent_completion_review routes to gate or fix", () => {
	assert.ok(
		mermaid.includes(
			"intent_completion_review --> intent_completion_gate : review.clean",
		),
		"review.clean → gate missing",
	)
	assert.ok(
		mermaid.includes(
			"intent_completion_review --> intent_completion_fix : review.findings",
		),
		"review.findings → fix missing",
	)
})

test("intent_completion_gate finalizes to complete", () => {
	assert.ok(
		mermaid.includes("intent_completion_gate --> complete : gate.approved"),
		"gate.approved → complete missing",
	)
})

console.log("\n=== Mermaid: terminals ===")

test("all four terminals link to [*]", () => {
	for (const t of [
		"complete --> [*]",
		"error --> [*]",
		"escalate --> [*]",
		"blocked --> [*]",
	]) {
		assert.ok(mermaid.includes(`  ${t}`), `terminal '${t}' missing`)
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
