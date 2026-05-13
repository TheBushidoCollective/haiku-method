// orchestrator/workflow/invalidate-downstream.ts — clears reviews +
// approvals on every unit of every stage AFTER `completedStage` when
// completion was triggered by a revisit (i.e. there's already
// downstream work with stamps from a prior forward walk).
//
// Why it exists (2026-05-13):
//
// The flow this guards is the cursor's "approve → approve →
// revisit upstream → re-approve upstream" loop. Today the cursor's
// signal for "stage is past" is per-unit FM (reviews + approvals
// stamped). When the user revisits stage X after stage Y and Z were
// already approved, the engine merges X back into intent main on
// complete_stage — but Y and Z keep their `reviews.*` /
// `approvals.*` stamps. The cursor walks past them on the next tick
// and either declares the intent complete or sealed without anyone
// re-reviewing Y and Z against the changed upstream content.
//
// The continuity contract is "downstream stages cover upstream
// deliverables." That's checked once at decompose; once a stage is
// approved, it's frozen against upstream changes. This module fills
// the gap on the OUTPUT side: when upstream re-completes,
// downstream's review/approval slots are cleared so the cursor
// re-runs them through dispatch_review / dispatch_approval /
// user_gate.
//
// Scope decisions:
//   - Clears ALL roles (spec, quality_gates, every configured
//     review-agent, user). The upstream content changed; every gate
//     should fire again. Cheaper subsets are easy to dial back later
//     if user re-review fatigue shows up.
//   - Does NOT clear `iterations[]` on units. The hat-produced
//     artifacts may still be substantially correct — the agent /
//     user can decide via the re-fired review gates whether to open
//     feedback (which drives a new bolt) or simply re-approve.
//   - Does NOT touch the stage's own `feedback/*.md` files or
//     `elaboration.md` — only per-unit FM.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parseFrontmatter, setFrontmatterField } from "../../state-tools.js"
import { resolveIntentStages } from "../studio.js"

/**
 * Strip every review + approval slot on every unit of every stage
 * after `completedStage`. Returns a summary with the stages touched
 * and total units cleared. No-op when `completedStage` is the last
 * stage in the intent's effective stage list.
 *
 * Idempotent: re-running on an already-cleared tree is a no-op.
 */
export function invalidateDownstreamApprovals(args: {
	intentDir: string
	intentFm: Record<string, unknown>
	studio: string
	completedStage: string
}): { stages_cleared: string[]; units_cleared: number } {
	const stages = resolveIntentStages(args.intentFm, args.studio)
	const completedIdx = stages.indexOf(args.completedStage)
	if (completedIdx < 0) return { stages_cleared: [], units_cleared: 0 }
	const downstream = stages.slice(completedIdx + 1)
	if (downstream.length === 0) return { stages_cleared: [], units_cleared: 0 }

	const stagesCleared: string[] = []
	let unitsCleared = 0

	for (const stage of downstream) {
		const unitsDir = join(args.intentDir, "stages", stage, "units")
		if (!existsSync(unitsDir)) continue
		const files = readdirSync(unitsDir).filter((f) => f.endsWith(".md"))
		let stageTouched = false
		for (const file of files) {
			const unitPath = join(unitsDir, file)
			const raw = readFileSync(unitPath, "utf8")
			const fm = parseFrontmatter(raw).data as Record<string, unknown>
			const hadReviews =
				fm.reviews &&
				typeof fm.reviews === "object" &&
				Object.keys(fm.reviews as Record<string, unknown>).length > 0
			const hadApprovals =
				fm.approvals &&
				typeof fm.approvals === "object" &&
				Object.keys(fm.approvals as Record<string, unknown>).length > 0
			if (!hadReviews && !hadApprovals) continue
			if (hadReviews) setFrontmatterField(unitPath, "reviews", {})
			if (hadApprovals) setFrontmatterField(unitPath, "approvals", {})
			unitsCleared++
			stageTouched = true
		}
		if (stageTouched) stagesCleared.push(stage)
	}

	return { stages_cleared: stagesCleared, units_cleared: unitsCleared }
}
