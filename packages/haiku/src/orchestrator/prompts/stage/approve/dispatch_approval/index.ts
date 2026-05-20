// orchestrator/prompts/dispatch_approval/index.ts — v4 review-agent
// dispatch for the POST-execute output approval track.
//
// Counterpart to dispatch_review (which fires PRE-execute against the
// unit specs). dispatch_approval fires after every unit's hat chain
// completes — the agent reads the unit's PRODUCED OUTPUTS (not the
// spec) and confirms they align with the spec they already approved
// pre-execute. On any disagreement, files an FB (origin:
// `adversarial-review`, targets.invalidates: [<role>]) which rewinds
// the cursor through the fix loop on this role. On clean approval,
// stamps `approvals.<role>` per unit.
//
// File-backed dispatch (2026-05-19): same shape as dispatch_review —
// the subagent prompt is written to its own file and the parent only
// sees a `<subagent prompt_file="...">` dispatch block.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import matter from "gray-matter"
import { stageDir } from "../../../../../state-tools.js"
import { resolveReviewAgentPath } from "../../../../../studio-reader.js"
import {
	emitSubagentDispatchBlock,
	inlineFile,
	resolveStudioMandateModel,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import {
	RUNTIME_OBSERVATION_ROLES,
	sharedBlockRef,
} from "../../../_shared/index.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)
const SUBAGENT_TEMPLATE = loadTemplate(import.meta.url, "subagent.eta.md")

// Engine-built-in approval roles — same three names as dispatch_review's
// pre-execute set, but the templates here describe post-execute checks
// (audit the WORK, not the spec).
const ENGINE_APPROVAL_BODIES: Record<string, string> = {
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

/** Read the unit FM's declared outputs and return an absolute-path list.
 *  Outputs are heterogeneous (markdown, code, images, PDFs), so we don't
 *  inline their content — just hand the subagent the list of paths to
 *  open with the Read tool. */
function readDeclaredOutputPaths(
	slug: string,
	stage: string,
	unit: string,
): string[] {
	const file = unit.endsWith(".md") ? unit : `${unit}.md`
	const unitPath = join(stageDir(slug, stage), "units", file)
	if (!existsSync(unitPath)) return []
	try {
		const { data } = matter(readFileSync(unitPath, "utf8"))
		const outputs = data.outputs
		if (!Array.isArray(outputs)) return []
		return outputs.filter((o): o is string => typeof o === "string")
	} catch {
		return []
	}
}

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""
	const role = (action.role as string) || ""
	const units = (action.units as string[]) || []

	const engineBodyTpl = ENGINE_APPROVAL_BODIES[role]
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

	// Inline each unit spec and collect each unit's declared output
	// paths. The approval agent reads spec from the inline (no
	// haiku_unit_read calls) and opens outputs from disk with Read.
	const unitsDir = stage ? join(stageDir(slug, stage), "units") : ""
	const unitsInline = unitsDir
		? units
				.map((u) => {
					const file = u.endsWith(".md") ? u : `${u}.md`
					return inlineFile(join(unitsDir, file), `Unit spec: ${u}`)
				})
				.filter((s) => s.length > 0)
		: []
	const outputPaths = stage
		? units
				.flatMap((u) => readDeclaredOutputPaths(slug, stage, u))
				.filter((v, i, arr) => arr.indexOf(v) === i)
		: []

	const doctrineRef = RUNTIME_OBSERVATION_ROLES.has(role)
		? sharedBlockRef("runtime-verification")
		: ""

	const subagentPrompt = eta.renderString(SUBAGENT_TEMPLATE, {
		slug,
		stage,
		role,
		isEngineRole: engineBodyTpl !== undefined,
		engineBody,
		mandateInline,
		unitsInline,
		outputPaths,
		doctrineRef,
	})

	const dispatchBlock = emitSubagentDispatchBlock({
		unit: `approval-${role}`,
		hat: "approval",
		bolt: 1,
		intent: slug,
		stage: stage || undefined,
		agentType: "general-purpose",
		model: modelTier,
		promptBody: subagentPrompt,
		heading: `### Subagent: \`${role}\` (post-execute approval)`,
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
