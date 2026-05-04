#!/usr/bin/env npx tsx
// Tests for handlers/manual-change-assessment.ts — builder for the
// `manual_change_assessment` workflow action.
//
// Coverage maps to features/manual-change-assessment.feature scenarios
// and unit-05 completion criteria:
//
//  - Builder produces an action with `action === "manual_change_assessment"`.
//  - `findings` array length and ordering preserved; each finding gets a
//    stable `DRF-NN` id assigned.
//  - `legal_outcomes` excludes `trigger-revisit` for current-stage findings
//    (AC-CO1) and includes all four for earlier-stage findings (AC-EO1).
//  - `legal_outcomes` excludes `inline-fix` for `file-removed` change_kind
//    (DATA-CONTRACTS.md §3.4 / AC matrix).
//  - `tick_id` is unique per dispatch — two dispatches return different IDs.
//  - `instructions` mentions `haiku_classify_drift` and the four outcome
//    strings.
//  - Same-tick atomic batching: 60 findings produce one action with all 60
//    in the `findings` array (Scenario "Large drift batch is dispatched in
//    a single atomic action payload").
//  - `isManualChangeAssessment` guard returns true for the new shape, false
//    for any other action.
//  - Default WorkflowHandler returns an `error` action (registry-only
//    fallback; production path is the gate's direct emission).

import assert from "node:assert"

const { buildManualChangeAssessmentAction, isManualChangeAssessment } =
	await import(
		"../src/orchestrator/workflow/handlers/manual-change-assessment.ts"
	)

const handlerModule = await import(
	"../src/orchestrator/workflow/handlers/manual-change-assessment.ts"
)
const defaultHandler = handlerModule.default

const actionsModule = await import("../src/orchestrator/actions.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}: ${err.message}`)
		if (process.env.VERBOSE) console.error(err)
	}
}

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
	return {
		intentSlug: "demo-intent",
		stage: "design",
		tickCounter: 1,
		mode: "continuous",
		...overrides,
	}
}

function makeFinding(overrides = {}) {
	return {
		path: "stages/design/artifacts/spec.md",
		change_kind: "modified",
		is_binary: false,
		diff_unified: "@@ -1,1 +1,1 @@\n-old\n+new",
		before_sha256: "a".repeat(64),
		after_sha256: "b".repeat(64),
		before_bytes: 100,
		after_bytes: 110,
		tracking_class: "stage-output",
		stage: "design",
		context_unit: null,
		...overrides,
	}
}

// ── Tests ──────────────────────────────────────────────────────────────────

console.log("=== buildManualChangeAssessmentAction shape ===")

test("action has discriminator manual_change_assessment", () => {
	const action = buildManualChangeAssessmentAction(makeCtx(), [makeFinding()])
	assert.strictEqual(action.action, "manual_change_assessment")
})

test("action carries intent_slug, stage, mode, tick_id", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ intentSlug: "x", stage: "design", mode: "autopilot" }),
		[makeFinding()],
	)
	assert.strictEqual(action.intent_slug, "x")
	assert.strictEqual(action.stage, "design")
	assert.strictEqual(action.mode, "autopilot")
	assert.ok(typeof action.tick_id === "string" && action.tick_id.length > 0)
})

test("findings length and ordering preserved", () => {
	const f1 = makeFinding({ path: "a.md" })
	const f2 = makeFinding({ path: "b.md" })
	const f3 = makeFinding({ path: "c.md" })
	const action = buildManualChangeAssessmentAction(makeCtx(), [f1, f2, f3])
	assert.strictEqual(action.findings.length, 3)
	assert.strictEqual(action.findings[0].path, "a.md")
	assert.strictEqual(action.findings[1].path, "b.md")
	assert.strictEqual(action.findings[2].path, "c.md")
})

test("each finding gets a stable zero-padded DRF-NN id", () => {
	const findings = [
		makeFinding({ path: "a.md" }),
		makeFinding({ path: "b.md" }),
	]
	const action = buildManualChangeAssessmentAction(makeCtx(), findings)
	assert.strictEqual(action.findings[0].finding_id, "DRF-01")
	assert.strictEqual(action.findings[1].finding_id, "DRF-02")
})

test("DRF-NN scales past 9 with zero-padding for first 99 findings", () => {
	const findings = Array.from({ length: 12 }, (_, i) =>
		makeFinding({ path: `f-${i}.md` }),
	)
	const action = buildManualChangeAssessmentAction(makeCtx(), findings)
	assert.strictEqual(action.findings[0].finding_id, "DRF-01")
	assert.strictEqual(action.findings[8].finding_id, "DRF-09")
	assert.strictEqual(action.findings[9].finding_id, "DRF-10")
	assert.strictEqual(action.findings[11].finding_id, "DRF-12")
})

