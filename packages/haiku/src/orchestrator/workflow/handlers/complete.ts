// orchestrator/workflow/handlers/complete.ts — Emit for the `complete`
// terminal state.
//
// FIRES WHEN: derive-state sees `intent.status === "completed"`.
// The runNext counterpart at orchestrator.ts:2200 produces the
// byte-identical shape.
//
// Defensive checkout: calls ensureOnIntentMain(ctx.slug), which runs
// `git checkout haiku/<slug>/main`. This is a git side-effect — not a
// pure function — but it is idempotent (no-op when HEAD is already on
// the correct branch) and a no-op in non-git environments where
// ensureOnIntentMain catches and silently ignores git errors.

import { ensureOnIntentMain } from "../../../git-worktree.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	ensureOnIntentMain(ctx.slug)
	return {
		action: "complete",
		message: `Intent '${ctx.slug}' is already completed`,
	}
}

export default emit
