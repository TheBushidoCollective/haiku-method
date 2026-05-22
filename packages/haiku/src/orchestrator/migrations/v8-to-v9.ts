// orchestrator/migrations/v8-to-v9.ts — Premise-witness model cleanup.
//
// v9 collapses the drift subsystem to a single source of truth: the
// witness lives on the signed slot, and witnesses snapshot premises
// (unit body + declared inputs), not deliverables (outputs).
//
// What this migration does, per intent:
//
//   1. For every signed `reviews.<role>` slot on every unit, build an
//      `input_witnesses` block from the unit's current `inputs:` field.
//      Hash each input file/dir against current on-disk content — the
//      result becomes the new baseline. Without this, units migrated
//      to v9 would have no input drift coverage until the next sign
//      cycle.
//
//   2. Drop `approvals.<role>.witnesses` (the legacy output witness
//      map) from every unit. Outputs are no longer drift-detected —
//      see DRIFT-CLEANUP.md for the rationale. The approval stays
//      (it's the audit record of who signed); only the witness map
//      goes away.
//
//   3. Delete the dead drift-baseline sidecar files. Under the v9
//      model, witnesses live in unit/intent FM and nothing else is
//      needed. The deleted files are:
//        - `<intentDir>/drift-markers.json`        — assessment markers
//        - `<intentDir>/stages/<stage>/baseline.json`
//        - `<intentDir>/stages/<stage>/baseline-content/`
//        - `<intentDir>/stages/<stage>/.baseline-ack`
//        - `<intentDir>/stages/<stage>/baseline-thrash.json`
//
//   4. Stamp `plugin_version: 9.0.0` on intent.md.
//
// Idempotent: re-running on a v9-migrated intent is a no-op. The
// `input_witnesses` backfill skips slots that already have the block;
// the output-witnesses strip skips approvals without a `witnesses`
// field; the file deletions skip non-existent paths.

import {
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	emptyMigrationDetails,
	type MigrationContext,
	type MigrationStepDetails,
	registerMigrator,
} from "../migrate-registry.js"
import { resolveInputWitnesses } from "../workflow/sign-slot.js"

const SOURCE_VERSION = "8.0.0"
const TARGET_VERSION = "9.0.0"

interface V9Outcome {
	units_migrated: number
	review_slots_backfilled: number
	approval_slots_stripped: number
	drift_artifacts_deleted: number
	iterations_message_migrated: number
}

/** Migrate the legacy iteration `reason` field to the unified handoff
 *  `message` field. v9 records a handoff baton on every hat transition
 *  (advance AND reject) in `iterations[].message`; pre-v9 only rejects
 *  carried text, in `iterations[].reason`. Move it forward so the SPA /
 *  browse timeline and the next-hat dispatch read a single field. Leaves
 *  `message` alone when already present (idempotent); drops `reason`
 *  once copied. Returns the number of entries changed. */
function migrateIterationMessages(data: Record<string, unknown>): number {
	const iters = data.iterations
	if (!Array.isArray(iters)) return 0
	let migrated = 0
	for (const entry of iters) {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
		const rec = entry as Record<string, unknown>
		if (typeof rec.reason !== "string") continue
		if (rec.message === undefined && rec.reason.length > 0) {
			rec.message = rec.reason
		}
		delete rec.reason
		migrated++
	}
	return migrated
}

function migrateOneUnitFile(
	unitPath: string,
	intentDir: string,
	repoRoot: string,
	outcome: V9Outcome,
): boolean {
	const raw = readFileSync(unitPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>
	let changed = false

	const unitInputs = Array.isArray(data.inputs) ? (data.inputs as string[]) : []

	// (1) Backfill input_witnesses on every signed review slot.
	const reviews = data.reviews
	if (reviews && typeof reviews === "object" && !Array.isArray(reviews)) {
		const reviewsRec = reviews as Record<string, unknown>
		for (const [, slot] of Object.entries(reviewsRec)) {
			if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue
			const slotRec = slot as Record<string, unknown>
			// Only backfill signed slots (have `at`). Unsigned placeholders
			// stay untouched.
			if (typeof slotRec.at !== "string" || slotRec.at.length === 0) continue
			// Skip if input_witnesses already present (idempotent re-run).
			if (slotRec.input_witnesses !== undefined) continue
			const witnesses = resolveInputWitnesses({
				intentDir,
				repoRoot,
				unitInputs,
			})
			// `slotRec` IS `reviewsRec[role]` (same object reference) —
			// mutating it writes through; no re-assignment needed.
			slotRec.input_witnesses = witnesses
			outcome.review_slots_backfilled++
			changed = true
		}
	}

	// (2) Strip approvals.<role>.witnesses from every slot. Approvals
	// become bookkeeping-only — they keep `at` but lose the output
	// witness map.
	const approvals = data.approvals
	if (approvals && typeof approvals === "object" && !Array.isArray(approvals)) {
		const approvalsRec = approvals as Record<string, unknown>
		for (const [, slot] of Object.entries(approvalsRec)) {
			if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue
			const slotRec = slot as Record<string, unknown>
			if (slotRec.witnesses === undefined) continue
			// `slotRec` IS `approvalsRec[role]` — the delete mutates in
			// place; no re-assignment needed.
			delete slotRec.witnesses
			outcome.approval_slots_stripped++
			changed = true
		}
	}

	// (3) Migrate legacy iteration `reason` → unified `message`.
	const itersMigrated = migrateIterationMessages(data)
	if (itersMigrated > 0) {
		outcome.iterations_message_migrated += itersMigrated
		changed = true
	}

	if (!changed) return false
	writeFileSync(unitPath, matter.stringify(parsed.content, data))
	return true
}

/** Migrate iteration `reason` → `message` on every feedback file in the
 *  intent (stage-scope + intent-scope). FB fix-hat iterations carry the
 *  same handoff baton as unit iterations. */
function migrateFeedbackIterations(
	intentDir: string,
	outcome: V9Outcome,
): void {
	const dirs: string[] = [join(intentDir, "feedback")]
	const stagesDir = join(intentDir, "stages")
	if (existsSync(stagesDir)) {
		for (const stageEntry of readdirSync(stagesDir, { withFileTypes: true })) {
			if (!stageEntry.isDirectory()) continue
			dirs.push(join(stagesDir, stageEntry.name, "feedback"))
		}
	}
	for (const dir of dirs) {
		if (!existsSync(dir)) continue
		for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
			const fbPath = join(dir, file)
			const raw = readFileSync(fbPath, "utf8")
			const parsed = matter(raw)
			const data = parsed.data as Record<string, unknown>
			const migrated = migrateIterationMessages(data)
			if (migrated > 0) {
				outcome.iterations_message_migrated += migrated
				writeFileSync(fbPath, matter.stringify(parsed.content, data))
			}
		}
	}
}

