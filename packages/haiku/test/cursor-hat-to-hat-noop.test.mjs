#!/usr/bin/env npx tsx
// cursor-hat-to-hat-noop.test.mjs — pins the fix for the
// "engine commits the advance but doesn't auto-dispatch the next
// hat" loop reported 2026-05-13 (images 1 & 2 of the
// kagami-slice-1-sendgrid-mirror screenshots).
//
// Root cause: the cursor's `walkStageUnits` had two intertwined
// problems:
//
// 1. `nextHatForUnit` returned `null` whenever the unit's last
//    iteration had `result === null`. That iteration was either
//    "engine pre-opened this hat for the next subagent" (the
//    happy-path mid-chain advance) or "subagent crashed without
//    closing" (the orphan path). Both should re-emit dispatch;
//    the cursor instead returned null → cursor returned null →
//    haiku_run_next returned a noop.
//
// 2. The in-flight filter at line ~866 caught ANY unit with a
//    null-result last iteration and short-circuited the whole
//    stage walk to noop. So even if one of two units was healthy,
//    the noop blocked dispatch for both.
//
// Plus the FB-as-unit variant of (1): `nextHatForUnit` only
// matched the unit-vocab `"reject"` for the rejection branch, not
// the FB-vocab `"rejected"` that haiku_feedback_reject_hat
// actually writes. After an assessor rejected an FB, the FB sat
// at status `addressed` and the cursor returned noop forever.

import assert from "node:assert/strict"
import { test } from "node:test"
import { nextHatForUnit } from "../src/orchestrator/workflow/cursor.ts"

function fm(iterations) {
	return { iterations }
}

test("nextHatForUnit: mid-chain advance → next hat (existing behavior, kept)", () => {
	const hats = ["planner", "implementer", "reviewer"]
	const out = nextHatForUnit(
		fm([{ hat: "planner", completed_at: "t", result: "advance" }]),
		hats,
	)
	assert.deepStrictEqual(out, { hat: "implementer", terminal: false })
})

test("nextHatForUnit: engine pre-opened iter (last.result === null after a closed advance) → dispatch the open hat", () => {
	// This is the #1 fix from the screenshots. After
	// haiku_unit_advance_hat closes the prior hat with
	// result="advance" and opens the next hat with result=null,
	// the cursor must re-emit start_unit_hat for the OPEN hat —
	// not noop.
	const hats = ["planner", "implementer", "reviewer"]
	const out = nextHatForUnit(
		fm([
			{ hat: "planner", completed_at: "t", result: "advance" },
			{ hat: "implementer", completed_at: null, result: null },
		]),
		hats,
	)
	assert.deepStrictEqual(
		out,
		{ hat: "implementer", terminal: false },
		"engine-pre-opened iter must surface as the open hat for re-dispatch",
	)
})

test("nextHatForUnit: fresh start (single open iter, no prior) → dispatch the open hat", () => {
	// After haiku_unit_start opens iter A with result=null and no
	// prior iter, the cursor must emit start_unit_hat for hat A
	// when the parent re-tickets (subagent never came back / crashed).
	const hats = ["planner", "implementer", "reviewer"]
	const out = nextHatForUnit(
		fm([{ hat: "planner", completed_at: null, result: null }]),
		hats,
	)
	assert.deepStrictEqual(
		out,
		{ hat: "planner", terminal: false },
		"fresh open iter without a prior must surface as the open hat",
	)
})

test("nextHatForUnit: terminal hat advance landed → null (unit done)", () => {
	// Past-terminal still returns null — the unit is done.
	const hats = ["planner", "implementer", "reviewer"]
	const out = nextHatForUnit(
		fm([
			{ hat: "planner", completed_at: "t", result: "advance" },
			{ hat: "implementer", completed_at: "t", result: "advance" },
			{ hat: "reviewer", completed_at: "t", result: "advance" },
		]),
		hats,
	)
	assert.strictEqual(out, null, "past the terminal hat → null (unit done)")
})

