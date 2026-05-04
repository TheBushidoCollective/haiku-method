// orchestrator/workflow/baseline-clear-marker.ts — Internal lifecycle handler
// that clears pending-assessment markers when their downstream actions
// resolve.
//
// Per DATA-CONTRACTS.md §4.4 / §6.3 and unit-09 spec:
//   - Trigger enum: "feedback-closed" | "feedback-rejected" | "revisit-complete".
//   - Validates the (outcome, trigger) legality matrix; returns
//     `trigger_outcome_mismatch` on mismatch.
//   - Reads the file's current SHA-256 from disk.
//   - In a single logical transaction, writes:
//       * PendingMarker.cleared_at = now()
//       * PendingMarker.resolved_sha = currentSha
//       * Baseline entry → (currentSha, currentBytes, currentMtimeNs, isBinary)
//         with author_class preserved (or default "human-implicit") and
//         acknowledged_via = "classification-terminal".
//   - Uses a tempfile-rename strategy so a crash mid-clear leaves either
//     both old files OR both new files (never one of each).
//   - Idempotent: when no open marker exists, returns
//     `{ ok: true, marker_cleared: false, reason: "no_open_marker" }`.
//   - DOES NOT modify the Assessment record. The post-clearance SHA lives
//     exclusively on PendingMarker.resolved_sha and the
//     `pending_marker_cleared` event payload.
//   - Emits a `pending_marker_cleared` event to the workflow event sink.
//
// Tool exposure (unit-09 §4 / DATA-CONTRACTS.md §4.4): `haiku_baseline_clear_marker`
// is INTERNAL-ONLY in v1 — exposed as a function in the workflow engine
// but NOT registered in the MCP tool registry. Only the feedback-lifecycle
// integration in state-tools.ts and the revisit-lifecycle integration in
// orchestrator/revisit.ts call it.
//
// API: all functions are exposed as both sync and async variants. The
// underlying I/O is synchronous (fs.writeFileSync, fs.renameSync) so the
// state-tools.ts and revisit.ts call sites — both fully synchronous —
// can call without await. The async variants are thin wrappers that
// resolve immediately and exist for callers that prefer async semantics
// or want to chain Promise.all with other async work.
//
// Spec references: ARCHITECTURE.md §5, DATA-CONTRACTS.md §2.1, §2.2, §4.4,
// §6.3, ACCEPTANCE-CRITERIA.md AC-G5 / AC-SF3 / AC-TR2.

import { randomBytes } from "node:crypto"
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { z } from "zod"
import { emitTelemetry } from "../../telemetry.js"
import {
	BaselineCorruptError,
	type BaselineEntry,
	BaselineEntrySchema,
	computeFileSha256Sync,
	isBinarySync,
} from "./drift-baseline.js"
import {
	type ClearTrigger,
	ClearTriggerSchema,
	findOpenMarker,
	type MarkerOutcome,
	type PendingMarker,
	readMarkers,
	TriggerOutcomeMismatchError,
} from "./drift-markers.js"

// ── Types ──────────────────────────────────────────────────────────────────

/** Result of clearMarkerForResolution. The `ok: true` discriminator is
 *  unconditional — even the no-open-marker idempotent case is success.
 *  Errors are surfaced via thrown exceptions (TriggerOutcomeMismatchError,
 *  BaselineCorruptError) rather than result variants, mirroring the
 *  drift-markers.ts convention. */
export type ClearMarkerForResolutionResult =
	| {
			ok: true
			marker_cleared: true
			baseline_updated: true
			resolved_sha: string
			path: string
			trigger: ClearTrigger
			assessment_id: string
			linked_feedback_id: string | null
			linked_revisit_target_stage: string | null
	  }
	| {
			ok: true
			marker_cleared: false
			baseline_updated: false
			reason: "no_open_marker"
	  }

/** Payload emitted via `emitTelemetry("haiku.drift.pending_marker_cleared")`
 *  matching DATA-CONTRACTS.md §6.3. */
export interface PendingMarkerClearedEvent {
	event_type: "pending_marker_cleared"
	event_at: string
	intent_slug: string
	path: string
	assessment_id: string
	trigger: ClearTrigger
	linked_feedback_id: string | null
	linked_revisit_target_stage: string | null
	resolved_sha: string
}

