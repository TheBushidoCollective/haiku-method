// orchestrator/workflow/run-tick.ts — Workflow-engine tick. Read disk
// → derive current state → run pre-tick consistency repair → dispatch
// the per-state handler → return the action.
//
// This is the runtime entry point for the H·AI·K·U workflow engine.
// State of record is on disk (intent.md frontmatter + per-stage
// state.json files); each tick is a fresh derive-from-disk →
// dispatch → emit cycle. There is no in-memory state machine, no
// long-lived actor — the durability + replayability comes from the
// fact that every tick reads its own truth.
//
// Per-state handlers live in `handlers/{state}.ts`. The registry in
// `handlers/index.ts` maps state names to handlers. Adding a new
// state name = adding the entry to the registry + the file.

import type { OrchestratorAction } from "../../orchestrator.js"
import { verifyIntentState } from "../../state-integrity.js"
import { type DerivedState, deriveCurrentState } from "./derive-state.js"
import { preTickFeedbackGate } from "./feedback-triage-gate.js"
import { dispatchHandler, WORKFLOW_STATES } from "./handlers/index.js"
import { preTickConsistency } from "./pre-tick.js"
import type { StateName } from "./types.js"

/** Re-export of the registry's key set + dispatch function so
 *  callers don't have to reach into handlers/index.js for them. */
export { dispatchHandler, WORKFLOW_STATES }

/** Result of a single workflow tick. */
export interface WorkflowTickResult {
	readonly state: StateName
	readonly context: DerivedState["context"]
	readonly action: OrchestratorAction | null
}

/** Convenience: drive one workflow tick and unwrap to an
 *  OrchestratorAction. Surfaces intent-not-found and registry-gap
 *  cases as concrete error actions so callers don't have to handle
 *  null tick results. Used by haiku_run_next, haiku_unit_advance_hat,
 *  and tests that drive the workflow end-to-end. */
export function dispatchOrchestratorAction(
	slug: string,
	root?: string,
): OrchestratorAction {
	const tick = runWorkflowTick(slug, root)
	if (tick?.action) return tick.action
	if (!tick) {
		return { action: "error", message: `Intent '${slug}' not found` }
	}
	return {
		action: "error",
		message: `runWorkflowTick produced no action for intent '${slug}' (state: ${tick.state}). Indicates a derive-state output without a registered handler.`,
	}
}

/** Run one workflow tick for an intent. Steps:
 *
 *   1. Pre-tick consistency repair (may mutate disk, may short-circuit
 *      with a safe_intent_repair action).
 *   2. Derive the current state from disk.
 *   3. Tamper detection (refuse to advance on integrity-violated
 *      intents).
 *   4. Look up the handler for the derived state and run it.
 *
 *  Returns null only when the intent doesn't exist on disk. */
export function runWorkflowTick(
	slug: string,
	root?: string,
): WorkflowTickResult | null {
	const repair = preTickConsistency(slug, root)

	const derived = deriveCurrentState(slug, root)
	if (!derived) return null

	if (repair) {
		// Deliberate ordering: repair short-circuits BEFORE the
		// tamper check. preTickConsistency only flags structural
		// inconsistencies it produced itself (machine-driven repair
		// of disk state), so its output is trusted. Running tamper
		// detection on an intent that's mid-repair would surface
		// transient state as an integrity violation. The next tick
		// (post-repair) re-runs verifyIntentState on a settled tree.
		return {
			state: "error",
			context: derived.context,
			action: repair,
		}
	}

	const tamperError = verifyIntentState(slug)
	if (tamperError) {
		return {
			state: "error",
			context: derived.context,
			action: { action: "error", message: tamperError },
		}
	}

	// Pre-tick feedback triage gate. Walks every stage from index 0
	// through the current stage looking for open (non-terminal) FBs.
	// Three outcomes:
	//   - any untriaged FB found → emit `feedback_triage`
	//   - every FB triaged but ≥ 1 on an earlier stage → emit revisit
	//   - else → null (fall through to the normal handler chain)
	// Intentionally runs AFTER tamper detection (we never advance on
	// a tampered tree) and BEFORE handler dispatch (so misplaced or
	// untriaged feedback can't be force-fixed by the wrong stage's
	// hats).
	const triageAction = preTickFeedbackGate(derived.context)
	if (triageAction) {
		const triageState: StateName =
			triageAction.action === "feedback_triage"
				? "feedback_triage"
				: "revisited"
		return {
			state: triageState,
			context: derived.context,
			action: triageAction,
		}
	}

	const action = dispatchHandler(derived.state, derived.context, root)

	return {
		state: derived.state,
		context: derived.context,
		action,
	}
}
