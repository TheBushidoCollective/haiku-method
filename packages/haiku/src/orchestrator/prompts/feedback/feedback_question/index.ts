// orchestrator/prompts/feedback_question/index.ts — Track-B preempt
// for user-decidable FBs that carry `resolution: "question"`.
//
// Cursor returns `feedback_question { stage, feedback_id,
// feedback_path }` when Track B walks an open FB whose `resolution`
// is `"question"`. The canonical source is a discovery subagent
// that surfaced a fork the codebase can't resolve. The fix-hat
// chain is wrong for these — the body is a question, not a finding
// — so the engine routes them to the main agent for inline
// answering.

import { Eta } from "eta"
import { loadTemplate } from "../../_load-template.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder((ctx) => {
	const action = ctx.action as unknown as {
		stage: string
		feedback_id: string
		feedback_path: string
	}
	return eta.renderString(TEMPLATE, {
		slug: ctx.slug,
		stage: action.stage,
		feedbackId: action.feedback_id,
		feedbackPath: action.feedback_path,
	})
})
