// orchestrator/prompts/elaborate_review/index.ts — Substance verifier
// for captured elaboration artifacts. Fires whenever the cursor sees
// `stages/<stage>/elaboration.md` exists but no `verified_at` stamp
// on its frontmatter.
//
// The verifier exists because the agent's incentive is to ship —
// "I asked one question, user said go" can clear a procedural gate
// but not a substantive one. An independent verifier reads the
// captured conversation, the intent, and STAGE.md, and answers one
// question: did this exchange engage substantively with *this*
// intent's goals on *this* stage's scope?
//
// Mechanically:
//   - The agent dispatches a subagent (Task tool) with the verifier
//     prompt below.
//   - The verifier reads three files: the elaboration artifact, the
//     intent body, and STAGE.md.
//   - Pass: verifier calls `haiku_stage_elaboration_seal` which
//     stamps `verified_at` on the artifact's frontmatter. Cursor's
//     next tick advances to discovery / decompose.
//   - Fail: verifier surfaces the specific gaps. The outer agent
//     re-engages the user, calls `haiku_stage_elaboration_record`
//     again (overwriting the artifact, clearing any stale
//     verified_at), and the cursor re-emits this action for another
//     verification pass.
//
// Two branches: pre-intent (no stage on the action — verify the
// intent body itself) vs. per-stage (verify the captured stage
// elaboration artifact). Both share the same verifier-dispatch
// shape; the template carries the conditional.

import { join } from "node:path"
import { Eta } from "eta"
import { buildConcurrentElaborateLoopBlock } from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder((ctx) => {
	const action = ctx.action as {
		stage?: string
		intent?: string
		verifier_nonce?: string
	}
	const stageRaw = action.stage
	const intentSlug = action.intent ?? ctx.slug
	const isPreIntent = !stageRaw
	const verifierNonce = action.verifier_nonce ?? ""

	const intentMdPath = join(ctx.dir, "intent.md")
	const stage = isPreIntent ? "" : (stageRaw as string)
	const stageMdPath = isPreIntent
		? ""
		: join(ctx.dir, "stages", stage, "STAGE.md")
	const elabPath = isPreIntent
		? ""
		: join(ctx.dir, "stages", stage, "elaboration.md")
	const concurrentLoopBlock = isPreIntent
		? ""
		: buildConcurrentElaborateLoopBlock("verify_conversation", {
				slug: intentSlug,
				stage,
			})

	return eta.renderString(TEMPLATE, {
		isPreIntent,
		intentSlug,
		stage,
		intentMdPath,
		stageMdPath,
		elabPath,
		concurrentLoopBlock,
		composedMode: ctx.composedMode === true,
		verifierNonce,
	})
})
