// orchestrator/prompts/intent_approved/index.ts — Tells the agent
// to call haiku_run_next immediately, since approval already
// happened.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug }) => {
	return eta.renderString(TEMPLATE, { slug })
})
