// orchestrator/prompts/escalate.ts — Iteration cap, fix-loop bolt
// cap, or loop detector tripped. Halt the autonomous loop by design.
// Render the situation + options menu; force the user to choose.
// The reject example differs by scope (intent-scope vs stage-scope).

import { MAX_FIX_LOOP_BOLTS, MAX_STAGE_ITERATIONS } from "../../state-tools.js"
import { definePromptBuilder } from "./define.js"

interface PendingItem {
	feedback_id: string
	title: string
}

export default definePromptBuilder(({ slug, action }) => {
	const escStage = action.stage as string | null
	const escReason = (action.reason as string) || "unknown"
	const escIteration = (action.iteration as number) || 0
	const escMax = (action.max_iterations as number) || MAX_STAGE_ITERATIONS
	const escMessage = (action.message as string) || ""
	const escPending = (action.pending_items as PendingItem[]) || []

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

	const itemList =
		escPending.length > 0
			? `\n\n### Still-pending feedback\n\n${escPending.map((p) => `- **${p.feedback_id}** — ${p.title}`).join("\n")}`
			: ""

	const rejectExample = isIntentScope
		? "`haiku_feedback_reject { intent, feedback_id, reason }` — dismiss specific items that shouldn't block (omit `stage` for intent-scope findings)"
		: "`haiku_feedback_reject { intent, stage, feedback_id, reason }` — dismiss specific items that shouldn't block"

	const capLine =
		escReason === "fix_loop_cap_exceeded"
			? `the fix loop spent its full ${MAX_FIX_LOOP_BOLTS}-bolt budget on ${escPending.length || "the"} finding(s) without satisfying the closure check`
			: `iteration ${escIteration} of ${escMax} (max) or repeated feedback signature detected`

	return `${header}\n\n${escMessage}${itemList}\n\n### STOP\n\n**Do NOT call \`haiku_run_next\` again.** The autonomous loop is halted by design — ${capLine}. Repeated bolts converging on the same surface fix is exactly what the cap exists to catch; another bolt without a different root-cause hypothesis will fail the same way. Surface this to the user and wait for them to choose:\n\n1. ${rejectExample}\n2. Invoke the \`/haiku:revisit\` slash command — user-invoked revisit (uncapped) that logs stage_revisit feedback so the next \`haiku_run_next\` reroutes via the pre-tick gate\n3. Terminate the intent or mark the stage complete manually\n4. Adjust the unit spec or criteria if the finding set is genuinely unreachable${isIntentScope ? "\n5. Edit the studio fix-hat mandates if the hats are structurally unable to close this class of finding" : ""}\n\nReport the situation and the options above. Do NOT decide autonomously.`
})
