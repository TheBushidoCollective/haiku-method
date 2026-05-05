// orchestrator/workflow/handlers/index.ts — Registry of per-state
// orchestrator handlers for the workflow engine.
//
// Every state name returned by derive-state has exactly one handler
// here. The handler owns emission of the OrchestratorAction for that
// state, plus any side effects (workflow-managed frontmatter writes, git
// operations, worktree allocation).
//
// Adding a new state name to the workflow:
//   1. Add the literal to StateName in `../types.ts`
//   2. Make derive-state return it from the appropriate disk-state
//      condition
//   3. Create `handlers/<state>.ts` exporting a default WorkflowHandler
//   4. Register it in REGISTRY below

import type { OrchestratorAction } from "../../../orchestrator.js"
import type { DerivedContext } from "../derive-state.js"
import type { StateName } from "../types.js"
import type { WorkflowHandler } from "./_types.js"
import complete from "./complete.js"
import composite from "./composite.js"
import elaborate from "./elaborate.js"
import error from "./error.js"
import execute from "./execute.js"
import gate from "./gate.js"
import intentCompletion from "./intent-completion.js"
import intentReview from "./intent-review.js"
import manualChangeAssessment from "./manual-change-assessment.js"
import review from "./review.js"
import selectMode from "./select-mode.js"
import selectStage from "./select-stage.js"
import selectStudio from "./select-studio.js"
import startStage from "./start-stage.js"

/** Per-state handler registry. Key = state name returned by
 *  derive-state. Value = the handler that emits an OrchestratorAction
 *  for that state. */
const REGISTRY: Partial<Record<StateName, WorkflowHandler>> = {
	complete,
	select_studio: selectStudio,
	select_mode: selectMode,
	select_stage: selectStage,
	intent_review: intentReview,
	error,
	start_stage: startStage,
	elaborate,
	execute,
	review,
	gate_review: gate,
	intent_completion_review: intentCompletion,
	intent_completion_fix: intentCompletion,
	composite_run_stage: composite,
	manual_change_assessment: manualChangeAssessment,
}

/** State names that have a registered handler. Derived from the
 *  registry keys; no separate flag to keep in sync. */
export const WORKFLOW_STATES: ReadonlySet<StateName> = new Set(
	Object.keys(REGISTRY) as StateName[],
)

/** Look up a state's handler and run it. Returns null when the state
 *  isn't registered OR when the handler returns null (handler-level
 *  deferral). `root` flows from test fixtures; production callers
 *  omit it and handlers fall back to findHaikuRoot. */
export function dispatchHandler(
	state: StateName,
	context: DerivedContext,
	root?: string,
): OrchestratorAction | null {
	const handler = REGISTRY[state]
	if (!handler) return null
	return handler(context, root)
}
