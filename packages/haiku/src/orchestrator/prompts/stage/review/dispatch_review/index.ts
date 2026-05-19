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

import { Eta } from "eta"
import { resolveReviewAgentPath } from "../../../../../studio-reader.js"
import { resolveStudioMandateModel } from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

// Engine-built-in stage-review roles. Each role's mandate body lives
// as a sibling `.eta.md` under `engine-bodies/`. When the dispatched
// role is one of these, the template renders the engine body inline
// instead of pointing the subagent at a (nonexistent) studio mandate
// file. Configured studio review-agents fall through to the cascade
// resolver and the inlineFile path.
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
	let engineBody: string | null = null
	let mandatePath: string | null = null
	let modelTier: string | undefined

	if (engineBodyTpl) {
		// Engine-built-in role: inline the mandate body, no studio file.
		engineBody = eta.renderString(engineBodyTpl, { slug, stage }).trim()
	} else {
		// Configured studio review agent: resolve via the 3-tier cascade
		// (global → studio → stage), then surface the absolute path so the
		// subagent's prompt can Read it directly. Pre-cascade the template
		// hardcoded `plugin/studios/<studio>/...` which broke for project
		// overrides AND for installed-plugin paths.
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
