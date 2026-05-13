// orchestrator/prompts/save_wip.ts — Branch-switch blocked by
// uncommitted work. The orchestrator detected dirty files on the
// current branch when trying to align with the active stage branch.
// The fix is mechanical: save the work in progress on the current
// branch (under a git-backed portfolio that means `git commit`), then
// retry `haiku_run_next`. No human intervention needed. Renamed
// 2026-05-12 from `commit_wip` per the principle "no engine action
// reflects a git/VCS operation."

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ action }) => {
	const message = (action.message as string) || ""
	return `## Save Work In Progress\n\n${message}`
})
