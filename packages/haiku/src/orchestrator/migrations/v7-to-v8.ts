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

const SOURCE_VERSION = "7.0.0"
const TARGET_VERSION = "8.0.0"

interface SynthesisOutcome {
	feedback_migrated: number
	feedback_with_synthesized_closure: number
	units_migrated: number
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

function walkUnitDirs(intentDir: string, outcome: SynthesisOutcome): void {
	const stagesDir = join(intentDir, "stages")
	if (!existsSync(stagesDir)) return
	for (const stageEntry of readdirSync(stagesDir, { withFileTypes: true })) {
		if (!stageEntry.isDirectory()) continue
		const unitsDir = join(stagesDir, stageEntry.name, "units")
		if (!existsSync(unitsDir)) continue
		for (const file of readdirSync(unitsDir).filter((f) => f.endsWith(".md"))) {
			if (migrateOneUnitFile(join(unitsDir, file))) outcome.units_migrated++
		}
	}
}

export function v7ToV8(ctx: MigrationContext): MigrationStepDetails {
	const details = emptyMigrationDetails()
	const outcome: SynthesisOutcome = {
		feedback_migrated: 0,
		feedback_with_synthesized_closure: 0,
		units_migrated: 0,
	}
	walkFeedbackDirs(ctx.intentDir, outcome)
	walkUnitDirs(ctx.intentDir, outcome)
	details.feedback_migrated = outcome.feedback_migrated
	details.feedback_with_synthesized_closure =
		outcome.feedback_with_synthesized_closure
	details.units_migrated = outcome.units_migrated

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

registerMigrator(SOURCE_VERSION, TARGET_VERSION, v7ToV8)
