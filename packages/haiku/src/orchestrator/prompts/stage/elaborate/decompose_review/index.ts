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
// File-backed dispatch (2026-05-19): the verifier prompt is written to
// its own per-intent prompt file; the parent only sees a
// `<subagent prompt_file="...">` pointer. Replaces the legacy
// fenced-inline body that polluted the parent's context with prose the
// subagent already reads on its own turn.
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
import { readIntentBody } from "../../../../../state-tools.js"
import { readStageBody } from "../../../../../studio-reader.js"
import {
	buildConcurrentElaborateLoopBlock,
	emitSubagentDispatchBlock,
	studioReadRef,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)
const SUBAGENT_TEMPLATE = loadTemplate(import.meta.url, "subagent.eta.md")

export default definePromptBuilder((ctx) => {
	const action = ctx.action as unknown as {
		stage: string
		intent?: string
		verifier_nonce?: string
	}
	const stage = action.stage
	const intentSlug = action.intent ?? ctx.slug
	const studio = ctx.studio
	const verifierNonce = action.verifier_nonce ?? ""

	// intent.md is guarded against generic Read by the workflow hook, and
	// STAGE.md is studio source — snapshot both via the same readers the
	// haiku_read_* tools use and emit "Read <snapshot>". elaboration.md is
	// a live, unguarded project artifact, read at its path.
	const intentRef = studioReadRef({
		resolveBody: () => readIntentBody(intentSlug),
		toolName: "haiku_read_intent",
		toolArgs: { intent: intentSlug },
		intent: intentSlug,
		stage,
		kind: "intent-goal",
		name: "intent",
	})
	const stageRef = studioReadRef({
		resolveBody: () => readStageBody(studio, stage),
		toolName: "haiku_read_stage",
		toolArgs: { studio, stage },
		intent: intentSlug,
		stage,
		kind: "stage-scope",
		name: stage,
	})
	const elabPath = join(ctx.dir, "stages", stage, "elaboration.md")

	const concurrentLoopBlock = buildConcurrentElaborateLoopBlock(
		"verify_decompose",
		{ slug: intentSlug, stage },
	)

	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
		stage,
		intentSlug,
		intentRef,
		stageRef,
		elabPath,
		verifierNonce,
	})
	const dispatchBlock = emitSubagentDispatchBlock({
		unit: `verify-${stage}-decompose`,
		hat: "decompose-verifier",
		bolt: 1,
		intent: intentSlug,
		stage,
		agentType: "general-purpose",
		promptBody: subagentPrompt,
		heading: `### Subagent: decompose verifier (stage \`${stage}\`)`,
		omitBolt: true,
	})

	return eta.renderString(TEMPLATE, {
		stage,
		intentSlug,
		elabPath,
		concurrentLoopBlock,
		verifierNonce,
		composedMode: ctx.composedMode === true,
		dispatchBlock,
	})
})
