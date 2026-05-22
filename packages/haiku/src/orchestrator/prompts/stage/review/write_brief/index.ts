// orchestrator/prompts/stage/review/write_brief/index.ts — the
// user-facing stage BRIEF dispatch.
//
// Cursor returns `write_brief { stage }` once per stage in the PRE-execute
// review walk, after the adversarial reviews sign off on the spec and
// before the review user gate, when no `BRIEF.md` exists yet. A dedicated
// briefer subagent reads the planned units + intent + inputs + knowledge
// and writes `stages/<stage>/BRIEF.md` — a plain-language summary for the
// human reviewing the plan at the gate.
//
// The briefer mandate is ENGINE-OWNED and universal (every stage produces
// something worth summarizing), inlined from `subagent.eta.md`, with the
// usual project `.haiku/` override via the prompts cascade. The brief is
// USER-FACING only: the focused work agents never read it (a PreToolUse
// guard denies Read/Grep on `BRIEF.md`), and it's never injected into any
// work-agent prompt.

import { Eta } from "eta"
import { emitSubagentDispatchBlock } from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)
const SUBAGENT_TEMPLATE = loadTemplate(import.meta.url, "subagent.eta.md")

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string) || ""

	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, { slug, stage })

	const dispatchBlock = emitSubagentDispatchBlock({
		unit: "brief",
		hat: "brief",
		bolt: 1,
		intent: slug,
		stage: stage || undefined,
		agentType: "general-purpose",
		promptBody: subagentPrompt,
		heading: `### Subagent: stage brief (\`${stage}\`)`,
		omitBolt: true,
	})

	return eta.renderString(TEMPLATE, { slug, stage, dispatchBlock })
})
