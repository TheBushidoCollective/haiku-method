// orchestrator/workflow/self-repair-approvals.ts
//
// Pre-tick self-repair for migrated / partially-stamped intents.
//
// Symptom: an intent's earlier stages have units whose iterations end on
// terminal-advance but the `reviews:` / `approvals:` blocks are empty
// (or missing). The cursor pins on the earliest such stage, emits
// `dispatch_review(spec)` every tick, but no stamp lands — usually
// because the user has already moved past that stage in a previous
// plugin generation. Common cause: v3→v4 migration ran on intent main
// but its writes were scattered to the wrong branch by an auto-commit
// during stage-branch alignment, never landing on the unit files the
// cursor actually walks.
//
// Self-repair rule: if stage N's units are all iteration-complete but
// have no approval stamps, AND any LATER stage in the intent's stage
// list has on-disk work (units, elaboration, discovery, or feedback
// files), then stage N MUST have been approved at some point — the
// user moved past it. Synthesize the missing stamps with
// `migrated: true` so debugging can identify them.
//
// The trigger ("any later stage has any on-disk work") is intentionally
// loose. We only need to know the user moved past N, not which exact
// signal proved it.
//
// This runs in run-tick.ts BEFORE the cursor walk. The cursor then
// reads the just-written stamps and walks past N to the actual current
// stage. No commit happens here — run-tick is observation-only; the
// existing pre-tick branch alignment in haiku_run_next.ts auto-commits
// engine-owned files when it switches branches, so the synthesized
// stamps ride along on the next branch switch.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { readReviewAgentPaths } from "../../studio-reader.js"
import { emitTelemetry } from "../../telemetry.js"
import { resolveIntentStages, resolveStageHats } from "../studio.js"

const SYNTH_REASON = "pre-tick-self-repair: later stage has on-disk work"

type UnitFm = Record<string, unknown>

function readMatter(path: string): { data: UnitFm; body: string } | null {
	if (!existsSync(path)) return null
	try {
		const raw = readFileSync(path, "utf8")
		// Deep clone the parsed object — gray-matter caches by content,
		// returning the same object reference on repeat reads of
		// identical content. Without the clone, mutating `data.reviews`
		// here leaks back into the cache and surfaces as phantom stamps
		// on the next read.
		const parsed = matter(raw)
		const data = JSON.parse(JSON.stringify(parsed.data)) as UnitFm
		return { data, body: parsed.content }
	} catch {
		return null
	}
}

function writeMatter(path: string, data: UnitFm, body: string): void {
	writeFileSync(path, matter.stringify(body, data))
}

/**
 * Has stage X been touched on disk? Used to detect whether the user
 * moved past an earlier stage even when that earlier stage's stamps
 * are missing.
 *
 * "Touched" means ANY of: a markdown file in units/, elaboration.md
 * present, a markdown file in feedback/, or a markdown file as a
 * direct child of the stage dir itself (discovery outputs, ad-hoc
 * artifacts). The scan is intentionally shallow — `readdirSync` is
 * not recursive, so files nested deeper than one level under the
 * stage root (e.g. `stages/<stage>/artifacts/foo/bar.md`) are NOT
 * detected. Shallow is enough for the proof we need: any artifact at
 * the standard stage-root locations is proof the cursor walked into
 * stage X at least once.
 */
function stageHasWork(intentDir: string, stage: string): boolean {
	const stageDir = join(intentDir, "stages", stage)
	if (!existsSync(stageDir)) return false

	const unitsDir = join(stageDir, "units")
	if (existsSync(unitsDir)) {
		const entries = readdirSync(unitsDir, { withFileTypes: true })
		if (entries.some((e) => e.isFile() && e.name.endsWith(".md"))) return true
	}

	if (existsSync(join(stageDir, "elaboration.md"))) return true

	const fbDir = join(stageDir, "feedback")
	if (existsSync(fbDir)) {
		const entries = readdirSync(fbDir, { withFileTypes: true })
		if (entries.some((e) => e.isFile() && e.name.endsWith(".md"))) return true
	}

	// Any other markdown file directly under the stage dir (discovery
	// outputs, ad-hoc artifacts) — anything that says "stage was visited".
	const top = readdirSync(stageDir, { withFileTypes: true })
	if (top.some((e) => e.isFile() && e.name.endsWith(".md"))) return true

	return false
}

