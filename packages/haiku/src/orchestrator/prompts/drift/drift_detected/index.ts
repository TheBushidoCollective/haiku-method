// orchestrator/prompts/drift_detected/index.ts — v4 drift sweep
// response.
//
// Cursor's Track C (drift sweep) returns `drift_detected { events }`
// when a witnessed artifact's current content sha256 stops matching
// the witness recorded at sign time. Detection is purely filesystem:
// hash the file on disk, compare to the stored witness. No git log,
// no commit enrichment — the hash mismatch IS the signal.
//
// The agent files an FB for each drift event; the next tick walks
// Track B (feedback) and the fix loop assesses the drift's impact.
//
// Forward-only invariant: completed work is not edited in place.
// The fix loop either closes the FB as cosmetic (no action) or
// writes new units that handle the drift's downstream consequences.

import { Eta } from "eta"
import { loadTemplate } from "../../_load-template.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

type DriftEvent = {
	unit: string
	role: string
	kind: string
	file: string
	since: string
}

export default definePromptBuilder(({ slug, action }) => {
	const events = (action.events as DriftEvent[]) || []
	return eta.renderString(TEMPLATE, {
		slug,
		events,
		eventCount: events.length,
	})
})
