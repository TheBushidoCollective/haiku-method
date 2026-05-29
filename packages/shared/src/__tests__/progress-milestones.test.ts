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
	milestonePipStatus,
	type ProgressStep,
	resolveActiveMilestoneIndex,
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

test("FAILURE MODE: quality_gates wedged BETWEEN agents splits the fan-out into two groups", () => {
	// Documents WHY `stageRoleLists` trails quality_gates: a distinct role
	// in the middle of the adversarial agents flushes the pending group, so
	// the agents render as two separate "adversarial approval" pips. The
	// engine avoids this by ordering quality_gates after every agent (see
	// the next test); this pins the builder rule that makes that necessary.
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

test("CORRECT ordering: quality_gates trailing the agents keeps the fan-out in ONE group", () => {
	// The order `stageRoleLists` actually produces: spec leads, every
	// adversarial agent fans out contiguously, then quality_gates and the
	// user gate close the walk. All agents collapse into a single pip.
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [],
		executeDone: true,
		approvalRoles: [
			{ role: "spec", stamped: false },
			{ role: "continuity", stamped: false },
			{ role: "cross-stage-consistency", stamped: false },
			{ role: "observability", stamped: false },
			{ role: "reliability", stamped: false },
			{ role: "quality_gates", stamped: false },
			{ role: "user", stamped: false },
		],
	})
	const approveKeys = steps
		.filter((s) => s.key.startsWith("approve:"))
		.map((s) => s.key)
	// spec | [continuity, cross-stage, observability, reliability] | quality_gates | user
	assert.deepStrictEqual(approveKeys, [
		"approve:spec",
		"approve:adversarial:0",
		"approve:quality_gates",
		"approve:user",
	])
	// exactly one adversarial group, counting all four agents
	const advGroups = approveKeys.filter((k) =>
		k.startsWith("approve:adversarial:"),
	)
	assert.deepStrictEqual(advGroups, ["approve:adversarial:0"])
	const group = steps.find((s) => s.key === "approve:adversarial:0")
	assert.match(group?.label ?? "", /adversarial approval \(0\/4\)/)
})

test("groupAdversarial:false expands each reviewer into its own per-role pip", () => {
	const steps = buildStageMilestones({
		elaborateDone: true,
		reviewRoles: [
			{ role: "spec", stamped: true },
			{ role: "continuity", stamped: true },
			{ role: "cross-stage-consistency", stamped: false },
			{ role: "runtime-verifier", stamped: false },
		],
		executeDone: false,
		approvalRoles: [],
		groupAdversarial: false,
	})
	// No `adversarial` collapse: every reviewer keeps its own `review:<role>`
	// pip so the status line can render one chip per agent.
	assert.deepStrictEqual(
		steps.map((s) => s.key),
		[
			"elaborate",
			"review:spec",
			"review:continuity",
			"review:cross-stage-consistency",
			"review:runtime-verifier",
			"execute",
		],
	)
	// Per-agent status survives the expansion: signed → done, the first
	// unsigned reviewer is the active one we're awaiting, the rest pending.
	const byKey = Object.fromEntries(steps.map((s) => [s.key, s.status]))
	assert.strictEqual(byKey["review:spec"], "done")
	assert.strictEqual(byKey["review:continuity"], "done")
	assert.strictEqual(byKey["review:cross-stage-consistency"], "active")
	assert.strictEqual(byKey["review:runtime-verifier"], "pending")
	// And each carries its own readable label, not a grouped count.
	const csc = steps.find((s) => s.key === "review:cross-stage-consistency")
	assert.strictEqual(csc?.label, "cross-stage review")
})

// ── resolveActiveMilestoneIndex — the desync fix (screenshot 2026-05-28) ─
//
// The stamp-derived milestone `status` LAGS the live cursor action: it can
// mark an EARLY pip `active` with several LATER pips already `done`, while
// `progress_index` (placed from the live action) points at the late
// approval gate. The SPA's dots used to follow `status` (orange dot at
// index 2) while the caption used `progress_index` ("9/10 approval gate").
// This helper makes one index authoritative for BOTH dots and caption.

