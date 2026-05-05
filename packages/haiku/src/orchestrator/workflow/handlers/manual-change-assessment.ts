// orchestrator/workflow/handlers/manual-change-assessment.ts — Build the
// action payload the agent receives in response to a tick where the
// pre-tick drift-detection gate emitted findings.
//
// The drift gate (drift-detection-gate.ts) runs in `runWorkflowTick` and,
// when it produces one or more `DriftFinding`s, short-circuits per-state
// dispatch. `run-tick.ts` calls `buildManualChangeAssessmentAction(ctx,
// findings)` to construct the action payload that flows back to the agent
// as the `tool_use_result`.
//
// Action shape (DATA-CONTRACTS.md §3.2):
//   {
//     action: "manual_change_assessment",
//     intent_slug: string,
//     stage: string,
//     tick_id: string,
//     findings: DriftFinding[],
//     mode: string,
//     instructions: string,
//     legal_outcomes: { [path]: string[] },
//   }
//
// The handler also stays registered in REGISTRY so that
// dispatchHandler(state) is total — but in practice the state is reached
// only via the gate's direct emission in run-tick.ts, never through
// derive-state. If dispatch ever lands here that is a wiring bug.
//
// Spec references: ARCHITECTURE.md §2.3, DATA-CONTRACTS.md §3.2 / §3.4,
// ACCEPTANCE-CRITERIA.md AC-CO1 / AC-EO1, features/manual-change-assessment.feature.

import { randomBytes } from "node:crypto"
import type { OrchestratorAction } from "../../../orchestrator.js"
import type { DriftFinding } from "../drift-detection-gate.js"
import type { WorkflowHandler } from "./_types.js"

// ── Action shape ───────────────────────────────────────────────────────────

/** Discriminated-union variant for `manual_change_assessment`. The
 *  shape mirrors DATA-CONTRACTS.md §3.2 — the agent sees these fields
 *  in the tool_use_result and must classify each finding via
 *  `haiku_classify_drift` before the next normal tick can proceed. */
export interface ManualChangeAssessmentAction extends OrchestratorAction {
	readonly action: "manual_change_assessment"
	readonly intent_slug: string
	readonly stage: string
	readonly tick_id: string
	readonly findings: ReadonlyArray<DriftFinding & { finding_id: string }>
	readonly mode: string
	readonly instructions: string
	readonly legal_outcomes: Readonly<Record<string, ReadonlyArray<Outcome>>>
}

/** The four classification outcomes (DATA-CONTRACTS.md §3.3). */
export type Outcome =
	| "ignore"
	| "inline-fix"
	| "surface-as-feedback"
	| "trigger-revisit"

const ALL_OUTCOMES: ReadonlyArray<Outcome> = [
	"ignore",
	"inline-fix",
	"surface-as-feedback",
	"trigger-revisit",
]

// ── Guard ──────────────────────────────────────────────────────────────────

/** True when the given action is a manual_change_assessment dispatch.
 *  Downstream consumers (prompt builders, telemetry sinks, tests) use
 *  this to discriminate the action surface. */
export function isManualChangeAssessment(
	action: OrchestratorAction | null | undefined,
): action is ManualChangeAssessmentAction {
	if (!action) return false
	if (action.action !== "manual_change_assessment") return false
	const a = action as Partial<ManualChangeAssessmentAction>
	return (
		typeof a.intent_slug === "string" &&
		typeof a.stage === "string" &&
		typeof a.tick_id === "string" &&
		Array.isArray(a.findings) &&
		typeof a.mode === "string" &&
		typeof a.instructions === "string" &&
		typeof a.legal_outcomes === "object" &&
		a.legal_outcomes !== null
	)
}

// ── Builder ────────────────────────────────────────────────────────────────

/** Context required by `buildManualChangeAssessmentAction`. Keep this
 *  shape narrow so callers don't have to assemble the whole derived
 *  workflow context — `run-tick.ts` and tests both build it directly
 *  from disk-derived primitives. */
