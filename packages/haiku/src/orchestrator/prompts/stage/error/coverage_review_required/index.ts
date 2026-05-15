// orchestrator/prompts/coverage_review_required/index.ts — Surfaces
// the cumulative-input-coverage validator's structured message
// verbatim. The action carries a detailed `message` field with the
// exact `haiku_unit_set` / `haiku_coverage_acknowledge` calls the
// agent needs to make per unreferenced upstream output. See
// `validateCumulativeInputCoverage` in `orchestrator/validators.ts`.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	return eta.renderString(TEMPLATE, { message: action.message ?? "" })
})