// 10-milestone track in the exact inconsistent shape the bug showed: the
// array's own active marker sits at index 1 (spec review), several LATER
// pips read done, and the live index points at the approval gate (9).
const LAGGING: ProgressStep[] = [
	{ key: "elaborate", label: "elaborate", status: "done" },
	{ key: "review:spec", label: "spec review", status: "active" },
	{ key: "review:adversarial:0", label: "adversarial review", status: "done" },
	{ key: "execute", label: "execute", status: "done" },
	{ key: "approve:spec", label: "spec approval", status: "done" },
	{
		key: "approve:adversarial:0",
		label: "adversarial approval",
		status: "done",
	},
	{ key: "approve:quality_gates", label: "quality gates", status: "done" },
	{ key: "approve:continuity", label: "continuity approval", status: "done" },
	{ key: "approve:runtime", label: "runtime approval", status: "done" },
	{ key: "approve:user", label: "approval gate", status: "pending" },
]

test("resolveActiveMilestoneIndex: LIVE progressIndex wins over the stamp marker", () => {
	// progress_index from the live action points at the approval gate (9);
	// without the fix the dots would follow `status` and land on index 1.
	assert.strictEqual(resolveActiveMilestoneIndex(LAGGING, 9, false), 9)
})

test("resolveActiveMilestoneIndex: falls back to the array marker when no progressIndex", () => {
	assert.strictEqual(resolveActiveMilestoneIndex(LAGGING, undefined, false), 1)
})

test("resolveActiveMilestoneIndex: ignores out-of-range progressIndex, uses the marker", () => {
	assert.strictEqual(resolveActiveMilestoneIndex(LAGGING, 99, false), 1)
	assert.strictEqual(resolveActiveMilestoneIndex(LAGGING, -1, false), 1)
})

test("resolveActiveMilestoneIndex: a complete stage marks every pip done (index past end)", () => {
	assert.strictEqual(
		resolveActiveMilestoneIndex(LAGGING, 3, true),
		LAGGING.length,
	)
})

test("resolveActiveMilestoneIndex: an all-done array (no active marker) returns the end sentinel", () => {
	const allDone: ProgressStep[] = LAGGING.map((m) => ({
		...m,
		status: "done" as const,
	}))
	assert.strictEqual(
		resolveActiveMilestoneIndex(allDone, undefined, false),
		allDone.length,
	)
})

// ── milestonePipStatus — derive each pip purely from the active index ───

test("milestonePipStatus: done/active/pending from the active index alone", () => {
	assert.strictEqual(milestonePipStatus(0, 9), "done")
	assert.strictEqual(milestonePipStatus(8, 9), "done")
	assert.strictEqual(milestonePipStatus(9, 9), "active")
	assert.strictEqual(milestonePipStatus(10, 9), "pending")
})

test("milestonePipStatus: an end-sentinel active index marks every pip done", () => {
	assert.strictEqual(milestonePipStatus(0, 10), "done")
	assert.strictEqual(milestonePipStatus(9, 10), "done")
})

test("dots + caption agree at the approval gate (integration of both helpers)", () => {
	// The active pip is the LAST one, all before it done, caption ai+1/total
	// — NOT the desynced "dot at 2, caption 9/10" the bug showed.
	const ai = resolveActiveMilestoneIndex(LAGGING, 9, false)
	assert.strictEqual(ai, 9)
	const rendered = LAGGING.map((_, i) => milestonePipStatus(i, ai))
	assert.deepStrictEqual(rendered, [
		"done",
		"done",
		"done",
		"done",
		"done",
		"done",
		"done",
		"done",
		"done",
		"active",
	])
	assert.strictEqual(`${ai + 1}/${LAGGING.length}`, "10/10")
})

console.log(`\n── Result: ${passed} passed, ${failed} failed ───────────`)
process.exit(failed === 0 ? 0 : 1)
