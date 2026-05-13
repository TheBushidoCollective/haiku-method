// orchestrator/prompts/commit_wip.ts — Branch-switch blocked by
// uncommitted work. The orchestrator detected dirty files on the
// current branch when trying to align with the active stage branch.
// The fix is mechanical: commit on the current branch, then retry
// `haiku_run_next`. No human intervention needed.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ action }) => {
	const message = (action.message as string) || ""
	return `## Commit Work In Progress\n\n${message}`
})