function pickIterations(fm: UnitFm): Array<Record<string, unknown>> {
	const its = fm.iterations
	return Array.isArray(its) ? (its as Array<Record<string, unknown>>) : []
}

/**
 * Is this unit iteration-complete? "Yes" means iterations exist, the
 * last entry has `result: "advance"` (not null, not "reject"), and the
 * last hat name in iterations is the LAST configured hat for the stage
 * (terminal). We can't take a more permissive "any advance" reading
 * here because mid-rotation hats also stamp advance; only the terminal
 * hat advancing is the signal "the unit's hat sequence is done."
 *
 * If `configuredHats` is empty (studio config didn't load), fall back
 * to "last iteration is advance" — softer but safer than blocking the
 * repair entirely.
 */
function isUnitIterationComplete(
	fm: UnitFm,
	configuredHats: string[],
): boolean {
	const its = pickIterations(fm)
	if (its.length === 0) return false
	const last = its[its.length - 1]
	if (last.result !== "advance") return false
	if (configuredHats.length === 0) return true
	return last.hat === configuredHats[configuredHats.length - 1]
}

interface SelfRepairResult {
	stagesRepaired: string[]
	unitsTouched: number
	reviewsAdded: number
	approvalsAdded: number
}

/**
 * Scan the intent and synthesize missing review/approval stamps on
 * any stage where:
 *   (1) every unit is iteration-complete (terminal advance), AND
 *   (2) any LATER stage in the intent has on-disk work.
 *
 * Within a qualifying stage, walk each unit independently: fill the
 * roles that are missing, leave the roles that are stamped alone.
 *
 * Returns a report of what was repaired so the caller can surface it
 * to the user. No-op when all stages are clean.
 *
 * Conservative on edge cases:
 *   - Studio config doesn't load: skip — we don't know the role list.
 *   - No later stage has work: skip — we have no evidence the stage
 *     was approved, so re-running the review is the right behavior.
 *
 * Per-unit grain: stages can be half-stamped (some units fully stamped,
 * others bare) when a migrator partially completed. We evaluate each
 * unit independently — already-stamped units are left alone, units
 * missing stamps get them backfilled. Missing individual ROLES on a
 * unit that has SOME stamps are also filled in (the cursor sees that
 * as an in-flight review track otherwise, which is the same loop on a
 * smaller scope).
 */
