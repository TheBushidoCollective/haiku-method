// orchestrator/prompts/seal_intent/index.ts — v4 intent-sealing
// prompt.
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

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug }) => {
	return eta.renderString(TEMPLATE, { slug })
})
