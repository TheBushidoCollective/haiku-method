// orchestrator/prompts/revise_unit_specs/index.ts — Pre-execute
// gate returned changes-requested at the elaborate-to-execute
// transition. The user's annotations target unit specs that haven't
// started yet — no feedback files are filed; the agent edits the
// pending unit `.md` files directly. The action carries a `message`
// composed by `haiku_await_gate` with the explicit instruction "do
// NOT draft a new wave, edit the existing pending units in place,
// then call haiku_run_next."

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	return eta.renderString(TEMPLATE, { message: action.message ?? "" })
})
