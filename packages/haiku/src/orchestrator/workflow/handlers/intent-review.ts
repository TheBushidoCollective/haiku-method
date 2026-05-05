// orchestrator/workflow/handlers/intent-review.ts — Emit for the
// `intent_review` state.
//
// FIRES WHEN: studio is selected, no stage has started yet
// (active_stage empty), no phase set on intent.md, and the user has
// not approved the intent yet (intent_reviewed !== true).
//
// This is the pre-stage review gate that pops a review screen for
// the minimal intent before the workflow enters stage 0. Approving it
// stamps `intent_reviewed: true` (handled by haiku_await_gate); the
// next tick falls through to `start_stage`.
//
// Distinct from:
//   - the legacy `intent_review` gate_context that fired at the end
//     of stage 0's elaborate phase (deleted in the same change that
//     introduced this handler — see handlers/elaborate.ts)
//   - `intent_completion_review`, which fires at the END after the
//     final stage's gate passes (see handlers/intent-completion.ts)

import { join } from "node:path"
import { sealIntentState } from "../../../state-integrity.js"
import { gitCommitState, setFrontmatterField } from "../../../state-tools.js"
import { emitTelemetry } from "../../../telemetry.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const intentFile = join(ctx.intentDirPath, "intent.md")

	// Stamp phase on intent.md so subsequent ticks (e.g. while the
	// review UI is open and an early run_next fires) re-derive into
	// this same handler instead of falling through to start_stage.
	// The phase is cleared by haiku_await_gate on approval.
	const currentPhase = (ctx.intent.phase as string) || ""
	if (currentPhase !== "intent_review") {
		setFrontmatterField(intentFile, "phase", "intent_review")
		gitCommitState(`haiku: open intent_review gate for ${slug}`)
		sealIntentState(slug)
	}

	emitTelemetry("haiku.gate.entered", {
		intent: slug,
		gate_context: "intent_review",
	})

	return {
		action: "gate_review",
		intent: slug,
		studio,
		stage: null,
		next_phase: "execute",
		gate_type: "ask",
		gate_context: "intent_review",
		message: `Intent '${slug}' is ready for your review before any stage starts. Approve to begin stage 0.`,
	}
}

export default emit
