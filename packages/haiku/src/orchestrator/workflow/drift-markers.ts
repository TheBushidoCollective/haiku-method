// orchestrator/workflow/drift-markers.ts — Pending-assessment marker store for
// the drift-detection subsystem.
//
// Responsibilities:
//   - `PendingMarker` type matching DATA-CONTRACTS.md §2.2 plus
//     `baseline_sha_at_creation` (ARCHITECTURE.md §5.2 / unit-02 spec §7).
//   - `readMarkers(intentDir)` — parse drift-markers.json at intent root.
//     Returns `{ markers: [] }` when absent (degraded-OK) or corrupt
//     (non-fatal warning; do NOT throw — ARCHITECTURE.md §8.4).
//   - `writeMarkers(intentDir, markers)` — atomic-rename write, canonical
//     JSON identical to writeBaseline.
//   - `appendMarker(intentDir, marker)` — read-append-write with mutual-
//     exclusion invariant (DATA-CONTRACTS.md §2.2).
//   - `findOpenMarker(markers, pathRel)` — newest open marker or null.
//   - `clearMarker(intentDir, pathRel, resolvedSha, trigger)` — sets
//     cleared_at + resolved_sha atomically; validates (outcome, trigger)
//     legality matrix (DATA-CONTRACTS.md §4.4).
//   - `isStaleMarker(marker, currentSha)` — double-edit detection
//     (AC-EE6 / ARCHITECTURE.md §5.3).
//   - `removeMarker(intentDir, pathRel)` — deletes open markers for path.
//
// No new third-party dependencies: node:fs/promises, node:path, node:crypto only
// (plus the existing zod already in packages/haiku).

import { randomBytes } from "node:crypto"
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import { rename, unlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { z } from "zod"

// ── Error classes ──────────────────────────────────────────────────────────

/** Thrown by appendMarker when the mutual-exclusion invariant is violated:
 *  linked_feedback_id and linked_revisit_target_stage must be exactly one
 *  non-null (DATA-CONTRACTS.md §2.2). */
export class MarkerInvariantError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "MarkerInvariantError"
	}
}

/** Thrown by clearMarker when the trigger value does not match the marker's
 *  outcome per the legality matrix (DATA-CONTRACTS.md §4.4). */
export class TriggerOutcomeMismatchError extends Error {
	readonly outcome: string
	readonly trigger: string

	constructor(outcome: string, trigger: string) {
		super(
			`Trigger '${trigger}' is not valid for marker outcome '${outcome}'. ` +
				`'surface-as-feedback' accepts 'feedback-closed' and 'feedback-rejected'; ` +
				`'trigger-revisit' accepts only 'revisit-complete'.`,
		)
		this.name = "TriggerOutcomeMismatchError"
		this.outcome = outcome
		this.trigger = trigger
	}
}

// ── Types ──────────────────────────────────────────────────────────────────

export const MarkerOutcomeSchema = z.enum([
	"surface-as-feedback",
	"trigger-revisit",
])
export type MarkerOutcome = z.infer<typeof MarkerOutcomeSchema>

export const ClearTriggerSchema = z.enum([
	"feedback-closed",
	"feedback-rejected",
	"revisit-complete",
])
export type ClearTrigger = z.infer<typeof ClearTriggerSchema>

/** One pending-assessment marker — DATA-CONTRACTS.md §2.2 plus
 *  `baseline_sha_at_creation` (ARCHITECTURE.md §5.2 / unit-02 spec §7). */
export const PendingMarkerSchema = z.object({
	path: z.string(),
	created_at: z.string(),
	created_by_assessment_id: z.string(),
	outcome: MarkerOutcomeSchema,
	linked_feedback_id: z.string().nullable(),
	linked_revisit_target_stage: z.string().nullable(),
	cleared_at: z.string().nullable(),
	resolved_sha: z.string().nullable(),
	/** The SHA-256 of the file at creation time — used by isStaleMarker and
	 *  the drift gate to detect double-edits (ARCHITECTURE.md §5.3 / AC-EE6). */
	baseline_sha_at_creation: z.string(),
})
export type PendingMarker = z.infer<typeof PendingMarkerSchema>

/** The in-memory marker store. */
export interface MarkerStore {
	markers: PendingMarker[]
}

/** On-disk shape: a JSON object with a single `markers` array key. */
const MarkerStoreDiskSchema = z.object({
	markers: z.array(PendingMarkerSchema),
})

// ── Path helper ────────────────────────────────────────────────────────────

function markersPath(intentDir: string): string {
	return join(intentDir, "drift-markers.json")
}

// ── Read / write ───────────────────────────────────────────────────────────

/** Read the intent-scoped marker store from disk.
 *
 * Returns `{ markers: [] }` when the file does not exist — a missing file
 * is NOT corruption; it simply means no markers have been written yet
 * (ARCHITECTURE.md §8.4 / AC-EE).
 *
 * When the file exists but cannot be parsed or fails schema validation, logs
 * a non-fatal warning and returns `{ markers: [] }` — the marker store is a
 * suppression optimisation; degraded operation (re-emission without
 * suppression) is preferable to halting (ARCHITECTURE.md §8.4). */
