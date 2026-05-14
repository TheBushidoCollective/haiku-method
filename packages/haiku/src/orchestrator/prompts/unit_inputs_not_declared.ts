// orchestrator/prompts/unit_inputs_not_declared.ts — Unit FM has
// no `inputs:` field declared at all. Surfaces as a structured
// action so the agent fixes the spec (via `haiku_unit_set { field:
// "inputs", value: [...] }`) before re-ticking, instead of subagents
// being dispatched against structurally-broken units. Task #25
// (2026-05-13) — engine self-detects what `haiku_repair` would
// otherwise have to be invoked for.

import { definePromptBuilder } from "./define.js"

interface UnitInputsNotDeclaredAction {
	kind: "unit_inputs_not_declared"
	stage: string
	units: string[]
}

export default definePromptBuilder(({ action, slug }) => {
	const a = action as unknown as UnitInputsNotDeclaredAction
	const units = a.units ?? []
	const stage = a.stage ?? ""
	const list = units.map((u) => `  - \`${u}\``).join("\n")
	return `## Unit \`inputs:\` Not Declared

Stage \`${stage}\` has ${units.length} unit(s) with no \`inputs:\` field in their
frontmatter. Every unit MUST declare what upstream artifacts it reads —
intent doc, knowledge docs, prior-stage outputs — even if the answer is
"nothing" (in which case set \`inputs: []\` explicitly).

Affected units:
${list}

### Fix

For each affected unit, call \`haiku_unit_set\` to declare the field:

\`\`\`json
{
  "intent": "${slug}",
  "unit": "<unit-name>",
  "field": "inputs",
  "value": ["stages/<upstream>/artifacts/<file>", "..."]
}
\`\`\`

If the unit genuinely reads nothing upstream, set \`value: []\` —
the empty array is a deliberate declaration and is fine. The engine
refuses to dispatch hats against a unit with NO \`inputs:\` key at
all because that condition is structural drift; the same condition
\`haiku_repair\` flags. The fix belongs in the unit spec, not in a
repair pass.

After fixing all affected units, call \`haiku_run_next\` to re-tick.`
})
