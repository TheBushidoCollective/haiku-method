// orchestrator/prompts/discovery_missing/index.ts — Surfaces the
// validator message verbatim. The orchestrator builds the
// human-readable guidance into action.message.

import { Eta } from "eta"
import { definePromptBuilder } from "../../../define.js"
import { loadTemplate } from "../../../_load-template.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	return eta.renderString(TEMPLATE, { message: action.message ?? "" })
})
