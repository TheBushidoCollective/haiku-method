// orchestrator/workflow/handlers/review.ts — Emit for the `review` state.
//
// Owns the review-phase emission chain at orchestrator.ts:3343-3379.
// Sub-cases handled:
//
//   1. Output validation (defense-in-depth) → outputs_missing
//   2. Quality gates fail → fix_quality_gates (stays in review)
//   3. Quality gates pass → workflowAdvancePhase to gate, emit review
//      (agent runs adversarial review agents next tick)
//
// Side effect: workflowAdvancePhase to gate when gates pass.

import {
	runQualityGates,
	validateStageOutputs,
	workflowAdvancePhase,
} from "../../../orchestrator.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const currentStage = ctx.currentStage

	if (!currentStage) return null
	if (ctx.currentPhase !== "review") return null

	const reviewOutputCheck = validateStageOutputs(slug, currentStage, studio)
	if (reviewOutputCheck) return reviewOutputCheck

	const gateFailures = runQualityGates(slug, currentStage)
	if (gateFailures.length > 0) {
		return {
			action: "fix_quality_gates",
			intent: slug,
			stage: currentStage,
			failures: gateFailures,
			message: `Quality gate(s) failed — fix before adversarial review:\n\n${gateFailures
				.map(
					(f) =>
						`- **${f.name}**: \`${f.command}\` (exit ${f.exit_code})${f.dir !== "" ? ` in ${f.dir}` : ""}\n  ${f.output.split("\n").slice(0, 5).join("\n  ")}`,
				)
				.join("\n\n")}`,
		}
	}

	workflowAdvancePhase(slug, currentStage, "gate")

	return {
		action: "review",
		intent: slug,
		studio,
		stage: currentStage,
		message: `Quality gates passed — run adversarial review agents for stage '${currentStage}'`,
	}
}

export default emit
