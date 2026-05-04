// orchestrator/workflow/handlers/review.ts — Emit for the `review` state.
//
// Owns the review-phase emission chain at orchestrator.ts:3343-3379.
// Sub-cases handled:
//
//   1. Output validation (defense-in-depth) → outputs_missing
//   2. Quality gates fail → fix_quality_gates (stays in review)
//   3. Per-stage output liveness → output_liveness_review_required
//      (catches stage-local orphans before adversarial review fires;
//       the intent-completion handler runs the same check intent-wide,
//       this one fires earlier so reviewers see orphans in fresh
//       context). Acknowledgments via `coverage-decisions.json`
//       suppress the gate; "deferred-to-later-stage" rationales are
//       acceptable when an integration unit is planned downstream.
//   4. Quality gates pass → workflowAdvancePhase to gate, emit review
//      (agent runs adversarial review agents next tick)
//
// Side effect: workflowAdvancePhase to gate when gates pass.

import { execSync } from "node:child_process"
import {
	runQualityGates,
	validateOutputLiveness,
	validateStageOutputs,
	workflowAdvancePhase,
} from "../../../orchestrator.js"
import { isGitRepo } from "../../../state-tools.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const currentStage = ctx.currentStage
	const intentDirPath = ctx.intentDirPath

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

	// Per-stage liveness — only the current stage's units' code outputs.
	// Best-effort in non-git environments (the validator short-circuits
	// when git rev-parse fails). Acknowledgments live in this stage's
	// coverage-decisions.json; "deferred-to-later-stage" rationales are
	// acceptable when an integration unit is planned downstream.
	if (isGitRepo()) {
		try {
			const repoRoot = execSync("git rev-parse --show-toplevel", {
				encoding: "utf8",
			}).trim()
			const livenessViolation = validateOutputLiveness(
				intentDirPath,
				[currentStage],
				repoRoot,
			)
			if (livenessViolation) return livenessViolation
		} catch {
			// best-effort — skip if git is unavailable
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
