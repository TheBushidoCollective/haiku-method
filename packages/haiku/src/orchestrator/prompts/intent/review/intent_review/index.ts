// orchestrator/prompts/intent_review/index.ts — Intent-completion review.
// The cursor returns `intent_review { role, dispatches[] }` once every stage
// is merged into intent main and a role on `intent.approvals` is still
// missing. `spec` dispatches serial-alone first, then the adversarial
// intent-review agents (continuity, cross-stage-consistency, the studio
// agents) fan out in ONE parallel batch (`dispatches[]`), then the `user`
// gate runs serial-last — exactly the per-stage `dispatch_review` shape.
//
// Roles fall into three buckets:
//   - "spec"        → spec-conformance subagent over the merged intent
//   - "continuity"  → continuity-review subagent over the merged intent
//   - "user"        → open the human gate (haiku_review_open)
//   - <studio-agent> → studio-level review-agent mandate
//
// Each non-user role becomes a uniform `<subagent>` dispatch block (engine
// body, studio mandate, or — only on registry drift — a fallback mandate);
// the parent spawns them all in one response. Intent-review subagents do NOT
// self-stamp (`haiku_review_stamp`'s note); the pre-tick drain signs each
// pending role (or re-dispatches the ones that filed findings).

import { Eta } from "eta"
import {
	readReviewAgentBody,
	readStudioReviewAgentPaths,
} from "../../../../../studio-reader.js"
import { materializeReferenceFile } from "../../../../../subagent-prompt-file.js"
import {
	buildDecisionsBlock,
	buildExistingFeedbackBlock,
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

/** Fallback mandate for a role that's neither an engine built-in nor a
 *  configured studio agent — reached only on registry drift (a test locks
 *  the cursor's `intentRoles` ↔ engine registry sync). Spawned as a normal
 *  subagent so the batch path stays uniform. */
function fallbackMandate(slug: string, role: string): string {
	return [
		`You are the \`${role}\` intent-completion reviewer for intent \`${slug}\`.`,
		"",
		"## Mandate (fallback — no studio-configured mandate file was found)",
		"",
		`1. Read every stage's \`outputs/\` and \`elaboration.md\` under \`.haiku/intents/${slug}/stages/\`.`,
		`2. Read the intent body at \`.haiku/intents/${slug}/intent.md\`.`,
		"3. Judge the intent-as-a-whole: work that contradicts another stage's output, missing coverage of an acceptance criterion across all stages, any cross-stage inconsistency (terminology, scope, technical choices).",
		`4. For each finding, file \`haiku_feedback\` with \`intent: "${slug}"\` (omit \`stage\`), \`origin: "agent"\`, \`author: "${role}"\`, and a body that quotes the artifact you're flagging. ALSO file one against the studio noting the missing mandate file at \`plugin/studios/<studio>/intent-review-agents/${role}.md\`.`,
		'5. When done, return your verdict in one paragraph: which findings you filed (by FB-NN), or "no findings".',
		"",
		"Do NOT modify any artifact files. Reviewer role, not fixer.",
	].join("\n")
}

/** Build ONE `<subagent>` dispatch block for a non-user intent-review role. */
function buildRoleBlock(
	slug: string,
	studio: string,
	role: string,
): { dispatchBlock: string; isEngine: boolean } {
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
		// Studio intent-completion review agent — resolve via the same reader
		// haiku_read_review_agent uses; only when it resolves.
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

	const promptBody = mandateRef
		? eta.renderString(SUBAGENT_TEMPLATE, {
				slug,
				role,
				mandateRef,
				doctrineRef: RUNTIME_OBSERVATION_ROLES.has(role)
					? sharedBlockRef("runtime-verification")
					: "",
				prInteraction: PR_INTERACTION_ROLES.has(role),
				existingFeedback: buildExistingFeedbackBlock(slug, ""),
				decisions: buildDecisionsBlock(slug),
			})
		: fallbackMandate(slug, role)

	const dispatchBlock = emitSubagentDispatchBlock({
		unit: "review",
		hat: role,
		bolt: 1,
		intent: slug,
		agentType: "general-purpose",
		model: mandateModel,
		promptBody,
		heading: `### Subagent: \`${role}\``,
		omitBolt: true,
	})
	return { dispatchBlock, isEngine: !!engineBodyTpl }
}

export default definePromptBuilder(({ slug, studio, action }) => {
	const dispatches: Array<{ role: string }> = Array.isArray(action.dispatches)
		? (action.dispatches as Array<{ role: string }>)
		: [{ role: (action.role as string) || "" }]

	// The user gate dispatches serial-alone — no subagent, opens the
	// human review session instead.
	if (dispatches.length === 1 && dispatches[0]?.role === "user") {
		return eta.renderString(TEMPLATE, {
			slug,
			role: "user",
			roles: ["user"],
			dispatchCount: 1,
			mandatePath: "",
			dispatchBlock: "",
			isEngineRole: false,
			description: "",
		})
	}

	const blocks = dispatches.map((d) => buildRoleBlock(slug, studio, d.role))
	const dispatchBlock = blocks.map((b) => b.dispatchBlock).join("\n\n")

	return eta.renderString(TEMPLATE, {
		slug,
		role: dispatches[0]?.role ?? "",
		roles: dispatches.map((d) => d.role),
		dispatchCount: dispatches.length,
		// Parent template keys its "spawn" branch on a truthy mandatePath.
		mandatePath: dispatchBlock,
		dispatchBlock,
		isEngineRole: blocks[0]?.isEngine ?? false,
		description: "",
	})
})
