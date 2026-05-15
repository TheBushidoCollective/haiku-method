// orchestrator/migrations/v6-to-v7.ts — Schema-noop migrator for the
// 6.x → 7.0.0 plugin bump.
//
// Why this exists:
//   The 7.0.0 release was an auto-bump triggered by Pass 2 (Claude
//   haiku) of `determine-bump-type.sh` mis-classifying PR #364 as a
//   major change. PR #364 was a small bot-comment fix-up plus the
//   v5→v6 catch-up migrator file — `vN-to-v(N+1).ts` filenames look
//   to the classifier like a major-version cut, even when the major
//   already happened on the previous merge. The classifier doesn't
//   read the current version, so it can't tell "we're cutting v7 and
//   adding the migrator at the same time" from "v7 already shipped
//   and this is the catch-up edge."
//
//   Net effect: 6.x → 7.0.0 is a schema-noop. None of the on-disk
//   shapes changed between 6.x and 7.0.0.
//
//   Mirrors the v4-to-v5 / v5-to-v6 pattern documented in
//   v4-to-v5.ts.
//
// What the migrator does:
//   Same as v4-to-v5.ts / v5-to-v6.ts: read intent.md, idempotent
//   stamp of `plugin_version: "7.0.0"`, no FM transforms, no field
//   deletions.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	emptyMigrationDetails,
	type MigrationContext,
	type MigrationStepDetails,
	registerMigrator,
} from "../migrate-registry.js"

const SOURCE_VERSION = "6.0.0"
const TARGET_VERSION = "7.0.0"

export function v6ToV7(ctx: MigrationContext): MigrationStepDetails {
	const details = emptyMigrationDetails()
	const intentMdPath = join(ctx.intentDir, "intent.md")
	if (!existsSync(intentMdPath)) return details
	const raw = readFileSync(intentMdPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>
	const current =
		typeof data.plugin_version === "string" ? data.plugin_version : ""
	if (current === TARGET_VERSION) {
		return details
	}
	data.plugin_version = TARGET_VERSION
	writeFileSync(intentMdPath, matter.stringify(parsed.content, data))
	details.intent_md_migrated = true
	return details
}

registerMigrator(SOURCE_VERSION, TARGET_VERSION, v6ToV7)
