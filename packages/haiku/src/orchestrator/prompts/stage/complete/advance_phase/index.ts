// orchestrator/prompts/advance_phase/index.ts — Notifies the agent
// which phase it just transitioned into and instructs it to call
// haiku_run_next immediately.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const toPhase = action.to_phase as string
	return eta.renderString(TEMPLATE, { slug, toPhase })
})
