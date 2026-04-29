// orchestrator/prompts/index.ts — Registry of per-action prompt
// builders.
//
// Each per-action file under this directory exports a
// `PromptBuilder` as its default export. The registry collects them
// into `actionPromptBuilders` (Map<actionName, PromptBuilder>) so
// buildRunInstructions can dispatch by name with a single lookup
// instead of a giant switch statement.
//
// The remaining (not-yet-extracted) action cases continue to live in
// orchestrator.ts's switch — buildRunInstructions checks the
// registry first, falls back to the switch for unmigrated actions.
// As more actions migrate, the switch shrinks toward zero.

import advance_phase from "./advance_phase.js"
import advance_stage from "./advance_stage.js"
import awaiting_external_review from "./awaiting_external_review.js"
import blocked from "./blocked.js"
import changes_requested from "./changes_requested.js"
import commit_wip from "./commit_wip.js"
import complete from "./complete.js"
import composite_run_stage from "./composite_run_stage.js"
import continue_units from "./continue_units.js"
import dag_cycle_detected from "./dag_cycle_detected.js"
import design_direction_complete from "./design_direction_complete.js"
import design_direction_required from "./design_direction_required.js"
import discovery_missing from "./discovery_missing.js"
import elaborate from "./elaborate.js"
import elaboration_insufficient from "./elaboration_insufficient.js"
import error from "./error.js"
import escalate from "./escalate.js"
import external_changes_requested from "./external_changes_requested.js"
import external_review_requested from "./external_review_requested.js"
import feedback_dispatch from "./feedback_dispatch.js"
import feedback_revisit from "./feedback_revisit.js"
import feedback_triage from "./feedback_triage.js"
import fix_quality_gates from "./fix_quality_gates.js"
import gate_blocked from "./gate_blocked.js"
import gate_review from "./gate_review.js"
import integrate_fix_chains from "./integrate_fix_chains.js"
import intent_approved from "./intent_approved.js"
import intent_complete from "./intent_complete.js"
import intent_completion_fix from "./intent_completion_fix.js"
import intent_completion_review from "./intent_completion_review.js"
import outputs_missing from "./outputs_missing.js"
import pre_review from "./pre_review.js"
import pre_review_waiting from "./pre_review_waiting.js"
import review from "./review.js"
import review_fix from "./review_fix.js"
import revise_unit_specs from "./revise_unit_specs.js"
import revisited from "./revisited.js"
import safe_intent_repair from "./safe_intent_repair.js"
import select_studio from "./select_studio.js"
import start_stage from "./start_stage.js"
import start_unit from "./start_unit.js"
import start_units from "./start_units.js"
import type { PromptBuilder } from "./types.js"
import unit_inputs_missing from "./unit_inputs_missing.js"
import unit_naming_invalid from "./unit_naming_invalid.js"
import unresolved_dependencies from "./unresolved_dependencies.js"

export const actionPromptBuilders: ReadonlyMap<string, PromptBuilder> = new Map<
	string,
	PromptBuilder
>([
	["advance_phase", advance_phase],
	["advance_stage", advance_stage],
	["awaiting_external_review", awaiting_external_review],
	["blocked", blocked],
	["changes_requested", changes_requested],
	["commit_wip", commit_wip],
	["complete", complete],
	["composite_run_stage", composite_run_stage],
	["continue_units", continue_units],
	["dag_cycle_detected", dag_cycle_detected],
	["design_direction_complete", design_direction_complete],
	["design_direction_required", design_direction_required],
	["discovery_missing", discovery_missing],
	["elaborate", elaborate],
	["elaboration_insufficient", elaboration_insufficient],
	["error", error],
	["escalate", escalate],
	["external_changes_requested", external_changes_requested],
	["external_review_requested", external_review_requested],
	["feedback_dispatch", feedback_dispatch],
	["feedback_revisit", feedback_revisit],
	["feedback_triage", feedback_triage],
	["fix_quality_gates", fix_quality_gates],
	["gate_blocked", gate_blocked],
	["gate_review", gate_review],
	["integrate_fix_chains", integrate_fix_chains],
	["intent_approved", intent_approved],
	["intent_complete", intent_complete],
	["intent_completion_fix", intent_completion_fix],
	["intent_completion_review", intent_completion_review],
	["outputs_missing", outputs_missing],
	["pre_review", pre_review],
	["pre_review_waiting", pre_review_waiting],
	["review", review],
	["review_fix", review_fix],
	["revise_unit_specs", revise_unit_specs],
	["revisited", revisited],
	["safe_intent_repair", safe_intent_repair],
	["select_studio", select_studio],
	["start_stage", start_stage],
	// Same builder serves both — start_unit branches on action.action
	// to add the haiku_unit_start step.
	["continue_unit", start_unit],
	["start_unit", start_unit],
	["start_units", start_units],
	["unit_inputs_missing", unit_inputs_missing],
	["unit_naming_invalid", unit_naming_invalid],
	["unresolved_dependencies", unresolved_dependencies],
])
