// orchestrator/prompts/unit_outputs_empty_iterations/index.ts — One
// or more units declare `outputs:` but have `iterations: []`. The
// per-unit builder hats never ran. Task #28 (2026-05-13): refuse to
// advance from execute to spec review against this state — review
// would just file `unit_outputs_empty` feedback per affected unit.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

interface UnitOutputsEmptyIterationsAction {
	kind: "unit_outputs_empty_iterations"
	stage: string
	units: string[]
}

export default definePromptBuilder(({ action, slug }) => {
	const a = action as unknown as UnitOutputsEmptyIterationsAction
	const units = a.units ?? []
	const stage = a.stage ?? ""
	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		units,
		unitCount: units.length,
	})
})