export function readMarkers(
	intentDir: string,
	logger?: { warn: (msg: string) => void },
): MarkerStore {
	const filePath = markersPath(intentDir)

	if (!existsSync(filePath)) {
		return { markers: [] }
	}

	let raw: string
	try {
		raw = readFileSync(filePath, "utf-8")
	} catch (err) {
		const msg = `drift-markers.json could not be read at '${filePath}': ${err}. Returning empty marker store (degraded operation).`
		if (logger) {
			logger.warn(msg)
		} else {
			console.warn(`[drift-markers] ${msg}`)
		}
		return { markers: [] }
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch (err) {
		const msg = `drift-markers.json could not be parsed at '${filePath}': ${err}. Returning empty marker store (degraded operation).`
		if (logger) {
			logger.warn(msg)
		} else {
			console.warn(`[drift-markers] ${msg}`)
		}
		return { markers: [] }
	}

	const result = MarkerStoreDiskSchema.safeParse(parsed)
	if (!result.success) {
		const msg = `drift-markers.json failed schema validation at '${filePath}': ${result.error.message}. Returning empty marker store (degraded operation).`
		if (logger) {
			logger.warn(msg)
		} else {
			console.warn(`[drift-markers] ${msg}`)
		}
		return { markers: [] }
	}

	return { markers: result.data.markers }
}

/** Serialise the marker store to canonical JSON (2-space indent, trailing
 *  newline — identical to writeBaseline) and atomically rename a tempfile
 *  into place.
 *
 *  Atomicity: tempfile is created in the SAME directory as the target
 *  (same filesystem, POSIX rename(2) is atomic). */
export async function writeMarkers(
	intentDir: string,
	store: MarkerStore,
): Promise<void> {
	const targetPath = markersPath(intentDir)
	const targetDir = dirname(targetPath)

	mkdirSync(targetDir, { recursive: true })

	const diskObj = { markers: store.markers }
	const json = `${JSON.stringify(diskObj, null, 2)}\n`

	const tmpPath = join(
		targetDir,
		`.drift-markers-${process.pid}-${randomBytes(6).toString("hex")}.json.tmp`,
	)

	try {
		await writeFile(tmpPath, json, "utf-8")
		await rename(tmpPath, targetPath)
	} catch (err) {
		await unlink(tmpPath).catch(() => {})
		throw err
	}
}

/** Synchronous mirror of `writeMarkers` — atomic tempfile + renameSync into
 *  place. Used by the synchronous gate context (see `removeMarkerSync` /
 *  `removeMarkersSync`) to avoid fire-and-forget races where rapid successive
 *  ticks re-detect the same stale marker before the async removal completes. */
export function writeMarkersSync(intentDir: string, store: MarkerStore): void {
	const targetPath = markersPath(intentDir)
	const targetDir = dirname(targetPath)

	mkdirSync(targetDir, { recursive: true })

	const diskObj = { markers: store.markers }
	const json = `${JSON.stringify(diskObj, null, 2)}\n`

	const tmpPath = join(
		targetDir,
		`.drift-markers-${process.pid}-${randomBytes(6).toString("hex")}.json.tmp`,
	)

	try {
		writeFileSync(tmpPath, json, "utf-8")
		renameSync(tmpPath, targetPath)
	} catch (err) {
		try {
			unlinkSync(tmpPath)
		} catch {
			/* tempfile already gone or never created */
		}
		throw err
	}
}

// ── Append ─────────────────────────────────────────────────────────────────

/** Read → validate → append → write.
 *
 * Enforces the mutual-exclusion invariant from DATA-CONTRACTS.md §2.2:
 *   - Exactly one of `linked_feedback_id` / `linked_revisit_target_stage`
 *     must be non-null. Both null OR both non-null → MarkerInvariantError. */
export async function appendMarker(
	intentDir: string,
	marker: PendingMarker,
): Promise<void> {
	// Validate mutual-exclusion invariant.
	const hasFb = marker.linked_feedback_id !== null
	const hasRevisit = marker.linked_revisit_target_stage !== null
	if (hasFb === hasRevisit) {
		// Both null or both non-null — invariant violation.
		throw new MarkerInvariantError(
			`PendingMarker mutual-exclusion invariant violated: exactly one of ` +
				`linked_feedback_id and linked_revisit_target_stage must be non-null, ` +
				`but got linked_feedback_id=${JSON.stringify(marker.linked_feedback_id)} ` +
				`and linked_revisit_target_stage=${JSON.stringify(marker.linked_revisit_target_stage)}.`,
		)
	}

	const store = readMarkers(intentDir)
	store.markers.push(marker)
	await writeMarkers(intentDir, store)
}

// ── Find ───────────────────────────────────────────────────────────────────

/** Return the newest open marker (cleared_at === null) for a path, or null
 *  if no open marker exists.
 *
 *  "Newest" = latest created_at (ISO-8601 lexicographic sort). The drift
 *  gate uses this to decide suppression (ARCHITECTURE.md §5.3). */
export function findOpenMarker(
	store: MarkerStore,
	pathRel: string,
): PendingMarker | null {
	const openMarkers = store.markers.filter(
		(m) => m.path === pathRel && m.cleared_at === null,
	)
	if (openMarkers.length === 0) return null

	// Sort descending by created_at (ISO-8601 lexicographic order is date order).
	openMarkers.sort((a, b) => {
		if (a.created_at > b.created_at) return -1
		if (a.created_at < b.created_at) return 1
		return 0
	})

	return openMarkers[0]
}

// ── Clear ──────────────────────────────────────────────────────────────────

/** (outcome, trigger) legality matrix — DATA-CONTRACTS.md §4.4. */
const LEGALITY_MATRIX: Record<MarkerOutcome, Set<ClearTrigger>> = {
	"surface-as-feedback": new Set(["feedback-closed", "feedback-rejected"]),
	"trigger-revisit": new Set(["revisit-complete"]),
}

export type ClearMarkerResult =
	| { cleared: true; marker: PendingMarker }
	| { cleared: false; reason: "no_open_marker" }

/** Set cleared_at and resolved_sha atomically for the open marker on pathRel.
 *
 * Validates the (outcome, trigger) legality matrix:
 *   - 'surface-as-feedback' accepts 'feedback-closed' and 'feedback-rejected'.
 *   - 'trigger-revisit' accepts only 'revisit-complete'.
 *   Throws TriggerOutcomeMismatchError on mismatch.
 *
 * Returns { cleared: true, marker } on success.
 * Returns { cleared: false, reason: 'no_open_marker' } when no open marker
 * exists (idempotent retry safe — not an error). */
export async function clearMarker(
	intentDir: string,
	pathRel: string,
	resolvedSha: string,
	trigger: ClearTrigger,
): Promise<ClearMarkerResult> {
	const store = readMarkers(intentDir)

	// Find the newest open marker for this path.
	const openMarker = findOpenMarker(store, pathRel)
	if (openMarker === null) {
		return { cleared: false, reason: "no_open_marker" }
	}

	// Validate legality matrix before mutating.
	const allowed = LEGALITY_MATRIX[openMarker.outcome]
	if (!allowed.has(trigger)) {
		throw new TriggerOutcomeMismatchError(openMarker.outcome, trigger)
	}

	// Stamp cleared_at and resolved_sha atomically (both set in one write).
	const clearedAt = new Date().toISOString()
	const clearedMarker: PendingMarker = {
		...openMarker,
		cleared_at: clearedAt,
		resolved_sha: resolvedSha,
	}

	// Replace the open marker in the store with the cleared version.
	const updatedMarkers = store.markers.map((m) =>
		m === openMarker ? clearedMarker : m,
	)
	await writeMarkers(intentDir, { markers: updatedMarkers })

	return { cleared: true, marker: clearedMarker }
}

// ── Stale detection ────────────────────────────────────────────────────────

/** Returns true when the file's current SHA differs from the marker's
 *  baseline_sha_at_creation — indicating a double-edit has occurred
 *  (AC-EE6 / ARCHITECTURE.md §5.3). The gate uses this to detect that
 *  the marker is stale and should be removed. */
export function isStaleMarker(
	marker: PendingMarker,
	currentSha: string,
): boolean {
	return currentSha !== marker.baseline_sha_at_creation
}

// ── Remove ─────────────────────────────────────────────────────────────────

/** Delete any open marker for pathRel. Used by the gate when it detects a
 *  stale marker (isStaleMarker returns true). Writes the updated store
 *  atomically. No-op if no open marker exists for the path. */
export async function removeMarker(
	intentDir: string,
	pathRel: string,
): Promise<void> {
	const store = readMarkers(intentDir)
	const filtered = store.markers.filter(
		(m) => !(m.path === pathRel && m.cleared_at === null),
	)
	if (filtered.length === store.markers.length) {
		// No open marker to remove — no-op.
		return
	}
	await writeMarkers(intentDir, { markers: filtered })
}

/** Synchronous batch-remove of open markers for the given paths. Single
 *  read + single atomic write — preferred over fire-and-forget calls to
 *  `removeMarker` from the synchronous gate, which raced with subsequent
 *  ticks and re-emitted duplicate `manual_change_assessment` dispatches
 *  for the same file. No-op if no open marker matches any provided path. */
export function removeMarkersSync(
	intentDir: string,
	pathRels: readonly string[],
): void {
	if (pathRels.length === 0) return
	const targetPaths = new Set(pathRels)
	const store = readMarkers(intentDir)
	const filtered = store.markers.filter(
		(m) => !(targetPaths.has(m.path) && m.cleared_at === null),
	)
	if (filtered.length === store.markers.length) return
	writeMarkersSync(intentDir, { markers: filtered })
}
