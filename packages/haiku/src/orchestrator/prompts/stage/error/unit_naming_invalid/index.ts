// orchestrator/prompts/unit_naming_invalid/index.ts — Unit file
// doesn't match the unit-NN-slug.md pattern. Tells the agent to
// rename and retry.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const message = (action.message as string) || "No details provided."
	return eta.renderString(TEMPLATE, { slug, message })
})
