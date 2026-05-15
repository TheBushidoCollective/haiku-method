// orchestrator/prompts/safe_intent_repair/index.ts — Repair pass
// produced either synthesized stages, a phase regression, or both.
// Surfaces what it did and tells the agent to address remaining
// manual-review items before resuming.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const synthesizedStages = (action.synthesized_stages as string[]) || []
	const phaseWasRegressed = (action.phase_regressed as boolean) || false
	const message = (action.message as string) || ""
	return eta.renderString(TEMPLATE, {
		slug,
		message,
		synthesizedStages,
		phaseWasRegressed,
	})
})
