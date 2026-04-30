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

import { existsSync } from "node:fs"
import { join } from "node:path"
import type { OrchestratorAction } from "../../orchestrator.js"
import { verifyIntentState } from "../../state-integrity.js"
import { getStageIterationCount, readJson } from "../../state-tools.js"
import { writeActionPromptFile } from "../../subagent-prompt-file.js"
import { resolveIntentStages } from "../studio.js"
import { type DerivedState, deriveCurrentState } from "./derive-state.js"
import { preTickFeedbackGate } from "./feedback-triage-gate.js"
import { dispatchHandler, WORKFLOW_STATES } from "./handlers/index.js"
import { preTickConsistency } from "./pre-tick.js"
import type { StateName } from "./types.js"
import {
	checkUpstreamReconciliation,
	type ReconciliationFinding,
} from "./upstream-reconciliation.js"

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
	// Four outcomes (see feedback-triage-gate.ts header):
	//   - any untriaged FB found → emit `feedback_triage`
	//   - every FB triaged but ≥ 1 on an earlier stage → emit `revisited`
	//   - human FB on current stage with null/question resolution →
	//     emit `feedback_dispatch` (prevents elaborate.ts / gate.ts
	//     from re-popping the review UI on unaddressed feedback)
	//   - else → null (fall through to the normal handler chain)
	// Intentionally runs AFTER tamper detection (we never advance on
	// a tampered tree) and BEFORE handler dispatch (so misplaced or
	// untriaged feedback can't be force-fixed by the wrong stage's
	// hats).
	const triageAction = preTickFeedbackGate(derived.context)
	if (triageAction) {
		// Explicit per-action mapping: every action `preTickFeedbackGate`
		// can return is enumerated here. If a future outcome adds a new
		// action type without updating this map, the `default` branch
		// fails loudly via an `error` action rather than silently
		// dropping into the wrong state name. Cheaper than a runtime
		// invariant since the action surface is small + closed.
		const triageState: StateName =
			triageAction.action === "feedback_triage"
				? "feedback_triage"
				: triageAction.action === "feedback_dispatch"
					? "feedback_dispatch"
					: triageAction.action === "revisited"
						? "revisited"
						: "error"
		if (triageState === "error") {
			return {
				state: "error",
				context: derived.context,
				action: {
					action: "error",
					message: `preTickFeedbackGate emitted unmapped action '${triageAction.action}'. run-tick.ts:triageState mapping needs an entry for it.`,
				},
			}
		}
		return {
			state: triageState,
			context: derived.context,
			action: triageAction,
		}
	}

	// Pre-elaboration upstream reconciliation gate. Fires only on the
	// FIRST elaboration of a stage that has at least one completed
	// upstream stage — that's the moment cross-document contradictions
	// in inherited artifacts will silently shape the elaborator's
	// decomposition. Once findings are acknowledged via
	// `haiku_reconciliation_acknowledge`, the stage's state.json
	// records the choice so subsequent ticks fall through.
	const reconAction = maybeUpstreamReconciliationGate(derived.context, root)
	if (reconAction) {
		return {
			state: "upstream_reconciliation_required",
			context: derived.context,
			action: reconAction,
		}
	}

	const action = dispatchHandler(derived.state, derived.context, root)

	return {
		state: derived.state,
		context: derived.context,
		action,
	}
}

/** Pre-elaboration reconciliation gate. Returns an
 *  `upstream_reconciliation_required` action when the corpus has
 *  divergences AND the agent hasn't already acknowledged them, OR
 *  null to fall through to the per-state handler chain. */
