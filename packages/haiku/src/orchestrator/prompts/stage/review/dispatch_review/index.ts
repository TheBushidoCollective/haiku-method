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

import { join } from "node:path"
import { Eta } from "eta"
import { stageDir } from "../../../../../state-tools.js"
import { resolveReviewAgentPath } from "../../../../../studio-reader.js"
import {
	emitSubagentDispatchBlock,
	inlineFile,
	inlineFiles,
	resolveStudioMandateModel,
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
	let engineBody = ""
	let mandateInline = ""
	let modelTier: string | undefined

	if (engineBodyTpl) {
		engineBody = eta.renderString(engineBodyTpl, { slug, stage }).trim()
	} else {
		const mandatePath = resolveReviewAgentPath(studio, stage, role)
		if (mandatePath) {
			mandateInline = inlineFile(mandatePath, `Mandate: ${role}`)
			modelTier = resolveStudioMandateModel({ mandatePath, studio, stage })
		}
	}

	// Inline every unit spec the review agent must audit. The subagent
	// is one-shot — pre-loading the specs saves N `haiku_unit_read` tool
	// calls in its session.
	const unitsDir = stage ? join(stageDir(slug, stage), "units") : ""
	const unitsInline = unitsDir
		? units
				.map((u) => {
					const file = u.endsWith(".md") ? u : `${u}.md`
					return inlineFile(join(unitsDir, file), `Unit spec: ${u}`)
				})
				.filter((s) => s.length > 0)
		: []

	// Render the subagent prompt body, then emit a file-backed dispatch
	// block. The parent never sees the rendered body — only the
	// `<subagent prompt_file="...">` pointer.
	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
		slug,
		stage,
		role,
		isEngineRole: engineBodyTpl !== undefined,
		engineBody,
		mandateInline,
		unitsInline,
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
