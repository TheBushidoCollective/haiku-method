// orchestrator/prompts/unresolved_dependencies/index.ts — Some
// unit's `depends_on` references a unit name that doesn't exist.
// Tells the agent to fix the references then retry.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const message = (action.message as string) || "No details provided."
	return eta.renderString(TEMPLATE, { slug, message })
})
