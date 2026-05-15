// orchestrator/prompts/blocked/index.ts — Units are blocked. Report
// to the user and ask for guidance — no autonomous unblocking.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	const blockedUnits = (action.blocked_units as string[]) || []
	return eta.renderString(TEMPLATE, { blockedUnits })
})
