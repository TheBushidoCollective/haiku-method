// orchestrator/workflow/purge-dead-sidecars.ts — Idempotent per-tick
// cleanup of engine-internal sidecar files that no longer have any
// reader or writer under the current model.
//
// Why this lives outside the migration system: the v8→v9 migration
// only fires when an intent's `plugin_version` differs from the
// running plugin's. If a file shows up on a v9-already-stamped intent
// (e.g. a downgrade-upgrade cycle, a stage merge from an old branch,
// a stray hand-written file), the migration won't re-run and the
// stale sidecar lingers forever.
//
// This sweep fires on every `runWorkflowTick` regardless of version.
// It only touches files in a known dead-list — never anything the
// engine or agents legitimately produce. Each entry has a comment
// explaining why it's safe to remove.

import { existsSync, readdirSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"

/** Files / directories at `<intentDir>/` that have no writer or reader
 *  under the v9 premise-witness model. Safe to remove on every tick. */
const INTENT_SCOPE_DEAD: ReadonlyArray<string> = [
	// Drift assessment markers — replaced by walking open drift FBs.
	"drift-markers.json",
]

/** Files / directories at `<intentDir>/stages/<stage>/` that have no
 *  writer or reader under the v9 model. */
const STAGE_SCOPE_DEAD: ReadonlyArray<string> = [
	// Premise witnesses live on the signed slot's FM. No baseline.json
	// is written by any v9 code path.
	"baseline.json",
	// Same reason; content sidecars are no longer produced.
	"baseline-content",
	// V-11 corruption-recovery flow removed alongside baseline.json.
	".baseline-ack",
	"baseline-thrash.json",
	// Pre-v9 user-gate path wrote this sidecar. It had no readers —
	// gate session pointers actually live on intent.md frontmatter
	// (gate_review_session_<stage> keys, written by haiku_run_next).
	"gate-session.json",
]

function tryDelete(path: string): void {
	if (!existsSync(path)) return
	try {
		const st = statSync(path)
		if (st.isDirectory()) {
			rmSync(path, { recursive: true, force: true })
		} else {
			rmSync(path, { force: true })
		}
	} catch {
		// Non-fatal — corrupt FS state shouldn't block the tick.
	}
}

/** Sweep an intent dir for known-dead engine sidecars. Idempotent
 *  and cheap (file-existence checks against a small known list).
 *  Returns the count of paths actually deleted, for callers that want
 *  to log/telemetry. */
export function purgeDeadSidecars(intentDir: string): number {
	let deleted = 0
	const before = new Set<string>()
	for (const name of INTENT_SCOPE_DEAD) {
		const p = join(intentDir, name)
		if (existsSync(p)) before.add(p)
		tryDelete(p)
	}
	const stagesDir = join(intentDir, "stages")
	if (existsSync(stagesDir)) {
		let stageEntries: string[] = []
		try {
			stageEntries = readdirSync(stagesDir)
		} catch {
			stageEntries = []
		}
		for (const name of stageEntries) {
			const stageDir = join(stagesDir, name)
			let isDir = false
			try {
				isDir = statSync(stageDir).isDirectory()
			} catch {
				continue
			}
			if (!isDir) continue
			for (const file of STAGE_SCOPE_DEAD) {
				const p = join(stageDir, file)
				if (existsSync(p)) before.add(p)
				tryDelete(p)
			}
		}
	}
	for (const p of before) {
		if (!existsSync(p)) deleted++
	}
	return deleted
}
