#!/usr/bin/env npx tsx
// Test suite for the no-repo-pointer gate model (2026-05-26).
//
// "The MCP is long-lived; the connection is to the MCP, not the tool."
// run_next no longer persists any gate_review_* pointer to intent.md.
// Instead:
//   - the session id stays an in-memory registry entry keyed by intent
//     slug — resolvable across a page refresh that reconnects the SAME
//     logical session;
//   - the post-decision routing (gate_context / next_stage / next_phase)
//     travels to await_gate as ARGS on the inline path.
//
// This pins the two contracts that make that safe: the await_gate input
// schema accepts the routing args, and the registry resolves a live
// review session by intent slug.

import assert from "node:assert"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

const { validateHaikuAwaitGateInputSchema } = await import(
	"../src/state/schemas/index.ts"
)
const { createSession, deleteSession, findLiveReviewSessionForIntent } =
	await import("../src/sessions.ts")

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

console.log("\n=== await_gate no-repo-pointer model ===")

test("input schema accepts inline routing args (gate_context/next_stage/next_phase)", () => {
	const ok = validateHaikuAwaitGateInputSchema({
		intent: "my-intent",
		session_id: "sess-1",
		review_url: "http://localhost:0/review",
		auto_open: false,
		gate_context: "elaborate_to_execute",
		next_stage: null,
		next_phase: "execute",
	})
	assert.equal(
		ok,
		true,
		`schema must accept the inline routing args; errors=${JSON.stringify(
			validateHaikuAwaitGateInputSchema.errors,
		)}`,
	)
})

test("input schema accepts a string next_stage and a null next_phase", () => {
	const ok = validateHaikuAwaitGateInputSchema({
		intent: "my-intent",
		gate_context: "stage_gate",
		next_stage: "design",
		next_phase: null,
	})
	assert.equal(ok, true, "next_stage string + next_phase null must validate")
})

test("input schema still rejects unknown fields (additionalProperties:false holds)", () => {
	const ok = validateHaikuAwaitGateInputSchema({
		intent: "my-intent",
		gate_review_session_id: "leaked-pointer",
	})
	assert.equal(
		ok,
		false,
		"a stray repo-pointer field must be rejected at the gate",
	)
})

test("registry resolves the live review session for an intent (no repo pointer needed)", () => {
	const s = createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "resolve-by-intent",
		target: "test",
	})
	try {
		const live = findLiveReviewSessionForIntent("resolve-by-intent")
		assert.ok(live, "a freshly created review session must resolve by slug")
		assert.equal(
			live.session_id,
			s.session_id,
			"the resolved session is the one created for this intent",
		)
		assert.equal(
			findLiveReviewSessionForIntent("some-other-intent"),
			undefined,
			"resolution is scoped to the intent slug",
		)
	} finally {
		deleteSession(s.session_id)
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
