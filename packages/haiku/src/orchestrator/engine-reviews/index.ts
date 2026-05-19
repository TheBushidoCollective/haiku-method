// orchestrator/engine-reviews/index.ts — Engine-owned review mandate
// bodies for the three built-in review roles: `spec`, `continuity`,
// and `cross-stage-consistency`.
//
// These three roles are generic enough to apply to every studio, so
// the engine owns the mandate content rather than each studio
// shipping (and drifting from) a per-stage copy. The bodies live as
// `.eta.md` siblings to this file; each takes a `scope` substitution
// ("stage" or "intent") so the same mandate prose can render at both
// scopes without duplication.
//
// Why a top-level orchestrator/ module rather than a prompts/_shared/
// block: these are content data the dispatch builders consume, not
// prompt fragments themselves. They sit alongside other engine-owned
// modules (workflow/, migrations/) that the prompt builders depend on,
// not inside the prompt-building tree.

import { Eta } from "eta"
import { loadTemplate } from "../prompts/_load-template.js"

const eta = new Eta({ autoEscape: false, useWith: true })

const ENGINE_REVIEW_TEMPLATES: Record<string, string> = {
	spec: loadTemplate(import.meta.url, "spec.eta.md"),
	continuity: loadTemplate(import.meta.url, "continuity.eta.md"),
	"cross-stage-consistency": loadTemplate(
		import.meta.url,
		"cross_stage_consistency.eta.md",
	),
}

/** True if `role` is one of the three engine-built-in review roles
 *  (spec, continuity, cross-stage-consistency). Used by dispatch
 *  builders to decide between inlining the engine mandate body and
 *  pointing at a studio mandate file. */
export function isEngineReviewRole(role: string): boolean {
	return Object.hasOwn(ENGINE_REVIEW_TEMPLATES, role)
}

/** The set of engine-built-in review role names, in canonical order
 *  (the order the cursor walks them). Exported so tests and the cursor
 *  can derive the role list from one source instead of hard-coding
 *  matching arrays in multiple files. */
export const ENGINE_REVIEW_ROLES = [
	"continuity",
	"spec",
	"cross-stage-consistency",
] as const

/** Render the engine mandate body for `role` at the given scope
 *  ("stage" or "intent"). Returns null when `role` is not an engine-
 *  built-in role — callers fall back to studio-mandate-file flow. */
export function renderEngineReviewMandate(
	role: string,
	scope: "stage" | "intent",
): string | null {
	const tpl = ENGINE_REVIEW_TEMPLATES[role]
	if (!tpl) return null
	return eta.renderString(tpl, { scope }).trim()
}
