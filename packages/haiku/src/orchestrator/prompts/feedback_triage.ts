// orchestrator/prompts/feedback_triage.ts — Pre-tick triage gate.
// Fires when there are open FBs on the current stage or any earlier
// stage that haven't been triaged yet (no `triaged_at:` on the FM).
// The agent reads each FB, decides whether it lives on the right
// stage, and either confirms placement (no-op move) or relocates it
// via `haiku_feedback_move`. Once every untriaged FB is processed,
// the next tick re-evaluates: open FB on earlier stage → revisit;
// open FB on current stage → fix loop.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ slug, action }) => {
	const message = (action.message as string) || ""
	const items =
		(action.items as Array<{
			feedback_id: string
			stage: string
			title: string
			origin: string
			author: string
			file: string
		}>) || []

	const itemBlocks = items
		.map((it, i) => {
			const stageLabel = it.stage || "intent-scope"
			return [
				`#### ${i + 1}. ${it.feedback_id} — ${it.title}`,
				`- Currently on: \`${stageLabel}\``,
				`- Source: ${it.origin} · author: ${it.author}`,
				`- File: \`${it.file}\``,
			].join("\n")
		})
		.join("\n\n")

	const validStages = (action.valid_stages as string[]) || []
	const stageHint = validStages.length
		? `Valid stages for this intent: ${validStages.map((s) => `\`${s}\``).join(", ")}, plus \`""\` for intent-scope.`
		: ""

	return [
		`## Feedback Triage Required`,
		"",
		message,
		"",
		`### Open feedback (${items.length})`,
		"",
		itemBlocks || "_(none)_",
		"",
		"### What to do",
		"",
		"For **each** item above:",
		"",
		"1. Read the FB body (and any attachment / source_ref).",
		"2. Decide where it belongs:",
		"   - **Right place already** → call `haiku_feedback_move` with `to_stage` equal to the current stage. This stamps `triaged_at:` without moving the file.",
		"   - **Wrong stage** → call `haiku_feedback_move` with `to_stage` set to the correct stage. The file relocates and gets renumbered in the target dir.",
		"   - **Out of scope / not actionable** → call `haiku_feedback_reject` with a reason. The FB closes and stops blocking the gate.",
		"",
		stageHint,
		"",
		`When every item has been triaged, call \`haiku_run_next { intent: "${slug}" }\`. The pre-tick gate will re-evaluate: any open FBs left on earlier stages will trigger a revisit; current-stage FBs flow into the fix loop.`,
	]
		.filter(Boolean)
		.join("\n")
})
