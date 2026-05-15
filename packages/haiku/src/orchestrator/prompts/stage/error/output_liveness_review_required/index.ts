// orchestrator/prompts/output_liveness_review_required/index.ts —
// Surfaces the output-liveness validator's structured message
// verbatim. The action carries a detailed `message` field listing
// orphan code outputs (declared but never imported / rendered) plus
// the per-orphan resolution paths (author an integrating unit OR
// call `haiku_coverage_acknowledge`). See `validateOutputLiveness`
// in `orchestrator/validators.ts`.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	return eta.renderString(TEMPLATE, { message: action.message ?? "" })
})
