// orchestrator/prompts/migrated/index.ts — One-time post-migration
// banner. Run-tick.ts emits this after a successful auto-migration
// so the agent has full context about what changed on disk before
// the cursor walks again. The message is fully composed in
// run-tick.ts; this just frames it so it routes through
// actionPromptBuilders like every other action instead of falling
// through to the "## Unknown Action" default in
// buildRunInstructions.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ action }) => {
	return eta.renderString(TEMPLATE, { message: action.message ?? "" })
})
