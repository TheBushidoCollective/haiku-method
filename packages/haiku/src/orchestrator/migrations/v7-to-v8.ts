// orchestrator/migrations/v7-to-v8.ts — Strip the legacy `status:` field
// from feedback and unit frontmatter; synthesize derivation signals where
// the status implied closure or rejection.
//
// v4 schemas (feedback.ts:8, unit.ts:5) already say "there is no status
// field" — but the consumer code in state-tools.ts still reads `item.status`
// as a fallback when on-disk data has the legacy field. v7-to-v8 removes
// the legacy data so consumers can switch to pure derivation without a
// "but what about old data" branch.
//
// Mapping (when synthesizing closure/rejection signals from old enum values):
//   status: "pending"   → drop (already implicit: no closed_at, no rejected_at)
//   status: "fixing"    → drop (iterations[] should already mark this)
//   status: "addressed" → drop + stamp closed_at = (existing closed_at OR created_at)
//                                + closed_by = "feedback-assessor" (origin per the
//                                v3 doc at FEEDBACK_STATUSES — the assessor hat
//                                was the canonical addressor)
//   status: "answered"  → drop + stamp closed_at = (existing OR created_at)
//                                + resolution = "answered" (carries the no-code
//                                flavor for callers that care)
//   status: "closed"    → drop + stamp closed_at = (existing OR created_at)
//                                + closed_by = "manual_close" (provenance unknown
//                                from old data — we mark it as "manually closed
//                                pre-migration" rather than guess)
//   status: "rejected"  → drop + stamp rejected_at = (existing OR created_at)
//
// Idempotent: re-running on a v8-migrated FB is a no-op (the file no longer
// has a status field, so the strip path is a no-op; existing closed_at /
// rejected_at are preserved).

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	emptyMigrationDetails,
	type MigrationContext,
	type MigrationStepDetails,
	registerMigrator,
} from "../migrate-registry.js"
import { resolveStageHats } from "../studio.js"

const SOURCE_VERSION = "7.0.0"
const TARGET_VERSION = "8.0.0"

interface SynthesisOutcome {
	feedback_migrated: number
	feedback_with_synthesized_closure: number
	units_migrated: number
	/** Units that had non-empty reviews+approvals but empty iterations[].
	 *  Backfilled with `{ hat, result: "advance" }` per hat in the
	 *  stage's hats sequence. Issue #371. */
	units_with_synthesized_iterations: number
}

