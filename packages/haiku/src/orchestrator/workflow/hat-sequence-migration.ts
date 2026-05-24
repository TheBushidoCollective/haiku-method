// orchestrator/workflow/hat-sequence-migration.ts — reconcile units whose
// recorded iterations reference a hat that no longer exists in the stage's
// hat sequence.
//
// When a studio's (or a project override's) `hats:` list changes — e.g. the
// 2026-05-23 security reshape dropped red-team/blue-team from the per-unit
// loop — units that already ran those hats carry iteration entries naming a
// hat that's no longer in the sequence. Left alone, `stageHats.indexOf(hat)`
// returns -1 and the cursor / reject routing compute against a hat that isn't
// there (the live admin-portal-reimagine unit-006 sits exactly here: capped
// at blue-team, a hat the reshape removed).
//
// Policy (set with Jason): TRIM each unit's iterations to the entries whose
// hat is still in the unit's current sequence. The consequence falls out of
// `deriveUnitStatus`/the cursor automatically:
//   - terminal in-sequence verify already advanced → the trimmed history ends
//     at that advance → the hat loop reads as complete → routes to the stage
//     review track (where the relocated adversarial review-agent + fix-loop
//     now handle what red/blue used to). unit-006: security-reviewer advanced
//     at bolt 4, so trimming the red/blue tail leaves it loop-complete.
//   - no in-sequence hat advanced → trimmed to empty → derives pending → the
//     unit re-runs cleanly under the new sequence.
// Findings the removed hats filed survive as feedback (FB files), so trimming
// the iteration ENTRIES loses no work — only references to vanished hats.
//
// Idempotent: a unit with no orphan-hat entries is untouched. Runs pre-cursor
// in run-tick. No git/worktree side effects — pure on-disk FM reconciliation.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { intentDir, resolveUnitHats } from "../../state-tools.js"

type IterEntry = { hat?: unknown } & Record<string, unknown>

export function reconcileOrphanedHatSequences(slug: string): {
	reconciled: string[]
} {
	const reconciled: string[] = []
	const iDir = intentDir(slug)
	const intentFile = join(iDir, "intent.md")
	if (!existsSync(intentFile)) return { reconciled }

	let stages: string[] = []
	try {
		const { data } = matter(readFileSync(intentFile, "utf8"))
		stages = Array.isArray(data.stages) ? (data.stages as string[]) : []
	} catch {
		return { reconciled }
	}

	for (const stage of stages) {
		const unitsDir = join(iDir, "stages", stage, "units")
		if (!existsSync(unitsDir)) continue
		for (const file of readdirSync(unitsDir).filter((n) => n.endsWith(".md"))) {
			const unit = file.replace(/\.md$/, "")
			const unitPath = join(unitsDir, file)
			let parsed: { data: Record<string, unknown>; content: string }
			try {
				parsed = matter(readFileSync(unitPath, "utf8"))
			} catch {
				continue
			}
			const iters = Array.isArray(parsed.data.iterations)
				? (parsed.data.iterations as IterEntry[])
				: []
			if (iters.length === 0) continue

			const validHats = new Set(resolveUnitHats(slug, stage, unit))
			const isOrphan = (it: IterEntry) =>
				typeof it?.hat === "string" && !validHats.has(it.hat)
			if (!iters.some(isOrphan)) continue

			const trimmed = iters.filter(
				(it) => typeof it?.hat === "string" && validHats.has(it.hat),
			)
			// Clone before mutating: gray-matter caches parses by content string,
			// so an in-place edit would poison that cache for any later read of
			// the same content.
			const data = structuredClone(parsed.data)
			data.iterations = trimmed
			writeFileSync(unitPath, matter.stringify(parsed.content, data))
			reconciled.push(`${stage}/${unit}`)
		}
	}

	return { reconciled }
}