export function selfRepairMissingApprovals(
	intentDir: string,
	studio: string,
	mode: string,
): SelfRepairResult {
	const result: SelfRepairResult = {
		stagesRepaired: [],
		unitsTouched: 0,
		reviewsAdded: 0,
		approvalsAdded: 0,
	}

	const intentMdPath = join(intentDir, "intent.md")
	if (!existsSync(intentMdPath)) return result
	let intentFm: UnitFm = {}
	try {
		intentFm = matter(readFileSync(intentMdPath, "utf8")).data as UnitFm
	} catch {
		return result
	}

	const stages = resolveIntentStages(intentFm, studio)
	if (stages.length < 2) return result // no "later stage" possible

	for (let i = 0; i < stages.length - 1; i++) {
		const stage = stages[i]
		const stageDir = join(intentDir, "stages", stage)
		const unitsDir = join(stageDir, "units")
		if (!existsSync(unitsDir)) continue

		const unitFiles = readdirSync(unitsDir, { withFileTypes: true })
			.filter((e) => e.isFile() && e.name.endsWith(".md"))
			.map((e) => join(unitsDir, e.name))
		if (unitFiles.length === 0) continue

		// Resolve role list. We need at least one configured agent or
		// the spec/user pair to make a repair meaningful.
		let reviewAgents: string[] = []
		try {
			reviewAgents = Object.keys(readReviewAgentPaths(studio, stage)).sort()
		} catch {
			reviewAgents = []
		}
		const isAutopilot = mode === "autopilot"
		const reviewRoles: string[] = isAutopilot
			? ["spec"]
			: ["spec", ...reviewAgents, "user"]
		const approvalRoles: string[] = isAutopilot
			? ["spec", "quality_gates"]
			: ["spec", "quality_gates", ...reviewAgents, "user"]

		// Load every unit's FM. Per-unit decision below — we don't
		// require all-or-nothing on the stage, since migrators that
		// partially completed leave the stage half-stamped (some units
		// fully stamped, others bare).
		const hats = readStageHats(studio, stage)
		const fms: { path: string; data: UnitFm; body: string }[] = []
		let allIterationComplete = true
		for (const path of unitFiles) {
			const parsed = readMatter(path)
			if (!parsed) {
				// Unreadable unit FM — flip the gate to "not complete"
				// (conservative: don't synthesize over a file we can't
				// parse) and surface the path via telemetry so debugging
				// has something to grep. Without this, the stage silently
				// stays unrepaired tick after tick.
				emitTelemetry("haiku.self_repair.unit_unreadable", {
					stage,
					path,
				})
				allIterationComplete = false
				break
			}
			fms.push({ path, data: parsed.data, body: parsed.body })
			if (!isUnitIterationComplete(parsed.data, hats)) {
				allIterationComplete = false
			}
		}
		// All units must be iteration-complete to consider the stage
		// "past the build phase" — otherwise we'd stamp approvals over
		// work that isn't done yet. If any unit is mid-flight, the
		// cursor's execute track is the right driver.
		if (!allIterationComplete) continue

		// Stage N looks past the build phase. Check trigger: any later
		// stage has on-disk work?
		let laterStageHasWork = false
		for (let j = i + 1; j < stages.length; j++) {
			if (stageHasWork(intentDir, stages[j])) {
				laterStageHasWork = true
				break
			}
		}
		if (!laterStageHasWork) continue

		// All stage-level gates passed. For each unit, fill any missing
		// review/approval roles — leave existing stamps alone. Units
		// that are already fully stamped pass through with no writes
		// (and don't count toward `unitsTouched`).
		let stageHadAnyRepair = false
		for (const { path, data, body } of fms) {
			const its = pickIterations(data)
			const tsRaw =
				its.length > 0 ? (its[its.length - 1].completed_at as string) : ""
			const ts =
				typeof tsRaw === "string" && tsRaw.length > 0
					? tsRaw
					: new Date().toISOString()

			const reviews =
				data.reviews && typeof data.reviews === "object"
					? { ...(data.reviews as Record<string, unknown>) }
					: {}
			const approvals =
				data.approvals && typeof data.approvals === "object"
					? { ...(data.approvals as Record<string, unknown>) }
					: {}

			let unitTouched = false
			for (const role of reviewRoles) {
				if (reviews[role] == null) {
					reviews[role] = {
						at: ts,
						migrated: true,
						synthesized_reason: SYNTH_REASON,
					}
					result.reviewsAdded++
					unitTouched = true
				}
			}
			for (const role of approvalRoles) {
				if (approvals[role] == null) {
					approvals[role] = {
						at: ts,
						migrated: true,
						synthesized_reason: SYNTH_REASON,
					}
					result.approvalsAdded++
					unitTouched = true
				}
			}

			if (unitTouched) {
				data.reviews = reviews
				data.approvals = approvals
				writeMatter(path, data, body)
				result.unitsTouched++
				stageHadAnyRepair = true
			}
		}

		if (stageHadAnyRepair) result.stagesRepaired.push(stage)
	}

	return result
}

function readStageHats(studio: string, stage: string): string[] {
	try {
		return resolveStageHats(studio, stage) || []
	} catch {
		return []
	}
}

export const __testOnly = {
	stageHasWork,
	isUnitIterationComplete,
}
