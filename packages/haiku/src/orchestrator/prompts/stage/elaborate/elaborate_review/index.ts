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
// File-backed dispatch (2026-05-19): the verifier's prompt is written
// to its own per-intent prompt file and the parent only sees a
// `<subagent prompt_file="...">` pointer. Pre-2026-05-19 the parent
// inlined the verifier body in a fenced code block, which polluted
// the parent's context with prose the subagent would Read for itself
// — wasted tokens and made the parent's tick longer.
//
// Two branches: pre-intent (no stage on the action — verify the
// intent body itself) vs. per-stage (verify the captured stage
// elaboration artifact). Both share the same verifier-dispatch
// shape; the subagent template carries the conditional.

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
	const action = ctx.action as {
		stage?: string
		intent?: string
		verifier_nonce?: string
	}
	const stageRaw = action.stage
	const intentSlug = action.intent ?? ctx.slug
	const isPreIntent = !stageRaw
	const verifierNonce = action.verifier_nonce ?? ""

	const stage = isPreIntent ? "" : (stageRaw as string)
	// intent.md is guarded against generic Read; STAGE.md is studio
	// source — snapshot both via the haiku_read_* readers and emit "Read
	// <snapshot>". elaboration.md is a live, unguarded artifact (path).
	const intentRef = studioReadRef({
		resolveBody: () => readIntentBody(intentSlug),
		toolName: "haiku_read_intent",
		toolArgs: { intent: intentSlug },
		intent: intentSlug,
		stage: stage || undefined,
		kind: "intent-goal",
		name: "intent",
	})
	const stageRef = isPreIntent
		? ""
		: studioReadRef({
				resolveBody: () => readStageBody(ctx.studio, stage),
				toolName: "haiku_read_stage",
				toolArgs: { studio: ctx.studio, stage },
				intent: intentSlug,
				stage,
				kind: "stage-scope",
				name: stage,
			})
	const elabPath = isPreIntent
		? ""
		: join(ctx.dir, "stages", stage, "elaboration.md")
	const concurrentLoopBlock = isPreIntent
		? ""
		: buildConcurrentElaborateLoopBlock("verify_conversation", {
				slug: intentSlug,
				stage,
			})

	// Render the verifier subagent prompt and emit a file-backed
	// dispatch block. The parent template embeds only the
	// `<subagent prompt_file="...">` markup; the verifier reads the
	// full prompt from disk.
	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
		isPreIntent,
		intentSlug,
		stage,
		intentRef,
		stageRef,
		elabPath,
		verifierNonce,
	})
	const dispatchBlock = emitSubagentDispatchBlock({
		unit: isPreIntent ? "verify-intent" : `verify-${stage}-elaboration`,
		hat: "elaborate-verifier",
		bolt: 1,
		intent: intentSlug,
		stage: isPreIntent ? undefined : stage,
		agentType: "general-purpose",
		promptBody: subagentPrompt,
		heading: isPreIntent
			? "### Subagent: pre-intent elaborate verifier"
			: `### Subagent: elaborate verifier (stage \`${stage}\`)`,
		omitBolt: true,
	})

	return eta.renderString(TEMPLATE, {
		isPreIntent,
		intentSlug,
		stage,
		elabPath,
		concurrentLoopBlock,
		composedMode: ctx.composedMode === true,
		verifierNonce,
		dispatchBlock,
	})
})
