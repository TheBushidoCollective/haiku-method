// orchestrator/prompts/stage/approve/dispatch_quality_gates/index.ts
// — v4 quality_gates runner prompt.
//
// Two scopes per GOALS.md § "Quality gates are one handler at three
// scopes" (the unit scope runs inline at terminal-hat advance and
// doesn't go through this prompt; the stage and intent scopes both
// dispatch through `haiku_dispatch_quality_gates`):
//
//   - **stage scope** — cursor returns `dispatch_quality_gates {
//     stage, units }` when the post-execute approval track reaches
//     the engine-built `quality_gates` role and
//     `approvals.quality_gates` is unsigned on one or more units. The
//     tool runs each unit's `quality_gates: [{ name, command, dir? }]`
//     commands; on all-pass for a unit, the tool stamps
//     `approvals.quality_gates`; on failure, it files an FB targeting
//     the unit with `targets.invalidates: ["quality_gates"]`.
//
//   - **intent scope** — cursor returns `dispatch_quality_gates {
//     scope: "intent", units }` after intent_review when
//     `approvals.intent_quality_gates` is unsigned. The intent-scope
//     set is **derived** from the union of every unit's
//     `quality_gates[]` across every stage, deduped by command. Run
//     once at intent scope; failures file FBs with
//     `targets.invalidates: ["intent_quality_gates"]` and the cursor
//     routes through the studio fix-hat loop.
//
// The cursor only emits stage-scope today; the intent-scope branch
// is wired here so the prompt is correct the moment the engine
// catches up.
//
// The agent doesn't spawn a subagent for this — quality_gates is
// engine-callable, no LLM involvement.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string) || ""
	const units = (action.units as string[]) || []
	const scope = (action.scope as string) || ""
	const intentScope = scope === "intent" || stage === ""
	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		units,
		unitCount: units.length,
		unitsJson: JSON.stringify(units),
		intentScope,
	})
})
