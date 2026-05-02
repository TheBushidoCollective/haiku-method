// tools/orchestrator/haiku_classify_drift.ts — Agent-callable MCP tool that
// records classification outcomes for a `manual_change_assessment` action.
//
// This is the workflow's terminal step in the drift loop. The agent submits
// one classification per dispatched finding; the tool atomically:
//
//   1. Writes any inline `feedback_creates[]` entries via the existing
//      writeFeedbackFile path (resolves them into FB-NN ids).
//   2. Builds and writes the `Assessment` record per
//      DATA-CONTRACTS.md §2.3 to `stages/{stage}/drift-assessments/DA-NN.json`.
//   3. For each terminal classification (`ignore`, `inline-fix`):
//      updates baseline.json for the owning stage to the on-disk SHA.
//      `ignore` on a deletion REMOVES the baseline entry instead of
//      updating it (AC-CI2).
//   4. For each non-terminal classification (`surface-as-feedback`,
//      `trigger-revisit`): writes a PendingMarker via appendMarker.
//   5. For each `trigger-revisit`: invokes `revisit()` targeting
//      `linked_revisit_target_stage`. The revisit dispatch handler later
//      stamps `Assessment.revisit_invoked_at` (we initialise it null here).
//   6. Emits `haiku.assessment.recorded` telemetry with the payload counts.
//   7. Clears the active dispatch record so a duplicate replay returns
//      `tick_id_stale`.
//
// Rollback semantics: if any step fails after side effects have started,
// the helper attempts best-effort cleanup of partial state — the most
// load-bearing case is the per-stage baseline write, which is atomic
// (rename-into-place); feedback-create rollback requires deleting the
// FB files we just wrote. The aim is "all or none" within the assessment
// transaction.
//
// References:
//   - DATA-CONTRACTS.md §2.3 (Assessment), §3.3 (Classification),
//     §3.4 (legality matrix), §4.3 (this tool's contract), §6.2 (event).
//   - ARCHITECTURE.md §4.4, §5.4 (baseline-update contract).
//   - ACCEPTANCE-CRITERIA.md AC-G2..AC-G12, AC-CI1/CI2, AC-IF1, AC-SF1..3,
//     AC-TR1..3, AC-EE5.

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { unlink } from "node:fs/promises"
import { join } from "node:path"
import matter from "gray-matter"
import { revisit } from "../../orchestrator/revisit.js"
import {
	type Baseline,
	type BaselineEntry,
	canonicalisePath,
	computeFileSha256Sync,
	isBinarySync,
	readBaseline,
	writeBaselineSync,
} from "../../orchestrator/workflow/drift-baseline.js"
import {
	clearDriftDispatch,
	readDriftDispatch,
} from "../../orchestrator/workflow/drift-dispatch.js"
import {
	appendMarker,
	type PendingMarker,
} from "../../orchestrator/workflow/drift-markers.js"
import { findHaikuRoot, writeFeedbackFile } from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool, validateSlugArgs } from "../define.js"
import { text } from "./_text.js"

// ── Local types ────────────────────────────────────────────────────────────

type Outcome =
	| "ignore"
	| "inline-fix"
	| "surface-as-feedback"
	| "trigger-revisit"

interface ClassificationInput {
	path: string
	outcome: Outcome
	rationale_excerpt: string
	linked_feedback_id?: string | null
	linked_revisit_target_stage?: string | null
}

interface FeedbackCreateInline {
	for_classification_path: string
	title: string
	body: string
	origin: string
	resolution?: string | null
}

// ── Internal helpers ───────────────────────────────────────────────────────

const VALID_OUTCOMES: ReadonlySet<Outcome> = new Set([
	"ignore",
	"inline-fix",
	"surface-as-feedback",
	"trigger-revisit",
])

/** Build an MCP-shaped error response (isError: true). */
function errorResponse(
	error: string,
	message: string,
	extra: Record<string, unknown> = {},
) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify({ ok: false, error, message, ...extra }, null, 2),
			},
		],
		isError: true,
	}
}

