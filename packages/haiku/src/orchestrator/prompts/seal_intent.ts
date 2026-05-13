// orchestrator/prompts/seal_intent.ts — v4 intent-sealing prompt.
//
// Cursor returns `seal_intent` when:
//   - every stage is complete (its content lives on intent main), AND
//   - every required intent-level approval is signed (mode-shaped:
//     spec + continuity for autopilot; spec + continuity + studio
//     review-agents + user for discrete/continuous).
//
// `seal_intent` is a SEMANTIC action ("the intent is done") — under a
// git-backed portfolio the engine performs whatever stage→main work
// remains under `withIntentMainLock` as an implementation detail, then
// stamps `intent.sealed_at`. The next tick emits `sealed`. Renamed
// 2026-05-12 from `merge_intent` per the principle "no engine action
// reflects a git/VCS operation."

import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ slug }) => {
	const lines: string[] = []
	lines.push(`# Seal intent \`${slug}\``)
	lines.push("")
	lines.push(
		`Every stage on intent **${slug}** is complete and every required intent-level approval is signed. The engine is ready to seal the intent.`,
	)
	lines.push("")
	lines.push("## What to do")
	lines.push("")
	lines.push(
		`Call \`haiku_run_next { intent: "${slug}" }\` again — the engine handles intent-sealing mechanics (under git-backed portfolios this includes any final stage→main reconciliation under \`withIntentMainLock\`), stamps \`intent.sealed_at\`, and the next tick emits \`sealed\`. Do NOT run \`git merge\` yourself; the engine owns the merge order and the lock.`,
	)
	lines.push("")
	lines.push(
		`On a successful seal, no further action. On \`merge_conflict\`, the response will name the conflicting files and the resolution path.`,
	)
	return lines.join("\n")
})
