// orchestrator/prompts/changes_requested/index.ts — Reviewer asked
// for changes. Renders the message + any per-file annotations as a
// bulleted list, then tells the agent to address them and re-submit.

import { Eta } from "eta"
import { loadTemplate } from "../../_load-template.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const annotations = action.annotations as
		| Array<{ path?: string; body?: string }>
		| undefined
	const message = (action.message as string) || "No details provided."
	return eta.renderString(TEMPLATE, { slug, message, annotations })
})
