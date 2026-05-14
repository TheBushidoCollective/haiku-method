#!/usr/bin/env npx tsx
// Test suite for the select_studio prompt builder. The bug we're
// guarding against: with the pre-stage selection chain (#310), the
// engine drives `select_studio` elicitation on the same tick that
// derives state — the agent has no chance to pre-narrow the studio
// list, so it calls `haiku_select_studio { intent }` with no options
// and the user sees every studio in the registry. The narrowing UX
// (subset + "Show all studios..." escape) only kicks in if the agent
// passes an `options` subset, so the prompt now has to instruct the
// agent to pick 2-4 studios from the action's `available_studios`
// payload before calling the tool.

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

console.log("\n=== select_studio prompt builder ===")

test("prompt instructs the agent to pre-narrow with options", () => {
	const body = selectStudioPrompt({
		...baseCtx,
		action: {
			action: "select_studio",
			intent: "demo-intent",
			available_studios: studios,
		},
	})
	assert.ok(body, "builder must return a body")
	// Core directive: pick 2-4 and pass as options.
	assert.ok(
		/2[–-]4|2 to 4|two to four/i.test(body),
		"prompt must tell the agent to pick 2-4 studios",
	)
	assert.ok(
		body.includes("options: ["),
		"prompt must show the call shape with options: [...]",
	)
	assert.ok(body.includes("haiku_select_studio"), "prompt must name the tool")
	assert.ok(
		body.includes('"demo-intent"'),
		"prompt must include the slug as a literal arg",
	)
})

test("prompt renders the available studios with descriptions", () => {
	const body = selectStudioPrompt({
		...baseCtx,
		action: {
			action: "select_studio",
			intent: "demo-intent",
			available_studios: studios,
		},
	})
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

test("prompt mentions the 'Show all studios...' escape (so narrowing isn't lossy)", () => {
	const body = selectStudioPrompt({
		...baseCtx,
		action: {
			action: "select_studio",
			intent: "demo-intent",
			available_studios: studios,
		},
	})
	assert.ok(
		/show\s+all\s+studios/i.test(body),
		"prompt must reference the 'Show all studios...' escape so the agent knows narrowing isn't lossy",
	)
})

test("prompt provides a fallback path when narrowing isn't possible", () => {
	const body = selectStudioPrompt({
		...baseCtx,
		action: {
			action: "select_studio",
			intent: "demo-intent",
			available_studios: studios,
		},
	})
	assert.ok(
		/no\s+`?options`?|without\s+options|cannot\s+narrow/i.test(body),
		"prompt must allow the agent to call without options when narrowing fails",
	)
})

test("prompt does NOT direct the agent to Read intent.md (blocked by workflow-fields hook)", () => {
	// The guard-workflow-fields PreToolUse hook blocks generic
	// Read/Write/Edit on intent.md and emits "BLOCKED: Cannot read
	// intent.md via generic Read…". If the prompt instructs the
	// agent to Read intent.md, the agent hits the block, gets
	// redirected, and wastes a round-trip. The fix is to tell the
	// agent the description is already in context (it just authored
	// the intent moments ago in the same turn that triggered this
	// elicitation).
	const body = selectStudioPrompt({
		...baseCtx,
		action: {
			action: "select_studio",
			intent: "demo-intent",
			available_studios: studios,
		},
	})
	assert.ok(
		!/Read\s+(the\s+)?(intent\s+description\s+)?in\s+`?\.haiku\/intents/i.test(
			body,
		),
		"prompt must not tell the agent to Read .haiku/intents/<slug>/intent.md (workflow-fields hook blocks it)",
	)
	// Positive: the prompt should anchor the agent on its in-context recall.
	assert.ok(
		/recall|in\s+(your\s+)?context|already\s+have/i.test(body),
		"prompt must anchor the agent on the in-context description",
	)
})

test("prompt handles missing available_studios gracefully", () => {
	// Defensive: if the handler ever returns the action without
	// available_studios (registry-missing edge case), the prompt
	// shouldn't crash or render `undefined`/`[object Object]`.
	const body = selectStudioPrompt({
		...baseCtx,
		action: {
			action: "select_studio",
			intent: "demo-intent",
		},
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
