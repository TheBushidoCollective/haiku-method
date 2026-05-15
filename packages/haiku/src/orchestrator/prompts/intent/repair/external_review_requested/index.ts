// orchestrator/prompts/external_review_requested/index.ts — User
// chose to route a stage to external review (e.g. an actual GitHub
// MR) instead of approving inline. Emitted by `haiku_await_gate`'s
// gate flow when the user selects the external path. The action
// carries a fully-composed `message` with the engine-opened PR URL
// (or fallback instructions to open one manually) plus the
// `haiku_run_next` callback shape for recording the review URL.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	return eta.renderString(TEMPLATE, { message: action.message ?? "" })
})