export interface ManualChangeAssessmentCtx {
	readonly intentSlug: string
	/** Active stage at tick time. Drives the AC-CO1 trigger-revisit
	 *  filter. */
	readonly stage: string
	/** Tick counter from the active stage's state.json (or 0). Used
	 *  with the intent slug + a fresh ISO timestamp to compose a stable,
	 *  unique tick_id the classify tool can validate for freshness. */
	readonly tickCounter: number
	/** Intent operating mode — copied through to the action so the SPA
	 *  drift-assessment view can render mode-aware context. Stored values:
	 *  `continuous`, `discrete`, `autopilot`. `discrete-hybrid` is a
	 *  derived/virtual state never stored on intent.md. Tests may pass
	 *  additional strings (e.g. "interactive", "pickup"). */
	readonly mode: string
}

/** Build the `manual_change_assessment` action payload from a list of
 *  `DriftFinding`s. The handler:
 *
 *   1. Assigns each finding a stable `finding_id` (`DRF-NN`,
 *      zero-padded, scoped to the dispatch — not globally unique).
 *   2. Computes per-finding legal classification outcomes using the
 *      change_kind matrix in DATA-CONTRACTS.md §3.4 plus the
 *      current-stage `trigger-revisit` exclusion from AC-CO1.
 *   3. Composes a stable `tick_id` of the form
 *      `tick-<slug>-<tickCounter>-<isoZ>-<rand>` so two consecutive
 *      dispatches produce different IDs.
 *   4. Builds the agent-facing `instructions` prose: tells the agent
 *      to call `haiku_classify_drift`, names the four outcomes, lists
 *      each finding's allowed outcomes, and reminds the agent to
 *      populate `agent_rationale` plus per-finding `rationale_excerpt`
 *      (AC-EE5).
 *   5. Returns the fully-typed action ready for the tool_use_result.
 *
 *  This builder is pure: it does no disk I/O and writes nothing —
 *  side effects (assessment recording, baseline updates, marker
 *  writes) happen later in `haiku_classify_drift` and the
 *  `haiku_baseline_clear_marker` lifecycle.
 */
export function buildManualChangeAssessmentAction(
	ctx: ManualChangeAssessmentCtx,
	findings: ReadonlyArray<DriftFinding>,
): ManualChangeAssessmentAction {
	const tickId = buildTickId(ctx.intentSlug, ctx.tickCounter)

	// Assign stable finding IDs (DRF-01, DRF-02, ...). Scope is the
	// dispatch — these ids are NOT globally unique across ticks; they
	// just give the agent and the prompt builder a handle for each
	// row in the classification UX.
	const numbered = findings.map((f, i) => ({
		...f,
		finding_id: `DRF-${String(i + 1).padStart(2, "0")}`,
	}))

	// Build the legal_outcomes map per AC-CO1 + DATA-CONTRACTS.md §3.4.
	const legalOutcomes: Record<string, ReadonlyArray<Outcome>> = {}
	for (const finding of numbered) {
		legalOutcomes[finding.path] = computeLegalOutcomes(finding, ctx.stage)
	}

	const instructions = buildInstructions(ctx, numbered, legalOutcomes)

	return {
		action: "manual_change_assessment",
		intent_slug: ctx.intentSlug,
		stage: ctx.stage,
		tick_id: tickId,
		findings: numbered,
		mode: ctx.mode,
		instructions,
		legal_outcomes: legalOutcomes,
	}
}

// ── Internals ──────────────────────────────────────────────────────────────

/** Compute per-finding legal outcomes.
 *
 *  Two filters apply:
 *   1. AC-CO1: when the finding's owning stage equals the active
 *      stage, `trigger-revisit` is excluded (revisit-of-self is a
 *      no-op).
 *   2. DATA-CONTRACTS.md §3.4: when `change_kind === "file-removed"`,
 *      `inline-fix` is excluded (no on-disk file to extend).
 *
 *  The synthetic out-of-sync finding (`is_baseline_oom: true`) is
 *  treated like any other finding — the agent decides whether to
 *  ignore the surface or surface it. This may be revisited if the OOM
 *  case warrants its own UX. */
function computeLegalOutcomes(
	finding: DriftFinding & { finding_id?: string },
	activeStage: string,
): ReadonlyArray<Outcome> {
	let outcomes = ALL_OUTCOMES.slice() as Outcome[]

	// Current-stage findings cannot trigger a revisit-of-self.
	// `finding.stage === null` is intent-scope (e.g. intent.md) — treat
	// it as cross-stage so all four outcomes remain available.
	if (finding.stage !== null && finding.stage === activeStage) {
		outcomes = outcomes.filter((o) => o !== "trigger-revisit")
	}

	// file-removed cannot inline-fix (nothing to extend).
	if (finding.change_kind === "file-removed") {
		outcomes = outcomes.filter((o) => o !== "inline-fix")
	}

	return outcomes
}

