// orchestrator/workflow/validate-unit-inputs-gate.ts — pre-tick gate
// that catches units ALREADY on disk whose `inputs:` lists a unit name
// instead of a file path, and auto-files a deduplicated feedback so the
// malformed spec gets fixed instead of silently wedging the cursor.
//
// Why this exists alongside the write-time validator: `haiku_unit_write`
// now rejects `inputs:` entries shaped like `unit-NNN-slug`
// (`inputs_unit_name_not_path`), so NEW units can't land malformed. But
// units written before that validator existed are already on disk —
// e.g. admin-portal-reimagine unit-014 (2026-05-19) declared
// `inputs: [unit-005-…, unit-006-…, unit-007-…]` with no `depends_on`.
// The cursor's wave-ready filter gates on `depends_on` (empty → ready)
// and dispatched it; `haiku_unit_start`'s input-existence gate then
// refused it (unit names aren't files on disk). A unit selected as
// ready that can never start = a permanent wedge with no recordable
// outcome. This gate surfaces it as feedback the next tick can route
// through the normal review/fix flow.
//
// Dedup: one FB per malformed unit, keyed by
// `source_ref: malformed-inputs:<unit>`. Re-running the gate every tick
// is a no-op once the FB is open; closing/fixing the unit lets it
// re-fire only if the malformed shape returns.

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { findCurrentStage } from "./cursor.js"
import {
	readFeedbackFiles,
	stageDir,
	writeFeedbackFile,
} from "../../state-tools.js"

const UNIT_NAME_INPUT = /^unit-\d+-/

export interface MalformedInputsGateResult {
	/** Units that had a malformed input and got an FB filed this tick. */
	filed: string[]
	/** Units already covered by an open dedup FB (skipped). */
	skipped: string[]
}

/** Scan the active stage's units for `inputs:` entries shaped like unit
 *  names and auto-file a deduplicated feedback per offending unit.
 *  Returns the units acted on. Best-effort: any read/parse failure on a
 *  single unit is skipped, never thrown — the cursor walk surfaces real
 *  errors. */
export function autoFileMalformedUnitInputs(
	slug: string,
	intentDirPath: string,
	studio: string,
): MalformedInputsGateResult {
	const filed: string[] = []
	const skipped: string[] = []

	const stage = findCurrentStage(slug, studio, intentDirPath)
	if (!stage) return { filed, skipped }

	const unitsDir = join(stageDir(slug, stage), "units")
	if (!existsSync(unitsDir)) return { filed, skipped }

	// Open FBs whose source_ref already covers a malformed-inputs finding,
	// for dedup. Read at this stage's scope (where we file).
	const openRefs = new Set<string>()
	try {
		for (const fb of readFeedbackFiles(slug, stage)) {
			const ref = (fb as { source_ref?: unknown }).source_ref
			const closed = (fb as { closed_at?: unknown; status?: unknown })
			if (
				closed.closed_at ||
				(typeof closed.status === "string" && closed.status === "closed") ||
				(typeof closed.status === "string" && closed.status === "rejected")
			)
				continue
			if (typeof ref === "string" && ref.startsWith("malformed-inputs:")) {
				openRefs.add(ref)
			}
		}
	} catch {
		/* if we can't read FBs, fall through — writeFeedbackFile is the
		 * authority on duplicate numbering anyway */
	}

	let unitFiles: string[]
	try {
		unitFiles = readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
	} catch {
		return { filed, skipped }
	}

	for (const file of unitFiles) {
		let fm: Record<string, unknown>
		try {
			fm = matter(readFileSync(join(unitsDir, file), "utf8")).data
		} catch {
			continue
		}
		const inputs = Array.isArray(fm.inputs) ? (fm.inputs as unknown[]) : []
		const offending = inputs.filter(
			(i): i is string =>
				typeof i === "string" && UNIT_NAME_INPUT.test(i.trim()),
		)
		if (offending.length === 0) continue

		const unitName = file.replace(/\.md$/, "")
		const sourceRef = `malformed-inputs:${unitName}`
		if (openRefs.has(sourceRef)) {
			skipped.push(unitName)
			continue
		}

		const body = [
			`Unit \`${unitName}\` declares \`inputs:\` entries that are unit NAMES, not file paths:`,
			"",
			...offending.map((o) => `  - \`${o}\``),
			"",
			"`inputs:` must list file PATHS the unit reads (e.g. `product/ACCEPTANCE-CRITERIA.md`, a prior-stage artifact, or a producing unit's declared output file). A unit name is not a path the engine can read — `haiku_unit_start` rejects it as `unit_inputs_missing`, and because the cursor's wave-ready filter gates on `depends_on` (not `inputs`), the unit is selected as ready yet can never start.",
			"",
			"To fix: rewrite the unit so the cross-unit ordering lives in `depends_on:` and `inputs:` references the producing unit's actual output file path(s). Use `haiku_unit_write` (which now rejects the unit-name shape at write time).",
		].join("\n")

		try {
			writeFeedbackFile(slug, stage, {
				title: `Unit ${unitName}: inputs reference unit names, not file paths`,
				body,
				origin: "agent",
				author: "engine:input-validator",
				authorType: "system",
				source_ref: sourceRef,
				triaged_at: new Date().toISOString(),
				targetUnit: unitName,
			})
			filed.push(unitName)
			openRefs.add(sourceRef)
		} catch {
			/* best-effort; next tick retries */
		}
	}

	return { filed, skipped }
}
