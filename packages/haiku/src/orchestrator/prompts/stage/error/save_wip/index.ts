// orchestrator/prompts/save_wip/index.ts — Branch-switch blocked by
// uncommitted work. The orchestrator detected dirty files on the
// current branch when trying to align with the active stage branch.
// The fix is mechanical: save the work in progress on the current
// branch (under a git-backed portfolio that means `git commit`),
// then retry `haiku_run_next`. No human intervention needed.
// Renamed 2026-05-12 from `commit_wip` per the principle "no engine
// action reflects a git/VCS operation."

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	return eta.renderString(TEMPLATE, { message: action.message ?? "" })
})