function migrateOneFeedbackFile(fbPath: string): {
	migrated: boolean
	closure_synthesized: boolean
} {
	const raw = readFileSync(fbPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>
	const status =
		typeof data.status === "string" ? data.status.trim().toLowerCase() : ""
	if (!status) return { migrated: false, closure_synthesized: false }

	const createdAt = typeof data.created_at === "string" ? data.created_at : ""
	const fallbackTs = createdAt || new Date(0).toISOString()
	let synthesized = false

	switch (status) {
		case "addressed":
			if (!data.closed_at) {
				data.closed_at = fallbackTs
				synthesized = true
			}
			if (!data.closed_by) data.closed_by = "feedback-assessor"
			break
		case "answered":
			if (!data.closed_at) {
				data.closed_at = fallbackTs
				synthesized = true
			}
			if (!data.resolution) data.resolution = "answered"
			break
		case "closed":
			if (!data.closed_at) {
				data.closed_at = fallbackTs
				synthesized = true
			}
			if (!data.closed_by) data.closed_by = "manual_close"
			break
		case "rejected":
			if (!data.rejected_at) {
				data.rejected_at = fallbackTs
				synthesized = true
			}
			break
		case "pending":
		case "fixing":
		default:
			// drop the field; no synthesis needed (absence of closure signals
			// IS the open state)
			break
	}

	delete data.status
	writeFileSync(fbPath, matter.stringify(parsed.content, data))
	return { migrated: true, closure_synthesized: synthesized }
}

/** Synthesize iterations[] for a unit that has populated reviews +
 *  approvals but an empty (or missing) iterations array. Mirrors the
 *  `set_unit_iterations` auto-synth path — one `{ hat, result: "advance" }`
 *  entry per hat in the stage's `hats:` sequence. The shape the cursor
 *  and force_stage_complete need to recognize the unit as terminal.
 *
 *  Why this lives in v8: issue #371. `reviews` and `approvals` are v4+
 *  signature shapes; `iterations[]` (plural) is also v4+. Native v4 units
 *  populate both in lockstep, so a pure v4-and-up unit should never hit
 *  this branch. The mismatch case is units that came through the v0-to-v4
 *  migration carrying a v3 `completed_at`: v0-to-v4 backfills
 *  `reviews`/`approvals` when `wasCompleted` is true, but v3 had no
 *  plural `iterations[]` to preserve (v3 stored a scalar `iteration: N`
 *  that v0-to-v4 drops as a deprecated field). Result: `iterations: []`
 *  on a unit the v3 engine considered done. The v4+ cursor reads
 *  iterations as the terminal-advance signal, so without this backfill
 *  the unit re-enters the execute loop forever.
 *
 *  The signature-presence heuristic is sound for that v3-completed path:
 *  populated `reviews` + `approvals` means a prior engine pass explicitly
 *  recorded sign-off, which is the same provenance the iteration entries
 *  would have carried. This is recovery of an audit trail v0-to-v4
 *  should have written, not fabrication of state. */
function backfillUnitIterations(
	unitPath: string,
	stage: string,
	studio: string,
): boolean {
	const raw = readFileSync(unitPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>

	const iterations = data.iterations
	const iterationsEmpty =
		iterations === undefined ||
		iterations === null ||
		(Array.isArray(iterations) && iterations.length === 0)
	if (!iterationsEmpty) return false

	const reviews = data.reviews
	const approvals = data.approvals
	const hasReviews =
		reviews !== null &&
		typeof reviews === "object" &&
		Object.keys(reviews as Record<string, unknown>).length > 0
	const hasApprovals =
		approvals !== null &&
		typeof approvals === "object" &&
		Object.keys(approvals as Record<string, unknown>).length > 0
	if (!hasReviews || !hasApprovals) return false

	const hats = resolveStageHats(studio, stage)
	if (hats.length === 0) return false

	// Best-effort timestamp: prefer approvals.user.at (the canonical
	// "this unit landed" stamp), fall back to any approval/review
	// timestamp, fall back to now. Synthesized entries all share the
	// same `at` (we can't reconstruct per-hat timestamps from approvals).
	const pickAt = (rec: unknown): string | null => {
		if (rec && typeof rec === "object") {
			const at = (rec as { at?: unknown }).at
			if (typeof at === "string" && at.length > 0) return at
		}
		return null
	}
	const approvalsRec = approvals as Record<string, unknown>
	const reviewsRec = reviews as Record<string, unknown>
	const at =
		pickAt(approvalsRec.user) ||
		Object.values(approvalsRec).map(pickAt).find(Boolean) ||
		Object.values(reviewsRec).map(pickAt).find(Boolean) ||
		new Date().toISOString()

	data.iterations = hats.map((hat) => ({
		hat,
		result: "advance",
		at,
		synthesized_by: "v7_to_v8_backfill",
	}))
	writeFileSync(unitPath, matter.stringify(parsed.content, data))
	return true
}

function migrateOneUnitFile(unitPath: string): boolean {
	const raw = readFileSync(unitPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>
	if (data.status === undefined) return false
	// Unit schema (unit.ts:5) explicitly says there is no status field.
	// If on-disk data has one, drop it — no synthesis needed since unit
	// position is fully derived from iterations / reviews / approvals
	// records and branch-merged state.
	delete data.status
	writeFileSync(unitPath, matter.stringify(parsed.content, data))
	return true
}

function walkFeedbackDirs(intentDir: string, outcome: SynthesisOutcome): void {
	const scopes: string[] = []
	const intentScope = join(intentDir, "feedback")
	if (existsSync(intentScope)) scopes.push(intentScope)
	const stagesDir = join(intentDir, "stages")
	if (existsSync(stagesDir)) {
		for (const entry of readdirSync(stagesDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue
			const fbDir = join(stagesDir, entry.name, "feedback")
			if (existsSync(fbDir)) scopes.push(fbDir)
		}
	}
	for (const scope of scopes) {
		for (const file of readdirSync(scope).filter((f) => f.endsWith(".md"))) {
			const r = migrateOneFeedbackFile(join(scope, file))
			if (r.migrated) {
				outcome.feedback_migrated++
				if (r.closure_synthesized) outcome.feedback_with_synthesized_closure++
			}
		}
	}
}

function walkUnitDirs(
	intentDir: string,
	studio: string,
	outcome: SynthesisOutcome,
): void {
	const stagesDir = join(intentDir, "stages")
	if (!existsSync(stagesDir)) return
	for (const stageEntry of readdirSync(stagesDir, { withFileTypes: true })) {
		if (!stageEntry.isDirectory()) continue
		const stage = stageEntry.name
		const unitsDir = join(stagesDir, stage, "units")
		if (!existsSync(unitsDir)) continue
		for (const file of readdirSync(unitsDir).filter((f) => f.endsWith(".md"))) {
			const unitPath = join(unitsDir, file)
			if (migrateOneUnitFile(unitPath)) outcome.units_migrated++
			// Backfill iterations[] AFTER the status strip — the backfill
			// reads the post-strip frontmatter shape.
			if (studio && backfillUnitIterations(unitPath, stage, studio)) {
				outcome.units_with_synthesized_iterations++
			}
		}
	}
}

export function v7ToV8(ctx: MigrationContext): MigrationStepDetails {
	const details = emptyMigrationDetails()
	const outcome: SynthesisOutcome = {
		feedback_migrated: 0,
		feedback_with_synthesized_closure: 0,
		units_migrated: 0,
		units_with_synthesized_iterations: 0,
	}

	// Read studio from intent.md up-front — the unit iteration backfill
	// needs it to resolve the per-stage hats sequence.
	let studio = ""
	const intentMdPath = join(ctx.intentDir, "intent.md")
	if (existsSync(intentMdPath)) {
		const data = matter(readFileSync(intentMdPath, "utf8")).data as Record<
			string,
			unknown
		>
		studio = typeof data.studio === "string" ? data.studio : ""
	}

	walkFeedbackDirs(ctx.intentDir, outcome)
	walkUnitDirs(ctx.intentDir, studio, outcome)
	details.feedback_migrated = outcome.feedback_migrated
	details.feedback_with_synthesized_closure =
		outcome.feedback_with_synthesized_closure
	details.units_migrated = outcome.units_migrated
	// Re-use the closest existing counter — there's no dedicated
	// `units_with_synthesized_iterations` field on the shared
	// MigrationStepDetails type (issue #371 was filed after that shape
	// shipped). Reuse `units_with_synthesized_approval` since both
	// flag "unit needed retroactive bookkeeping to align with current
	// engine expectations." The migration banner copy reads from this
	// counter and is already worded for that audience.
	details.units_with_synthesized_approval +=
		outcome.units_with_synthesized_iterations

	// Stamp plugin_version on intent.md.
	if (existsSync(intentMdPath)) {
		const raw = readFileSync(intentMdPath, "utf8")
		const parsed = matter(raw)
		const data = parsed.data as Record<string, unknown>
		const current =
			typeof data.plugin_version === "string" ? data.plugin_version : ""
		if (current !== TARGET_VERSION) {
			data.plugin_version = TARGET_VERSION
			writeFileSync(intentMdPath, matter.stringify(parsed.content, data))
			details.intent_md_migrated = true
		}
	}

	return details
}

registerMigrator(SOURCE_VERSION, TARGET_VERSION, v7ToV8)