/** Compose a tick_id of the form
 *  `tick-<slug>-<tickCounter>-<isoZ>-<rand>`. The trailing random
 *  segment ensures two ticks for the same slug + counter still emit
 *  distinct IDs (the counter is stamped post-write so consecutive
 *  ticks within one wall-clock millisecond are otherwise identical). */
function buildTickId(intentSlug: string, tickCounter: number): string {
	const iso = new Date().toISOString()
	const rand = randomBytes(3).toString("hex")
	return `tick-${intentSlug}-${tickCounter}-${iso}-${rand}`
}

/** Build the agent-facing instructions prose. Names the MCP tool to
 *  call, the four outcomes, the per-finding legal outcomes, and the
 *  rationale-population requirement (AC-EE5: empty rationale on
 *  non-ignore is rejected by the classifier). */
function buildInstructions(
	ctx: ManualChangeAssessmentCtx,
	findings: ReadonlyArray<DriftFinding & { finding_id: string }>,
	legalOutcomes: Readonly<Record<string, ReadonlyArray<Outcome>>>,
): string {
	const lines: string[] = []
	lines.push(
		`The pre-tick drift-detection gate detected ${findings.length} change${
			findings.length === 1 ? "" : "s"
		} in the tracked surface for intent \`${ctx.intentSlug}\` (active stage: \`${ctx.stage}\`, mode: \`${ctx.mode}\`).`,
	)
	lines.push("")
	lines.push(
		"Classify EVERY finding by calling `haiku_classify_drift` with one classification per finding. The four valid outcomes are:",
	)
	lines.push("")
	lines.push(
		"- `ignore` — change observed, accept it; baseline updates immediately.",
	)
	lines.push(
		"- `inline-fix` — absorb into the current bolt; baseline updates immediately.",
	)
	lines.push(
		"- `surface-as-feedback` — open a feedback item; baseline holds (pending-marker written) until feedback reaches a terminal state (`closed` or `rejected`).",
	)
	lines.push(
		"- `trigger-revisit` — revisit the owning stage; baseline holds until the revisit completes. Not legal for current-stage findings.",
	)
	lines.push("")
	lines.push("### Per-finding allowed outcomes")
	lines.push("")
	for (const f of findings) {
		const allowed = legalOutcomes[f.path] ?? []
		lines.push(
			`- \`${f.finding_id}\` \`${f.path}\` (${f.change_kind}, stage: ${f.stage ?? "intent-scope"}) — ${allowed
				.map((o) => `\`${o}\``)
				.join(", ")}`,
		)
	}
	lines.push("")
	lines.push("### Required fields for `haiku_classify_drift`")
	lines.push("")
	lines.push(
		"- `agent_rationale` (top-level) — non-empty prose explaining why each classification was chosen. The classifier rejects empty rationales on any non-`ignore` outcome (AC-EE5).",
	)
	lines.push(
		"- `classifications[].rationale_excerpt` — short per-finding label suitable for the SPA drift-assessment row. Required for every classification.",
	)
	lines.push(
		"- `classifications[].linked_feedback_id` — required when outcome is `surface-as-feedback`. If you create the feedback item inline via the same tool call, supply the entry in `feedback_creates[]` and leave `linked_feedback_id` null; the tool will fill it.",
	)
	lines.push(
		"- `classifications[].linked_revisit_target_stage` — required when outcome is `trigger-revisit`. Must be a stage at or before the active stage.",
	)
	lines.push("")
	lines.push(
		"After the classify call returns, call `haiku_run_next` to resume the normal stage handler.",
	)

	return lines.join("\n")
}

// ── Default WorkflowHandler (registry compatibility) ───────────────────────

/** Default handler. Reached only if dispatchHandler is invoked with
 *  state `manual_change_assessment` outside the gate path — that is a
 *  wiring bug; surface it as an error. */
const emit: WorkflowHandler = (_ctx) => {
	return {
		action: "error",
		message:
			"manual_change_assessment handler reached via normal dispatch — this state should only " +
			"be emitted directly by the drift-detection gate in runWorkflowTick. " +
			"Check run-tick.ts drift gate wiring.",
	}
}

export default emit
