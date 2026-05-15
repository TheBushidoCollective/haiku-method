// orchestrator/prompts/decompose_review/index.ts — Decompose-verifier
// dispatch for the 4th elaborate-loop completion signal per GOALS.md.
//
// Fires whenever the cursor sees units exist on the active stage but
// `decompose_verified_at` is missing on `stages/<stage>/elaboration.md`.
// The verifier audits unit coverage against the captured conversation:
// nothing the user scoped is missing a unit, no unit drifts outside
// the conversation's scope.
//
// Mechanically:
//   - The agent dispatches a subagent (Task tool) with the verifier
//     prompt below.
//   - The verifier reads the elaboration artifact + every unit spec.
//   - Pass: verifier calls `haiku_stage_decompose_seal` which stamps
//     `decompose_verified_at` on the artifact's frontmatter. Cursor's
//     next tick advances past `decompose_review` into the wave loop.
//   - Fail: verifier files feedback with `targets.invalidates:
//     ["decompose_complete"]` so the fix loop reruns decomposition.

import { join } from "node:path"
import { Eta } from "eta"
import { buildConcurrentElaborateLoopBlock } from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder((ctx) => {
	const action = ctx.action as unknown as {
		stage: string
		intent?: string
		verifier_nonce?: string
	}
	const stage = action.stage
	const intentSlug = action.intent ?? ctx.slug
	const verifierNonce = action.verifier_nonce ?? ""

	const intentMdPath = join(ctx.dir, "intent.md")
	const stageMdPath = join(ctx.dir, "stages", stage, "STAGE.md")
	const elabPath = join(ctx.dir, "stages", stage, "elaboration.md")
	const unitsDir = join(ctx.dir, "stages", stage, "units")

	const concurrentLoopBlock = buildConcurrentElaborateLoopBlock(
		"verify_decompose",
		{ slug: intentSlug, stage },
	)

	return eta.renderString(TEMPLATE, {
		stage,
		intentSlug,
		intentMdPath,
		stageMdPath,
		elabPath,
		unitsDir,
		concurrentLoopBlock,
		verifierNonce,
		composedMode: ctx.composedMode === true,
	})
})
