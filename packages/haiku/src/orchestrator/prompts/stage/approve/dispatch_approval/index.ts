// orchestrator/prompts/dispatch_approval/index.ts — v4 review-agent
// dispatch for the post-execute output approval track.
//
// Mirror of dispatch_review but the review-agent reads the unit's
// PRODUCED OUTPUTS (not the spec) and confirms they align with the
// spec it already approved. On any disagreement, files an FB
// (origin: `adversarial-review`, targets.invalidates: [<role>]) which
// rewinds the cursor through the fix loop on this role. On clean
// approval, stamps `approvals.<role>`.
//
// Model routing follows the same `resolveStudioMandateModel` cascade
// as dispatch_review. See its header for rationale.

import { join } from "node:path"
import { Eta } from "eta"
import { resolvePluginRoot } from "../../../../../config.js"
import { resolveStudioMandateModel } from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""
	const role = (action.role as string) || ""
	const units = (action.units as string[]) || []

	const mandatePath = join(
		resolvePluginRoot(),
		"studios",
		studio,
		"stages",
		stage,
		"review-agents",
		`${role}.md`,
	)
	const modelTier = resolveStudioMandateModel({ mandatePath, studio, stage })

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		role,
		units,
		unitCount: units.length,
		unitsList: units.join(", "),
		modelTier,
	})
})
