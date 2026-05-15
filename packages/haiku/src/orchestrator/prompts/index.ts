// orchestrator/prompts/index.ts — Registry of per-action prompt
// builders.
//
// Builders live in scope/phase folders per `prompts/PROMPTS.md`:
//
//   stage/<phase>/<action>/   per-stage actions (cursor Track A)
//   intent/<phase>/<action>/  intent-scope actions (cursor Track A intent walk)
//   feedback/<action>/        Track B (FB classification routing + fix loops)
//   drift/<action>/           Track C (filesystem reconciliation)
//   global/<action>/          scope-agnostic surfaces (error, complete)
//
// Phase names match ARCHITECTURE.md §2.1 (elaborate / execute /
// review / approve / complete) plus stage/error/ for engine-refused
// surfaces. The registry below maps cursor action name → builder; the
// folder layout is for human navigation only — the engine sees a
// flat name → builder map.
//
// 2026-05-14 (GAPS § 1a → Option A): the five per-signal elaborate-
// loop kinds (`elaborate`, `elaborate_review`, `decompose`,
// `decompose_review`, `discovery_required`) collapsed into a single
// `elaborate_loop` action. The per-signal builders are still
// imported by `stage/elaborate/elaborate_loop/index.ts` (the router)
// but are NOT registered as top-level dispatch entries.

// ── drift/ (Track C — filesystem reconciliation) ─────────────────
import drift_detected from "./drift/drift_detected/index.js"
// ── feedback/ (Track B — single-track per GOALS § "Two loop primitives") ─
// Fix loops are not a separate phase; they're feedback dispatch
// against the stage's `fix_hats:` (or studio's `fix-hats:` for
// intent-scope). Same handler, different FB origin + scope.
import changes_requested from "./feedback/changes_requested/index.js"
import close_feedback from "./feedback/close_feedback/index.js"
import feedback_question from "./feedback/feedback_question/index.js"
import fix_quality_gates from "./feedback/fix_quality_gates/index.js"
import intent_completion_fix from "./feedback/intent_completion_fix/index.js"
import review_fix from "./feedback/review_fix/index.js"
import start_feedback_hat from "./feedback/start_feedback_hat/index.js"
// ── global/ (scope-agnostic) ─────────────────────────────────────
import complete from "./global/complete/index.js"
import error from "./global/error/index.js"
import external_review_requested from "./intent/repair/external_review_requested/index.js"
import revise_unit_specs from "./intent/repair/revise_unit_specs/index.js"
import safe_intent_repair from "./intent/repair/safe_intent_repair/index.js"
import intent_completion_review from "./intent/review/intent_completion_review/index.js"
import intent_review from "./intent/review/intent_review/index.js"
import intent_approved from "./intent/seal/intent_approved/index.js"
import intent_complete from "./intent/seal/intent_complete/index.js"
import seal_intent from "./intent/seal/seal_intent/index.js"
// ── intent/ ───────────────────────────────────────────────────────
import migrated from "./intent/setup/migrated/index.js"
import select_studio from "./intent/setup/select_studio/index.js"
import dispatch_approval from "./stage/approve/dispatch_approval/index.js"
import dispatch_quality_gates from "./stage/approve/dispatch_quality_gates/index.js"
import advance_phase from "./stage/complete/advance_phase/index.js"
import advance_stage from "./stage/complete/advance_stage/index.js"
import complete_stage from "./stage/complete/complete_stage/index.js"
// ── stage/ ────────────────────────────────────────────────────────
import elaborate_loop from "./stage/elaborate/elaborate_loop/index.js"
import blocked from "./stage/error/blocked/index.js"
import coverage_review_required from "./stage/error/coverage_review_required/index.js"
import dag_cycle_detected from "./stage/error/dag_cycle_detected/index.js"
import discovery_missing from "./stage/error/discovery_missing/index.js"
import elaboration_insufficient from "./stage/error/elaboration_insufficient/index.js"
import escalate from "./stage/error/escalate/index.js"
import gate_blocked from "./stage/error/gate_blocked/index.js"
import output_liveness_review_required from "./stage/error/output_liveness_review_required/index.js"
import outputs_missing from "./stage/error/outputs_missing/index.js"
import save_wip from "./stage/error/save_wip/index.js"
import unit_inputs_missing from "./stage/error/unit_inputs_missing/index.js"
import unit_inputs_not_declared from "./stage/error/unit_inputs_not_declared/index.js"
import unit_naming_invalid from "./stage/error/unit_naming_invalid/index.js"
import unit_outputs_empty_iterations from "./stage/error/unit_outputs_empty_iterations/index.js"
import unresolved_dependencies from "./stage/error/unresolved_dependencies/index.js"
import start_unit from "./stage/execute/start_unit/index.js"
import start_unit_hat from "./stage/execute/start_unit_hat/index.js"
import user_gate from "./stage/gate/user_gate/index.js"
import dispatch_review from "./stage/review/dispatch_review/index.js"
import review from "./stage/review/review/index.js"
import start_stage from "./stage/start_stage/index.js"

import type { PromptBuilder } from "./types.js"

export const actionPromptBuilders: ReadonlyMap<string, PromptBuilder> = new Map<
	string,
	PromptBuilder
>([
	// stage/
	["start_stage", start_stage],
	["elaborate_loop", elaborate_loop],
	// `start_unit` serves the v4 start_unit_hat dispatch by name —
	// the dispatch tool aliases the action key when calling
	// buildRunInstructions.
	["start_unit", start_unit],
	["start_unit_hat", start_unit_hat],
	["dispatch_review", dispatch_review],
	["review", review],
	["dispatch_approval", dispatch_approval],
	["dispatch_quality_gates", dispatch_quality_gates],
	["user_gate", user_gate],
	["advance_phase", advance_phase],
	["advance_stage", advance_stage],
	["complete_stage", complete_stage],
	["blocked", blocked],
	["coverage_review_required", coverage_review_required],
	["dag_cycle_detected", dag_cycle_detected],
	["discovery_missing", discovery_missing],
	["elaboration_insufficient", elaboration_insufficient],
	["escalate", escalate],
	["gate_blocked", gate_blocked],
	["output_liveness_review_required", output_liveness_review_required],
	["outputs_missing", outputs_missing],
	["save_wip", save_wip],
	["unit_inputs_missing", unit_inputs_missing],
	["unit_inputs_not_declared", unit_inputs_not_declared],
	["unit_naming_invalid", unit_naming_invalid],
	["unit_outputs_empty_iterations", unit_outputs_empty_iterations],
	["unresolved_dependencies", unresolved_dependencies],
	// intent/
	["migrated", migrated],
	["select_studio", select_studio],
	["intent_completion_review", intent_completion_review],
	["intent_review", intent_review],
	["intent_approved", intent_approved],
	["intent_complete", intent_complete],
	["seal_intent", seal_intent],
	["external_review_requested", external_review_requested],
	["revise_unit_specs", revise_unit_specs],
	["safe_intent_repair", safe_intent_repair],
	// feedback/ (Track B)
	["changes_requested", changes_requested],
	["close_feedback", close_feedback],
	["feedback_question", feedback_question],
	["fix_quality_gates", fix_quality_gates],
	["intent_completion_fix", intent_completion_fix],
	["review_fix", review_fix],
	["start_feedback_hat", start_feedback_hat],
	// drift/ (Track C)
	["drift_detected", drift_detected],
	// global/
	["complete", complete],
	["error", error],
])
