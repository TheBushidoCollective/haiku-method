// orchestrator/prompts/feedback_dispatch.ts — Pending feedback on
// a stage that DOESN'T require rolling the stage back. The
// orchestrator classified each item by resolution and emitted a
// dispatch plan: needs_triage, questions, inline_fixes. Each
// category is handled differently. The `message` field carries the
// per-item playbook the orchestrator rendered.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ action }) => {
	const message = (action.message as string) || ""
	const counts = (action.counts as Record<string, number>) || {}
	const stage = (action.stage as string) || ""

	const summaryLine = Object.entries(counts)
		.filter(([, n]) => n > 0)
		.map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`)
		.join(", ")

	return `## Feedback Dispatch: ${stage}\n\n${summaryLine ? `_${summaryLine}_\n\n` : ""}${message}`
})
