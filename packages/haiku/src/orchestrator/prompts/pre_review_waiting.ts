// orchestrator/prompts/pre_review_waiting.ts — Pre-execute review
// was just dispatched and reviewer subagents may still be running.
// The workflow engine refuses to advance during a grace window so a fast retry
// doesn't race past in-flight reviewers. The agent should wait for
// every reviewer to return, then call haiku_run_next again. To
// skip the grace window when reviewers are confirmed done, set
// `pre_review_reviewers_acknowledged: true` in the stage state.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ slug, action }) => {
	const message = (action.message as string) || ""
	const stage = (action.stage as string) || ""
	const graceRemaining = (action.grace_remaining_ms as number) || 0
	const dispatchedAt = (action.dispatched_at as string) || ""

	const parts: string[] = [
		`## Pre-Execute Review In Progress: ${stage}`,
		"",
		message,
	]

	if (graceRemaining > 0) {
		parts.push(
			"",
			`**Grace remaining:** ${Math.ceil(graceRemaining / 1000)}s`,
			dispatchedAt ? `**Dispatched at:** ${dispatchedAt}` : "",
		)
	}

	parts.push(
		"",
		"### Instructions",
		"",
		"1. Wait for every reviewer subagent in the prior `pre_review` wave to return.",
		`2. Call \`haiku_run_next { intent: "${slug}" }\` — the workflow engine will re-check.`,
		"",
		"**Do NOT** dispatch new work or modify unit specs while pre-review is in flight. The workflow engine auto-advances when the grace window elapses or when `pre_review_reviewers_acknowledged` is set.",
	)

	return parts.filter((p) => p !== "").join("\n")
})
