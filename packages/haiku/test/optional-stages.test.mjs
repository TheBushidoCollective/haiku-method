#!/usr/bin/env npx tsx
// optional-stages.test.mjs — canonical intent.stages resolution, the
// auto-ignore input filter, and the optional/deprecated config fields.
//
// Covers the foundation of the optional-stages feature (2026-05-27):
//   - resolveIntentStages: intent.stages is the canonical ordered plan;
//     skip_stages is gone; stale stages (not in the studio) are guarded out;
//     absent stages fall back to the full studio list.
//   - filterInputsByPlanStages: a cross-stage input whose source stage is
//     out-of-plan is dropped (the auto-ignore for dropped optional stages).
//   - StageConfig.optional / StudioConfig.deprecated default sensibly.

import assert from "node:assert"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { resolveIntentStages, filterInputsByPlanStages, resolveStudioStages } =
	await import("../src/orchestrator/studio.ts")
const { buildStudioConfig } = await import(
	"../src/orchestrator/workflow/build-studio-config.ts"
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

console.log("=== resolveIntentStages: canonical plan ===")

const softwareStages = resolveStudioStages("software")
assert.ok(softwareStages.length > 0, "software studio should resolve stages")

test("absent intent.stages falls back to full studio list", () => {
	assert.deepStrictEqual(
		resolveIntentStages({}, "software"),
		softwareStages,
	)
})

test("intent.stages is the canonical plan (subset of studio stages)", () => {
	const plan = ["inception", "development", "security"]
	assert.deepStrictEqual(
		resolveIntentStages({ stages: plan }, "software"),
		plan,
	)
})

test("a stage not in the studio is guarded out (stale-stage guard)", () => {
	const plan = ["inception", "ghost-stage", "development"]
	assert.deepStrictEqual(
		resolveIntentStages({ stages: plan }, "software"),
		["inception", "development"],
	)
})

test("skip_stages is dead — it no longer affects resolution", () => {
	// Legacy frontmatter carrying skip_stages must be ignored entirely.
	const out = resolveIntentStages(
		{ stages: softwareStages, skip_stages: ["design", "product"] },
		"software",
	)
	assert.deepStrictEqual(out, softwareStages)
})

test("empty intent.stages array falls back to full studio list", () => {
	assert.deepStrictEqual(
		resolveIntentStages({ stages: [] }, "software"),
		softwareStages,
	)
})

console.log("=== filterInputsByPlanStages: auto-ignore ===")

const devInputs = [
	{ stage: "inception", discovery: "discovery" },
	{ stage: "design", discovery: "design-brief" },
	{ stage: "design", output: "design-artifacts" },
	{ stage: "product", discovery: "acceptance-criteria" },
]

test("inputs from in-plan stages survive; out-of-plan stages drop", () => {
	const plan = ["inception", "development", "security"] // design + product dropped
	const kept = filterInputsByPlanStages(devInputs, plan)
	assert.deepStrictEqual(kept, [{ stage: "inception", discovery: "discovery" }])
})

test("all inputs survive when every source stage is in plan", () => {
	const plan = ["inception", "design", "product", "development"]
	assert.strictEqual(filterInputsByPlanStages(devInputs, plan).length, 4)
})

test("accepts a Set as well as an array", () => {
	const kept = filterInputsByPlanStages(devInputs, new Set(["design"]))
	assert.strictEqual(kept.length, 2)
	assert.ok(kept.every((i) => i.stage === "design"))
})

console.log("=== config fields: optional / deprecated ===")

const software = buildStudioConfig("software")

test("StageConfig.optional defaults to false for a mandatory stage", () => {
	assert.strictEqual(software.stages.inception.optional, false)
	assert.strictEqual(software.stages.development.optional, false)
})

test("StudioConfig.deprecated defaults to false for an active studio", () => {
	assert.strictEqual(software.deprecated, false)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
