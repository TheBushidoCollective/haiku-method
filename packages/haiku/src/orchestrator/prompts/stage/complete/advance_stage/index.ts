// orchestrator/prompts/advance_stage/index.ts — Gate passed. The
// orchestrator already advanced to the next stage; the agent just
// needs to call haiku_run_next to drive the next action.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const stage = action.stage as string
	const nextStage = action.next_stage as string
	return eta.renderString(TEMPLATE, { slug, stage, nextStage })
})
