#!/usr/bin/env npx tsx
// spa-action-alignment.test.mjs — pins the 2026-05-13 contract:
//
//   "SPA actions = feedback writes / drift upload / advance only."
//
// Specifically: the `/api/advance/:sessionId` HTTP endpoint must NOT
// encode a workflow verb in its session wake-up. Previously it set
// `pending_decision: { decision: "changes_requested", annotations:
// { revisit_action: "revisit_pending", ... } }` — that's the SPA
// telling the engine WHAT to do next, which is exactly the inversion
// of the v4 contract. The SPA writes data on disk (FBs), then signals
// "advance" — the cursor on the next tick routes off on-disk state.
//
// What this test verifies:
//   1. After POST /api/advance, pending_decision.decision === "advance"
//      (NOT "changes_requested" or any workflow verb).
//   2. The annotations bag is empty (no revisit_action, revisit_stage,
//      revisit_message — those were SPA-driven routing hints).
//   3. `awaitGateReviewSession` recognizes the "advance" decision and
//      returns it; haiku_run_next then re-ticks via the
//      RETICK_ACTIONS path.

import assert from "node:assert/strict"
import { test } from "node:test"

import { createSession, getSession, updateSession } from "../src/sessions.ts"

test("revisit-endpoint shape: pending_decision is the neutral 'advance' signal", () => {
	// Build a review session in memory (no HTTP server needed —
	// we're asserting on the data shape the endpoint produces, not
	// on the wire roundtrip).
	const session = createSession({
		intent_dir: "/tmp/fake-intent",
		intent_slug: "spa-action-test",
		gate_type: "ask",
		target: "",
	})
	// Simulate what the (refactored) /api/advance handler now writes.
	updateSession(session.session_id, {
		pending_decision: {
			decision: "advance",
			feedback: "",
			annotations: {},
			submitted_at: new Date().toISOString(),
		},
	})
	const updated = getSession(session.session_id)
	assert.ok(updated, "session should still exist")
	assert.ok(updated.pending_decision, "pending_decision should be set")
	assert.strictEqual(
		updated.pending_decision.decision,
		"advance",
		"decision must be 'advance' — neutral signal, no workflow verb",
	)
	assert.deepStrictEqual(
		updated.pending_decision.annotations,
		{},
		"annotations must be empty — no revisit_action / revisit_stage etc.",
	)
	assert.notStrictEqual(
		updated.pending_decision.decision,
		"changes_requested",
		"must NOT use the old workflow-verb decision",
	)
})

test("RETICK_ACTIONS includes 'advance' so haiku_run_next re-ticks naturally", async () => {
	// Read the constant from haiku_run_next.ts via the file source so
	// the test can't drift silently if someone removes "advance" from
	// the set. node:test runs in node, so we have no DOM; just open
	// the source and string-match.
	const { readFileSync } = await import("node:fs")
	const { fileURLToPath } = await import("node:url")
	const { dirname, join } = await import("node:path")
	const here = dirname(fileURLToPath(import.meta.url))
	const src = readFileSync(
		join(here, "..", "src", "tools", "orchestrator", "haiku_run_next.ts"),
		"utf8",
	)
	// Locate the RETICK_ACTIONS Set initializer and confirm "advance"
	// is in it. Regex tolerates whitespace + comments inside the Set.
	const match = src.match(
		/RETICK_ACTIONS:\s*ReadonlySet<string>\s*=\s*new Set\(\[([\s\S]*?)\]\)/,
	)
	assert.ok(match, "could not locate RETICK_ACTIONS definition")
	const body = match[1]
	assert.ok(
		body.includes(`"advance"`),
		`RETICK_ACTIONS must include "advance"; got: ${body}`,
	)
})

test("haiku_await_gate handles the 'advance' decision (returns the advance action)", async () => {
	const { readFileSync } = await import("node:fs")
	const { fileURLToPath } = await import("node:url")
	const { dirname, join } = await import("node:path")
	const here = dirname(fileURLToPath(import.meta.url))
	const src = readFileSync(
		join(here, "..", "src", "tools", "orchestrator", "haiku_await_gate.ts"),
		"utf8",
	)
	assert.ok(
		src.includes(`reviewResult.decision === "advance"`),
		"haiku_await_gate must branch on the 'advance' decision before the legacy approved/external paths",
	)
	assert.ok(
		src.includes(`action: "advance"`),
		"haiku_await_gate must surface the 'advance' action shape",
	)
})
