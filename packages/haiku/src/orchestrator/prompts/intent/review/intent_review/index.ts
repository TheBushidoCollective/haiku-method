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
import {
	readReviewAgentBody,
	readStudioReviewAgentPaths,
} from "../../../../../studio-reader.js"
import { materializeReferenceFile } from "../../../../../subagent-prompt-file.js"
import {
	emitSubagentDispatchBlock,
	resolveStudioMandateModel,
	studioReadRef,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import {
	PR_INTERACTION_ROLES,
	RUNTIME_OBSERVATION_ROLES,
	sharedBlockRef,
} from "../../../_shared/index.js"
import { definePromptBuilder } from "../../../define.js"

// Engine-built-in intent-completion review roles. Each role's mandate
// body lives as a sibling `.eta.md` under `engine-bodies/`. The role
// list is the canonical set: the cursor's `intentRoles` walk must stay
// in sync (a test locks this).
const ENGINE_REVIEW_BODIES: Record<string, string> = {
	spec: loadTemplate(import.meta.url, "engine-bodies/spec.eta.md"),
	continuity: loadTemplate(import.meta.url, "engine-bodies/continuity.eta.md"),
	"cross-stage-consistency": loadTemplate(
		import.meta.url,
		"engine-bodies/cross_stage_consistency.eta.md",
	),
}

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)
const SUBAGENT_TEMPLATE = loadTemplate(import.meta.url, "subagent.eta.md")

export default definePromptBuilder(({ slug, studio, action }) => {
	const role = (action.role as string) || ""

	if (role === "user") {
		return eta.renderString(TEMPLATE, { slug, role })
	}

	// Resolve a mandate snapshot for the role — engine body (rendered)
	// or studio review-agent file (FM-stripped) — materialized into the
	// intent's prompts tree and referenced by path. Engine roles resolve
	// BEFORE the studio lookup so a same-name studio file can never shadow
	// a built-in. Both buckets flow through ONE file-backed subagent
	// dispatch below; the dispatch record reflects exactly what the
	// reviewer audited against.
	const engineBodyTpl = ENGINE_REVIEW_BODIES[role]
	let mandateRef = ""
	let mandateModel: string | undefined

	if (engineBodyTpl) {
		// Engine role — rendered, not a studio file. Snapshot directly.
		const engineBody = eta.renderString(engineBodyTpl, { slug }).trim()
		const snap = materializeReferenceFile({
			intent: slug,
			kind: "engine-body",
			name: role,
			body: engineBody,
		})
		mandateRef = `**Read** \`${snap}\``
	} else {
		// Studio intent-completion review agent — resolve via the same
		// reader haiku_read_review_agent uses; only spawn when it resolves
		// (else fall through to the generic fallback below).
		const body = readReviewAgentBody(studio, undefined, role)
		if (body) {
			mandateRef = studioReadRef({
				resolveBody: () => body,
				toolName: "haiku_read_review_agent",
				toolArgs: { studio, role },
				intent: slug,
				kind: "mandate",
				name: role,
			})
			mandateModel = resolveStudioMandateModel({
				mandatePath: readStudioReviewAgentPaths(studio)[role],
				studio,
			})
		}
	}

	if (mandateRef) {
		const reviewPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
			slug,
			role,
			mandateRef,
			doctrineRef: RUNTIME_OBSERVATION_ROLES.has(role)
				? sharedBlockRef("runtime-verification")
				: "",
			prInteraction: PR_INTERACTION_ROLES.has(role),
		})

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
			// Parent template keys its "spawn the subagent" branch on a
			// truthy mandatePath; mandateRef is truthy whenever we resolved.
			mandatePath: mandateRef,
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
