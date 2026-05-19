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
// Engine-built-in roles (spec, continuity, cross-stage-consistency)
// render mandate bodies inline from sibling engine-bodies/<role>.eta.md.
// Configured studio review agents resolve through the 3-tier cascade
// (global → studio → stage) and the subagent reads the resolved file
// directly.
//
// Model routing follows the same `resolveStudioMandateModel` cascade
// as dispatch_review.

import { Eta } from "eta"
import { resolveReviewAgentPath } from "../../../../../studio-reader.js"
import { resolveStudioMandateModel } from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

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

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""
	const role = (action.role as string) || ""
	const units = (action.units as string[]) || []

	const engineBodyTpl = ENGINE_APPROVAL_BODIES[role]
	let engineBody: string | null = null
	let mandatePath: string | null = null
	let modelTier: string | undefined

	if (engineBodyTpl) {
		engineBody = eta.renderString(engineBodyTpl, { slug, stage }).trim()
	} else {
		mandatePath = resolveReviewAgentPath(studio, stage, role)
		modelTier = mandatePath
			? resolveStudioMandateModel({ mandatePath, studio, stage })
			: undefined
	}

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		role,
		units,
		unitCount: units.length,
		unitsList: units.join(", "),
		modelTier,
		mandatePath: mandatePath ?? "",
		engineBody: engineBody ?? "",
		isEngineRole: engineBody !== null,
	})
})
