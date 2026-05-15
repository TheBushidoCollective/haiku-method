// orchestrator/prompts/complete_stage/index.ts — v4 stage-completion
// prompt.
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

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, action }) => {
	const stage = (action.stage as string) || ""
	return eta.renderString(TEMPLATE, { slug, stage })
})
