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
	wouldDeadlock,
	buildLoopHaltAction,
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
	recordTickResult("slug-b", { action: "complete_stage", stage: "design" })
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
	const B = { action: "complete_stage", stage: "design" }
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
	const B = { action: "complete_stage", stage: "design" }
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
	const B = { action: "complete_stage", stage: "design" }
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

test("deadlock-detector: A→A→A→B fires churn on B's arrival", () => {
	// Intended contract: when the recent window narrows to 2 distinct
	// signatures with the most recent tick being a transition, that's
	// churn — even when the prior signature repeated. The `suspected`
	// signal fired at tick 2 (A→A), and the churn signal fires at
	// tick 4 (when B arrives and the window becomes [A,A,A,B]: distinct
	// size = 2, > 1, ≤ CHURN_MAX_DISTINCT). The two signals are
	// independent observations of the same wedge; both firing is
	// expected and useful — dashboards can correlate them.
	__resetDeadlockDetector()
	const A = { action: "dispatch_review", role: "spec" }
	const B = { action: "complete_stage", stage: "design" }
	recordTickResult("slug-l", A) // count=1
	recordTickResult("slug-l", A) // count=2 (suspected fires)
	recordTickResult("slug-l", A) // count=3 (suspected silent)
	recordTickResult("slug-l", B) // recent=[A,A,A,B] → churn fires
	const h = __getTickHistoryForTests("slug-l")
	assert.strictEqual(
		h.churn_fired,
		true,
		"A→A→A→B must fire churn when B's arrival narrows the window to 2 distinct sigs",
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
	recordTickResult("slug-k", { action: "complete_stage", stage: "inception" })
	recordTickResult("slug-k", { action: "elaborate", stage: "design" })
	assert.strictEqual(
		__getTickHistoryForTests("slug-k").churn_fired,
		false,
		"4 distinct signatures is normal cursor progression, not churn",
	)
})

// ─ Integration: confirm the detector is actually wired into runWorkflowTick.
// The detector being unit-tested correctly is necessary but not sufficient —
// it has to FIRE on every tick the engine emits. This test calls
// runWorkflowTick directly and inspects the in-memory tick history to verify
// the wiring.
test("deadlock-detector integration: runWorkflowTick records every emitted action", async () => {
	__resetDeadlockDetector()
	const { dirname, resolve, join } = await import("node:path")
	const { fileURLToPath } = await import("node:url")
	const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import(
		"node:fs"
	)
	const { tmpdir } = await import("node:os")

	const __filename = fileURLToPath(import.meta.url)
	const __dirname = dirname(__filename)
	const origPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
	process.env.CLAUDE_PLUGIN_ROOT = resolve(
		__dirname,
		"..",
		"..",
		"..",
		"plugin",
	)

	const { runWorkflowTick } = await import(
		"../src/orchestrator/workflow/run-tick.ts"
	)
	await import("../src/orchestrator/migrations/v0-to-v4.ts")

	const root = mkdtempSync(join(tmpdir(), "haiku-detector-integ-"))
	const haikuRoot = join(root, ".haiku")
	const slug = "integ-test-intent"
	const iDir = join(haikuRoot, "intents", slug)
	mkdirSync(join(iDir, "stages", "inception", "units"), { recursive: true })
	// Minimal current-major intent — plugin_version stamped at the
	// running plugin's major.0.0 so the migration registry is a no-op
	// on both ticks (no major-version delta → no migrate edge fires).
	// NO deprecated v3 fields (active_stage / status / phase, all in
	// DEPRECATED_INTENT_FIELDS) so the cruft re-migrator also stays
	// quiet. Both ticks produce the same action signature, so the
	// detector's consecutive counter increments cleanly.
	//
	// We pull the major from getPluginVersion at runtime so a future
	// major bump doesn't break this test the same way the 4 → 5 bump
	// did when the fixture was hard-coded to "4.0.0".
	const { getPluginVersion } = await import("../src/version.ts")
	// `|| "4"` (not `?? "4"`) so the fallback also catches the
	// empty-string case from a malformed version. `split(".")[0]`
	// on `""` returns `""`, which `??` would happily pass through.
	const fixtureVersion = `${getPluginVersion().split(".")[0] || "4"}.0.0`
	writeFileSync(
		join(iDir, "intent.md"),
		[
			"---",
			"title: Integration test intent",
			"studio: software",
			"mode: continuous",
			`plugin_version: ${fixtureVersion}`,
			"stages: [inception]",
			"---",
			"body",
			"",
		].join("\n"),
	)

	const origCwd = process.cwd()
	try {
		process.chdir(root)
		runWorkflowTick(slug, haikuRoot)
		const afterFirst = __getTickHistoryForTests(slug)
		assert.ok(
			afterFirst !== null,
			"runWorkflowTick must record the tick in the detector — found no history",
		)
		assert.strictEqual(afterFirst.count, 1, "first recorded tick has count=1")
		runWorkflowTick(slug, haikuRoot)
		const afterSecond = __getTickHistoryForTests(slug)
		// Same disk state → same action signature → counter increments.
		// This is also the threshold-crossing tick for `suspected`.
		assert.strictEqual(
			afterSecond.count,
			2,
			"second identical tick must increment the consecutive counter",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(root, { recursive: true, force: true })
		if (origPluginRoot === undefined) {
			delete process.env.CLAUDE_PLUGIN_ROOT
		} else {
			process.env.CLAUDE_PLUGIN_ROOT = origPluginRoot
		}
	}
})

// ── HALT GATE: enforcing prevention (added 2026-05-15) ─────────────
//
// The detector previously emitted telemetry only. Per the goal
// "ensure nothing in our engine can put us in an infinite loop"
// (PR adding wouldDeadlock + buildLoopHaltAction), the engine now
// REFUSES to return the same action signature beyond HALT_THRESHOLD
// consecutive ticks. These tests pin the predicate behavior; the
// run-tick.ts wiring is integration-tested elsewhere.

test("wouldDeadlock: fires on the HALT_THRESHOLD-th consecutive identical tick", () => {
	__resetDeadlockDetector()
	const action = { action: "dispatch_review", stage: "design", role: "spec" }
	// Simulate 3 identical recorded ticks (count=3 in history).
	// HALT_THRESHOLD is 4, so the NEXT tick (4th) should fire.
	for (let i = 0; i < 3; i++) recordTickResult("slug-h", action)
	const verdict = wouldDeadlock("slug-h", action)
	assert.ok(verdict, "4th identical tick must trigger halt verdict")
	assert.strictEqual(verdict.kind, "repeat")
	assert.strictEqual(verdict.count, 4)
})

test("wouldDeadlock: returns null when next signature differs (loop broken)", () => {
	__resetDeadlockDetector()
	const same = { action: "dispatch_review", stage: "design", role: "spec" }
	for (let i = 0; i < 3; i++) recordTickResult("slug-i", same)
	const verdict = wouldDeadlock("slug-i", {
		action: "complete_stage",
		stage: "design",
	})
	assert.strictEqual(
		verdict,
		null,
		"different signature breaks the chain — no halt",
	)
})

test("wouldDeadlock: churn pattern (A↔B over 8 ticks) triggers halt", () => {
	__resetDeadlockDetector()
	const a = { action: "dispatch_review", stage: "design", role: "spec" }
	const b = { action: "dispatch_review", stage: "design", role: "user" }
	// Record 7 alternating ticks; the 8th is the verdict probe.
	const seq = [a, b, a, b, a, b, a]
	for (const x of seq) recordTickResult("slug-j", x)
	const verdict = wouldDeadlock("slug-j", b)
	assert.ok(verdict, "A↔B over 8 ticks must trigger halt")
	assert.strictEqual(verdict.kind, "churn")
	assert.ok(verdict.distinct === 2)
})

test("buildLoopHaltAction: produces a `loop_halted` action with surfaced detail", () => {
	const verdict = {
		kind: "repeat",
		count: 4,
		signature: '{"action":"dispatch_review","role":"spec"}',
	}
	const halt = buildLoopHaltAction("test-slug", verdict)
	assert.strictEqual(halt.action, "loop_halted")
	assert.strictEqual(halt.intent, "test-slug")
	assert.strictEqual(halt.loop, "repeat")
	assert.ok(halt.message.includes("4 consecutive times"))
	assert.ok(halt.message.includes("test-slug"))
	assert.ok(
		halt.message.includes("dispatch_review"),
		"halt message must surface the offending signature",
	)
})

test("first tick of a brand-new intent: wouldDeadlock returns null (no prior history)", () => {
	__resetDeadlockDetector()
	const verdict = wouldDeadlock("slug-fresh", {
		action: "start_stage",
		stage: "design",
	})
	assert.strictEqual(verdict, null, "fresh intent has no prior — no halt")
})

test("recordTickResult: loop_halted action does NOT pollute the recent window", () => {
	__resetDeadlockDetector()
	const A = { action: "dispatch_review", role: "spec" }
	const B = { action: "complete_stage", stage: "design" }
	// Build up an A↔B alternation.
	for (const x of [A, B, A, B, A, B, A]) recordTickResult("slug-k", x)
	const before = __getTickHistoryForTests("slug-k")
	const beforeLen = before.recent.length
	// Now record a halt — must NOT extend the window.
	recordTickResult("slug-k", {
		action: "loop_halted",
		intent: "slug-k",
		message: "halt",
	})
	const after = __getTickHistoryForTests("slug-k")
	assert.strictEqual(
		after.recent.length,
		beforeLen,
		"loop_halted action must not append to recent window",
	)
	assert.ok(
		!after.recent.some((s) => s.includes("loop_halted")),
		"loop_halted signature must not appear in recent window",
	)
})
