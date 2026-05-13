// Workflow-engine types.
//
// The `StateName` union enumerates every state the workflow engine
// can be in, matching the action surface produced by the per-state
// handlers in handlers/. Keeping the union exhaustive lets TypeScript
// catch missing cases when dispatchHandler or per-state files
// dispatch on state name.
//
// `WorkflowContext` is the runtime context threaded through each
// handler — populated by deriveCurrentState from disk on every tick.

/** Runtime context the workflow engine threads through every
 *  handler. Each tick recomputes this from disk via
 *  deriveCurrentState; there is no in-memory state preserved across
 *  ticks. */
export interface WorkflowContext {
	readonly slug: string
	readonly studio: string
	readonly intentDirPath: string
	readonly intent: Record<string, unknown>
	readonly currentStage: string
	readonly currentPhase: string
	/** Optional URL when the agent is signalling external review state. */
	readonly externalReviewUrl?: string
}

/** Discriminator across every concrete state derive-state can return
 *  + every action shape per-state handlers can emit. Keep this
 *  exhaustive so TS exhaustiveness checks catch missing cases when
 *  adding a new handler. */
export type StateName =
	// setup
	| "select_studio"
	| "select_mode"
	| "select_stage"
	| "intent_review"
	| "start_stage"
	// phase progression
	| "elaborate"
	| "elaborate_review"
	| "decompose"
	| "advance_phase"
	| "execute"
	| "advance_stage"
	| "intent_complete"
	// units
	| "start_unit"
	| "start_units"
	| "continue_unit"
	| "continue_units"
	// review loop
	| "review"
	| "review_fix"
	| "fix_quality_gates"
	| "integrate_fix_chains"
	| "pre_review"
	| "pre_review_waiting"
	// intent-completion review
	| "intent_completion_review"
	| "intent_completion_fix"
	// revisit — `revisited` removed 2026-05-12: declared but never emitted.
	// The feedback walk handles stage rewinds via `start_feedback_hat` at
	// the target stage; no distinct cursor action needed. See
	// `plugin/skills/revisit/SKILL.md`.
	| "feedback_revisit"
	| "feedback_dispatch"
	| "feedback_triage"
	// gates
	| "gate_review"
	| "intent_approved"
	| "awaiting_external_review"
	| "external_review_requested"
	| "external_changes_requested"
	| "gate_blocked"
	| "changes_requested"
	| "revise_unit_specs"
	// validation failures
	| "outputs_missing"
	| "elaboration_insufficient"
	| "discovery_missing"
	| "dag_cycle_detected"
	| "unit_inputs_missing"
	| "unresolved_dependencies"
	| "unit_naming_invalid"
	| "coverage_review_required"
	| "output_liveness_review_required"
	// drift-detection
	| "manual_change_assessment"
	// ops
	| "save_wip"
	// terminal / special
	| "blocked"
	| "complete"
	| "error"
	| "escalate"
	// design_direction_required / _complete / _uploaded / clarify_required
	// deleted 2026-05-08 — collapsed into the discovery-agent model.
	| "safe_intent_repair"
	| "composite_run_stage"
	| "upstream_reconciliation_required"