function deleteIfExists(path: string, outcome: V9Outcome): void {
	if (!existsSync(path)) return
	try {
		const st = statSync(path)
		if (st.isDirectory()) {
			rmSync(path, { recursive: true, force: true })
		} else {
			rmSync(path, { force: true })
		}
		outcome.drift_artifacts_deleted++
	} catch {
		// Non-fatal — corrupt FS state shouldn't block the migration.
	}
}

function purgeDriftArtifacts(intentDir: string, outcome: V9Outcome): void {
	// Intent-scope marker store.
	deleteIfExists(join(intentDir, "drift-markers.json"), outcome)

	// Per-stage baseline state + legacy gate-session sidecar.
	const stagesDir = join(intentDir, "stages")
	if (!existsSync(stagesDir)) return
	for (const stageEntry of readdirSync(stagesDir, { withFileTypes: true })) {
		if (!stageEntry.isDirectory()) continue
		const stageDir = join(stagesDir, stageEntry.name)
		deleteIfExists(join(stageDir, "baseline.json"), outcome)
		deleteIfExists(join(stageDir, "baseline-content"), outcome)
		deleteIfExists(join(stageDir, ".baseline-ack"), outcome)
		deleteIfExists(join(stageDir, "baseline-thrash.json"), outcome)
		// Pre-v9 user-gate path wrote a per-stage gate-session.json
		// sidecar. It had no readers — gate session pointers actually
		// live on intent.md frontmatter (gate_review_session_<stage>
		// keys, written by haiku_run_next). Delete any leftover files.
		deleteIfExists(join(stageDir, "gate-session.json"), outcome)
	}
}

function deriveRepoRoot(intentDir: string): string {
	// Mirrors sign-slot.ts's resolution — peel <slug>/intents/.haiku
	// off the intent dir to land at the repo root.
	return join(intentDir, "..", "..", "..")
}

export function v8ToV9(ctx: MigrationContext): MigrationStepDetails {
	const details = emptyMigrationDetails()
	const outcome: V9Outcome = {
		units_migrated: 0,
		review_slots_backfilled: 0,
		approval_slots_stripped: 0,
		drift_artifacts_deleted: 0,
		iterations_message_migrated: 0,
	}

	const repoRoot = deriveRepoRoot(ctx.intentDir)

	// Walk every unit file and migrate FM (reviews backfill + approvals
	// strip).
	const stagesDir = join(ctx.intentDir, "stages")
	if (existsSync(stagesDir)) {
		for (const stageEntry of readdirSync(stagesDir, { withFileTypes: true })) {
			if (!stageEntry.isDirectory()) continue
			const unitsDir = join(stagesDir, stageEntry.name, "units")
			if (!existsSync(unitsDir)) continue
			for (const file of readdirSync(unitsDir).filter((f) =>
				f.endsWith(".md"),
			)) {
				const unitPath = join(unitsDir, file)
				if (migrateOneUnitFile(unitPath, ctx.intentDir, repoRoot, outcome)) {
					outcome.units_migrated++
				}
			}
		}
	}

	// Migrate feedback iteration `reason` → `message` (units handled in
	// migrateOneUnitFile above).
	migrateFeedbackIterations(ctx.intentDir, outcome)

	// Delete dead drift-baseline sidecar files.
	purgeDriftArtifacts(ctx.intentDir, outcome)

	details.units_migrated = outcome.units_migrated
	details.drift_artifacts_deleted = outcome.drift_artifacts_deleted
	details.review_slots_backfilled = outcome.review_slots_backfilled
	details.approval_slots_stripped = outcome.approval_slots_stripped
	details.iterations_message_migrated = outcome.iterations_message_migrated

	// Stamp plugin_version on intent.md.
	const intentMdPath = join(ctx.intentDir, "intent.md")
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

registerMigrator(SOURCE_VERSION, TARGET_VERSION, v8ToV9)
