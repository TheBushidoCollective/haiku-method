// __tests__/progress-milestones.test.ts — Pure-function tests for the
// shared milestone builder. Pins the ORDER, LABELS, and
// done→active→pending finalize that both the MCP engine's status-line
// track and the website browse UI render off of.
//
// Run via: cd packages/shared && npx tsx src/__tests__/progress-milestones.test.ts

import assert from "node:assert"
import {
	approvalMilestoneLabel,
	buildStageMilestones,
	finalizeSteps,
	reviewMilestoneLabel,
} from "../progress-milestones"

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
	try {
		fn()
		passed++
		console.log(`✔ ${name}`)
	} catch (err) {
		failed++
		console.error(`✖ ${name}`)
		console.error(err)
	}
}

// ── Labels ────────────────────────────────────────────────────────────

test("review labels: user → spec gate, cross-stage, default <role> review", () => {
	assert.strictEqual(reviewMilestoneLabel("user"), "spec gate")
	assert.strictEqual(
		reviewMilestoneLabel("cross-stage-consistency"),
		"cross-stage review",
	)
	assert.strictEqual(reviewMilestoneLabel("spec"), "spec review")
})

test("approval labels: user → approval gate, quality_gates, cross-stage, default", () => {
	assert.strictEqual(approvalMilestoneLabel("user"), "approval gate")
	assert.strictEqual(approvalMilestoneLabel("quality_gates"), "quality gates")
	assert.strictEqual(
		approvalMilestoneLabel("cross-stage-consistency"),
		"cross-stage approval",
	)
	assert.strictEqual(
		approvalMilestoneLabel("runtime-verifier"),
		"runtime-verifier approval",
	)
})

// ── finalizeSteps ─────────────────────────────────────────────────────

test("finalize: first not-done is active, rest pending, done stay done", () => {
	const out = finalizeSteps([
		{ key: "a", label: "a", done: true },
		{ key: "b", label: "b", done: false },
		{ key: "c", label: "c", done: false },
	])
	assert.deepStrictEqual(
		out.map((s) => s.status),
		["done", "active", "pending"],
	)
})

test("finalize: all done → no active step", () => {
	const out = finalizeSteps([
		{ key: "a", label: "a", done: true },
		{ key: "b", label: "b", done: true },
	])
	assert.deepStrictEqual(
		out.map((s) => s.status),
		["done", "done"],
	)
})

// ── buildStageMilestones order + keys ─────────────────────────────────

test("order: elaborate → reviews → execute → approvals → observations", () => {
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [
			{ role: "spec", stamped: true },
			{ role: "continuity", stamped: false },
		],
		executeDone: false,
		approvalRoles: [{ role: "quality_gates", stamped: false }],
		observationsDone: false,
	})
	// spec keeps its own pip; continuity is an adversarial reviewer →
	// collapses into the grouped pip. quality_gates keeps its own pip.
	assert.deepStrictEqual(
		steps.map((s) => s.key),
		[
			"elaborate",
			"review:spec",
			"review:adversarial:0",
			"execute",
			"approve:quality_gates",
			"observations",
		],
	)
})

test("observations omitted when observationsDone is null/undefined", () => {
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [],
		executeDone: false,
		approvalRoles: [],
	})
	assert.deepStrictEqual(
		steps.map((s) => s.key),
		["elaborate", "execute"],
	)
})

// ── buildStageMilestones gating ───────────────────────────────────────

test("a stamped review is NOT done until elaborate is done", () => {
	const steps = buildStageMilestones({
		elaborateDone: false,
		reviewRoles: [{ role: "spec", stamped: true }],
		executeDone: false,
		approvalRoles: [],
	})
	// elaborate is the active (first not-done) step; the stamped review
	// can't be done while elaborate is still in flight.
	const elaborate = steps.find((s) => s.key === "elaborate")
	const review = steps.find((s) => s.key === "review:spec")
	assert.strictEqual(elaborate?.status, "active")
	assert.strictEqual(review?.status, "pending")
})

test("a stamped approval is NOT done until execute is done", () => {
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [{ role: "spec", stamped: true }],
		executeDone: false,
		approvalRoles: [{ role: "quality_gates", stamped: true }],
	})
	const execute = steps.find((s) => s.key === "execute")
	const approval = steps.find((s) => s.key === "approve:quality_gates")
	// reviews done + elaborate done → execute is the active step;
	// the approval stays pending despite being stamped.
	assert.strictEqual(execute?.status, "active")
	assert.strictEqual(approval?.status, "pending")
})

test("everything done → all steps done, no active", () => {
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [{ role: "spec", stamped: true }],
		executeDone: true,
		approvalRoles: [{ role: "quality_gates", stamped: true }],
		observationsDone: true,
	})
	assert.ok(steps.every((s) => s.status === "done"))
})

// ── adversarial grouping ──────────────────────────────────────────────

test("adversarial reviewers collapse into one grouped pip with a count", () => {
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [
			{ role: "spec", stamped: true },
			{ role: "continuity", stamped: true },
			{ role: "cross-stage-consistency", stamped: false },
			{ role: "accessibility", stamped: false },
		],
		executeDone: false,
		approvalRoles: [],
	})
	const keys = steps.map((s) => s.key)
	// spec distinct; the 3 adversarial reviewers → one grouped pip.
	assert.deepStrictEqual(keys, [
		"elaborate",
		"review:spec",
		"review:adversarial:0",
		"execute",
	])
	const group = steps.find((s) => s.key === "review:adversarial:0")
	// 1 of 3 adversarial reviewers signed → count in the label, still active.
	assert.match(group?.label ?? "", /adversarial review \(1\/3\)/)
	assert.strictEqual(group?.status, "active")
})

test("grouped pip is done only when every adversarial role has signed", () => {
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [
			{ role: "continuity", stamped: true },
			{ role: "cross-stage-consistency", stamped: true },
		],
		executeDone: false,
		approvalRoles: [],
	})
	const group = steps.find((s) => s.key === "review:adversarial:0")
	assert.strictEqual(group?.status, "done")
	assert.match(group?.label ?? "", /adversarial review \(2\/2\)/)
})

test("quality_gates splits the approval adversarial group, both keep order", () => {
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [],
		executeDone: true,
		approvalRoles: [
			{ role: "spec", stamped: true },
			{ role: "continuity", stamped: true },
			{ role: "cross-stage-consistency", stamped: true },
			{ role: "quality_gates", stamped: false },
			{ role: "accessibility", stamped: false },
			{ role: "user", stamped: false },
		],
	})
	// spec | [continuity, cross-stage] | quality_gates | [accessibility] | user
	assert.deepStrictEqual(
		steps.filter((s) => s.key.startsWith("approve:")).map((s) => s.key),
		[
			"approve:spec",
			"approve:adversarial:0",
			"approve:quality_gates",
			"approve:adversarial:1",
			"approve:user",
		],
	)
})

console.log(`\n── Result: ${passed} passed, ${failed} failed ───────────`)
process.exit(failed === 0 ? 0 : 1)
