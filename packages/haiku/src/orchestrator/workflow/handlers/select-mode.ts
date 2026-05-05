// orchestrator/workflow/handlers/select-mode.ts — Emit for the
// `select_mode` state.
//
// FIRES WHEN: studio is selected on intent.md but `mode` is not.
// Intent.md created with no mode (the agent never sets it directly);
// the agent must call `haiku_select_mode` which elicits a mode value
// from the fixed enum. After mode is set:
//   - non-quick (continuous, discrete, autopilot, discrete-hybrid):
//     the select-mode tool ALSO writes the studio's full stage list
//     into `stages`. derive-state then falls through to intent_review.
//   - quick: the select-mode tool leaves `stages` empty, derive-state
//     routes to `select_stage` next, and the agent elicits a single
//     stage there.
//
// This handler is the no-input emit — the agent reads it and calls
// haiku_select_mode in response.

import { INTENT_MODES } from "../../../state/schemas/intent.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	return {
		action: "select_mode",
		intent: slug,
		studio: ctx.studio,
		available_modes: [...INTENT_MODES],
		message: `Intent '${slug}' has no mode selected. Call haiku_select_mode { intent: "${slug}" } to elicit a mode value from the user.`,
	}
}

export default emit
