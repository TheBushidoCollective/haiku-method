#!/usr/bin/env npx tsx
// deadlock-detector.test.mjs
//
// Inter-tick wedge detection. The existing intra-tick loop guard
// catches spin loops inside a single haiku_run_next call. This
// detector catches the other shape — same action emitted across
// multiple consecutive ticks with no progress between them — which
// is the wedge pattern that historically shipped past CI tests
// because it spans tick boundaries.
//
// Tests inspect the detector's internal tick-history state directly
// (via the __getTickHistoryForTests test hook) rather than
// monkey-patching emitTelemetry, since ES module bindings are
// read-only. The detector's job is to track repetitions and
// signal at the threshold; the telemetry call is one observable
// side-effect, the history state is another.

import assert from "node:assert"
import { test } from "node:test"

const {
	recordTickResult,
	__resetDeadlockDetector,
	__getTickHistoryForTests,
	actionSignatureForDeadlock,
} = await import("../src/orchestrator/workflow/deadlock-detector.ts")

test("deadlock-detector: same action twice in a row reaches threshold", () => {
	__resetDeadlockDetector()
	const action = { action: "dispatch_review", stage: "inception", role: "spec" }
	recordTickResult("slug-a", action)
	assert.strictEqual(
		__getTickHistoryForTests("slug-a").count,
		1,
		"first tick records count=1",
	)
	recordTickResult("slug-a", action)
	assert.strictEqual(
		__getTickHistoryForTests("slug-a").count,
		2,
		"second identical tick reaches threshold (count=2)",
	)
})

test("deadlock-detector: changing action signature resets the counter", () => {
	__resetDeadlockDetector()
	recordTickResult("slug-b", { action: "dispatch_review", role: "spec" })
	recordTickResult("slug-b", { action: "merge_stage", stage: "design" })
	recordTickResult("slug-b", { action: "dispatch_review", role: "spec" })
	// Last call lands on a NEW count=1 — the previous alternating tick
	// reset the chain.
	assert.strictEqual(__getTickHistoryForTests("slug-b").count, 1)
})

test("deadlock-detector: continued repeats keep incrementing past threshold", () => {
	__resetDeadlockDetector()
	const action = { action: "elaborate", stage: "design" }
	recordTickResult("slug-c", action) // count = 1
	recordTickResult("slug-c", action) // count = 2 (fires)
	recordTickResult("slug-c", action) // count = 3
	recordTickResult("slug-c", action) // count = 4
	assert.strictEqual(__getTickHistoryForTests("slug-c").count, 4)
})

test("deadlock-detector: signature distinguishes target stage/unit/role", () => {
	__resetDeadlockDetector()
	const sig1 = actionSignatureForDeadlock({
		action: "dispatch_review",
		stage: "inception",
		role: "spec",
	})
	const sig2 = actionSignatureForDeadlock({
		action: "dispatch_review",
		stage: "design",
		role: "spec",
	})
	assert.notStrictEqual(
		sig1,
		sig2,
		"different stages must produce different signatures",
	)
	const sig3 = actionSignatureForDeadlock({
		action: "dispatch_review",
		stage: "inception",
		role: "completeness",
	})
	assert.notStrictEqual(
		sig1,
		sig3,
		"different roles must produce different signatures",
	)
})

test("deadlock-detector: per-slug isolation — one intent's wedge doesn't leak", () => {
	__resetDeadlockDetector()
	const action = { action: "dispatch_review", role: "spec" }
	recordTickResult("slug-e", action)
	recordTickResult("slug-e", action) // crosses threshold for slug-e
	recordTickResult("slug-f", action) // fresh history for slug-f
	assert.strictEqual(__getTickHistoryForTests("slug-e").count, 2)
	assert.strictEqual(__getTickHistoryForTests("slug-f").count, 1)
})

test("deadlock-detector: null action records as a stable 'null' signature", () => {
	__resetDeadlockDetector()
	recordTickResult("slug-g", null)
	recordTickResult("slug-g", null)
	assert.strictEqual(__getTickHistoryForTests("slug-g").count, 2)
	assert.strictEqual(__getTickHistoryForTests("slug-g").signature, "null")
})

test("deadlock-detector: A→B→A→B churn pattern surfaces a churn signal", () => {
	__resetDeadlockDetector()
	const A = { action: "dispatch_review", role: "spec" }
	const B = { action: "merge_stage", stage: "design" }
	recordTickResult("slug-h", A)
	recordTickResult("slug-h", B)
	recordTickResult("slug-h", A)
	// 4th tick should trigger churn detection — 4 entries cycling
	// through 2 distinct signatures.
	recordTickResult("slug-h", B)
	const h = __getTickHistoryForTests("slug-h")
	assert.strictEqual(
		h.churn_fired,
		true,
		"A→B→A→B must trigger the churn detector",
	)
	assert.strictEqual(
		h.recent.length,
		4,
		"recent window holds the alternating history",
	)
})

test("deadlock-detector: churn only fires once per alternation run", () => {
	__resetDeadlockDetector()
	const A = { action: "dispatch_review", role: "spec" }
	const B = { action: "merge_stage", stage: "design" }
	recordTickResult("slug-i", A)
	recordTickResult("slug-i", B)
	recordTickResult("slug-i", A)
	recordTickResult("slug-i", B) // crosses threshold here
	const afterCross = __getTickHistoryForTests("slug-i")
	assert.strictEqual(afterCross.churn_fired, true)
	// Continued alternation must not re-fire (the churn_fired latch
	// should stay set).
	recordTickResult("slug-i", A)
	recordTickResult("slug-i", B)
	const afterMore = __getTickHistoryForTests("slug-i")
	assert.strictEqual(
		afterMore.churn_fired,
		true,
		"latch stays set during continued alternation",
	)
})

test("deadlock-detector: a fresh signature in the window resets the churn latch", () => {
	__resetDeadlockDetector()
	const A = { action: "dispatch_review", role: "spec" }
	const B = { action: "merge_stage", stage: "design" }
	const C = { action: "elaborate", stage: "product" }
	recordTickResult("slug-j", A)
	recordTickResult("slug-j", B)
	recordTickResult("slug-j", A)
	recordTickResult("slug-j", B) // churn fires
	assert.strictEqual(__getTickHistoryForTests("slug-j").churn_fired, true)
	// Brand-new signature C — latch resets, ready to fire again on a
	// new alternation cycle.
	recordTickResult("slug-j", C)
	assert.strictEqual(
		__getTickHistoryForTests("slug-j").churn_fired,
		false,
		"introducing a new signature resets the latch",
	)
})

test("deadlock-detector: healthy progression (A→B→C→D distinct) does NOT trigger churn", () => {
	__resetDeadlockDetector()
	recordTickResult("slug-k", { action: "elaborate", stage: "inception" })
	recordTickResult("slug-k", {
		action: "dispatch_review",
		stage: "inception",
		role: "spec",
	})
	recordTickResult("slug-k", { action: "merge_stage", stage: "inception" })
	recordTickResult("slug-k", { action: "elaborate", stage: "design" })
	assert.strictEqual(
		__getTickHistoryForTests("slug-k").churn_fired,
		false,
		"4 distinct signatures is normal cursor progression, not churn",
	)
})
