// orchestrator/prompts/migrated.ts — One-time post-migration banner.
// Run-tick.ts emits this after a successful auto-migration so the
// agent has full context about what changed on disk before the
// cursor walks again. Without this, the agent sees deleted v3 state
// files in `git status` and incorrectly tells the user data was
// lost. The message is fully composed in run-tick.ts; we just frame
// it here so it routes through actionPromptBuilders like every other
// action instead of falling through to the "## Unknown Action"
// default in buildRunInstructions.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ action }) => {
	return `## Intent Migrated\n\n${action.message}`
})