function maybeUpstreamReconciliationGate(
	context: DerivedState["context"],
	root: string | undefined,
): OrchestratorAction | null {
	const { slug, studio, intent, currentStage, stageState, intentDirPath } =
		context
	if (!currentStage) return null
	if ((stageState.phase as string) !== "elaborate") return null
	// First elaboration only — re-runs of the elaborate phase don't
	// re-trigger reconciliation. The signal: iterations array length
	// is exactly 1 (the initial entry).
	if (getStageIterationCount(stageState) !== 1) return null
	// Skip if already acknowledged on this stage. The acknowledge tool
	// stamps `upstream_reconciliation_acknowledged: true` here.
	if (stageState.upstream_reconciliation_acknowledged === true) return null

	const studioStages = resolveIntentStages(intent, studio)
	const myIdx = studioStages.indexOf(currentStage)
	if (myIdx <= 0) return null

	// Walk prior stages and pick the ones with a completed marker.
	const priorStages: string[] = []
	for (let i = 0; i < myIdx; i++) {
		const stage = studioStages[i]
		const stateFile = root
			? join(root, "intents", slug, "stages", stage, "state.json")
			: join(intentDirPath, "stages", stage, "state.json")
		if (!existsSync(stateFile)) continue
		try {
			const ss = readJson(stateFile) as Record<string, unknown>
			if ((ss.status as string) === "completed") priorStages.push(stage)
		} catch {
			/* unreadable state.json — skip */
		}
	}
	if (priorStages.length === 0) return null

	const result = checkUpstreamReconciliation(slug, priorStages, root)
	if (!result || result.findings.length === 0) return null

	const body = renderReconciliationPrompt(slug, currentStage, result.findings)
	let promptFile: string | null = null
	try {
		const { path } = writeActionPromptFile({
			action: "upstream_reconciliation_required",
			intent: slug,
			stage: currentStage,
			content: body,
			tickHint: `recon-${Date.now()}`,
		})
		promptFile = path
	} catch (err) {
		console.error(
			`[haiku] reconciliation prompt-file write failed for ${slug}/${currentStage}: ${err instanceof Error ? err.message : String(err)}. Falling back to inline message.`,
		)
	}

	return {
		action: "upstream_reconciliation_required",
		intent: slug,
		stage: currentStage,
		findings: result.findings,
		...(promptFile
			? {
					prompt_file: promptFile,
					message: `Read \`${promptFile}\` and execute its instructions exactly. ${result.findings.length} upstream-artifact divergence(s) require reconciliation before this stage can elaborate.`,
				}
			: {
					message: `Detected ${result.findings.length} upstream-artifact divergence(s) before first elaboration of stage '${currentStage}'. Reconcile the upstream artifacts (and re-run \`haiku_run_next\`), or call \`haiku_reconciliation_acknowledge\` to record the decision and proceed.`,
				}),
	}
}

/** Render a markdown prompt body for the reconciliation gate. */
function renderReconciliationPrompt(
	slug: string,
	stage: string,
	findings: readonly ReconciliationFinding[],
): string {
	const sections: string[] = []
	sections.push(`## Upstream Reconciliation Required: ${stage}`)
	sections.push(
		[
			`Before elaborating stage **${stage}**, the workflow engine detected **${findings.length} cross-document divergence(s)** in the upstream-artifact corpus. The elaborator inherits these contradictions silently — fix them now or acknowledge the choice on record.`,
			"",
			"Two paths:",
			"",
			"1. **Reconcile.** Edit the upstream artifacts to use one canonical name / status / field. Then re-run `haiku_run_next` — the gate re-checks and falls through if the corpus is consistent.",
			'2. **Acknowledge.** If the divergence is intentional (e.g. the artifacts describe different surfaces that genuinely need different names), call `haiku_reconciliation_acknowledge { intent: "' +
				slug +
				'", stage: "' +
				stage +
				'", rationale: "<why this divergence is correct>" }`. The decision lands in the stage\'s `decision_log` for audit and the gate falls through on the next tick.',
		].join("\n"),
	)

	for (const f of findings) {
		const lines: string[] = []
		lines.push(`### ${f.kind} divergence: ${f.concept}`)
		lines.push("")
		lines.push(f.message)
		lines.push("")
		lines.push("**Occurrences:**")
		for (const o of f.occurrences.slice(0, 12)) {
			lines.push(`- \`${o.file}:${o.line}\` — \`${o.name}\` — _${o.excerpt}_`)
		}
		if (f.occurrences.length > 12) {
			lines.push(`- … ${f.occurrences.length - 12} more`)
		}
		sections.push(lines.join("\n"))
	}
	return sections.join("\n\n")
}