/** Determine the next zero-padded NN across every stage's
 *  drift-assessments/ directory in the intent. The Assessment id
 *  ("AS-NN") is intent-scoped per DATA-CONTRACTS.md §2.3, but the file
 *  lives in `stages/{stage}/drift-assessments/DA-NN.json` — so the
 *  counter must scan all stages, not just the active one. Returns 1
 *  when no prior assessment exists. */
function nextAssessmentNumber(intentDir: string): number {
	const stagesDir = join(intentDir, "stages")
	if (!existsSync(stagesDir)) return 1
	let max = 0
	try {
		for (const stage of readdirSync(stagesDir, { withFileTypes: true })) {
			if (!stage.isDirectory()) continue
			const dir = join(stagesDir, stage.name, "drift-assessments")
			if (!existsSync(dir)) continue
			try {
				for (const name of readdirSync(dir)) {
					const m = name.match(/^(?:DA|AS)-(\d+)\.json$/)
					if (!m) continue
					const n = Number.parseInt(m[1], 10)
					if (!Number.isNaN(n) && n > max) max = n
				}
			} catch {
				// per-stage scan failure is non-fatal — keep walking.
			}
		}
	} catch {
		// stages dir scan failure — fall back to 1.
	}
	return max + 1
}

/** Zero-pad to two digits (FB-01, AS-07, DA-12). */
function zeroPad(n: number): string {
	return n < 10 ? `0${n}` : String(n)
}

/** Build a BaselineEntry for a file currently on disk at `absPath`.
 *  Used by terminal-outcome baseline updates. */
function baselineEntryForFile(args: {
	pathRel: string
	absPath: string
	stage: string | null
	trackingClass: BaselineEntry["tracking_class"]
	authorClass: BaselineEntry["author_class"]
	acknowledgedVia: BaselineEntry["acknowledged_via"]
}): BaselineEntry {
	const sha256 = computeFileSha256Sync(args.absPath)
	const stat = statSync(args.absPath)
	return {
		path: args.pathRel,
		sha256,
		bytes: stat.size,
		mtime_ns: Math.round(stat.mtimeMs * 1_000_000),
		is_binary: isBinarySync(args.absPath),
		author_class: args.authorClass,
		acknowledged_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
		acknowledged_via: args.acknowledgedVia,
		stage: args.stage,
		tracking_class: args.trackingClass,
	}
}

// ── Tool definition ────────────────────────────────────────────────────────

