// orchestrator/prompts/intent_review/index.ts — Per-role
// intent-completion review. Cursor returns `intent_review { role }`
// once every stage is merged into intent main and at least one role
// on `intent.approvals` is still missing. One tick per role; the
// engine signs each via the review server / agent dispatch and walks
// again until every role is signed, then emits `seal_intent`.
//
// Roles fall into three buckets:
//   - "spec"        → spec-conformance subagent over the merged intent
//   - "continuity"  → continuity-review subagent over the merged intent
//   - "user"        → open the human gate (haiku_review_open)
//   - <studio-agent> → studio-level review-agent mandate
//
// The companion `intent_completion_review` builder handles the bulk
// "spawn every studio review-agent in parallel" pass that happens
// once per intent. This builder serializes the per-role drumbeat the
// cursor walks after that pass.

import { Eta } from "eta"
import { readStudioReviewAgentPaths } from "../../../../../studio-reader.js"
import {
	emitSubagentDispatchBlock,
	inlineFile,
	resolveStudioMandateModel,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

// Engine-built-in intent-completion review roles. Each role's mandate
// body lives as a sibling `.eta.md` under `engine-bodies/`. The role
// list is the canonical set: the cursor's `intentRoles` walk must stay
// in sync (a test locks this).
const ENGINE_REVIEW_BODIES: Record<string, string> = {
	spec: loadTemplate(import.meta.url, "engine-bodies/spec.eta.md"),
	continuity: loadTemplate(
		import.meta.url,
		"engine-bodies/continuity.eta.md",
	),
	"cross-stage-consistency": loadTemplate(
		import.meta.url,
		"engine-bodies/cross_stage_consistency.eta.md",
	),
}

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, studio, action }) => {
	const role = (action.role as string) || ""

	if (role === "user") {
		return eta.renderString(TEMPLATE, { slug, role })
	}

	// Engine-built-in roles render the mandate body from the sibling
	// engine-bodies/<role>.eta.md template. Renders BEFORE the studio
	// mandate lookup so an engine role can never be shadowed by a
	// same-name studio file. The cursor's `intentRoles` walk is the
	// canonical source for which roles are engine-built — a test locks
	// that against this map.
	const engineBodyTpl = ENGINE_REVIEW_BODIES[role]
	if (engineBodyTpl) {
		const engineBody = eta.renderString(engineBodyTpl, { slug }).trim()
		return eta.renderString(TEMPLATE, {
			slug,
			role,
			mandatePath: "",
			dispatchBlock: "",
			description: engineBody,
		})
	}

	const mandates = readStudioReviewAgentPaths(studio)
	const mandatePath = mandates[role]

	if (mandatePath) {
		const mandateModel = resolveStudioMandateModel({ mandatePath, studio })
		const reviewPrompt = [
			`You are the **${role}** intent-completion review agent for intent "${slug}".`,
			"",
			"## Required context (inlined below)",
			"Your review mandate is embedded in this prompt. You audit the WHOLE intent — every stage's artifacts — against the studio's standards.",
			"",
			inlineFile(mandatePath, `Mandate: ${role}`),
			"",
			"## Write scope (STRICT)",
			"You MUST NOT write, edit, or create any file. Your ONLY output channel is `haiku_feedback` (intent scope — omit `stage`).",
			"",
			"## Instructions",
			"",
			`1. Read intent artifacts: \`.haiku/intents/${slug}/stages/*/\` and \`.haiku/intents/${slug}/knowledge/\`.`,
			`2. Audit through your mandate's lens.`,
			`3. For each issue: \`haiku_feedback({ intent: "${slug}", title, body, origin: "studio-review", author: "${role}" })\`. Omit \`stage\`.`,
			`4. When done, return a one-line summary of how many findings you logged. The engine signs \`approvals.${role}\` automatically when the subagent terminates clean (no findings) — outstanding findings drive the studio fix-hat loop on the next tick.`,
		].join("\n")

		const dispatchBlock = emitSubagentDispatchBlock({
			unit: "review",
			hat: role,
			bolt: 1,
			intent: slug,
			agentType: "general-purpose",
			model: mandateModel,
			promptBody: reviewPrompt,
			heading: `### Subagent: \`${role}\``,
			omitBolt: true,
		})
		return eta.renderString(TEMPLATE, {
			slug,
			role,
			mandatePath,
			dispatchBlock,
			description: "",
		})
	}

	// Fallback: role is neither engine-built-in nor a configured studio
	// agent. This is the legacy "audit for the unknown role" stub —
	// reached only if the cursor's `intentRoles` list and the engine
	// review registry drift apart, which a test locks against.
	return eta.renderString(TEMPLATE, {
		slug,
		role,
		mandatePath: "",
		dispatchBlock: "",
		description: `audit the intent for the \`${role}\` standard`,
	})
})
