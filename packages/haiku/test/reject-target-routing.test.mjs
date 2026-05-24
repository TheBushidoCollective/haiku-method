// reject-target-routing.test.mjs
//
// Phase 2: the shared reject-target resolver, made role-aware. A reject must
// reach a hat that can ACT (a `build` hat) — bouncing to a `verify` hat
// (which can only judge) burns bolts to the cap, which is the deadlock the
// admin-portal-reimagine bug report hit (blue-team → red-team → reviewer,
// none of which build). With `role:` markers declared, the resolver skips
// verify hats and routes to the nearest preceding build hat. Without roles,
// it degrades to the legacy step-back-one (so unmarked stages are unchanged).

import assert from "node:assert/strict"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname
const { resolveRejectTarget } = await import(
	`${SRC}orchestrator/hat-loop-routing.ts`
)

// Synthetic role maps — Phase 5 puts real markers on the security hats.
const SECURITY = [
	"threat-modeler",
	"security-engineer",
	"security-reviewer",
	"red-team",
	"blue-team",
]
const SECURITY_ROLES = {
	"threat-modeler": "plan",
	"security-engineer": "build",
	"security-reviewer": "verify",
	"red-team": "verify",
	"blue-team": "verify",
}
const roleOf = (m) => (h) => m[h]

test("no roles → legacy step-back-one (unmarked stages unchanged)", () => {
	const r = resolveRejectTarget(SECURITY, "blue-team")
	assert.strictEqual(r.targetHat, "red-team", "step back one")
	assert.strictEqual(r.via, "step-back-one")
})

test("role-aware: a verify hat reject skips intervening verifiers → nearest build hat", () => {
	// THE BUG FIX: blue-team(verify) rejecting must reach security-engineer
	// (build), not red-team(verify) one step back.
	const r = resolveRejectTarget(SECURITY, "blue-team", {
		roleOf: roleOf(SECURITY_ROLES),
	})
	assert.strictEqual(r.targetHat, "security-engineer")
	assert.strictEqual(r.via, "nearest-build")
})

test("role-aware: red-team(verify) reject also routes to the builder", () => {
	const r = resolveRejectTarget(SECURITY, "red-team", {
		roleOf: roleOf(SECURITY_ROLES),
	})
	assert.strictEqual(r.targetHat, "security-engineer")
})

test("role-aware: clean plan-do-verify verifier reject → builder (same as step-back-one)", () => {
	const hats = ["planner", "builder", "reviewer"]
	const roles = { planner: "plan", builder: "build", reviewer: "verify" }
	const r = resolveRejectTarget(hats, "reviewer", { roleOf: roleOf(roles) })
	assert.strictEqual(r.targetHat, "builder")
	assert.strictEqual(r.via, "nearest-build")
})

test("role-aware: builder reject (no build hat before it) → falls back to step-back-one (planner)", () => {
	const hats = ["planner", "builder", "reviewer"]
	const roles = { planner: "plan", builder: "build", reviewer: "verify" }
	const r = resolveRejectTarget(hats, "builder", { roleOf: roleOf(roles) })
	assert.strictEqual(r.targetHat, "planner")
	assert.strictEqual(r.via, "step-back-one")
})

test("named target: a valid prior non-verify hat is honored (plan-defect → planner)", () => {
	// A verifier flagging a SPEC defect routes to the planner, not the builder.
	const r = resolveRejectTarget(SECURITY, "blue-team", {
		roleOf: roleOf(SECURITY_ROLES),
		namedTarget: "threat-modeler",
	})
	assert.strictEqual(r.targetHat, "threat-modeler")
	assert.strictEqual(r.via, "named-target")
})

test("named target: a verify hat is NOT a valid target → falls through to nearest build", () => {
	const r = resolveRejectTarget(SECURITY, "blue-team", {
		roleOf: roleOf(SECURITY_ROLES),
		namedTarget: "red-team", // verify — cannot be a rewind target
	})
	assert.strictEqual(r.targetHat, "security-engineer")
	assert.strictEqual(r.via, "nearest-build")
})

test("named target: a target at/after the rejecter is ignored (can't rewind forward)", () => {
	const r = resolveRejectTarget(SECURITY, "security-reviewer", {
		roleOf: roleOf(SECURITY_ROLES),
		namedTarget: "blue-team", // after the rejecter
	})
	assert.strictEqual(r.targetHat, "security-engineer")
	assert.strictEqual(r.via, "nearest-build")
})

test("assessor-to-first special case still wins (unit track)", () => {
	const hats = ["designer", "builder", "feedback-assessor"]
	const r = resolveRejectTarget(hats, "feedback-assessor", {
		assessorToFirst: true,
		assessorHat: "feedback-assessor",
	})
	assert.strictEqual(r.targetHat, "designer")
	assert.strictEqual(r.via, "assessor-to-first")
})

test("rejecter is first hat → retries self", () => {
	const r = resolveRejectTarget(SECURITY, "threat-modeler")
	assert.strictEqual(r.targetHat, "threat-modeler")
	assert.strictEqual(r.callingIdx, 0)
})
