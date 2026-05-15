// orchestrator/prompts/close_feedback/index.ts — Auto-close prompt
// for feedback that has cleared its fix-hat sequence.
//
// Cursor returns `close_feedback { stage, feedback_id }` when every
// hat in the stage's `fix_hats:` rotation has signed advance on the
// FB. The engine flips the FB's lifecycle to `closed` on the next
// tick; this prompt tells the agent to drive that tick and surface
// the closure to the user.

import { Eta } from "eta"
import { loadTemplate } from "../../_load-template.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string) || ""
	const fbId = (action.feedback_id as string) || ""
	return eta.renderString(TEMPLATE, { slug, stage, fbId })
})