console.log(
	"=== legal_outcomes filter (AC-CO1, AC-EO1, DATA-CONTRACTS §3.4) ===",
)

test("current-stage findings exclude trigger-revisit (AC-CO1)", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ stage: "design" }),
		[makeFinding({ path: "p.md", stage: "design" })],
	)
	const outcomes = action.legal_outcomes["p.md"]
	assert.ok(Array.isArray(outcomes))
	assert.ok(
		!outcomes.includes("trigger-revisit"),
		"trigger-revisit should be excluded",
	)
	assert.ok(outcomes.includes("ignore"))
	assert.ok(outcomes.includes("inline-fix"))
	assert.ok(outcomes.includes("surface-as-feedback"))
})

test("earlier-stage findings include all four outcomes (AC-EO1)", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ stage: "development" }),
		[makeFinding({ path: "p.md", stage: "design" })],
	)
	const outcomes = action.legal_outcomes["p.md"]
	assert.strictEqual(outcomes.length, 4)
	assert.ok(outcomes.includes("ignore"))
	assert.ok(outcomes.includes("inline-fix"))
	assert.ok(outcomes.includes("surface-as-feedback"))
	assert.ok(outcomes.includes("trigger-revisit"))
})

test("intent-scope findings (stage: null) are treated as cross-stage", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ stage: "design" }),
		[makeFinding({ path: "intent.md", stage: null })],
	)
	const outcomes = action.legal_outcomes["intent.md"]
	assert.ok(outcomes.includes("trigger-revisit"))
})

test("file-removed excludes inline-fix (DATA-CONTRACTS §3.4)", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ stage: "development" }),
		[
			makeFinding({
				path: "gone.md",
				stage: "design",
				change_kind: "file-removed",
				after_sha256: null,
				after_bytes: null,
				diff_unified: null,
			}),
		],
	)
	const outcomes = action.legal_outcomes["gone.md"]
	assert.ok(!outcomes.includes("inline-fix"), "file-removed cannot inline-fix")
	assert.ok(outcomes.includes("ignore"))
	assert.ok(outcomes.includes("surface-as-feedback"))
	assert.ok(outcomes.includes("trigger-revisit"))
})

test("file-removed on current stage gets ignore + surface-as-feedback only", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ stage: "design" }),
		[
			makeFinding({
				path: "gone.md",
				stage: "design",
				change_kind: "file-removed",
				after_sha256: null,
				after_bytes: null,
				diff_unified: null,
			}),
		],
	)
	const outcomes = action.legal_outcomes["gone.md"]
	assert.ok(!outcomes.includes("inline-fix"))
	assert.ok(!outcomes.includes("trigger-revisit"))
	assert.ok(outcomes.includes("ignore"))
	assert.ok(outcomes.includes("surface-as-feedback"))
})

test("new-file-detected admits all four outcomes when cross-stage", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ stage: "development" }),
		[
			makeFinding({
				path: "new.md",
				stage: "design",
				change_kind: "new-file-detected",
				before_sha256: null,
				before_bytes: null,
			}),
		],
	)
	const outcomes = action.legal_outcomes["new.md"]
	assert.strictEqual(outcomes.length, 4)
})

console.log("=== tick_id uniqueness ===")

test("two consecutive dispatches produce different tick_ids", () => {
	const a1 = buildManualChangeAssessmentAction(makeCtx(), [makeFinding()])
	const a2 = buildManualChangeAssessmentAction(makeCtx(), [makeFinding()])
	assert.notStrictEqual(a1.tick_id, a2.tick_id, "tick_ids must be unique")
})

test("tick_id includes the slug and counter", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ intentSlug: "abc", tickCounter: 7 }),
		[makeFinding()],
	)
	assert.ok(
		action.tick_id.includes("abc"),
		`tick_id should mention slug, got ${action.tick_id}`,
	)
	assert.ok(
		action.tick_id.includes("7"),
		`tick_id should mention counter, got ${action.tick_id}`,
	)
})

console.log("=== instructions prose ===")

test("instructions mention haiku_classify_drift", () => {
	const action = buildManualChangeAssessmentAction(makeCtx(), [makeFinding()])
	assert.ok(
		action.instructions.includes("haiku_classify_drift"),
		"instructions must reference haiku_classify_drift",
	)
})

