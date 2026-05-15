// orchestrator/prompts/fix_quality_gates/index.ts — Quality-gate
// failure fixup loop. Lists the failures and instructs the agent to
// fix + retry. Adversarial review re-runs after gates pass.
//
// Two failure shapes the agent encounters here:
//
//   1. The gate's COMMAND is right but the production code is wrong.
//      Fix the code (Edit on the unit's outputs), commit, retry.
//
//   2. The gate DEFINITION is wrong — typo in the command, library
//      API drifted, YAML serialization mangled the inline syntax. In
//      this case the gate itself needs editing. Pre-2026-05-07 the
//      forward-only lifecycle blocked `haiku_unit_set` on completed
//      units, so the agent had no engine-side path and had to fall
//      back to "edit the file outside Claude Code." That trap is
//      gone: `quality_gates` is now lifecycle-mutable on completed
//      units (see haiku_unit_set handler), so the fix below is
//      always available.

import { Eta } from "eta"
import { loadTemplate } from "../../_load-template.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string) || ""
	const stageHint = stage ? `, stage: "${stage}"` : ""
	const message = (action.message as string) || "No details provided."
	return eta.renderString(TEMPLATE, { slug, stageHint, message })
})