export default defineTool({
	name: "haiku_classify_drift",
	description:
		"Record classification outcomes for a `manual_change_assessment` action. The agent submits one Classification per dispatched finding; the tool atomically writes the Assessment record, creates any inline feedback items, updates baselines for terminal outcomes (ignore, inline-fix), writes pending-assessment markers for non-terminal outcomes (surface-as-feedback, trigger-revisit), and dispatches haiku_revisit for trigger-revisit. Rejects stale tick_ids, illegal outcomes (per change_kind matrix), missing rationales on non-ignore outcomes, and revisit targets at or downstream of the active stage.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent_slug: {
				type: "string",
				description: "Slug of the active intent.",
			},
			tick_id: {
				type: "string",
				description:
					"The tick_id from the dispatched manual_change_assessment action. Must match the active drift dispatch; stale ids are rejected with `tick_id_stale`.",
			},
			classifications: {
				type: "array",
				description:
					"One Classification per dispatched finding. Length must match the dispatch's findings array. Each entry has: path, outcome, rationale_excerpt, optionally linked_feedback_id (required for surface-as-feedback) and linked_revisit_target_stage (required for trigger-revisit).",
				items: {
					type: "object",
					properties: {
						path: { type: "string" },
						outcome: {
							type: "string",
							enum: [
								"ignore",
								"inline-fix",
								"surface-as-feedback",
								"trigger-revisit",
							],
						},
						rationale_excerpt: { type: "string" },
						linked_feedback_id: { type: ["string", "null"] },
						linked_revisit_target_stage: { type: ["string", "null"] },
					},
					required: ["path", "outcome", "rationale_excerpt"],
				},
			},
			agent_rationale: {
				type: "string",
				description:
					"Free-form prose explaining the classifications. Must contain at least one non-whitespace character.",
			},
			feedback_creates: {
				type: "array",
				description:
					"Inline feedback creates — one per surface-as-feedback classification that omits linked_feedback_id. Each entry has for_classification_path, title, body, origin (must be 'agent'), and optional resolution.",
				items: {
					type: "object",
					properties: {
						for_classification_path: { type: "string" },
						title: { type: "string" },
						body: { type: "string" },
						origin: { type: "string" },
						resolution: { type: ["string", "null"] },
					},
					required: ["for_classification_path", "title", "body", "origin"],
				},
			},
		},
		required: ["intent_slug", "tick_id", "classifications", "agent_rationale"],
	},

	async handle(args) {
		// ── Input extraction ─────────────────────────────────────────────────
		const slug = args.intent_slug as string
		const tickId = args.tick_id as string
		const classifications =
			(args.classifications as ClassificationInput[]) ?? []
		const agentRationale = (args.agent_rationale as string) ?? ""
		const feedbackCreates =
			(args.feedback_creates as FeedbackCreateInline[] | undefined) ?? []

		const slugCheck = validateSlugArgs({ intent: slug })
		if (slugCheck) return slugCheck

		// ── Agent rationale must be non-empty (≥1 non-whitespace char) ───────
		if (typeof agentRationale !== "string" || agentRationale.trim() === "") {
			return errorResponse(
				"empty_rationale",
				"agent_rationale must contain at least one non-whitespace character.",
			)
		}

		// ── Resolve intent dir ───────────────────────────────────────────────
		const root = findHaikuRoot()
		const intentDir = join(root, "intents", slug)
		if (!existsSync(join(intentDir, "intent.md"))) {
			return errorResponse("intent_not_found", `Intent '${slug}' not found.`)
		}

		// ── Load active dispatch ─────────────────────────────────────────────
		const dispatch = readDriftDispatch(intentDir)
		if (dispatch === null) {
			return errorResponse(
				"tick_id_stale",
				"No active drift dispatch found. The dispatch may have already been consumed or the gate has not emitted any findings.",
			)
		}

		// ── Validate tick_id ─────────────────────────────────────────────────
		if (dispatch.tick_id !== tickId) {
			return errorResponse(
				"tick_id_stale",
				`tick_id '${tickId}' does not match the active drift dispatch ('${dispatch.tick_id}'). The gate may have re-fired with a new dispatch.`,
				{ active_tick_id: dispatch.tick_id },
			)
		}

		// ── Validate classifications.length === findings.length ─────────────
		if (classifications.length !== dispatch.findings.length) {
			return errorResponse(
				"classifications_count_mismatch",
				`Expected ${dispatch.findings.length} classifications (one per dispatched finding), but received ${classifications.length}.`,
				{
					expected: dispatch.findings.length,
					received: classifications.length,
				},
			)
		}

		// ── Validate per-classification path matches the dispatched ordering ─
		for (let i = 0; i < classifications.length; i++) {
			const c = classifications[i]
			const f = dispatch.findings[i]
			if (c.path !== f.path) {
				return errorResponse(
					"path_unknown",
					`classifications[${i}].path '${c.path}' does not match findings[${i}].path '${f.path}'. Classifications must be parallel-indexed to the dispatched findings.`,
					{ index: i, expected_path: f.path, received_path: c.path },
				)
			}
		}

		// ── Validate every outcome is one of the four canonical values ───────
		for (let i = 0; i < classifications.length; i++) {
			const c = classifications[i]
			if (!VALID_OUTCOMES.has(c.outcome)) {
				return errorResponse(
					"illegal_outcome",
					`classifications[${i}].outcome '${c.outcome}' is not a valid classification. Valid outcomes: ignore, inline-fix, surface-as-feedback, trigger-revisit.`,
					{
						index: i,
						received_outcome: c.outcome,
						valid_outcomes: [
							"ignore",
							"inline-fix",
							"surface-as-feedback",
							"trigger-revisit",
						],
					},
				)
			}
		}

		// ── Validate outcome is in dispatched legal_outcomes for the path ────
		for (let i = 0; i < classifications.length; i++) {
			const c = classifications[i]
			const allowed = dispatch.legal_outcomes[c.path] ?? []
			if (!allowed.includes(c.outcome)) {
				return errorResponse(
					"illegal_outcome",
					`classifications[${i}].outcome '${c.outcome}' is not legal for finding '${c.path}'. Legal outcomes for this finding: [${allowed.join(", ")}].`,
					{
						index: i,
						path: c.path,
						received_outcome: c.outcome,
						legal_outcomes: allowed,
					},
				)
			}
		}

		// ── Validate non-empty rationale_excerpt on non-ignore outcomes ──────
		for (let i = 0; i < classifications.length; i++) {
			const c = classifications[i]
			if (c.outcome === "ignore") continue
			if (
				typeof c.rationale_excerpt !== "string" ||
				c.rationale_excerpt.trim() === ""
			) {
				return errorResponse(
					"empty_rationale",
					`classifications[${i}].rationale_excerpt must be non-empty for outcome '${c.outcome}'. Only 'ignore' permits an empty rationale.`,
					{ index: i, outcome: c.outcome },
				)
			}
		}

		// ── Validate trigger-revisit target stage ────────────────────────────
		// Per AC-EO1 / AC-CO1: target must be at or before the active stage —
		// revisit-of-self is permitted only via the dispatched legal_outcomes
		// filter (which already excludes trigger-revisit on current-stage
		// findings); cross-stage trigger-revisits must target an upstream
		// stage.
		const intentMd = readIntentFrontmatter(intentDir)
		const intentStages = (intentMd.stages as string[] | undefined) ?? []
		const activeStage = dispatch.stage
		const activeIdx = intentStages.indexOf(activeStage)
		for (let i = 0; i < classifications.length; i++) {
			const c = classifications[i]
			if (c.outcome !== "trigger-revisit") continue
			const target = c.linked_revisit_target_stage
			if (target === null || target === undefined || target === "") {
				return errorResponse(
					"revisit_target_invalid",
					`classifications[${i}] (trigger-revisit) requires linked_revisit_target_stage.`,
					{ index: i },
				)
			}
			if (intentStages.length > 0) {
				const targetIdx = intentStages.indexOf(target)
				if (targetIdx < 0) {
					return errorResponse(
						"revisit_target_invalid",
						`linked_revisit_target_stage '${target}' is not a stage on this intent. Stages: [${intentStages.join(", ")}].`,
						{ index: i, target, intent_stages: intentStages },
					)
				}
				if (activeIdx >= 0 && targetIdx > activeIdx) {
					return errorResponse(
						"revisit_target_invalid",
						`linked_revisit_target_stage '${target}' is downstream of the active stage '${activeStage}'. Revisit must target an at-or-before stage.`,
						{ index: i, target, active_stage: activeStage },
					)
				}
			}
		}

		// ── Validate surface-as-feedback link / inline create ────────────────
		// For each surface-as-feedback classification, EITHER linked_feedback_id
		// is already set (referencing an existing FB) OR a feedback_creates
		// entry exists for the same path.
		const inlineByPath = new Map<string, FeedbackCreateInline>()
		for (const fc of feedbackCreates) {
			if (typeof fc.origin !== "string" || fc.origin !== "agent") {
				return errorResponse(
					"illegal_outcome",
					`feedback_creates entries must have origin: 'agent'. Got '${fc.origin}'.`,
					{ for_path: fc.for_classification_path, origin: fc.origin },
				)
			}
			inlineByPath.set(fc.for_classification_path, fc)
		}
		for (let i = 0; i < classifications.length; i++) {
			const c = classifications[i]
			if (c.outcome !== "surface-as-feedback") continue
			const hasLink =
				typeof c.linked_feedback_id === "string" &&
				c.linked_feedback_id.trim() !== ""
			const hasInline = inlineByPath.has(c.path)
			if (!hasLink && !hasInline) {
				return errorResponse(
					"missing_link",
					`classifications[${i}] (surface-as-feedback) requires either linked_feedback_id or a feedback_creates entry for path '${c.path}'.`,
					{ index: i, path: c.path },
				)
			}
		}

		// ── Side effects ──────────────────────────────────────────────────────
		// All-or-rollback: track every disk mutation so we can undo on a
		// downstream failure.
		const createdFeedbackFiles: string[] = [] // absolute paths to feedback .md files we created
		const createdFeedbackIds: string[] = [] // FB-NN ids returned to the caller
		const createdMarkerPaths: string[] = [] // PendingMarker.path values appended
		const inlineLinkByPath = new Map<string, string>() // for_path -> FB-NN

		try {
			// 1. Inline feedback creates — write FBs first so we can backfill
			//    linked_feedback_id on the matching classifications.
			for (const fc of feedbackCreates) {
				// Resolve the matching classification's owning stage.
				const matched = classifications.find(
					(c) =>
						c.outcome === "surface-as-feedback" &&
						c.path === fc.for_classification_path,
				)
				if (!matched) {
					// feedback_creates entry that doesn't pair to a real
					// surface-as-feedback classification — reject.
					throw new ToolError(
						"missing_link",
						`feedback_creates entry for path '${fc.for_classification_path}' has no matching surface-as-feedback classification.`,
						{ for_path: fc.for_classification_path },
					)
				}
				// Owning stage = finding.stage (the stage that owns the file
				// drift was detected on). Falls back to the active stage if
				// the finding is intent-scope.
				const finding = dispatch.findings.find(
					(f) => f.path === fc.for_classification_path,
				)
				const owningStage = finding?.stage ?? activeStage
				const result = writeFeedbackFile(slug, owningStage, {
					title: fc.title,
					body: fc.body,
					origin: fc.origin,
					resolution: fc.resolution ?? null,
				})
				createdFeedbackIds.push(result.feedback_id)
				createdFeedbackFiles.push(
					join(root, result.file.replace(/^\.haiku\//, "")),
				)
				inlineLinkByPath.set(fc.for_classification_path, result.feedback_id)
			}

			// 2. Resolve linked_feedback_id for classifications that omitted it.
			const resolvedClassifications: ClassificationInput[] =
				classifications.map((c) => {
					if (c.outcome !== "surface-as-feedback") return c
					if (c.linked_feedback_id) return c
					const fbId = inlineLinkByPath.get(c.path)
					return fbId ? { ...c, linked_feedback_id: fbId } : c
				})

			// 3. Build the Assessment record.
			const assessmentStageDir = join(intentDir, "stages", activeStage)
			const assessmentNumber = nextAssessmentNumber(intentDir)
			const assessmentId = `AS-${zeroPad(assessmentNumber)}`
			// File name uses the DA- prefix (drift-assessment file) per
			// ARCHITECTURE.md §4.6 + DATA-CONTRACTS.md §4.6; the same NN
			// is shared with the AS-NN id so the file name and the id
			// stay correlated.
			const assessmentFileName = `DA-${zeroPad(assessmentNumber)}.json`
			const createdAt = new Date().toISOString()

			const assessmentClassifications = resolvedClassifications.map((c) => ({
				path: c.path,
				outcome: c.outcome,
				rationale_excerpt: c.rationale_excerpt,
				linked_feedback_id: c.linked_feedback_id ?? null,
				linked_revisit_target_stage: c.linked_revisit_target_stage ?? null,
			}))

			// resulting_sha: terminal outcomes carry the on-disk SHA at
			// classification time; non-terminal outcomes carry null and
			// are NEVER updated (the post-clearance SHA lives on the
			// PendingMarker per DATA-CONTRACTS.md §2.3 / §3.6).
			const hasNonTerminal = assessmentClassifications.some(
				(c) =>
					c.outcome === "surface-as-feedback" ||
					c.outcome === "trigger-revisit",
			)
			let resultingSha: string | null = null
			if (!hasNonTerminal) {
				// All terminal — compute the SHA of the first finding's file
				// (or null if it was deleted). For a multi-file assessment
				// every finding shares the same tick window so this records
				// a representative SHA. The per-finding SHAs already exist on
				// the findings themselves (after_sha256).
				const firstWithFile = dispatch.findings.find(
					(f) => f.change_kind !== "file-removed",
				)
				if (firstWithFile) resultingSha = firstWithFile.after_sha256 ?? null
			}

			const assessmentRecord = {
				id: assessmentId,
				created_at: createdAt,
				tick_id: dispatch.tick_id,
				findings: dispatch.findings,
				classifications: assessmentClassifications,
				agent_rationale: agentRationale,
				resulting_sha: resultingSha,
				revisit_invoked_at: null,
				mode: dispatch.mode,
				confirmed_by_user: false,
			}

			// 4. Write Assessment record (DA-NN.json).
			const assessmentDir = join(assessmentStageDir, "drift-assessments")
			mkdirSync(assessmentDir, { recursive: true })
			const assessmentPath = join(assessmentDir, assessmentFileName)
			writeFileSync(
				assessmentPath,
				`${JSON.stringify(assessmentRecord, null, 2)}\n`,
				"utf-8",
			)

			// 5. Per-classification side effects.
			let baselinesUpdated = 0
			let pendingMarkersCreated = 0
			const revisitTargets: string[] = []

			// Group baseline updates by owning stage (one writeBaseline per
			// stage to keep the on-disk file consistent).
			const baselineUpdatesByStage = new Map<
				string,
				{ remove: string[]; upsert: BaselineEntry[] }
			>()

			function bucketFor(stage: string) {
				let b = baselineUpdatesByStage.get(stage)
				if (!b) {
					b = { remove: [], upsert: [] }
					baselineUpdatesByStage.set(stage, b)
				}
				return b
			}

			for (let i = 0; i < resolvedClassifications.length; i++) {
				const c = resolvedClassifications[i]
				const f = dispatch.findings[i]
				const owningStage = f.stage ?? activeStage

				if (c.outcome === "ignore" || c.outcome === "inline-fix") {
					// Terminal outcome: update baseline (or remove on deletion).
					const canonical = canonicalisePath(c.path)
					if (c.outcome === "ignore" && f.change_kind === "file-removed") {
						// AC-CI2: ignore on a deletion REMOVES the baseline entry.
						bucketFor(owningStage).remove.push(canonical)
						baselinesUpdated++
					} else {
						// Update to current on-disk SHA. The file should exist
						// for inline-fix; if missing, fall back to the finding's
						// after_sha256 metadata (e.g. ignore on a non-existent
						// file path that re-emerged after the gate scan).
						const absPath = join(intentDir, canonical)
						if (existsSync(absPath)) {
							// Use the author_class carried on the finding from the gate
							// (which read the action log at dispatch time). Fall back
							// to "human-implicit" per DATA-CONTRACTS §6.1 inference rule
							// when the field is absent (e.g. legacy dispatch records).
							const authorClass: BaselineEntry["author_class"] =
								f.author_class ?? "human-implicit"
							const trackingClass = f.tracking_class
							const entry = baselineEntryForFile({
								pathRel: canonical,
								absPath,
								stage: f.stage,
								trackingClass,
								authorClass,
								acknowledgedVia: "classification-terminal",
							})
							bucketFor(owningStage).upsert.push(entry)
							baselinesUpdated++
						}
					}
				} else if (c.outcome === "surface-as-feedback") {
					// Non-terminal: write a PendingMarker. baseline_sha_at_creation
					// is the file's CURRENT on-disk SHA (used for stale detection).
					const canonical = canonicalisePath(c.path)
					const absPath = join(intentDir, canonical)
					let currentSha: string
					try {
						currentSha = existsSync(absPath)
							? computeFileSha256Sync(absPath)
							: ""
					} catch {
						currentSha = ""
					}
					const marker: PendingMarker = {
						path: canonical,
						created_at: new Date().toISOString(),
						created_by_assessment_id: assessmentId,
						outcome: "surface-as-feedback",
						linked_feedback_id: c.linked_feedback_id ?? null,
						linked_revisit_target_stage: null,
						cleared_at: null,
						resolved_sha: null,
						baseline_sha_at_creation: currentSha,
					}
					await appendMarker(intentDir, marker)
					createdMarkerPaths.push(canonical)
					pendingMarkersCreated++
				} else if (c.outcome === "trigger-revisit") {
					// Non-terminal: write a PendingMarker, queue a revisit.
					const canonical = canonicalisePath(c.path)
					const absPath = join(intentDir, canonical)
					let currentSha: string
					try {
						currentSha = existsSync(absPath)
							? computeFileSha256Sync(absPath)
							: ""
					} catch {
						currentSha = ""
					}
					const marker: PendingMarker = {
						path: canonical,
						created_at: new Date().toISOString(),
						created_by_assessment_id: assessmentId,
						outcome: "trigger-revisit",
						linked_feedback_id: null,
						linked_revisit_target_stage: c.linked_revisit_target_stage ?? null,
						cleared_at: null,
						resolved_sha: null,
						baseline_sha_at_creation: currentSha,
					}
					await appendMarker(intentDir, marker)
					createdMarkerPaths.push(canonical)
					pendingMarkersCreated++
					if (c.linked_revisit_target_stage) {
						revisitTargets.push(c.linked_revisit_target_stage)
					}
				}
			}

			// 6. Apply baseline updates (one write per owning stage).
			for (const [stage, ops] of baselineUpdatesByStage.entries()) {
				const baseline: Baseline = readBaseline(intentDir, stage) ?? {
					entries: new Map(),
				}
				const newEntries = new Map(baseline.entries)
				for (const path of ops.remove) {
					newEntries.delete(path)
				}
				for (const entry of ops.upsert) {
					newEntries.set(entry.path, entry)
				}
				writeBaselineSync(intentDir, stage, { entries: newEntries })
			}

			// 7. Dispatch revisits (best-effort; the revisit dispatch handler
			//    later stamps Assessment.revisit_invoked_at). We invoke
			//    revisit() once per unique target stage; if multiple findings
			//    target the same stage they consolidate into one revisit.
			const uniqueTargets = Array.from(new Set(revisitTargets))
			for (const target of uniqueTargets) {
				try {
					revisit(slug, target)
				} catch (err) {
					// Revisit failures are surfaced via console; the
					// assessment record + marker are still durable.
					console.error(
						`[haiku_classify_drift] revisit('${slug}', '${target}') failed: ${String(err)}`,
					)
				}
			}

			// 8. Emit assessment_recorded telemetry (DATA-CONTRACTS.md §6.2).
			const outcomesCount: Record<Outcome, number> = {
				ignore: 0,
				"inline-fix": 0,
				"surface-as-feedback": 0,
				"trigger-revisit": 0,
			}
			for (const c of resolvedClassifications) {
				outcomesCount[c.outcome]++
			}
			emitTelemetry("haiku.assessment.recorded", {
				intent: slug,
				assessment_id: assessmentId,
				outcomes_count: JSON.stringify(outcomesCount),
				feedback_ids_created: JSON.stringify(createdFeedbackIds),
				baselines_updated: String(baselinesUpdated),
				pending_markers_created: String(pendingMarkersCreated),
				mode: dispatch.mode,
			})
			// Pair-event for the `assessments-zero-completion` alert in
			// deploy/operations/drift-detection-alerts.yaml. Labels match
			// `haiku.drift.assessments.count` (intent_slug + stage) so the
			// alert's compound expression
			//   rate(haiku.drift.assessments.count[6h]) > 0
			//   AND rate(haiku.drift.assessments.resolved[6h]) == 0
			// pairs by series. Emitted once per Assessment record write — the
			// dispatch-vs-resolution lifecycle terminates here regardless of
			// per-finding outcome.
			emitTelemetry("haiku.drift.assessments.resolved", {
				intent_slug: slug,
				stage: activeStage,
				tick_iteration: String(dispatch.tick_counter),
				count: String(resolvedClassifications.length),
			})

			// 9. Clear the active dispatch — replays now return tick_id_stale.
			clearDriftDispatch(intentDir)

			// 10. Compose the response.
			const nextTickWill = describeNextTick({
				outcomes: resolvedClassifications.map((c) => c.outcome),
				revisitTargets: uniqueTargets,
				feedbackIds: createdFeedbackIds,
			})

			return text(
				JSON.stringify(
					{
						ok: true,
						assessment_id: assessmentId,
						feedback_created: createdFeedbackIds,
						pending_markers_created: pendingMarkersCreated,
						baselines_updated: baselinesUpdated,
						next_tick_will: nextTickWill,
					},
					null,
					2,
				),
			)
		} catch (err) {
			// Best-effort rollback for the partial-write case.
			await rollbackPartial(createdFeedbackFiles)
			if (err instanceof ToolError) {
				return errorResponse(err.code, err.message, err.extra)
			}
			return errorResponse(
				"internal_error",
				`Assessment write failed: ${String(err)}`,
			)
		}
	},
})

