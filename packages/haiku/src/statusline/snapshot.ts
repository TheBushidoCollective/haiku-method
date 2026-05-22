// statusline/snapshot.ts — persisted statusline POSITION.
//
// The status line used to re-derive the cursor live on every refresh. That
// runs out-of-band from the agent's own loop, so the moment a tool changes
// disk state (e.g. a review agent files feedback) the live walk would jump
// to the NEXT action — showing "fix-loop" before the agent has actually
// picked it up. Reported 2026-05-20.
//
// Fix: the engine persists the action it actually DISPATCHED (in
// `broadcastTick`, the single tick commit point) and the status line reads
// THAT instead of re-deriving. So the line reflects what the agent is doing
// now, not what the cursor predicts next. The per-hat/unit bars stay
// dynamic — read live from disk against the persisted position's stage — so
// within a phase the bars still move; only the POSITION is frozen until the
// next tick. On a cold start (no snapshot) the status line falls back to a
// live derive ("compute on boot").
//
// Storage: `~/.haiku/projects/<key>/intents/<slug>/statusline.json` via the
// shared `intentRuntimeStatePath` helper — the same home-dir runtime tree
// the deadlock detector uses. Deliberately NOT the project `.haiku/`: the
// engine ticks in the main tree while the status line CLI runs from the
// user's terminal cwd (and unit work happens in linked worktrees); that
// helper resolves all of them back to one project key, so writer and reader
// agree, and it never touches git. Tests redirect it with HAIKU_PROJECTS_ROOT.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { intentRuntimeStatePath } from "../subagent-prompt-file.js"

const SNAPSHOT_FILE = "statusline.json"

export interface StatuslineSnapshot {
	/** The intent the snapshot is for — guards against reading a snapshot
	 *  written for a different active intent. */
	intent: string
	/** The dispatched cursor action (serialized). Read back as the
	 *  position the status line renders. */
	action: unknown
	/** ISO timestamp of the dispatch — for debugging / future staleness. */
	at: string
}

/** Persist the dispatched action for an intent. Best-effort: any failure
 *  is swallowed — the status line just falls back to a live derive. */
export function writeStatuslineSnapshot(slug: string, action: unknown): void {
	try {
		const path = intentRuntimeStatePath(slug, SNAPSHOT_FILE)
		const snapshot: StatuslineSnapshot = {
			intent: slug,
			action: action ?? null,
			at: new Date().toISOString(),
		}
		writeFileSync(path, JSON.stringify(snapshot))
	} catch {
		/* best-effort — never let snapshotting break a tick */
	}
}

/** Read the persisted snapshot for an intent, or null when absent /
 *  unreadable / written for a different intent. Defensive parse: a
 *  malformed or mismatched snapshot reads as null so the caller derives
 *  live (cold-start / boot path). */
export function readStatuslineSnapshot(
	slug: string,
): StatuslineSnapshot | null {
	try {
		const path = intentRuntimeStatePath(slug, SNAPSHOT_FILE)
		if (!existsSync(path)) return null
		const parsed = JSON.parse(readFileSync(path, "utf8")) as StatuslineSnapshot
		if (!parsed || typeof parsed !== "object") return null
		if (parsed.intent !== slug) return null
		return parsed
	} catch {
		return null
	}
}
