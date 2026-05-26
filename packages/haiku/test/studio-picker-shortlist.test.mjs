#!/usr/bin/env npx tsx
// Studio picker shortlist / "Show all" behavior.
//
// The bug this guards: the engine-driven studio picker (2026-05-07 moved
// select_* inline) called haiku_select_studio with no options, so it
// presented EVERY studio on every intent. The fix narrows the picker
// from the agent's create-time `studio_candidates`: the shortlist renders
// first, the rest are flagged `secondary` so the SPA tucks them behind a
// "Show all studios…" expansion. buildStudioPickerOptions is the pure
// ordering/marking core.

import assert from "node:assert"

const { buildStudioPickerOptions } = await import(
	"../src/tools/orchestrator/studio-picker-options.ts"
)

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (e.stack) console.log(e.stack)
	}
}

const studios = [
	{ dir: "/s/product", name: "product", description: "Build a feature" },
	{ dir: "/s/design", name: "design", description: "Visual + UX" },
	{ dir: "/s/research", name: "research", description: "Investigate" },
	{ dir: "/s/operations", name: "operations", description: "Run + deploy" },
]

console.log("\n=== studio picker shortlist (buildStudioPickerOptions) ===")

test("shortlist studios render first, in shortlist order", () => {
	const opts = buildStudioPickerOptions(studios, ["research", "design"])
	assert.deepStrictEqual(
		opts.map((o) => o.label),
		["research", "design", "product", "operations"],
		"shortlist (research, design) leads; the rest follow in registry order",
	)
})

test("non-shortlist studios are flagged secondary; shortlist is not", () => {
	const opts = buildStudioPickerOptions(studios, ["research", "design"])
	const byName = Object.fromEntries(opts.map((o) => [o.label, o]))
	assert.strictEqual(
		byName.research.secondary,
		undefined,
		"shortlist = primary",
	)
	assert.strictEqual(byName.design.secondary, undefined, "shortlist = primary")
	assert.strictEqual(byName.product.secondary, true, "rest = secondary")
	assert.strictEqual(byName.operations.secondary, true, "rest = secondary")
})

test("empty shortlist → every studio is primary (pre-shortlist behavior)", () => {
	const opts = buildStudioPickerOptions(studios, [])
	assert.deepStrictEqual(
		opts.map((o) => o.label),
		["product", "design", "research", "operations"],
		"registry order preserved",
	)
	assert.ok(
		opts.every((o) => o.secondary === undefined),
		"no secondary flags when there's no shortlist — no 'Show all' toggle",
	)
})

test("shortlist names with no matching studio are ignored (no crash, no phantom)", () => {
	const opts = buildStudioPickerOptions(studios, ["does-not-exist"])
	// No real studio matched → behaves like an empty shortlist.
	assert.strictEqual(opts.length, studios.length)
	assert.ok(
		opts.every((o) => o.secondary === undefined),
		"a shortlist that matches nothing must not flag everything secondary",
	)
})

test("partial-match shortlist still narrows on the studios that DID match", () => {
	const opts = buildStudioPickerOptions(studios, ["operations", "ghost"])
	const byName = Object.fromEntries(opts.map((o) => [o.label, o]))
	assert.strictEqual(opts[0].label, "operations", "matched studio leads")
	assert.strictEqual(byName.operations.secondary, undefined)
	assert.strictEqual(byName.product.secondary, true)
})

test("option shape carries id + label + description", () => {
	const opts = buildStudioPickerOptions(studios, ["product"])
	const product = opts.find((o) => o.label === "product")
	assert.strictEqual(product.id, "/s/product", "id is the studio dir")
	assert.strictEqual(product.description, "Build a feature")
})

test("missing description defaults to empty string", () => {
	const opts = buildStudioPickerOptions([{ dir: "/s/x", name: "x" }], [])
	assert.strictEqual(opts[0].description, "")
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
