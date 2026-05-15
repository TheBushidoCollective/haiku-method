// orchestrator/prompts/outputs_missing/index.ts — Stage didn't
// produce required output artifacts. Surfaces the validator message
// verbatim.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	return eta.renderString(TEMPLATE, { message: action.message ?? "" })
})
