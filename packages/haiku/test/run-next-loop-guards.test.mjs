#!/usr/bin/env npx tsx
// Regression for gigsmart/haiku-method#333 — `haiku_run_next` hung-call.
//
// Two failure modes the call must defend against, both of which look
// like a hung MCP call from the agent's side:
//
// 1. Picker cancellation — `runSelectionPicker` used to treat any
//    non-`isError` response as success. The picker tools return
//    `{action: "cancelled"}` JSON (not `isError`) when the SPA times
//    out (default 30 min) or the user dismisses the prompt. Without
//    a guard, the cursor still sees the field unset, the picker fires
//    again, and each iteration burns another 30 minutes.
//
// 2. Re-dispatch loops with no progress — every `while` block in
//    `handle` (select_*, close_feedback, merge_stage, gate_review)
//    re-ticks after a side-effect. If the side-effect didn't advance
//    cursor state, the loop spins inside the call. The cap +
//    same-action signature check catches both cases with a clear
//    diagnostic.

import assert from "node:assert"

const { RUN_NEXT_LOOP_CAP, actionSignature, loopAbortResponse } = await import(
	"../src/tools/orchestrator/_loop_guard.ts"
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
	}
}

console.log("\n=== loop guard helpers (regression: #333 hung run_next) ===")

test("RUN_NEXT_LOOP_CAP is a sane positive integer", () => {
	assert.strictEqual(typeof RUN_NEXT_LOOP_CAP, "number")
	assert.ok(RUN_NEXT_LOOP_CAP >= 4 && RUN_NEXT_LOOP_CAP <= 64)
})

test("actionSignature normalises identical actions to identical strings", () => {
	const a = {
		action: "merge_stage",
		stage: "design",
		unit: null,
		feedback_id: null,
		role: null,
	}
	const b = { action: "merge_stage", stage: "design" }
	assert.strictEqual(actionSignature(a), actionSignature(b))
})

test("actionSignature distinguishes actions on stage / unit / feedback_id / role", () => {
	const base = { action: "merge_stage", stage: "design" }
	const otherStage = { action: "merge_stage", stage: "development" }
	const otherUnit = { action: "merge_stage", stage: "design", unit: "u-01" }
	const otherFb = {
		action: "close_feedback",
		stage: "design",
		feedback_id: "FB-01",
	}
	assert.notStrictEqual(actionSignature(base), actionSignature(otherStage))
	assert.notStrictEqual(actionSignature(base), actionSignature(otherUnit))
	assert.notStrictEqual(actionSignature(base), actionSignature(otherFb))
})

test("loopAbortResponse(cap) returns isError and surfaces the diagnostic for user-side recovery", () => {
	// Contract revised 2026-05-12 (HAIKU-BUG-merge-loop-after-v0-to-v4-
	// migration): the diagnostic line MUST appear in the response text
	// so the user can recover it without grepping the MCP socket's
	// stderr (which Claude Code captures into a unix-socket buffer
	// they can't reach from disk). Without it, a real wedged user
	// reported they couldn't tell which loop fired. The diagnostic is
	// ALSO written to the per-session log file at
	// `$TMPDIR/haiku-prompts/{session_id}/loop-guards.log` (same dir
	// the subagent prompts live in, so the user has one place to look
	// for everything the engine wrote in their session).
	const r = loopAbortResponse(
		"merge_stage",
		17,
		{ action: "merge_stage", stage: "design" },
		"cap",
	)
	assert.strictEqual(r.isError, true)
	assert.ok(Array.isArray(r.content) && r.content.length === 1)
	const text = r.content[0].text
	// Actionable instructions for the user.
	assert.match(text, /retry/i)
	assert.match(text, /haiku_run_next/)
	// Diagnostic line is in the body (the user-recoverable signal).
	assert.match(text, /diagnostic: /)
	assert.match(text, /loop=merge_stage/)
	assert.match(text, /reason=cap/)
	assert.match(text, /iterations=17/)
	assert.match(text, /action=merge_stage/)
	assert.match(text, /stage=design/)
	// Path to the per-session log file ($TMPDIR/haiku-prompts/{session_id}/...).
	assert.match(text, /log: /)
	assert.match(text, /haiku-prompts/)
	assert.match(text, /loop-guards\.log/)
})

test("loopAbortResponse(no_progress) also surfaces the diagnostic", () => {
	const r = loopAbortResponse(
		"select_*",
		3,
		{ action: "select_studio" },
		"no_progress",
	)
	assert.strictEqual(r.isError, true)
	const text = r.content[0].text
	assert.match(text, /retry/i)
	assert.match(text, /diagnostic: /)
	assert.match(text, /loop=select_\*/)
	assert.match(text, /reason=no_progress/)
	assert.match(text, /action=select_studio/)
})

console.log("")
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`)
console.log("")

if (failed > 0) process.exit(1)
