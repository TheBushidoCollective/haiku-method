// orchestrator/prompts/unit_inputs_not_declared/index.ts — Unit FM
// has no `inputs:` field declared at all. Surfaces as a structured
// action so the agent fixes the spec (via `haiku_unit_set { field:
// "inputs", value: [...] }`) before re-ticking, instead of subagents
// being dispatched against structurally-broken units. Task #25
// (2026-05-13) — engine self-detects what `haiku_repair` would
// otherwise have to be invoked for.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

interface UnitInputsNotDeclaredAction {
	kind: "unit_inputs_not_declared"
	stage: string
	units: string[]
}

export default definePromptBuilder(({ action, slug }) => {
	const a = action as unknown as UnitInputsNotDeclaredAction
	const units = a.units ?? []
	const stage = a.stage ?? ""
	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		units,
		unitCount: units.length,
	})
})
