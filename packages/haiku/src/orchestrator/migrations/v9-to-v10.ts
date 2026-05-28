// orchestrator/migrations/v9-to-v10.ts — Canonical intent.stages cleanup.
//
// The 9.x → 10.0.0 bump removed the `skip_stages` deny-list: `intent.stages`
// is now the single canonical, materialized stage plan (the studio's `stages:`
// is the superset template; the intent owns the live list). "What got dropped"
// is `studio.stages − intent.stages` — no second filter.
//
// What this migrator does to each intent.md:
//   1. Strip the dead `skip_stages` field if present.
//   2. Materialize `stages` if it's missing/empty — compute the effective
//      plan via resolveIntentStages (which, pre-migration, still honored the
//      old skip_stages deny-list, so the materialized list reflects whatever
//      the intent was actually walking). Most v9 intents already carry a
//      materialized `stages` (stamped at haiku_select_mode), so this branch is
//      a backfill for the rare legacy intent that lacked it.
//   3. Idempotent stamp of plugin_version: "10.0.0".
//
// No-op when neither skip_stages is present nor stages needs backfilling and
// the version is already current.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	emptyMigrationDetails,
	type MigrationContext,
	type MigrationStepDetails,
	registerMigrator,
} from "../migrate-registry.js"
import { resolveStudioStages } from "../studio.js"

const SOURCE_VERSION = "9.0.0"
const TARGET_VERSION = "10.0.0"

export function v9ToV10(ctx: MigrationContext): MigrationStepDetails {
	const details = emptyMigrationDetails()
	const intentMdPath = join(ctx.intentDir, "intent.md")
	if (!existsSync(intentMdPath)) return details
	const raw = readFileSync(intentMdPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>
	const current =
		typeof data.plugin_version === "string" ? data.plugin_version : ""

	let changed = false

	// 1. Materialize stages BEFORE stripping skip_stages, honoring the OLD
	//    deny-list semantics inline. resolveIntentStages no longer applies
	//    skip_stages (Phase 3 removed it), so materializing through it would
	//    silently re-add stages a legacy intent had skipped. Replicate the
	//    pre-removal filter here: studio stages, minus skip_stages. This branch
	//    only fires when there's no materialized `stages` yet (pre-haiku_select_mode
	//    era), so there's no existing allow-list to intersect with — the deny-list
	//    (skip_stages) is the only filter that applies.
	const hasStages =
		Array.isArray(data.stages) && (data.stages as unknown[]).length > 0
	if (!hasStages && typeof data.studio === "string" && data.studio) {
		const studioStages = resolveStudioStages(data.studio)
		const skip = Array.isArray(data.skip_stages)
			? (data.skip_stages as unknown[]).filter(
					(s): s is string => typeof s === "string",
				)
			: []
		const materialized = studioStages.filter((s) => !skip.includes(s))
		if (materialized.length > 0) {
			data.stages = materialized
			changed = true
		}
	}

	// 2. Strip the dead skip_stages field.
	if ("skip_stages" in data) {
		delete data.skip_stages
		changed = true
	}

	if (current === TARGET_VERSION && !changed) {
		return details
	}
	data.plugin_version = TARGET_VERSION
	writeFileSync(intentMdPath, matter.stringify(parsed.content, data))
	details.intent_md_migrated = true
	return details
}

registerMigrator(SOURCE_VERSION, TARGET_VERSION, v9ToV10)
