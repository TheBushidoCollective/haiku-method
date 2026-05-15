// orchestrator/prompts/intent_complete/index.ts — All stages done.
// Different copy for git vs. filesystem persistence: git mode tells
// the agent to open ONE final-delivery MR; filesystem mode just
// reports completion. Either way the orchestrator already marked
// the intent completed.

import { Eta } from "eta"
import { getMainlineBranch } from "../../../../../git-worktree.js"
import { isGitRepo } from "../../../../../state-tools.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug }) => {
	const gitMode = isGitRepo()
	const mainline = gitMode ? getMainlineBranch() : ""
	return eta.renderString(TEMPLATE, { slug, gitMode, mainline })
})
