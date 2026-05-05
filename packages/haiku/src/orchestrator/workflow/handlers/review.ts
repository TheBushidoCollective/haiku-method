// orchestrator/workflow/handlers/review.ts — Emit for the `review` state.
//
// Owns the two-phase review sequence (universal — fires on every stage):
//
//   Phase 1 — Spec gate (engine phase, unconditional):
//     If spec_review_dispatched is not yet set → emit `spec_review` action.
//     The dispatched subagent uses the engine's built-in spec-conformance
//     prompt (no per-studio mandate file, no opt-out). Advances to gate
//     so the fix loop can handle any spec findings before quality review
//     fires. Every intent has a spec; every stage produces something the
//     intent scoped — so every stage benefits.
//
//   Phase 2 — Quality review:
//     After the spec gate clears (spec_review_dispatched is set and no
//     open spec findings), run the full quality review layer (all studio-
//     declared review agents). gate.ts resets to the review phase when
//     spec is done but quality_review_dispatched is still unset.
//
// Sub-cases handled once in quality-review mode:
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
// Side effects:
//   - state.json: spec_review_dispatched, quality_review_dispatched flags
//   - workflowAdvancePhase to gate on spec_review dispatch and on quality dispatch

import { execSync } from "node:child_process"
import {
	runQualityGates,
	validateOutputLiveness,
	validateStageOutputs,
	workflowAdvancePhase,
} from "../../../orchestrator.js"
import {
	gitCommitState,
	isGitRepo,
	readJson,
	stageStatePath,
	writeJson,
} from "../../../state-tools.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const currentStage = ctx.currentStage
	const intentDirPath = ctx.intentDirPath

	if (!currentStage) return null
	if (ctx.currentPhase !== "review") return null

	const specReviewDispatched = ctx.stageState.spec_review_dispatched === true
	const qualityReviewDispatched =
		ctx.stageState.quality_review_dispatched === true

	// Phase 1: dispatch the engine spec_review subagent first (always, on
	// every stage, until it has been dispatched once for this stage).
	if (!specReviewDispatched) {
		const statePath = stageStatePath(slug, currentStage)
		const stateData = readJson(statePath)
		stateData.spec_review_dispatched = true
		writeJson(statePath, stateData)
		// Advance to gate so the fix loop can handle spec findings on the next tick.
		workflowAdvancePhase(slug, currentStage, "gate")
		gitCommitState(`haiku: spec_review dispatch in ${currentStage}`)
		return {
			action: "spec_review",
			intent: slug,
			studio,
			stage: currentStage,
			message: `Spec conformance gate for stage '${currentStage}' — runs before quality review to verify collective spec delivery.`,
		}
	}

	// Phase 2: quality review (spec gate done or no spec agents).
	// Validate outputs and run quality gates before emitting.
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

	// Mark quality review dispatched so the gate handler knows not to reset
	// to review phase again after quality findings are resolved.
	if (!qualityReviewDispatched) {
		const statePath = stageStatePath(slug, currentStage)
		const stateData = readJson(statePath)
		stateData.quality_review_dispatched = true
		writeJson(statePath, stateData)
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
