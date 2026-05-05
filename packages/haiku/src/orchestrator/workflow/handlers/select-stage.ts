// orchestrator/workflow/handlers/select-stage.ts — Emit for the
// `select_stage` state.
//
// FIRES WHEN: mode is `quick` and `stages` is empty. Quick is the
// only mode that pins the workflow to a single user-elicited stage;
// all other modes get the studio's full stage list set automatically
// by haiku_select_mode.
//
// The agent must call `haiku_select_stage`, which elicits one stage
// from the studio's stage list and writes `stages: [<stage>]` to
// intent.md. derive-state then falls through to intent_review.

import { resolveStudioStages } from "../../../orchestrator.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const studioStages = resolveStudioStages(studio)
	return {
		action: "select_stage",
		intent: slug,
		studio,
		available_stages: studioStages,
		message: `Intent '${slug}' is in quick mode and needs exactly one stage selected. Call haiku_select_stage { intent: "${slug}" } to elicit which stage.`,
	}
}

export default emit