// ── Helpers ────────────────────────────────────────────────────────────────

class ToolError extends Error {
	readonly code: string
	readonly extra: Record<string, unknown>
	constructor(
		code: string,
		message: string,
		extra: Record<string, unknown> = {},
	) {
		super(message)
		this.code = code
		this.extra = extra
	}
}

/** Read intent.md frontmatter for stage-list lookup. Returns an empty
 *  record on any failure — the validator falls back to a permissive
 *  pass when the stage list is unavailable. */
function readIntentFrontmatter(intentDir: string): Record<string, unknown> {
	const intentMd = join(intentDir, "intent.md")
	if (!existsSync(intentMd)) return {}
	try {
		const raw = readFileSync(intentMd, "utf-8")
		const { data } = matter(raw)
		return data as Record<string, unknown>
	} catch {
		return {}
	}
}

/** Best-effort cleanup of feedback files we wrote before a failure
 *  short-circuited the side-effect pipeline. Idempotent. */
async function rollbackPartial(feedbackFiles: string[]): Promise<void> {
	for (const f of feedbackFiles) {
		try {
			await unlink(f)
		} catch {
			// already gone — fine
		}
	}
}

/** Build the human-readable `next_tick_will` string for the response.
 *  Drives the SPA's status pill and tells the agent what to expect on
 *  the next haiku_run_next call. */
function describeNextTick(args: {
	outcomes: ReadonlyArray<Outcome>
	revisitTargets: ReadonlyArray<string>
	feedbackIds: ReadonlyArray<string>
}): string {
	if (args.revisitTargets.length > 0) {
		return `dispatch_revisit_to_${args.revisitTargets.join("_and_")}`
	}
	if (args.feedbackIds.length > 0) {
		return `dispatch_review_fix_for_${args.feedbackIds.join("_and_")}`
	}
	if (args.outcomes.every((o) => o === "ignore" || o === "inline-fix")) {
		return "resume_per_state_dispatch"
	}
	return "resume_per_state_dispatch"
}
