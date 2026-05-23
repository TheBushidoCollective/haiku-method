// derive-unit-status.test.mjs
//
// CHARACTERIZATION (Phase 0 safety net for the HatLoopEngine extraction).
//
// `deriveUnitStatus` is the single source of truth for a unit's
// pending/active/completed status — read off `iterations[]` + `approvals`,
// NOT a stored `status:` field (v8 dropped it; legacy fallback remains).
// The recovery primitive (`haiku_unit_reset` → clear iterations → derive
// pending) and the sequence migration both depend on this exact mapping,
// so we pin the truth table BEFORE the extraction can perturb it.
//
// Mirrors the code at state-tools.ts deriveUnitStatus():
//   iterations non-empty:
//     last.result === "advance" AND approvals has ≥1 key → "completed"
//     otherwise                                           → "active"
//   else legacy `status`: completed|complete → completed; active → active
//   else                                                   → "pending"

import assert from "node:assert/strict"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname
const { deriveUnitStatus } = await import(`${SRC}state-tools.ts`)

test("deriveUnitStatus: no iterations, no legacy status → pending", () => {
	assert.strictEqual(deriveUnitStatus({}), "pending")
	assert.strictEqual(deriveUnitStatus({ iterations: [] }), "pending")
})

test("deriveUnitStatus: open iteration (result null) → active", () => {
	assert.strictEqual(
		deriveUnitStatus({
			iterations: [{ hat: "builder", result: null, completed_at: null }],
		}),
		"active",
	)
})

test("deriveUnitStatus: last advance but NO approvals → active (not complete)", () => {
	assert.strictEqual(
		deriveUnitStatus({ iterations: [{ hat: "reviewer", result: "advance" }] }),
		"active",
	)
	// Empty approvals object is still "no approvals".
	assert.strictEqual(
		deriveUnitStatus({
			iterations: [{ hat: "reviewer", result: "advance" }],
			approvals: {},
		}),
		"active",
	)
})

test("deriveUnitStatus: last advance AND ≥1 approval → completed", () => {
	assert.strictEqual(
		deriveUnitStatus({
			iterations: [{ hat: "reviewer", result: "advance" }],
			approvals: { spec: { signed_at: "2026-05-23T00:00:00Z" } },
		}),
		"completed",
	)
})

test("deriveUnitStatus: last result reject + approvals → active (last not advance)", () => {
	assert.strictEqual(
		deriveUnitStatus({
			iterations: [
				{ hat: "reviewer", result: "advance" },
				{ hat: "builder", result: "reject" },
			],
			approvals: { spec: { signed_at: "x" } },
		}),
		"active",
	)
})

test("deriveUnitStatus: legacy status fallback when no iterations", () => {
	assert.strictEqual(deriveUnitStatus({ status: "completed" }), "completed")
	assert.strictEqual(deriveUnitStatus({ status: "complete" }), "completed")
	assert.strictEqual(deriveUnitStatus({ status: "active" }), "active")
	assert.strictEqual(deriveUnitStatus({ status: "pending" }), "pending")
})

test("deriveUnitStatus: cleared iterations is the reset target — derives pending", () => {
	// This is the contract haiku_unit_reset relies on: wiping iterations
	// (and not leaving a legacy `status: active`) returns the unit to
	// pending so it can be re-run cleanly.
	assert.strictEqual(
		deriveUnitStatus({ iterations: [], approvals: {}, reviews: {} }),
		"pending",
	)
})