test("nextHatForUnit: empty iterations → first hat (fresh unit)", () => {
	const hats = ["planner", "implementer", "reviewer"]
	const out = nextHatForUnit(fm([]), hats)
	assert.deepStrictEqual(out, { hat: "planner", terminal: false })
})

// ── FB vocab compat ─────────────────────────────────────────────
//
// FBs use different iteration vocabulary than units:
//   - Unit advance_hat:    result = "advance"
//   - FB   advance_hat:    result = "advanced" (mid-chain) | "closed" (terminal)
//   - Unit reject_hat:     result = "reject"
//   - FB   reject_hat:     result = "rejected"
//
// `nextHatForUnit` matches both forms for advance ("advance"
// AND "advanced"). It must also match both for reject — the
// FB-fix-loop went silent after an assessor rejection because
// only "reject" was matched and "rejected" fell through to null.

test("nextHatForUnit: FB reject vocab — 'rejected' (past tense) routes to previous hat", () => {
	const fixHats = ["classifier", "researcher", "feedback-assessor"]
	const out = nextHatForUnit(
		fm([
			{ bolt: 1, hat: "classifier", completed_at: "t", result: "advanced" },
			{ bolt: 1, hat: "researcher", completed_at: "t", result: "advanced" },
			{
				bolt: 1,
				hat: "feedback-assessor",
				completed_at: "t",
				result: "rejected",
				reason: "fix not in place",
			},
		]),
		fixHats,
	)
	// After the assessor rejects, the cursor re-dispatches the
	// PRIOR hat (researcher) on the next bolt.
	assert.deepStrictEqual(out, {
		hat: "researcher",
		terminal: false,
		rejected: true,
	})
})

test("nextHatForUnit: FB reject vocab — 'rejected' on first hat re-dispatches first hat", () => {
	const fixHats = ["classifier", "researcher", "feedback-assessor"]
	const out = nextHatForUnit(
		fm([
			{
				bolt: 1,
				hat: "classifier",
				completed_at: "t",
				result: "rejected",
			},
		]),
		fixHats,
	)
	assert.deepStrictEqual(out, {
		hat: "classifier",
		terminal: false,
		rejected: true,
	})
})

// ── Drift case ────────────────────────────────────────────────────
//
// When the open iter's `hat` name is not in the studio's configured
// hat set, the cursor cannot meaningfully dispatch. The unit's
// iterations point at a stale hat name (studio renamed / removed
// that hat after the unit's prior run). nextHatForUnit must return
// null rather than mis-dispatch the stale name.

test("nextHatForUnit: open iter on a hat NOT in the configured set (drift) → null", () => {
	const hats = ["planner", "implementer", "reviewer"]
	const out = nextHatForUnit(
		fm([
			{ hat: "planner", completed_at: "t", result: "advance" },
			// `bogus-hat` is not in the configured set — studio drift.
			{ hat: "bogus-hat", completed_at: null, result: null },
		]),
		hats,
	)
	assert.strictEqual(
		out,
		null,
		"open iter on a drift hat must return null (cursor cannot dispatch a name the studio no longer has)",
	)
})

test("nextHatForUnit: closed iter on a hat NOT in the configured set (drift) → null", () => {
	// Pins the `if (idx < 0) return null` guard inside the
	// advance/advanced/closed branch when a closed iter points at a
	// hat the studio no longer has.
	//
	// NOTE: the reject/rejected branch is intentionally asymmetric.
	// It guards with `if (idx <= 0)` and dispatches `configuredHats[0]`
	// rather than returning null — a drift rejection falls back to
	// re-running the fix-hat sequence from the start. So this test
	// pins ONLY the advance-side drift contract; the reject-side
	// drift behavior (fall back to first hat) is covered by the
	// "FB reject vocab — 'rejected' on first hat re-dispatches first
	// hat" case above and is the correct behavior.
	const hats = ["planner", "implementer", "reviewer"]
	const out = nextHatForUnit(
		fm([{ hat: "bogus-hat", completed_at: "t", result: "advance" }]),
		hats,
	)
	assert.strictEqual(out, null)
})
