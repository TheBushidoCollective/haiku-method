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