// ── Legality matrix — DATA-CONTRACTS.md §4.4 ──────────────────────────────

const LEGALITY_MATRIX: Record<MarkerOutcome, ReadonlySet<ClearTrigger>> = {
	"surface-as-feedback": new Set<ClearTrigger>([
		"feedback-closed",
		"feedback-rejected",
	]),
	"trigger-revisit": new Set<ClearTrigger>(["revisit-complete"]),
}

// ── Path helpers ───────────────────────────────────────────────────────────

function markersPath(intentDir: string): string {
	return join(intentDir, "drift-markers.json")
}

function baselinePath(intentDir: string, stage: string): string {
	return join(intentDir, "stages", stage, "baseline.json")
}

// ── On-disk schema (mirrors drift-baseline.ts) ─────────────────────────────

const BaselineDiskSchema = z.record(z.string(), BaselineEntrySchema)

// ── Baseline file helpers (raw read — no Map indirection) ─────────────────

interface BaselineDiskRecord {
	[path: string]: BaselineEntry
}

function readBaselineDisk(
	intentDir: string,
	stage: string,
): { exists: boolean; record: BaselineDiskRecord } {
	const filePath = baselinePath(intentDir, stage)
	if (!existsSync(filePath)) return { exists: false, record: {} }

	let raw: string
	try {
		raw = readFileSync(filePath, "utf-8")
	} catch (err) {
		throw new BaselineCorruptError(stage, err)
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch (err) {
		throw new BaselineCorruptError(stage, err)
	}

	const result = BaselineDiskSchema.safeParse(parsed)
	if (!result.success) {
		throw new BaselineCorruptError(stage, result.error)
	}

	return { exists: true, record: { ...result.data } }
}

function serializeBaselineDisk(record: BaselineDiskRecord): string {
	const sortedKeys = Object.keys(record).sort()
	const sorted: BaselineDiskRecord = {}
	for (const k of sortedKeys) sorted[k] = record[k]
	return `${JSON.stringify(sorted, null, 2)}\n`
}

function serializeMarkerStore(markers: PendingMarker[]): string {
	return `${JSON.stringify({ markers }, null, 2)}\n`
}

function safeUnlinkSync(path: string): void {
	try {
		unlinkSync(path)
	} catch {
		// Ignore — tempfile may not exist.
	}
}

// ── Stage resolution ───────────────────────────────────────────────────────

/** Find which stage's baseline.json owns a tracked path. Returns null if
 *  no baseline contains an entry for the path. The first matching stage
 *  wins; per DATA-CONTRACTS.md §2.1 a path is unique per intent so at most
 *  one stage's baseline contains any given path. */
function findOwningStage(
	intentDir: string,
	pathRel: string,
): { stage: string; record: BaselineDiskRecord } | null {
	const stagesDir = join(intentDir, "stages")
	if (!existsSync(stagesDir)) return null

	let entries: string[] = []
	try {
		entries = readdirSync(stagesDir).filter((name) => {
			const full = join(stagesDir, name)
			try {
				return statSync(full).isDirectory()
			} catch {
				return false
			}
		})
	} catch {
		return null
	}

	for (const stage of entries) {
		try {
			const { exists, record } = readBaselineDisk(intentDir, stage)
			if (!exists) continue
			if (pathRel in record) {
				return { stage, record }
			}
		} catch (err) {
			if (err instanceof BaselineCorruptError) {
				// Skip corrupt baselines for the purposes of clearance lookup.
				// The drift gate will surface the corruption on its next scan.
				continue
			}
			throw err
		}
	}

	return null
}

// ── Public API (sync) ──────────────────────────────────────────────────────

/** Clear the pending-assessment marker for `pathRel` and update the owning
 *  stage's baseline in a single logical transaction (sync I/O).
 *
 *  Validates the (outcome, trigger) legality matrix:
 *    - "surface-as-feedback" accepts "feedback-closed" or "feedback-rejected".
 *    - "trigger-revisit" accepts only "revisit-complete".
 *
 *  Throws `TriggerOutcomeMismatchError` on legality violation.
 *  Throws `BaselineCorruptError` if the owning stage's baseline.json is corrupt.
 *
 *  Idempotent: when no open marker exists for `pathRel`, returns
 *  `{ ok: true, marker_cleared: false, reason: "no_open_marker" }`.
 *
 *  On success, in a single tempfile-rename transaction:
 *    1. Sets `PendingMarker.cleared_at = now()` and
 *       `PendingMarker.resolved_sha = currentSha`.
 *    2. Updates the baseline entry to (currentSha, currentBytes,
 *       currentMtimeNs, isBinary), with `acknowledged_via =
 *       "classification-terminal"` and `author_class` preserved (or the
 *       default "human-implicit" when the baseline entry is absent).
 *    3. Emits a `pending_marker_cleared` event via `emitTelemetry`.
 *
 *  The Assessment record is NEVER modified by this function — the post-
 *  clearance SHA lives exclusively on `PendingMarker.resolved_sha` and
 *  the emitted event payload.
 *
 *  Atomicity: writes both the new drift-markers.json AND the new
 *  baseline.json to tempfiles in the SAME directory as their targets,
 *  then renames both into place. POSIX `rename(2)` is atomic when source
 *  and destination are on the same filesystem; tempfiles colocated with
 *  their targets satisfy that constraint. The function writes BOTH
 *  tempfiles before EITHER rename, so a crash before any rename leaves
 *  both old files intact and a crash after both renames leaves both
 *  new files. The narrow window where rename-A succeeds and rename-B
 *  fails is unavoidable without an additional fsync fence; in practice
 *  both renames complete in the same OS jiffy on the same filesystem.
 */
export function clearMarkerForResolutionSync(
	intentDir: string,
	pathRel: string,
	trigger: ClearTrigger,
	options?: { intentSlug?: string },
): ClearMarkerForResolutionResult {
	// Validate trigger enum at the boundary so callers who pass garbage
	// fail fast rather than producing misleading error messages later.
	const triggerCheck = ClearTriggerSchema.safeParse(trigger)
	if (!triggerCheck.success) {
		throw new Error(
			`clearMarkerForResolution: trigger '${String(trigger)}' is not a valid ClearTrigger. ` +
				`Expected one of: feedback-closed, feedback-rejected, revisit-complete.`,
		)
	}

	// 1. Find the open marker.
	const store = readMarkers(intentDir)
	const openMarker = findOpenMarker(store, pathRel)
	if (openMarker === null) {
		return {
			ok: true,
			marker_cleared: false,
			baseline_updated: false,
			reason: "no_open_marker",
		}
	}

	// 2. Validate legality matrix.
	const allowed = LEGALITY_MATRIX[openMarker.outcome]
	if (!allowed.has(trigger)) {
		throw new TriggerOutcomeMismatchError(openMarker.outcome, trigger)
	}

	// 3. Locate owning stage's baseline.
	const owning = findOwningStage(intentDir, pathRel)
	const owningStage = owning?.stage ?? null
	const owningRecord: BaselineDiskRecord = owning?.record ?? {}
	const existingEntry: BaselineEntry | undefined = owningRecord[pathRel]

	// 4. Read current on-disk SHA (and bytes/mtime/binary).
	const absPath = join(intentDir, pathRel)
	if (!existsSync(absPath)) {
		// File on disk is missing. Cannot record a resolved_sha for a
		// non-existent file. This can happen if the human deleted the file
		// between classification and clearance — the marker is stale and
		// cannot be honored. Surface as an explicit error so the caller
		// can decide how to recover; idempotent retry is still the
		// correct response in production (the next pre-tick gate will
		// emit a "deleted" finding and the agent re-classifies).
		throw new Error(
			`clearMarkerForResolution: file '${pathRel}' is not on disk; cannot resolve marker. ` +
				`The next pre-tick drift gate will emit a deletion finding for re-classification.`,
		)
	}

	const currentSha = computeFileSha256Sync(absPath)
	const stat = statSync(absPath)
	const currentBytes = stat.size
	const currentMtimeNs =
		typeof stat.mtimeMs === "number" ? Math.floor(stat.mtimeMs * 1_000_000) : 0
	const currentIsBinary = isBinarySync(absPath)

	// 5. Build updated marker.
	const clearedAt = new Date().toISOString()
	const clearedMarker: PendingMarker = {
		...openMarker,
		cleared_at: clearedAt,
		resolved_sha: currentSha,
	}
	const newMarkers = store.markers.map((m) =>
		m === openMarker ? clearedMarker : m,
	)

	// 6. Build updated baseline entry. Preserve existing author_class if
	//    the marker carries one via the prior baseline; otherwise default
	//    to "human-implicit" (the post-clearance write was driven by the
	//    classification flow, which always begins with a human-class
	//    drift event by definition).
	const preservedAuthorClass = existingEntry?.author_class ?? "human-implicit"
	const preservedStage = existingEntry?.stage ?? owningStage
	const preservedTrackingClass = existingEntry?.tracking_class ?? "stage-output"

	const updatedEntry: BaselineEntry = {
		path: pathRel,
		sha256: currentSha,
		bytes: currentBytes,
		mtime_ns: currentMtimeNs,
		is_binary: currentIsBinary,
		author_class: preservedAuthorClass,
		acknowledged_at: clearedAt,
		acknowledged_via: "classification-terminal",
		stage: preservedStage,
		tracking_class: preservedTrackingClass,
	}

	const updatedRecord: BaselineDiskRecord = { ...owningRecord }
	updatedRecord[pathRel] = updatedEntry

	// 7. Atomic write: tempfile-rename for both files.
	//    Step a: write both tempfiles.
	//    Step b: rename both into place.
	//    Step c: on any failure, attempt cleanup of any tempfile.
	const markersTarget = markersPath(intentDir)
	const markersTmp = join(
		dirname(markersTarget),
		`.drift-markers-${process.pid}-${randomBytes(6).toString("hex")}.json.tmp`,
	)

	const baselineTarget = owningStage
		? baselinePath(intentDir, owningStage)
		: null
	const baselineTmp = baselineTarget
		? join(
				dirname(baselineTarget),
				`.baseline-${process.pid}-${randomBytes(6).toString("hex")}.json.tmp`,
			)
		: null

	const markersJson = serializeMarkerStore(newMarkers)
	const baselineJson = baselineTarget
		? serializeBaselineDisk(updatedRecord)
		: null

	// Ensure parent directories exist (for first-time markers / first
	// baseline write in fresh intents).
	mkdirSync(dirname(markersTarget), { recursive: true })
	if (baselineTarget) mkdirSync(dirname(baselineTarget), { recursive: true })

	// Phase 1: write tempfiles. If any tempfile write fails, clean up
	// any tempfile that did succeed and bubble.
	try {
		writeFileSync(markersTmp, markersJson, "utf-8")
		if (baselineTmp && baselineJson !== null) {
			writeFileSync(baselineTmp, baselineJson, "utf-8")
		}
	} catch (err) {
		safeUnlinkSync(markersTmp)
		if (baselineTmp) safeUnlinkSync(baselineTmp)
		throw err
	}

	// Phase 2: rename both into place. Each rename is atomic per-file
	// (POSIX guarantee on same-filesystem rename); the pair of renames
	// is not atomic across files. The unit-09 spec accepts this — we
	// wrote BOTH tempfiles before EITHER rename, so a crash before any
	// rename leaves both old files and a crash after both renames
	// leaves both new files. The narrow window where rename-A succeeds
	// and rename-B fails is unavoidable without an additional fsync
	// fence; in practice both renames complete in the same OS jiffy on
	// the same filesystem.
	try {
		renameSync(markersTmp, markersTarget)
		if (baselineTmp && baselineTarget) {
			renameSync(baselineTmp, baselineTarget)
		}
	} catch (err) {
		safeUnlinkSync(markersTmp)
		if (baselineTmp) safeUnlinkSync(baselineTmp)
		throw err
	}

	// 8. Emit telemetry event (DATA-CONTRACTS.md §6.3). emitTelemetry's
	//    attribute map is Record<string, string>; nullable fields are
	//    flattened to "" so the wire shape stays consistent (consumers
	//    that need the typed object should look at the function's return
	//    value or read drift-markers.json directly).
	emitTelemetry("haiku.drift.pending_marker_cleared", {
		event_type: "pending_marker_cleared",
		event_at: clearedAt,
		intent_slug: options?.intentSlug ?? "",
		path: pathRel,
		assessment_id: clearedMarker.created_by_assessment_id,
		trigger,
		linked_feedback_id: clearedMarker.linked_feedback_id ?? "",
		linked_revisit_target_stage:
			clearedMarker.linked_revisit_target_stage ?? "",
		resolved_sha: currentSha,
	})

	return {
		ok: true,
		marker_cleared: true,
		baseline_updated: true,
		resolved_sha: currentSha,
		path: pathRel,
		trigger,
		assessment_id: clearedMarker.created_by_assessment_id,
		linked_feedback_id: clearedMarker.linked_feedback_id,
		linked_revisit_target_stage: clearedMarker.linked_revisit_target_stage,
	}
}

/** Async wrapper for `clearMarkerForResolutionSync` — see that function
 *  for the full contract. The async variant is provided so callers that
 *  prefer Promise-based composition can integrate without a sync/async
 *  boundary. */
export async function clearMarkerForResolution(
	intentDir: string,
	pathRel: string,
	trigger: ClearTrigger,
	options?: { intentSlug?: string },
): Promise<ClearMarkerForResolutionResult> {
	return clearMarkerForResolutionSync(intentDir, pathRel, trigger, options)
}

// ── Bulk convenience helpers ───────────────────────────────────────────────

/** Walk `drift-markers.json` for every open marker linked to the given
 *  feedback id and clear each via `clearMarkerForResolutionSync`. Used by
 *  the feedback-lifecycle integration in state-tools.ts (sync call site).
 *
 *  Returns the per-path results. Idempotent: when no open marker matches
 *  `feedbackId`, returns an empty array.
 *
 *  Triggered ONLY on `closed` and `rejected` transitions per AC-G5 /
 *  AC-SF3 / DATA-CONTRACTS.md §4.4 ("addressed" is a mid-state and is
 *  NOT a clearance trigger).
 */
export function clearMarkersForFeedbackSync(
	intentDir: string,
	feedbackId: string,
	terminalStatus: "closed" | "rejected",
	options?: { intentSlug?: string },
): ClearMarkerForResolutionResult[] {
	const store = readMarkers(intentDir)
	const openMatches = store.markers.filter(
		(m) =>
			m.cleared_at === null &&
			m.linked_feedback_id === feedbackId &&
			m.outcome === "surface-as-feedback",
	)
	if (openMatches.length === 0) return []

	const trigger: ClearTrigger =
		terminalStatus === "closed" ? "feedback-closed" : "feedback-rejected"

	const results: ClearMarkerForResolutionResult[] = []
	for (const m of openMatches) {
		// Process serially — each call rewrites both files; running in
		// parallel would race on rename.
		results.push(
			clearMarkerForResolutionSync(intentDir, m.path, trigger, options),
		)
	}
	return results
}

/** Async wrapper for `clearMarkersForFeedbackSync`. */
export async function clearMarkersForFeedback(
	intentDir: string,
	feedbackId: string,
	terminalStatus: "closed" | "rejected",
	options?: { intentSlug?: string },
): Promise<ClearMarkerForResolutionResult[]> {
	return clearMarkersForFeedbackSync(
		intentDir,
		feedbackId,
		terminalStatus,
		options,
	)
}

/** Walk `drift-markers.json` for every open marker linked to the given
 *  revisit target stage (outcome: "trigger-revisit") and clear each via
 *  `clearMarkerForResolutionSync(... "revisit-complete")`. Used by the
 *  revisit-lifecycle integration in orchestrator/revisit.ts (sync call
 *  site).
 *
 *  Returns the per-path results. Idempotent: when no open marker
 *  matches `targetStage`, returns an empty array.
 */
export function clearMarkersForRevisitSync(
	intentDir: string,
	targetStage: string,
	options?: { intentSlug?: string },
): ClearMarkerForResolutionResult[] {
	const store = readMarkers(intentDir)
	const openMatches = store.markers.filter(
		(m) =>
			m.cleared_at === null &&
			m.linked_revisit_target_stage === targetStage &&
			m.outcome === "trigger-revisit",
	)
	if (openMatches.length === 0) return []

	const results: ClearMarkerForResolutionResult[] = []
	for (const m of openMatches) {
		results.push(
			clearMarkerForResolutionSync(
				intentDir,
				m.path,
				"revisit-complete",
				options,
			),
		)
	}
	return results
}

/** Async wrapper for `clearMarkersForRevisitSync`. */
export async function clearMarkersForRevisit(
	intentDir: string,
	targetStage: string,
	options?: { intentSlug?: string },
): Promise<ClearMarkerForResolutionResult[]> {
	return clearMarkersForRevisitSync(intentDir, targetStage, options)
}
