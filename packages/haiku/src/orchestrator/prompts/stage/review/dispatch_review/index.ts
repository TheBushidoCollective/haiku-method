// orchestrator/prompts/dispatch_review/index.ts — v4 review-agent
// dispatch for the pre-execute spec review track.
//
// File-backed dispatch (2026-05-19): the review-agent subagent gets
// its own complete prompt written to
// `subagent-<role>-review-<bolt>.prompt.md` under the per-intent
// prompts dir. The parent only sees a `<subagent prompt_file="...">`
// dispatch block — its context stays clean. The subagent reads ONE
// file that has the mandate, the unit specs, and the procedure all
// inlined (no Read fan-out, no haiku_unit_read calls for the spec
// bodies the engine could just hand it directly).

import { Eta } from "eta"
import {
	readReviewAgentBody,
	resolveReviewAgentPath,
} from "../../../../../studio-reader.js"
import { materializeReferenceFile } from "../../../../../subagent-prompt-file.js"
import {
	emitSubagentDispatchBlock,
	resolveStudioMandateModel,
	studioReadRef,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)
const SUBAGENT_TEMPLATE = loadTemplate(import.meta.url, "subagent.eta.md")

// Engine-built-in stage-review roles. Each role's mandate body lives
// as a sibling `.eta.md` under `engine-bodies/`. When the dispatched
// role is one of these, the subagent template renders the engine body
// inline instead of pointing the subagent at a (nonexistent) studio
// mandate file. Configured studio review-agents fall through to the
// cascade resolver and the inlineFile path.
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

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""
	const role = (action.role as string) || ""
	const units = (action.units as string[]) || []

	const engineBodyTpl = ENGINE_REVIEW_BODIES[role]
	// The mandate — engine body or studio review-agent file — is static
	// source. Materialize it (FM-stripped / rendered) into the intent's
	// prompts tree and reference THAT snapshot, so the dispatch record is
	// self-contained and reflection agents can re-read exactly what the
	// agent audited against. The unit SPECS are live artifacts: the agent
	// reads each via `haiku_unit_read` (FM-stripped), never an inlined
	// dispatch-time copy.
	let mandateRef = ""
	let modelTier: string | undefined

	if (engineBodyTpl) {
		// Engine roles are GENERATED (rendered eta), not studio files —
		// snapshot the rendered body directly; no reader/tool applies.
		const engineBody = eta.renderString(engineBodyTpl, { slug, stage }).trim()
		const snap = materializeReferenceFile({
			intent: slug,
			stage: stage || undefined,
			kind: "engine-body",
			name: role,
			body: engineBody,
		})
		mandateRef = `**Read** \`${snap}\``
	} else {
		mandateRef = studioReadRef({
			resolveBody: () => readReviewAgentBody(studio, stage, role),
			toolName: "haiku_read_review_agent",
			toolArgs: { studio, stage, role },
			intent: slug,
			stage: stage || undefined,
			kind: "mandate",
			name: role,
		})
		const srcMandatePath = resolveReviewAgentPath(studio, stage, role)
		if (srcMandatePath) {
			modelTier = resolveStudioMandateModel({
				mandatePath: srcMandatePath,
				studio,
				stage,
			})
		}
	}

	// Render the subagent prompt body, then emit a file-backed dispatch
	// block. The parent never sees the rendered body — only the
	// `<subagent prompt_file="...">` pointer.
	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
		slug,
		stage,
		role,
		isEngineRole: engineBodyTpl !== undefined,
		mandateRef,
		units,
	})

	const dispatchBlock = emitSubagentDispatchBlock({
		unit: `review-${role}`,
		hat: "review",
		bolt: 1,
		intent: slug,
		stage: stage || undefined,
		agentType: "general-purpose",
		model: modelTier,
		promptBody: subagentPrompt,
		heading: `### Subagent: \`${role}\` (pre-execute review)`,
		omitBolt: true,
	})

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		role,
		units,
		unitCount: units.length,
		isEngineRole: engineBodyTpl !== undefined,
		dispatchBlock,
	})
})
