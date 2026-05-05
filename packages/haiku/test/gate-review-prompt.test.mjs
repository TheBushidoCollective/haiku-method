#!/usr/bin/env npx tsx
// Test suite for the gate_review prompt builder. Two failure modes
// caused this file to exist:
//
// 1. The pre-stage `intent_review` gate emits with stage=null (no
//    stage has started yet). The previous prompt rendered "Stage
//    'null' is complete and ready..." — wrong subject and confuses
//    the agent about what's being approved.
//
// 2. The agent was ending its turn after posting the review URL and
//    never calling haiku_await_gate. The previous prompt used a
//    numbered list ("1. Tell the user the URL. 2. Call await_gate")
//    which the agent treated as two separate turns. The fix is
//    imperative same-turn language ("do BOTH in the same turn — do
//    NOT stop after step 1") so the agent doesn't release the turn
//    between posting and awaiting.
//
// These tests exercise the prompt builder directly so we don't have
// to spin up the whole orchestrator.

import assert from "node:assert"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

const { default: gateReviewPrompt } = await import(
	"../src/orchestrator/prompts/gate_review.ts"
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
	studio: "software",
	dir: "/tmp/whatever",
}

console.log("\n=== gate_review prompt builder ===")

test("stage gate (new session) — imperative same-turn language", () => {
	const body = gateReviewPrompt({
		...baseCtx,
		action: {
			action: "gate_review",
			intent: "demo-intent",
			stage: "build",
			next_stage: "release",
			next_phase: null,
			gate_type: "ask",
			gate_context: "stage_gate",
			review_url: "https://example.test/review/sess-123",
			session_id: "sess-123",
			browser_attached: false,
			reused: false,
		},
	})
	assert.ok(body, "builder must return a body")
	assert.ok(
		body.includes("haiku_await_gate"),
		"body must mention haiku_await_gate",
	)
	assert.ok(
		body.toLowerCase().includes("same turn"),
		"body must require the call in the same turn",
	)
	assert.ok(
		/do\s+not\s+stop/i.test(body),
		"body must explicitly tell the agent not to stop after posting the URL",
	)
	assert.ok(
		body.includes('"demo-intent"'),
		"body must include the slug as a literal arg for the await call",
	)
	assert.ok(
		body.includes("https://example.test/review/sess-123"),
		"body must include the review URL",
	)
	// stage gate names the stage
	assert.ok(
		body.includes('Stage "build"'),
		"stage-scope gate body should name the stage",
	)
	assert.ok(
		body.includes('"release"'),
		"stage-scope gate body should mention next stage when present",
	)
})

test("stage gate (browser attached) — skips post, still mandates await", () => {
	const body = gateReviewPrompt({
		...baseCtx,
		action: {
			action: "gate_review",
			intent: "demo-intent",
			stage: "build",
			next_stage: null,
			next_phase: null,
			gate_type: "ask",
			gate_context: "stage_gate",
			review_url: "https://example.test/review/sess-456",
			session_id: "sess-456",
			browser_attached: true,
			reused: true,
		},
	})
	assert.ok(body, "builder must return a body")
	assert.ok(
		/do\s+not\s+re-?post/i.test(body),
		"browser-attached body must say not to re-post the URL",
	)
	assert.ok(
		body.includes("haiku_await_gate"),
		"browser-attached body must still call haiku_await_gate",
	)
	assert.ok(
		body.includes("auto_open: false"),
		"browser-attached body must request auto_open: false to avoid duplicate tab",
	)
	assert.ok(
		body.toLowerCase().includes("same turn") ||
			/do\s+not\s+(end|stop)/i.test(body),
		"browser-attached body must still convey same-turn imperative",
	)
})

test("intent_review (stage = null) — does NOT render 'Stage null'", () => {
	const body = gateReviewPrompt({
		...baseCtx,
		action: {
			action: "gate_review",
			intent: "demo-intent",
			stage: null,
			next_stage: null,
			next_phase: "execute",
			gate_type: "ask",
			gate_context: "intent_review",
			review_url: "https://example.test/review/sess-789",
			session_id: "sess-789",
			browser_attached: false,
			reused: false,
		},
	})
	assert.ok(body, "builder must return a body")
	// The bug we're guarding against: pre-stage gate has no stage, so
	// any literal "Stage 'null'" / "Stage ''" / "Stage \"null\"" in the
	// rendered body is wrong.
	assert.ok(
		!/Stage\s+["']?(null|undefined)?["']?\s+is\s+complete/i.test(body),
		`pre-stage intent_review must not say 'Stage … is complete', got: ${body.slice(0, 200)}`,
	)
	assert.ok(
		!body.includes('Stage "null"'),
		"body must not contain literal 'Stage \"null\"'",
	)
	assert.ok(
		!body.includes("Stage ''"),
		"body must not contain literal \"Stage ''\"",
	)
	// Positive: it should describe the intent itself.
	assert.ok(
		/Intent\s+["']?demo-intent["']?\s+is\s+ready/i.test(body),
		"intent_review body should announce the INTENT, not a stage",
	)
	// And still drive the await call same-turn.
	assert.ok(
		body.includes("haiku_await_gate"),
		"intent_review body must still call haiku_await_gate",
	)
	assert.ok(
		body.toLowerCase().includes("same turn"),
		"intent_review body must require same-turn await call",
	)
})

test("intent_review with stage='' (empty-string coercion path)", () => {
	// The handler emits stage=null but the run_next pipeline uses
	// `(action.stage as string | null) ?? ""` to normalize. Cover the
	// empty-string path explicitly so a future refactor that flips the
	// normalization order doesn't silently regress the announcement.
	const body = gateReviewPrompt({
		...baseCtx,
		action: {
			action: "gate_review",
			intent: "demo-intent",
			stage: "",
			next_stage: null,
			next_phase: "execute",
			gate_type: "ask",
			// Note: gate_context omitted on purpose — relies on the
			// `stage === ""` fallback, NOT the explicit context check.
			review_url: "https://example.test/review/sess-empty",
			session_id: "sess-empty",
			browser_attached: false,
			reused: false,
		},
	})
	assert.ok(body, "builder must return a body")
	assert.ok(
		!body.includes('Stage ""'),
		"stage='' must not render literal 'Stage \"\"'",
	)
	assert.ok(
		/Intent\s+["']?demo-intent["']?\s+is\s+ready/i.test(body),
		"stage='' fallback should still announce the intent, not a stage",
	)
	assert.ok(
		body.includes("haiku_await_gate"),
		"stage='' fallback must still call haiku_await_gate",
	)
})

test("intent_review with browser_attached — keeps same-turn imperative", () => {
	const body = gateReviewPrompt({
		...baseCtx,
		action: {
			action: "gate_review",
			intent: "demo-intent",
			stage: null,
			next_stage: null,
			next_phase: "execute",
			gate_type: "ask",
			gate_context: "intent_review",
			review_url: "https://example.test/review/sess-789",
			session_id: "sess-789",
			browser_attached: true,
			reused: true,
		},
	})
	assert.ok(body, "builder must return a body")
	assert.ok(
		!body.includes('Stage "null"'),
		"body must not contain 'Stage \"null\"' in browser-attached intent_review path",
	)
	assert.ok(
		/Intent\s+["']?demo-intent["']?\s+is\s+ready/i.test(body),
		"intent_review (attached) body should still announce the intent, not a stage",
	)
	assert.ok(
		body.includes("haiku_await_gate"),
		"intent_review (attached) body must still call haiku_await_gate",
	)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
