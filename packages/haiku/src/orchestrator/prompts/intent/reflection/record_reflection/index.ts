// orchestrator/prompts/intent/reflection/record_reflection/index.ts —
// reflection intent-close prompt.
//
// Cursor returns `record_reflection {}` once at intent close, after
// every intent-scope approval is signed and before seal_intent
// advances, when no `reflection.md` has been written yet for this
// intent. The agent synthesizes the run from on-disk signal (per-stage
// observations.md + every FB + unit iterations/outputs), writes
// `reflection.md` at intent root, lands any project-local overlays
// directly under `.haiku/`, fires `haiku_report` for engine-class
// findings, and commits the whole batch with an `autotune:` prefixed
// message. The next tick sees `reflection.md` and falls through to
// seal_intent.

import { Eta } from "eta"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug }) => {
	return eta.renderString(TEMPLATE, { slug })
})
