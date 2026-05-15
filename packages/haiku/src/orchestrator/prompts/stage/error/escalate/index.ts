// orchestrator/prompts/escalate/index.ts — Iteration cap, fix-loop
// bolt cap, or loop detector tripped. Halt the autonomous loop by
// design. Render the situation + options menu; force the user to
// choose. The reject example differs by scope (intent-scope vs
// stage-scope).

import { Eta } from "eta"
import {
	MAX_FIX_LOOP_BOLTS,
	MAX_STAGE_ITERATIONS,
} from "../../../../../state-tools.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

interface PendingItem {
	feedback_id: string
	title: string
}

export default definePromptBuilder(({ slug, action }) => {
	const escStage = action.stage as string | null
	const escReason = (action.reason as string) || "unknown"
	const escIteration = (action.iteration as number) || 0
	const escMax = (action.max_iterations as number) || MAX_STAGE_ITERATIONS
	const message = (action.message as string) || ""
	const pendingItems = (action.pending_items as PendingItem[]) || []

	const isIntentScope = !escStage
	const scopeLabel = isIntentScope
		? `intent ${slug} (studio-level fix loop)`
		: escStage
	const header =
		escReason === "loop_detected"
			? `## Escalation: Loop Detected in ${scopeLabel}`
			: escReason === "fix_loop_cap_exceeded"
				? `## Escalation: Fix-Loop Bolt Cap Exceeded in ${scopeLabel}`
				: `## Escalation: Iteration Limit Exceeded in ${scopeLabel}`

	const rejectExample = isIntentScope
		? "`haiku_feedback_reject { intent, feedback_id, reason }` — dismiss specific items that shouldn't block (omit `stage` for intent-scope findings)"
		: "`haiku_feedback_reject { intent, stage, feedback_id, reason }` — dismiss specific items that shouldn't block"

	const capLine =
		escReason === "fix_loop_cap_exceeded"
			? `the fix loop spent its full ${MAX_FIX_LOOP_BOLTS}-bolt budget on ${pendingItems.length || "the"} finding(s) without satisfying the closure check`
			: `iteration ${escIteration} of ${escMax} (max) or repeated feedback signature detected`

	return eta.renderString(TEMPLATE, {
		header,
		message,
		pendingItems,
		capLine,
		rejectExample,
		isIntentScope,
	})
})
