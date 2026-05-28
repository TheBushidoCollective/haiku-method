// orchestrator/workflow/validate-output-existence-gate.ts — intent-closeout
// gate that re-validates every completed unit's DECLARED outputs still exist
// on disk, intelligently repairs near-miss extension typos in place, and
// auto-files a deduplicated feedback for the rest.
//
// Why this exists alongside the per-unit terminal-hat existence check
// (`state-tools.ts` `haiku_unit_advance_hat`): that gate validates outputs
// exist ONCE, at the moment the unit completes. After that, a later unit, a
// fix-loop edit, a rename, or a stage merge can move/delete a file — leaving
// a stale `outputs:` declaration that no gate re-checks. The SPA surfaces the
// phantom ("declared output isn't on disk"), but nothing blocked it. This
// gate is the closeout backstop: it runs when ALL stages are complete (the
// intent is wrapping up), so it never touches an in-flight unit whose output
// legitimately doesn't exist yet.
//
// Two outcomes per missing output:
//   1. INTELLIGENT REPAIR — the common cause is an extension typo (declared
//      `WorkerDates.test.ts`, shipped `WorkerDates.test.tsx`). `repairDeclaredOutput`
//      finds the same-stem sibling and we rewrite the declaration in place.
//      No feedback, no rewind — the declaration just catches up to reality.
//   2. FEEDBACK — genuinely absent (no sibling, or ambiguous). We file a
//      deduplicated FB so the fix loop corrects the path or produces the
//      file. NEVER rewind a stage; NEVER run the repair tool.
//
// Dedup: one FB per (unit, declared-path), keyed by
// `source_ref: missing-output:<unit>:<path>`. Re-running every tick is a
// no-op once the FB is open.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	readFeedbackFiles,
	repairDeclaredOutput,
	stageDir,
	unitOutputExists,
	writeFeedbackFile,
} from "../../state-tools.js"

export interface OutputExistenceGateResult {
	/** `{ unit, from, to }` for each declaration auto-corrected in place. */
	repaired: Array<{ unit: string; from: string; to: string }>
	/** `<unit>:<path>` for each unrepairable output that got an FB this tick. */
	filed: string[]
	/** `<unit>:<path>` already covered by an open dedup FB (skipped). */
	skipped: string[]
}

/** Walk every unit in the given stages, re-validate declared outputs exist,
 *  auto-repair near-miss extension typos in place, and file a deduplicated
 *  FB for the rest. Best-effort: a read/parse failure on a single unit is
 *  skipped, never thrown. Intended to run at intent CLOSEOUT (all stages
 *  complete) so it never flags an in-flight unit's not-yet-written output. */
export function autoRepairOrFileMissingOutputs(
	slug: string,
	stages: string[],
): OutputExistenceGateResult {
	const repaired: OutputExistenceGateResult["repaired"] = []
	const filed: string[] = []
	const skipped: string[] = []

	for (const stage of stages) {
		const unitsDir = join(stageDir(slug, stage), "units")
		if (!existsSync(unitsDir)) continue

		// Open FBs whose source_ref already covers a missing-output finding on
		// this stage, for dedup.
		const openRefs = new Set<string>()
		try {
			for (const fb of readFeedbackFiles(slug, stage)) {
				const ref = (fb as { source_ref?: unknown }).source_ref
				const closed = fb as { closed_at?: unknown; status?: unknown }
				// Skip closures that should ALLOW a re-file if the output is
				// still missing: `closed` (the fix landed — the output now
				// exists, so we won't reach the file step anyway) and `rejected`
				// (the finding was invalid). But a `non_actionable` close is the
				// fix loop ACCEPTING the output as intentionally absent — it must
				// SUPPRESS re-filing (it carries `closed_at`, so we keep it in
				// `openRefs` rather than letting it leak into an infinite
				// re-file → non_actionable → re-file loop).
				const status = typeof closed.status === "string" ? closed.status : null
				if (
					(closed.closed_at && status !== "non_actionable") ||
					status === "closed" ||
					status === "rejected"
				)
					continue
				if (typeof ref === "string" && ref.startsWith("missing-output:"))
					openRefs.add(ref)
			}
		} catch {
			/* writeFeedbackFile owns duplicate numbering anyway */
		}

		let unitFiles: string[]
		try {
			unitFiles = readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
		} catch {
			continue
		}

		for (const file of unitFiles) {
			const unitName = file.replace(/\.md$/, "")
			let parsed: ReturnType<typeof matter>
			try {
				parsed = matter(readFileSync(join(unitsDir, file), "utf8"))
			} catch {
				continue
			}
			const outputs = Array.isArray(parsed.data.outputs)
				? (parsed.data.outputs as unknown[]).filter(
						(o): o is string => typeof o === "string",
					)
				: []
			if (outputs.length === 0) continue

			const corrected: string[] = []
			const missing: string[] = []
			let dirty = false
			for (const out of outputs) {
				if (unitOutputExists(slug, unitName, out)) {
					corrected.push(out)
					continue
				}
				const fix = repairDeclaredOutput(slug, unitName, out)
				if (fix) {
					corrected.push(fix)
					repaired.push({ unit: unitName, from: out, to: fix })
					dirty = true
				} else {
					corrected.push(out)
					missing.push(out)
				}
			}

			if (dirty) {
				try {
					// Build a FRESH data object — never mutate `parsed.data`. gray-matter
					// caches parse results by content and returns a SHARED object, so
					// mutating it corrupts every other unit with byte-identical content
					// (e.g. two skeleton units) on its next parse.
					writeFileSync(
						join(unitsDir, file),
						matter.stringify(parsed.content, {
							...parsed.data,
							outputs: corrected,
						}),
					)
				} catch {
					/* best-effort; next tick retries */
				}
			}

			for (const out of missing) {
				const sourceRef = `missing-output:${unitName}:${out}`
				if (openRefs.has(sourceRef)) {
					skipped.push(`${unitName}:${out}`)
					continue
				}
				const body = [
					`Unit \`${unitName}\` declares an output that is not on disk:`,
					"",
					`  - \`${out}\``,
					"",
					"The intent is at closeout and this declared deliverable can't be found at the path the unit recorded. No same-name file with a different extension exists either, so it wasn't auto-repairable (an extension typo like `.test.ts` → `.test.tsx` self-corrects silently).",
					"",
					"To fix: EITHER correct the `outputs:` entry to the file's real path (if it was renamed/moved after this unit completed — e.g. a later unit or fix-loop changed it), OR produce the missing file. The fix-loop should land the actual change; a corrected declaration alone is only right when the file genuinely exists under a different name.",
				].join("\n")
				try {
					writeFeedbackFile(slug, stage, {
						title: `Unit ${unitName}: declared output not on disk (${out})`,
						body,
						origin: "agent",
						severity: "high",
						author: "engine:output-validator",
						authorType: "system",
						source_ref: sourceRef,
						triaged_at: new Date().toISOString(),
						targetUnit: unitName,
					})
					filed.push(`${unitName}:${out}`)
					openRefs.add(sourceRef)
				} catch {
					/* best-effort; next tick retries */
				}
			}
		}
	}

	return { repaired, filed, skipped }
}
