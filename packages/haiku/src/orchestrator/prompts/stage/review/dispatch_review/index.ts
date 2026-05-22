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
	buildExistingFeedbackBlock,
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

/** Build one subagent dispatch block for a single role. */
function buildRoleBlock(opts: {
	slug: string
	studio: string
	stage: string
	role: string
	units: string[]
}): { dispatchBlock: string; isEngineRole: boolean } {
	const { slug, studio, stage, role, units } = opts
	const engineBodyTpl = ENGINE_REVIEW_BODIES[role]
	let mandateRef = ""
	let modelTier: string | undefined

	if (engineBodyTpl) {
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

	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
		slug,
		stage,
		role,
		isEngineRole: engineBodyTpl !== undefined,
		mandateRef,
		units,
		existingFeedback: buildExistingFeedbackBlock(slug, stage),
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

	return { dispatchBlock, isEngineRole: engineBodyTpl !== undefined }
}

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""

	// Batched dispatches: iterate `dispatches[]` to build one subagent
	// block per role. Fall back to the legacy single-role shape for
	// backward compat with older snapshots / tests.
	type DispatchEntry = { role: string; units: string[] }
	const dispatches: DispatchEntry[] = Array.isArray(action.dispatches)
		? (action.dispatches as DispatchEntry[])
		: [{ role: (action.role as string) || "", units: (action.units as string[]) || [] }]

	const blocks = dispatches.map((d) =>
		buildRoleBlock({ slug, studio, stage, role: d.role, units: d.units }),
	)

	const allDispatchBlocks = blocks
		.map((b) => b.dispatchBlock)
		.join("\n\n")

	const allUnits = [...new Set(dispatches.flatMap((d) => d.units))]

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		dispatches,
		dispatchCount: dispatches.length,
		role: dispatches[0]?.role ?? "",
		units: allUnits,
		unitCount: allUnits.length,
		isEngineRole: blocks[0]?.isEngineRole ?? false,
		dispatchBlock: allDispatchBlocks,
	})
})
