// role-markers-propagation.test.mjs
//
// Phase 6: ideation/review and security-assessment/exploitation carry
// multiple verify hats in the per-unit loop (a reject would ping-pong
// verifier→verifier to the bolt cap). Unlike security's red/blue these are
// in-loop verifiers, not adversarial FB-filers — so the fix is `role:`
// markers that activate the role-aware reject routing: a reject from any
// verify hat skips the other verifiers and lands on the nearest build hat.
//
// Pins: the real hat mandates carry the right roles, and resolveRejectTarget
// (fed those roles) routes a deep-verify reject to the builder.

import assert from "node:assert/strict"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
process.env.CLAUDE_PLUGIN_ROOT = join(resolve(HERE, "..", "..", ".."), "plugin")

const { readHatDefs } = await import(`${SRC}/studio-reader.ts`)
const { resolveRejectTarget } = await import(
	`${SRC}/orchestrator/hat-loop-routing.ts`
)

function rolesFor(studio, stage) {
	const defs = readHatDefs(studio, stage)
	const roleOf = (h) => defs[h]?.role
	return { defs, roleOf }
}

test("ideation/review hats carry plan/build/verify×3 roles", () => {
	const { defs } = rolesFor("ideation", "review")
	assert.strictEqual(defs["review-planner"]?.role, "plan")
	assert.strictEqual(defs.synthesizer?.role, "build")
	assert.strictEqual(defs.reviewer?.role, "verify")
	assert.strictEqual(defs.critic?.role, "verify")
	assert.strictEqual(defs["fact-checker"]?.role, "verify")
})

test("ideation/review: a fact-checker reject skips the other verifiers → synthesizer (builder)", () => {
	const { roleOf } = rolesFor("ideation", "review")
	const hats = [
		"review-planner",
		"synthesizer",
		"reviewer",
		"critic",
		"fact-checker",
	]
	const r = resolveRejectTarget(hats, "fact-checker", { roleOf })
	assert.strictEqual(r.targetHat, "synthesizer")
	assert.strictEqual(r.via, "nearest-build")
})

test("exploitation hats carry plan/build/verify/build/verify roles", () => {
	const { defs } = rolesFor("security-assessment", "exploitation")
	assert.strictEqual(defs["attack-strategist"]?.role, "plan")
	assert.strictEqual(defs["exploit-developer"]?.role, "build")
	assert.strictEqual(defs["exploit-reviewer"]?.role, "verify")
	assert.strictEqual(defs["attack-operator"]?.role, "build")
	assert.strictEqual(defs.verifier?.role, "verify")
})

test("exploitation: a verifier reject routes to the nearest builder (attack-operator)", () => {
	const { roleOf } = rolesFor("security-assessment", "exploitation")
	const hats = [
		"attack-strategist",
		"exploit-developer",
		"exploit-reviewer",
		"attack-operator",
		"verifier",
	]
	const r = resolveRejectTarget(hats, "verifier", { roleOf })
	assert.strictEqual(r.targetHat, "attack-operator")
	assert.strictEqual(r.via, "nearest-build")
	// and exploit-reviewer (mid-loop verify) routes back to exploit-developer
	const r2 = resolveRejectTarget(hats, "exploit-reviewer", { roleOf })
	assert.strictEqual(r2.targetHat, "exploit-developer")
})

test("software/design hats carry plan/build/verify roles (convention sweep)", () => {
	const { defs } = rolesFor("software", "design")
	assert.strictEqual(defs["designer-prep"]?.role, "plan")
	assert.strictEqual(defs.designer?.role, "build")
	assert.strictEqual(defs["design-reviewer"]?.role, "verify")
})

test("software/design: design-reviewer reject → designer (build); named plan-defect → designer-prep", () => {
	const { roleOf } = rolesFor("software", "design")
	const hats = ["designer-prep", "designer", "design-reviewer"]
	// default: a build defect rewinds to the builder.
	const r = resolveRejectTarget(hats, "design-reviewer", { roleOf })
	assert.strictEqual(r.targetHat, "designer")
	// named plan-defect target: rewind to the planner (the upstream-FB bandaid
	// this replaced).
	const r2 = resolveRejectTarget(hats, "design-reviewer", {
		roleOf,
		namedTarget: "designer-prep",
	})
	assert.strictEqual(r2.targetHat, "designer-prep")
	assert.strictEqual(r2.via, "named-target")
})
