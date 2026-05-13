// orchestrator/prompts/complete_stage.ts — v4 stage-completion prompt.
//
// Cursor returns `complete_stage { stage }` when every unit in the
// stage has all required review + approval signatures on disk. The
// action is SEMANTIC ("this stage is done"), not a VCS verb — under
// a git-backed portfolio the engine merges the stage branch into
// intent main under `withIntentMainLock` as an implementation detail;
// under filesystem-only backings it performs whatever "complete"
// means there.
//
// Renamed 2026-05-12 from `merge_stage` per the principle "no engine
// action reflects a git or VCS operation." The action name describes
// the workflow intent; the underlying mechanism is the engine's
// concern.

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string) || ""

	const lines: string[] = []
	lines.push(`# Complete stage \`${stage}\``)
	lines.push("")
	lines.push(
		`Every unit on stage \`${stage}\` has its required reviews + approvals stamped. The cursor is ready to mark the stage complete and advance.`,
	)
	lines.push("")
	lines.push("## What to do")
	lines.push("")
	lines.push(
		`Call \`haiku_run_next { intent: "${slug}" }\` again — the engine handles stage-completion mechanics (under git-backed portfolios this includes merging \`haiku/${slug}/${stage}\` → \`haiku/${slug}/main\`; under filesystem-only backings it just transitions the stage state) and returns the next instruction. Most commonly: a \`complete_stage\` for the next finished stage, or \`intent_review\` once every stage is complete.`,
	)
	lines.push("")
	lines.push(
		`On success, no further action from you. On conflict (git backings), the response will include the conflicting files and recovery instructions.`,
	)

	return lines.join("\n")
})
