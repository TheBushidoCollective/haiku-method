// orchestrator/prompts/decompose_review/index.ts — Decompose-verifier
// dispatch for the 4th elaborate-loop completion signal per GOALS.md.
//
// Fires whenever the cursor sees units exist on the active stage but
// `decompose_verified_at` is missing on `stages/<stage>/elaboration.md`.
//
// The verifier audits TWO related questions in one pass (combined
// 2026-05-18, replacing what would have been a parallel pre-execute
// "spec engine review"):
//
//   1. Coverage-vs-conversation — every concrete deliverable the
//      captured conversation agreed to ship is represented by at least
//      one unit; no unit's scope drifts outside the conversation.
//
//   2. Spec-vs-intent alignment — every requirement `intent.md`
//      scopes for this stage has at least one unit addressing it; no
//      unit drifts outside the intent's stage scope.
//
// Both checks share the same artifact (the unit specs) and the same
// stamp (`decompose_verified_at`), so a single verifier reads each
// file once instead of two subagents reading the same files for
// overlapping questions.
//
// Mechanically:
//   - The agent dispatches a subagent (Task tool) with the verifier
//     prompt below.
//   - The verifier reads the elaboration artifact + intent + STAGE.md
//     + every unit spec.
//   - Pass: verifier calls `haiku_stage_decompose_seal` which stamps
//     `decompose_verified_at` on the artifact's frontmatter. Cursor's
//     next tick advances past `decompose_review` into the wave loop.
//   - Fail: verifier files feedback with `targets.invalidates:
//     ["decompose_complete"]` so the fix loop reruns decomposition.
//     The body labels the gap class (coverage-vs-conversation OR
//     spec-vs-intent) so the rewriter knows which lens failed.

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
