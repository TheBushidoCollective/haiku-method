// orchestrator/migrations/v4-to-v5.ts — Schema-noop migrator for the
// 4.x → 5.0.0 plugin bump.
//
// Why this exists:
//   The 5.0.0 release (commit 8c2698680, 2026-05-13) was an
//   auto-generated major-version bump triggered by the `/haiku:reset`
//   skill split (`/haiku:reset` → `/haiku:reset-stage` +
//   `/haiku:reset-intent`). That's a USER-FACING breaking change at
//   the slash-command level — none of the on-disk schemas changed.
//   Intent FM, unit FM, FB FM, stage state are all forward-compatible
//   from any 4.x build to 5.0.0.
//
//   But the migration registry doesn't know that. `runWorkflowTick`'s
//   `sourceMajor !== targetMajor` gate fires for every 4.x intent on
//   5.0.0 → calls `migrateIntent("4.0.0", "5.0.0")` → no edge
//   registered → throws → engine surfaces "Migration from
//   plugin_version='4.0.0' to '5.0.0' failed: no migration path
//   from 4.0.0 to 5.0.0" and refuses to advance.
//
//   Reported 2026-05-13 from a session running 5.0.0 against the
//   `location-timesheet-summary` and `addon-pricing-tiers` intents
//   (both authored on 4.0.0): the agent's diagnosis was "downgrade
//   haiku to the last 4.x" because no fix was reachable from the
//   user side. The fix is a schema-noop migrator registered on this
//   exact edge.
//
// What the migrator does:
//   1. Read intent.md.
//   2. If plugin_version is already "5.0.0", no-op (idempotent —
//      a future re-run on a stamped intent stays clean).
//   3. Otherwise, stamp `plugin_version: "5.0.0"`. No FM transforms,
//      no file moves, no field deletions — 5.0.0 reads every 4.x
//      shape unchanged.
//
//   The "Migrated intent ..." banner from run-tick.ts still surfaces
//   to the agent so it sees a clean "0 units migrated, 0 stamps
//   synthesized" report — confirming the bump was a no-op rather
//   than the engine silently mutating state behind the user.
//
// What happens at the NEXT 5.x major bump:
//   Add a similar file (`v5-to-v6.ts`) registering an explicit edge.
//   If the bump genuinely changes a schema, that migrator does the
//   transform; if it's another user-facing-only bump like this one,
//   it's a stamp-only no-op like below. Either way, the registry
//   never has a missing edge for an active build.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	emptyMigrationDetails,
	type MigrationContext,
	type MigrationStepDetails,
	registerMigrator,
} from "../migrate-registry.js"

const SOURCE_VERSION = "4.0.0"
const TARGET_VERSION = "5.0.0"

export function v4ToV5(ctx: MigrationContext): MigrationStepDetails {
	const details = emptyMigrationDetails()
	const intentMdPath = join(ctx.intentDir, "intent.md")
	if (!existsSync(intentMdPath)) return details
	const raw = readFileSync(intentMdPath, "utf8")
	const parsed = matter(raw)
	const data = parsed.data as Record<string, unknown>
	const current =
		typeof data.plugin_version === "string" ? data.plugin_version : ""
	if (current === TARGET_VERSION) {
		// Already stamped — caller's findChain would have returned an
		// empty chain in this case, so we shouldn't actually be invoked.
		// Defensive: stay a no-op.
		return details
	}
	data.plugin_version = TARGET_VERSION
	writeFileSync(intentMdPath, matter.stringify(parsed.content, data))
	details.intent_md_migrated = true
	return details
}

// Register the schema-noop edge. The migrator stamps the new version
// onto intent.md and returns; no other state is touched.
registerMigrator(SOURCE_VERSION, TARGET_VERSION, v4ToV5)
