// orchestrator/prompts/gate_blocked/index.ts — Stage gate review
// couldn't run (transient). Tells the agent to retry once and
// escalate if it persists.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const message = (action.message as string) || "No details provided."
	return eta.renderString(TEMPLATE, { slug, message })
})
