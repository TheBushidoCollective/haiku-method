// orchestrator/prompts/dispatch_review/index.ts — v4 review-agent
// dispatch for the pre-execute spec review track.
//
// Cursor returns `dispatch_review { stage, role, units }` when one
// configured review agent (e.g. `adversarial-architect`,
// `code-reviewer`) hasn't signed `reviews.<role>` yet on one or more
// units. The agent dispatches that review-agent subagent against the
// listed unit specs. The subagent reads each spec, files an FB if it
// finds an issue (origin: `adversarial-review`, targets.invalidates:
// [<this-role>]), and stamps `reviews.<role>` when its review
// completes — clean or with FBs filed.
//
// The review-agent's tool whitelist (enforced by the parent's Task
// dispatch): `haiku_unit_read`, `haiku_feedback` (create), nothing
// else. No advance_hat, no run_next, no triage tools — review-agents
// are pure finders, not workflow drivers.
//
// Model routing — same `resolveStudioMandateModel` cascade as
// review and intent_review: review-agent mandate `model:` →
// stage `default_model:` → studio `default_model:`.

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
