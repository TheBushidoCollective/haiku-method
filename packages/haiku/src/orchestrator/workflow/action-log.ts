// orchestrator/workflow/action-log.ts — Per-tick action log.
//
// Responsibilities:
//   - `appendActionLogEntry(intentDir, tickCounter, entry)` — append an
//     `ActionLogEntry` to the intent-scope action log under the
//     shared per-file mutex (FB-28 atomicity model).
//   - `readActionLogForTick(intentDir, tickCounter)` — return entries for
//     a given tick counter; surfaces malformed-line counts to callers
//     so silent JSON-parse failures can no longer mask tampering /
//     interleaved-writer corruption (FB-28 fail-closed model).
//   - `findActionLogEntryForPath(entries, pathRel)` — return the most
//     recent entry for a file path, or null.
//
// Storage: a single intent-scope JSONL file at
//   `.haiku/intents/{slug}/action-log.jsonl`
// Each line is a complete `ActionLogEntry` JSON object. The entry carries
// its own `tick_counter` so the file is a unified append-only log that
// can be filtered by tick. The drift-detection gate calls
// `readActionLogForTick` to distinguish `human-via-mcp` from
// `human-implicit` writes (ARCHITECTURE.md §6.2).
//
// FB-28 atomicity model: appends share the per-file mutex defined in
// `write-audit.ts` (`appendJsonlLineGuarded`) so concurrent SPA upload,
// MCP `haiku_human_write`, and drift-baseline writers cannot interleave
// bytes on the action log. The on-disk record size is bounded by
// `MAX_AUDIT_RECORD_BYTES` and per-field caps in `write-audit.ts`.
//
// No new external dependencies: node:fs/promises only.

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { type ActionLogEntry, appendJsonlLineGuarded } from "./write-audit.js"

// Re-export so callers can import the type from either module.
export type { ActionLogEntry } from "./write-audit.js"

// ── Path helper ────────────────────────────────────────────────────────────

/** Returns the absolute path of the action log for an intent directory. */
export function actionLogPath(intentDir: string): string {
	return join(intentDir, "action-log.jsonl")
}

// ── Append ─────────────────────────────────────────────────────────────────

/** Append an `ActionLogEntry` to the intent-scope action log via the
 *  shared per-file mutex + bounded-record path
 *  (`appendJsonlLineGuarded`). The entry's `tick_counter` field is used
 *  for per-tick filtering by `readActionLogForTick`. Parent directories
 *  are created if absent (handled inside the guarded append).
 *
 *  Returns `{ ok: true }` on success or `{ ok: false, reason: string }`
 *  on failure (including `record_too_large` when the serialised entry
 *  exceeds `MAX_AUDIT_RECORD_BYTES`). Never throws. */
export async function appendActionLogEntry(
	intentDir: string,
	_tickCounter: number,
	entry: ActionLogEntry,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	const filePath = actionLogPath(intentDir)
	const line = JSON.stringify(entry)
	return appendJsonlLineGuarded(filePath, line)
}

// ── Read ───────────────────────────────────────────────────────────────────

/** Read result for a per-tick action-log scan.
 *
 *  `entries` are the validly-parsed `ActionLogEntry` rows for the
 *  requested tick. `malformedCount` is the number of non-blank lines in
 *  the on-disk file that failed to JSON-parse — a non-zero value signals
 *  either tampering or interleaved-writer corruption and MUST cause the
 *  caller to fail closed (refuse to advance the drift gate, surface a
 *  baseline-corruption marker, etc.). The legacy `readActionLogForTick`
 *  shape (a bare array) silently swallowed parse errors and let tampered
 *  lines vanish — see FB-28 §"Consequence". */
export interface ActionLogReadResult {
	entries: ActionLogEntry[]
	malformedCount: number
	/** Sample of the first malformed lines (capped at 5) for telemetry /
	 *  diagnostics. Never includes the entire line in case it carries
	 *  attacker-controlled bytes — clipped to 256 chars per sample. */
	malformedSamples: string[]
}

/** Maximum sample lines to retain when reporting malformed input. */
const MALFORMED_SAMPLE_CAP = 5
/** Maximum bytes per malformed sample line (clipped). */
const MALFORMED_SAMPLE_BYTES = 256

/** Read all action-log entries for a given tick counter. Returns an
 *  `ActionLogReadResult` so callers can detect malformed lines and fail
 *  closed.
 *
 *  Lines that are not valid JSON or do not parse as `ActionLogEntry`
 *  are EXCLUDED from `entries` AND counted in `malformedCount`. The
 *  prior implementation silently swallowed parse failures via
 *  `catch { /* skip *​/ }`, which let tampering or concurrent-writer
 *  corruption mask itself: a `human-via-mcp` write whose action-log
 *  entry was corrupted on disk would be reattributed to
 *  `human-implicit` by the drift gate (FB-28 §"Consequence"). */
export async function readActionLogForTick(
	intentDir: string,
	tickCounter: number,
): Promise<ActionLogReadResult> {
	const filePath = actionLogPath(intentDir)

	let raw: string
	try {
		raw = await readFile(filePath, "utf-8")
	} catch {
		// File may not exist yet — that's normal on the first tick.
		return { entries: [], malformedCount: 0, malformedSamples: [] }
	}

	const entries: ActionLogEntry[] = []
	const malformedSamples: string[] = []
	let malformedCount = 0
	for (const line of raw.split("\n")) {
		const trimmed = line.trim()
		if (!trimmed) continue
		try {
			const parsed = JSON.parse(trimmed) as ActionLogEntry
			if (parsed.tick_counter === tickCounter) {
				entries.push(parsed)
			}
		} catch {
			malformedCount++
			if (malformedSamples.length < MALFORMED_SAMPLE_CAP) {
				malformedSamples.push(trimmed.slice(0, MALFORMED_SAMPLE_BYTES))
			}
		}
	}
	return { entries, malformedCount, malformedSamples }
}

// ── Query ──────────────────────────────────────────────────────────────────

/** Return the most recent `ActionLogEntry` for a given file path from a
 *  pre-loaded entry list, or `null` if none exists.
 *
 *  "Most recent" is determined by array order: the last matching entry in
 *  the list wins. Callers that need cross-tick ordering should sort entries
 *  by timestamp before calling this function; within a single tick, array
 *  order (insertion order from the append log) is sufficient. */
export function findActionLogEntryForPath(
	entries: ActionLogEntry[],
	pathRel: string,
): ActionLogEntry | null {
	let result: ActionLogEntry | null = null
	for (const entry of entries) {
		if (entry.path === pathRel) {
			result = entry
		}
	}
	return result
}
