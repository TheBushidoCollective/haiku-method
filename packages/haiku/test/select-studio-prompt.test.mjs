#!/usr/bin/env npx tsx
// Test suite for the select_studio prompt builder.
//
// Contract (post-2026-05-25): studio selection is engine-driven — the
// `select_studio` tick is intercepted by haiku_run_next, which runs the
// SPA picker inline, so in the normal path the agent never sees this
// prompt at all. This prompt is the fallback surface for direct/foreign
// callers. Pre-narrowing now happens at CREATE time: the agent stamps
// `studio_candidates` on intent.md via haiku_intent_create, and
// haiku_select_studio reads that to present a shortlist first with the
// rest behind a "Show all studios…" expansion in the SPA picker.
//
// So the prompt must NOT tell the agent to call haiku_select_studio with
// an `options` subset (that contract is dead). It should point the agent
// at the engine-driven flow (call haiku_run_next) and explain that the
// shortlist comes from create-time candidates.

import assert from "node:assert"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

const { default: selectStudioPrompt } = await import(
	"../src/orchestrator/prompts/intent/setup/select_studio/index.ts"
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

const baseCtx = {
	slug: "demo-intent",
	studio: "",
	dir: "/tmp/whatever",
}

const studios = [
	{
		name: "product",
		slug: "product",
		description: "Build a product feature end-to-end",
		category: "software",
	},
	{
		name: "design",
		slug: "design",
		description: "Iterate on visual design + UX",
		category: "design",
	},
	{
		name: "research",
		slug: "research",
		description: "Investigation, analysis, no code change",
		category: "knowledge",
	},
	{
		name: "operations",
		slug: "operations",
		description: "Run, deploy, monitor, teardown",
		category: "ops",
	},
]

const ctxWith = (extra = {}) => ({
	...baseCtx,
	action: {
		action: "select_studio",
		intent: "demo-intent",
		available_studios: studios,
		...extra,
	},
})

console.log("\n=== select_studio prompt builder ===")

test("prompt routes the agent to the engine-driven picker (haiku_run_next)", () => {
	const body = selectStudioPrompt(ctxWith())
	assert.ok(body, "builder must return a body")
	assert.ok(
		body.includes("haiku_run_next"),
		"prompt must point the agent at haiku_run_next (engine-driven picker)",
	)
})

test("prompt explains the shortlist comes from create-time studio_candidates", () => {
	const body = selectStudioPrompt(ctxWith())
	assert.ok(
		/studio_candidates/.test(body),
		"prompt must name studio_candidates as the pre-narrow mechanism",
	)
	assert.ok(
		/creation\s+time|create\s+time|haiku_intent_create/i.test(body),
		"prompt must tie candidates to intent creation, not to this step",
	)
})

test("prompt does NOT teach the dead 'call haiku_select_studio with options' contract", () => {
	const body = selectStudioPrompt(ctxWith())
	assert.ok(
		!/haiku_select_studio\s*\{[^}]*options/i.test(body),
		"prompt must not instruct the agent to call haiku_select_studio with an options subset (dead contract)",
	)
})

test("prompt mentions the 'Show all studios...' expansion (so narrowing isn't lossy)", () => {
	const body = selectStudioPrompt(ctxWith())
	assert.ok(
		/show\s+all\s+studios/i.test(body),
		"prompt must reference the 'Show all studios…' expansion so narrowing isn't lossy",
	)
})

test("prompt renders the available studios with descriptions when present", () => {
	const body = selectStudioPrompt(ctxWith())
	for (const s of studios) {
		assert.ok(
			body.includes(s.name),
			`studio name "${s.name}" must appear in the listing`,
		)
		assert.ok(
			body.includes(s.description),
			`description for "${s.name}" must appear in the listing`,
		)
	}
})

test("prompt does NOT direct the agent to Read intent.md (blocked by workflow-fields hook)", () => {
	const body = selectStudioPrompt(ctxWith())
	assert.ok(
		!/Read\s+(the\s+)?(intent\s+description\s+)?in\s+`?\.haiku\/intents/i.test(
			body,
		),
		"prompt must not tell the agent to Read .haiku/intents/<slug>/intent.md (workflow-fields hook blocks it)",
	)
})

test("prompt handles missing available_studios gracefully", () => {
	// Defensive: the action's available_studios is currently unpopulated
	// in the live engine, so the listing falls through to the empty
	// fallback. The prompt must not crash or render undefined/[object Object].
	const body = selectStudioPrompt({
		...baseCtx,
		action: { action: "select_studio", intent: "demo-intent" },
	})
	assert.ok(
		body,
		"builder must still return a body when available_studios is missing",
	)
	assert.ok(
		!body.includes("undefined"),
		"prompt must not render the literal 'undefined'",
	)
	assert.ok(
		!body.includes("[object Object]"),
		"prompt must not render '[object Object]'",
	)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
