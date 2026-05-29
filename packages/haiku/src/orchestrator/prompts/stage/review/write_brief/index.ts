// orchestrator/prompts/stage/review/write_brief/index.ts — the
// user-facing stage BRIEF dispatch.
//
// Cursor returns `write_brief { stage, phase }` for the SAME `BRIEF.md`
// artifact at two points in a stage's life:
//
//   - `phase: "pre"`  — PRE-execute review walk, after the adversarial
//     reviews sign off on the spec and before the review user gate, when no
//     `BRIEF.md` exists yet. The briefer reads the planned units + intent +
//     inputs + knowledge and writes the brief as "this is what I am going
//     to do" — a plain-language summary for the human reviewing the PLAN.
//   - `phase: "post"` — POST-execute, after every approval is signed, the
//     quality gates have run, and observations are recorded, but before the
//     stage closes. The briefer rewrites the SAME `BRIEF.md` in place as
//     "this is what I did" — reading the outputs, closed feedback, and
//     iterations — then stamps a `.brief-finalized` marker so the cursor
//     advances to complete_stage on the next tick.
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
	// `phase` distinguishes the PRE-execute brief ("what I am going to do")
	// from the POST-execute closing brief ("what I did"). Default to "pre"
	// for back-compat with any caller that omits it.
	const phase = (action.phase as string) === "post" ? "post" : "pre"

	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
		slug,
		stage,
		phase,
	})

	const dispatchBlock = emitSubagentDispatchBlock({
		unit: "brief",
		hat: "brief",
		bolt: 1,
		intent: slug,
		stage: stage || undefined,
		agentType: "general-purpose",
		promptBody: subagentPrompt,
		heading: `### Subagent: stage brief (\`${stage}\`, ${phase})`,
		omitBolt: true,
	})

	return eta.renderString(TEMPLATE, { slug, stage, dispatchBlock, phase })
})
