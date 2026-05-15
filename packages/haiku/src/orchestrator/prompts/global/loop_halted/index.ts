// orchestrator/prompts/global/loop_halted/index.ts — Loop-halt
// directive. Returned by the engine in place of an action that would
// have re-fired for the (HALT_THRESHOLD)th consecutive time. The
// agent reads this and stops re-ticking; the user sees the halt and
// decides how to recover.

import { Eta } from "eta"
import { loadTemplate } from "../../_load-template.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	const a = action as { message?: string; loop?: string; intent?: string }
	return eta.renderString(TEMPLATE, {
		message: a.message ?? "",
		loop: a.loop ?? "repeat",
		intent: a.intent ?? "",
	})
})
