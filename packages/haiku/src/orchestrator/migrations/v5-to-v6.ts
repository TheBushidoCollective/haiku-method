// orchestrator/migrations/v5-to-v6.ts — Schema-noop migrator for the
// 5.x → 6.0.0 plugin bump.
//
// Why this exists:
//   The 6.0.0 release was a user-facing-only major bump. None of the
//   on-disk schemas changed — intent.md FM, unit FM, FB FM, and stage
//   state are all forward-compatible from any 5.x build to 6.0.0.
//
//   But the migration registry doesn't know that. `runWorkflowTick`'s
//   `sourceMajor !== targetMajor` gate fires for every 5.x intent on
//   6.0.0 → calls `migrateIntent("5.0.0", "6.0.0")` → no edge
//   registered → throws → engine surfaces "Migration from
//   plugin_version='5.0.0' to '6.0.0' failed: no migration path
//   from 5.0.0 to 6.0.0" and refuses to advance.
//
//   Mirrors the v4-to-v5.ts pattern documented there.
//
// What the migrator does:
//   Same as v4-to-v5.ts: read intent.md, idempotent stamp of
//   `plugin_version: "6.0.0"`, no FM transforms, no field deletions.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	emptyMigrationDetails,
	type MigrationContext,
	type MigrationStepDetails,
	registerMigrator,
} from "../migrate-registry.js"

const SOURCE_VERSION = "5.0.0"
const TARGET_VERSION = "6.0.0"

export function v5ToV6(ctx: MigrationContext): MigrationStepDetails {
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

registerMigrator(SOURCE_VERSION, TARGET_VERSION, v5ToV6)
