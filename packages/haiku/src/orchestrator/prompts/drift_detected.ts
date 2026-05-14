// orchestrator/prompts/drift_detected.ts — v4 drift sweep response.
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

import { definePromptBuilder } from "./define.js"

type DriftEvent = {
	unit: string
	role: string
	kind: string
	file: string
	since: string
}

export default definePromptBuilder(({ slug, action }) => {
	const events = (action.events as DriftEvent[]) || []

	const lines: string[] = []
	lines.push(`# Drift detected on intent \`${slug}\``)
	lines.push("")
	lines.push(
		`The drift sweep found ${events.length} witnessed artifact(s) edited out-of-band since their review/approval was signed:`,
	)
	lines.push("")
	for (const e of events) {
		lines.push(
			`- \`${e.kind}\` drift on \`${e.unit}\` / role \`${e.role}\`: \`${e.file}\` (witnessed at \`${e.since}\`, current content sha256 no longer matches)`,
		)
	}
	lines.push("")
	lines.push("## What to do")
	lines.push("")
	lines.push(
		`File one feedback per drift event via \`haiku_feedback\`. Each FB:`,
	)
	lines.push("")
	lines.push(`- \`origin: "drift"\``)
	lines.push(`- \`source_ref: "drift:<kind>:<file>"\``)
	lines.push(`- \`target_unit\`: the unit named in the event`)
	lines.push(
		`- \`target_invalidates: []\` — the assessor decides whether the drift is material; closure with empty invalidates means "cosmetic, no action"; a non-empty list re-routes the cursor through the named approval roles`,
	)
	lines.push(`- body: include the kind, file path, and since timestamp`)
	lines.push("")
	lines.push(
		`After filing each FB, call \`haiku_run_next { intent: "${slug}" }\`. The cursor walks Track B and dispatches the fix loop on the new FB(s).`,
	)
	lines.push("")
	lines.push(
		`**Forward-only**: do NOT directly edit any unit's outputs to "fix" the drift. Either close the FB as cosmetic, or let the assessor write new corrective units in the current/future stages. Completed unit bytes are immutable.`,
	)

	return lines.join("\n")
})