test("prompt body references haiku_classify_drift (no stale tool list)", async () => {
	const { default: promptBuilder } = await import(
		"../src/orchestrator/prompts/manual_change_assessment.ts"
	)
	const action = buildManualChangeAssessmentAction(makeCtx(), [makeFinding()])
	const body = promptBuilder({
		slug: action.intent_slug,
		studio: "software",
		action,
		dir: "/tmp/haiku-prompt-body-test",
	})
	assert.ok(body !== null, "prompt body must be non-null for normal findings")
	assert.ok(
		body.includes("haiku_classify_drift"),
		"prompt body must reference haiku_classify_drift",
	)
	// Reject the stale tool list — these names belonged to the pre-classify
	// protocol and would silently bypass haiku_classify_drift if the agent
	// followed them.
	assert.ok(
		!body.includes("haiku_baseline_init") || body.includes("is_baseline_oom"),
		"prompt body must not direct the agent to call haiku_baseline_init outside the OOM path",
	)
	assert.ok(
		!body.includes("Call `haiku_feedback`"),
		"prompt body must not direct the agent to call haiku_feedback directly",
	)
	assert.ok(
		!body.includes("Call `haiku_feedback_move`"),
		"prompt body must not direct the agent to call haiku_feedback_move directly",
	)
})

test("instructions mention all four outcome strings", () => {
	const action = buildManualChangeAssessmentAction(makeCtx(), [makeFinding()])
	assert.ok(action.instructions.includes("ignore"))
	assert.ok(action.instructions.includes("inline-fix"))
	assert.ok(action.instructions.includes("surface-as-feedback"))
	assert.ok(action.instructions.includes("trigger-revisit"))
})

test("instructions mention agent_rationale and rationale_excerpt (AC-EE5)", () => {
	const action = buildManualChangeAssessmentAction(makeCtx(), [makeFinding()])
	assert.ok(action.instructions.includes("agent_rationale"))
	assert.ok(action.instructions.includes("rationale_excerpt"))
})

test("instructions list per-finding allowed outcomes", () => {
	const action = buildManualChangeAssessmentAction(
		makeCtx({ stage: "design" }),
		[makeFinding({ path: "a.md", stage: "design" })],
	)
	// Should reference a.md path and outcome list
	assert.ok(action.instructions.includes("a.md"))
})

console.log("=== large batch atomicity ===")

test("60 findings produce one action with all 60 in findings array", () => {
	const findings = Array.from({ length: 60 }, (_, i) =>
		makeFinding({ path: `f-${i}.md` }),
	)
	const action = buildManualChangeAssessmentAction(makeCtx(), findings)
	assert.strictEqual(action.findings.length, 60)
	// And every one has a finding_id
	for (let i = 0; i < 60; i++) {
		assert.ok(
			action.findings[i].finding_id?.startsWith("DRF-"),
			`finding ${i} missing finding_id`,
		)
		assert.strictEqual(action.findings[i].path, `f-${i}.md`)
	}
})

test("60 findings produce 60 entries in legal_outcomes map", () => {
	const findings = Array.from({ length: 60 }, (_, i) =>
		makeFinding({ path: `f-${i}.md` }),
	)
	const action = buildManualChangeAssessmentAction(makeCtx(), findings)
	assert.strictEqual(Object.keys(action.legal_outcomes).length, 60)
})

console.log("=== isManualChangeAssessment guard ===")

test("guard returns true for a built action", () => {
	const action = buildManualChangeAssessmentAction(makeCtx(), [makeFinding()])
	assert.strictEqual(isManualChangeAssessment(action), true)
})

test("guard returns false for a different action shape", () => {
	const other = { action: "elaborate", slug: "foo" }
	assert.strictEqual(isManualChangeAssessment(other), false)
})

test("guard returns false for an action with the wrong discriminator", () => {
	const other = { action: "feedback_dispatch", findings: [], stage: "design" }
	assert.strictEqual(isManualChangeAssessment(other), false)
})

test("guard returns false for null / undefined", () => {
	assert.strictEqual(isManualChangeAssessment(null), false)
	assert.strictEqual(isManualChangeAssessment(undefined), false)
})

test("guard returns false for an action missing required fields", () => {
	const malformed = { action: "manual_change_assessment", stage: "design" }
	assert.strictEqual(isManualChangeAssessment(malformed), false)
})

console.log("=== actions.ts re-exports ===")

test("actions.ts re-exports buildManualChangeAssessmentAction", () => {
	assert.strictEqual(
		typeof actionsModule.buildManualChangeAssessmentAction,
		"function",
	)
})

test("actions.ts re-exports isManualChangeAssessment", () => {
	assert.strictEqual(typeof actionsModule.isManualChangeAssessment, "function")
})

console.log("=== default WorkflowHandler fallback ===")

test("default handler returns error action when reached via dispatch", () => {
	const result = defaultHandler({
		slug: "test",
		studio: "software",
		intentDirPath: "/tmp/x",
		intent: {},
		currentStage: "design",
		currentPhase: "execute",
	})
	assert.strictEqual(result.action, "error")
	assert.ok(typeof result.message === "string")
	assert.ok(result.message.includes("manual_change_assessment"))
})

// ── Summary ────────────────────────────────────────────────────────────────

console.log("")
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
