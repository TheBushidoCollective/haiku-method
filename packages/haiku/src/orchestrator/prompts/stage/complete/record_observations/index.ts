// orchestrator/prompts/stage/complete/record_observations/index.ts —
// autotune per-stage observations prompt.
//
// Cursor returns `record_observations { stage }` once per stage,
// after every approval is signed and before complete_stage advances,
// when no `observations.md` has been written yet for that stage.
// The agent writes a free-form reflection capturing the signal that
// artifacts on disk don't already show — mandate ambiguity, engine
// friction, discovery dead-ends, surprise. The next tick sees the
// file on disk and falls straight through to complete_stage.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string) || ""
	return eta.renderString(TEMPLATE, { slug, stage })
})
