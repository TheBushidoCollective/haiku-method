// orchestrator/workflow/drift-dispatch.ts — Persisted active drift dispatch state.
//
// When the pre-tick drift-detection gate emits a `manual_change_assessment`
// action (run-tick.ts), we stamp the resulting tick_id + findings here so
// that the agent's downstream `haiku_classify_drift` call can:
//
//   1. Validate the supplied tick_id against the active dispatch
//      (reject `tick_id_stale` when the gate has re-fired with a new id).
//   2. Echo the dispatched findings into the Assessment record (the agent
//      submits classifications by path; we hydrate the corresponding
//      DriftFinding objects from this file rather than trusting the agent
//      to re-supply them).
//   3. Look up the per-finding `legal_outcomes` set to validate every
//      classification choice.
//
// Storage: a single JSON file at .haiku/intents/{slug}/drift-dispatch.json.
// One record at a time — the gate overwrites on each new emission. There is
// no append-only history of dispatches; the durable record of what the
// agent decided lives in stages/{stage}/drift-assessments/DA-NN.json.
//
// Read on every classify call. Cleared (file deleted) by the classify tool
// on success so a duplicate replay returns `tick_id_stale` rather than
// re-applying the same classifications on top of an already-updated baseline.

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import type { DriftFinding } from "./drift-detection-gate.js"

// ── Schema ─────────────────────────────────────────────────────────────────

/** The four classification outcomes (DATA-CONTRACTS.md §3.3). */
const OutcomeSchema = z.enum([
	"ignore",
	"inline-fix",
	"surface-as-feedback",
	"trigger-revisit",
])

/** Mirror of `DriftFinding` but as a Zod schema so we can round-trip the
 *  dispatched findings through disk safely. */
const DriftFindingSchema = z.object({
	path: z.string(),
	change_kind: z.enum(["new-file-detected", "modified", "file-removed"]),
	is_binary: z.boolean(),
	diff_unified: z.string().nullable(),
	before_sha256: z.string().nullable(),
	after_sha256: z.string().nullable(),
	before_bytes: z.number().nullable(),
	after_bytes: z.number().nullable(),
	tracking_class: z.enum([
		"stage-output",
		"knowledge",
		"unit-output",
		"intent-meta",
	]),
	stage: z.string().nullable(),
	context_unit: z.string().nullable(),
	is_baseline_oom: z.boolean().optional(),
	author_class: z.enum(["agent", "human-via-mcp", "human-implicit"]).optional(),
})

/** On-disk shape of `drift-dispatch.json`. */
const DriftDispatchSchema = z.object({
	tick_id: z.string(),
	stage: z.string(),
	tick_counter: z.number(),
	mode: z.string(),
	created_at: z.string(),
	findings: z.array(DriftFindingSchema),
	legal_outcomes: z.record(z.string(), z.array(OutcomeSchema)),
})

export type DriftDispatch = z.infer<typeof DriftDispatchSchema>

// ── Path helper ────────────────────────────────────────────────────────────

function dispatchPath(intentDir: string): string {
	return join(intentDir, "drift-dispatch.json")
}

// ── Read / write ───────────────────────────────────────────────────────────

/** Read the active drift dispatch. Returns null when the file does not
 *  exist (no active dispatch) or when it cannot be parsed (degraded —
 *  treated as "no active dispatch" so the classifier can fail with
 *  `tick_id_stale` rather than crashing). */
export function readDriftDispatch(intentDir: string): DriftDispatch | null {
	const filePath = dispatchPath(intentDir)
	if (!existsSync(filePath)) return null

	let raw: string
	try {
		raw = readFileSync(filePath, "utf-8")
	} catch {
		return null
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		return null
	}

	const result = DriftDispatchSchema.safeParse(parsed)
	if (!result.success) return null

	return result.data
}

/** Persist the active drift dispatch. The classify tool reads this back
 *  and validates the agent's tick_id against `dispatch.tick_id`. Overwrites
 *  any prior dispatch — only one is active at a time per intent. */
export function writeDriftDispatch(
	intentDir: string,
	dispatch: DriftDispatch,
): void {
	const filePath = dispatchPath(intentDir)
	const json = `${JSON.stringify(dispatch, null, 2)}\n`
	writeFileSync(filePath, json, "utf-8")
}

/** Delete the active dispatch record. Called by `haiku_classify_drift`
 *  after a successful classification so a replay of the same call returns
 *  `tick_id_stale` (the dispatch is now consumed). Idempotent — does
 *  nothing when the file does not exist. */
export function clearDriftDispatch(intentDir: string): void {
	const filePath = dispatchPath(intentDir)
	if (!existsSync(filePath)) return
	try {
		unlinkSync(filePath)
	} catch {
		// Best-effort — a stale file does not corrupt the next dispatch
		// (which overwrites it) so a delete failure is non-fatal here.
	}
}

/** Build a `DriftDispatch` payload from the components the gate already
 *  has in hand. Pure helper — does no disk I/O. */
export function buildDriftDispatch(args: {
	tickId: string
	stage: string
	tickCounter: number
	mode: string
	findings: ReadonlyArray<DriftFinding>
	legalOutcomes: Readonly<
		Record<string, ReadonlyArray<z.infer<typeof OutcomeSchema>>>
	>
}): DriftDispatch {
	return {
		tick_id: args.tickId,
		stage: args.stage,
		tick_counter: args.tickCounter,
		mode: args.mode,
		created_at: new Date().toISOString(),
		findings: args.findings.map((f) => ({
			path: f.path,
			change_kind: f.change_kind,
			is_binary: f.is_binary,
			diff_unified: f.diff_unified,
			before_sha256: f.before_sha256,
			after_sha256: f.after_sha256,
			before_bytes: f.before_bytes,
			after_bytes: f.after_bytes,
			tracking_class: f.tracking_class,
			stage: f.stage,
			context_unit: f.context_unit,
			...(f.is_baseline_oom !== undefined
				? { is_baseline_oom: f.is_baseline_oom }
				: {}),
			...(f.author_class !== undefined ? { author_class: f.author_class } : {}),
		})),
		legal_outcomes: Object.fromEntries(
			Object.entries(args.legalOutcomes).map(([k, v]) => [k, v.slice()]),
		),
	}
}
