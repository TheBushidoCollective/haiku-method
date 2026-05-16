// orchestrator/workflow/debug-ops.ts — Admin/recovery operations for
// the `/haiku:debug` skill (PR adding `haiku_debug` tool, 2026-05-15).
//
// Every operation here mutates state in ways the normal workflow
// engine WOULD NOT — bypassing FSM guards, signing approvals without
// running the hat sequence, re-stamping witnesses to clear drift.
// They exist for ONE purpose: unsticking corrupt intents the user
// can otherwise only fix by hand-editing FM on disk (which the agent
// cannot do — guard-workflow-fields.ts blocks that).
//
// Safety: NONE of these are exposed to the agent directly. They're
// only callable from `haiku_debug`, which requires the user to
// confirm via the SPA picker before any mutation runs. The tool
// definition here is just the operations; the user-confirmation
// gate is in `tools/orchestrator/haiku_debug.ts`.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	intentDir,
	parseFrontmatter,
	setFrontmatterField,
} from "../../state-tools.js"
import { resolveStageHats, resolveStudioStages } from "../studio.js"
import { type CursorPosition, derivePosition } from "./cursor.js"
import { approvalRolesFor, reviewRolesFor } from "./derived-stage-state.js"
import { buildApprovalRecord, buildReviewRecord } from "./sign-slot.js"

export interface DebugForceStageResult {
	stages_processed: string[]
	units_signed: number
	intent_quality_gates_signed: boolean
	feedback_closed: number
	elaborations_sealed: number
}

/** Force a stage and every prior stage to "complete" by signing all
 *  reviews + approvals + intent_quality_gates. The "proof" the user
 *  named in the goal — that a unit moved through all hats — is
 *  enforced minimally: we require `iterations` to be non-empty AND
 *  the last iteration's `result` to be `"advance"`. If a unit hasn't
 *  reached terminal advance, refuse to sign it (caller surfaces
 *  which units fail).
 *
 *  Idempotent: re-running on already-signed units is a no-op (the
 *  build*Record helpers compute current SHAs; if no FM key changes
 *  no write fires). */
export function forceStageComplete(args: {
	slug: string
	targetStage: string
	/** When true, also stamps `closed_at` + `closed_by: "force_complete"`
	 *  on every open feedback record on the targeted stages (and on the
	 *  intent scope when the target is the final stage). Without this,
	 *  open FBs continue to block the cursor even after every approval is
	 *  signed. The v4 closure model derives "closed" from `closed_at` /
	 *  `closed_by` — we deliberately don't write `status: closed` here
	 *  (the legacy `status` field is being phased out). */
	closeOpenFeedback?: boolean
}):
	| { ok: true; result: DebugForceStageResult }
	| { ok: false; error: string; details?: unknown } {
	const dir = intentDir(args.slug)
	const intentMdPath = join(dir, "intent.md")
	if (!existsSync(intentMdPath)) {
		return {
			ok: false,
			error: "intent_not_found",
			details: { slug: args.slug },
		}
	}
	const intentFm = parseFrontmatter(readFileSync(intentMdPath, "utf8")).data
	const studio = (intentFm.studio as string) || ""
	const intentMode = (intentFm.mode as string) || "continuous"
	if (!studio) {
		return { ok: false, error: "intent_missing_studio" }
	}

	const stages = resolveStudioStages(studio)
	if (!stages.includes(args.targetStage)) {
		return {
			ok: false,
			error: "stage_not_in_studio",
			details: { studio, stages, targetStage: args.targetStage },
		}
	}
	const targetIdx = stages.indexOf(args.targetStage)
	const stagesToProcess = stages.slice(0, targetIdx + 1)

	// Two-pass design for atomicity. Pass 1 walks every unit on every
	// stage and collects refusals WITHOUT writing anything; if any unit
	// hasn't reached terminal advance the op aborts with a clean error.
	// Pass 2 only runs when the whole set passes — so the on-disk state
	// transitions all-or-nothing per call. Earlier versions wrote partial
	// signatures before the refusal check fired and reported the
	// half-signed stages as "processed", which overstated success.
	const refusedUnits: Array<{ stage: string; unit: string; reason: string }> =
		[]
	const planned: Array<{
		stage: string
		unitPath: string
		reviewRoles: readonly string[]
		approvalRoles: readonly string[]
		fm: Record<string, unknown>
	}> = []
	for (const stage of stagesToProcess) {
		const unitsDir = join(dir, "stages", stage, "units")
		if (!existsSync(unitsDir)) continue
		const reviewRoles = reviewRolesFor(studio, stage, intentMode)
		const approvalRoles = approvalRolesFor(studio, stage, intentMode)
		for (const unitFile of readdirSync(unitsDir).filter((f) =>
			f.endsWith(".md"),
		)) {
			const unitPath = join(unitsDir, unitFile)
			const fm = parseFrontmatter(readFileSync(unitPath, "utf8")).data
			const iterations = Array.isArray(fm.iterations) ? fm.iterations : []
			const last = iterations[iterations.length - 1] as
				| { result?: unknown }
				| undefined
			if (!last || last.result !== "advance") {
				refusedUnits.push({
					stage,
					unit: unitFile,
					reason:
						"unit has not reached terminal advance — debug tool refuses to sign units that have NOT moved through all hats",
				})
				continue
			}
			planned.push({ stage, unitPath, reviewRoles, approvalRoles, fm })
		}
	}

	if (refusedUnits.length > 0) {
		return {
			ok: false,
			error: "units_not_terminal_advance",
			details: { refusedUnits, signed: 0 },
		}
	}

	// Pass 2: every unit cleared the gate; sign and persist.
	const stagesSigned = new Set<string>()
	let unitsSigned = 0
	for (const plan of planned) {
		const outputs = Array.isArray(plan.fm.outputs)
			? (plan.fm.outputs as string[])
			: []
		const reviews =
			plan.fm.reviews && typeof plan.fm.reviews === "object"
				? { ...(plan.fm.reviews as Record<string, unknown>) }
				: {}
		for (const role of plan.reviewRoles) {
			if (!reviews[role]) reviews[role] = buildReviewRecord(plan.unitPath)
		}
		const approvals =
			plan.fm.approvals && typeof plan.fm.approvals === "object"
				? { ...(plan.fm.approvals as Record<string, unknown>) }
				: {}
		for (const role of plan.approvalRoles) {
			if (!approvals[role]) approvals[role] = buildApprovalRecord(dir, outputs)
		}
		setFrontmatterField(plan.unitPath, "reviews", reviews)
		setFrontmatterField(plan.unitPath, "approvals", approvals)
		stagesSigned.add(plan.stage)
		unitsSigned++
	}
	const stagesProcessed = stagesToProcess.filter((s) => stagesSigned.has(s))

	// Elaboration seal — the cursor blocks at `elaborate` / `elaborate_review`
	// / `decompose_review` until elaboration.md exists with both
	// `verified_at` and `decompose_verified_at` stamps. When every unit
	// on a stage has terminal-advanced (the precondition that just got
	// us through pass 1+2 above), the elaboration round-trip is moot for
	// recovery — the units exist and are signed. Synthesize the artifact
	// + stamps so the cursor walks past the elaborate phase too.
	//
	// IMPORTANT: this fires only inside the debug op (which requires user
	// confirmation via picker/SPA modal). The normal workflow engine still
	// requires the verifier subagent to seal — this synth path is the
	// recovery escape hatch the user explicitly invoked.
	let elaborationsSealed = 0
	for (const stage of stagesProcessed) {
		const stageDir = join(dir, "stages", stage)
		const elabPath = join(stageDir, "elaboration.md")
		const nowIso = new Date().toISOString()
		if (!existsSync(elabPath)) {
			const synthesizedBody = `# Elaboration (synthesized by /haiku:debug)\n\nThis stage's units terminal-advanced through every hat without an elaboration.md being recorded. The debug recovery op synthesized this artifact so the cursor can walk past the elaborate phase.\n`
			const fm: Record<string, unknown> = {
				recorded_at: nowIso,
				verified_at: nowIso,
				decompose_verified_at: nowIso,
				intent: args.slug,
				stage,
				synthesized_by: "force_complete",
			}
			writeFileSync(elabPath, matter.stringify(synthesizedBody, fm))
			elaborationsSealed++
		} else {
			const elabFm = parseFrontmatter(readFileSync(elabPath, "utf8")).data
			let touched = false
			if (!elabFm.verified_at) {
				setFrontmatterField(elabPath, "verified_at", nowIso)
				touched = true
			}
			if (!elabFm.decompose_verified_at) {
				setFrontmatterField(elabPath, "decompose_verified_at", nowIso)
				touched = true
			}
			if (touched) elaborationsSealed++
		}
	}

	// Intent-scope quality_gates — the cursor's intent-completion gate
	// also signs `intent.md.approvals.intent_quality_gates`. For the
	// final stage, force that too so the cursor doesn't re-emit the
	// intent-completion review on the next tick.
	let igsSigned = false
	if (targetIdx === stages.length - 1) {
		const intentApprovals =
			intentFm.approvals && typeof intentFm.approvals === "object"
				? { ...(intentFm.approvals as Record<string, unknown>) }
				: {}
		// Roles must match the cursor's intent-completion gate at
		// cursor.ts:1354–1355: it requires `["spec", "continuity"]`
		// (autopilot) or `["spec", "continuity", "user"]` (non-autopilot)
		// BEFORE it reaches the `intent_quality_gates` check. Omitting
		// `continuity` means the cursor re-emits intent_review on the
		// next tick and the wedge persists.
		for (const role of ["spec", "continuity", "user", "intent_quality_gates"]) {
			if (!intentApprovals[role]) {
				intentApprovals[role] = { at: new Date().toISOString() }
			}
		}
		setFrontmatterField(intentMdPath, "approvals", intentApprovals)
		igsSigned = true
	}

	// Open feedback also blocks the cursor — even after every approval is
	// signed, the next tick will return feedback_dispatch / review_fix as
	// long as any FB lacks closure. When the caller asks, force-close
	// every open FB on the processed stages (and on the intent scope when
	// the final stage was the target).
	let feedbackClosed = 0
	if (args.closeOpenFeedback) {
		const fbScopes = stagesProcessed.map((s) =>
			join(dir, "stages", s, "feedback"),
		)
		if (targetIdx === stages.length - 1) {
			fbScopes.push(join(dir, "feedback"))
		}
		const nowIso = new Date().toISOString()
		for (const fbDir of fbScopes) {
			if (!existsSync(fbDir)) continue
			for (const fbFile of readdirSync(fbDir).filter((f) =>
				f.endsWith(".md"),
			)) {
				const fbPath = join(fbDir, fbFile)
				const fbFm = parseFrontmatter(readFileSync(fbPath, "utf8")).data
				const closedAt = (fbFm as { closed_at?: unknown }).closed_at
				const rejectedAt = (fbFm as { rejected_at?: unknown }).rejected_at
				// closed_at is the cursor's source-of-truth for closure (per
				// the v4 lifecycle doc — `closed_by` alone is "a unit
				// claimed it, the assessor hasn't verified yet" which still
				// blocks the gate). Skip FBs that already have closed_at OR
				// rejected_at stamped; otherwise stamp closed_at and
				// preserve any existing closed_by (don't overwrite the
				// claimer's provenance — just add the verification timestamp
				// the cursor needs).
				if (typeof closedAt === "string" && closedAt.length > 0) continue
				if (typeof rejectedAt === "string" && rejectedAt.length > 0) continue
				setFrontmatterField(fbPath, "closed_at", nowIso)
				const existingClosedBy = (fbFm as { closed_by?: unknown }).closed_by
				if (
					!(typeof existingClosedBy === "string" && existingClosedBy.length > 0)
				) {
					setFrontmatterField(fbPath, "closed_by", "force_complete")
				}
				feedbackClosed++
			}
		}
	}

	return {
		ok: true,
		result: {
			stages_processed: stagesProcessed,
			units_signed: unitsSigned,
			intent_quality_gates_signed: igsSigned,
			feedback_closed: feedbackClosed,
			elaborations_sealed: elaborationsSealed,
		},
	}
}

/** Set an arbitrary intent.md field, bypassing the FSM guards. Used
 *  primarily for `mode` (which is normally engine-managed via
 *  haiku_select_mode + the picker). The user confirmation gate in
 *  haiku_debug is what makes this safe — the agent can't reach this
 *  without the user clicking through. */
export function setIntentField(args: {
	slug: string
	field: string
	value: unknown
}): { ok: true } | { ok: false; error: string } {
	const intentMdPath = join(intentDir(args.slug), "intent.md")
	if (!existsSync(intentMdPath)) {
		return { ok: false, error: "intent_not_found" }
	}
	setFrontmatterField(intentMdPath, args.field, args.value)
	return { ok: true }
}

/** Reset drift by re-stamping every signed slot's witness with the
 *  CURRENT on-disk SHA. After this runs, the next drift sweep finds
 *  current SHAs match witnesses → no events emit → loop breaks.
 *  Walks every stage, every unit, every review/approval slot. */
export function resetDrift(args: {
	slug: string
}):
	| { ok: true; reviews_refreshed: number; approvals_refreshed: number }
	| { ok: false; error: string } {
	const dir = intentDir(args.slug)
	const stagesDir = join(dir, "stages")
	if (!existsSync(stagesDir)) {
		return { ok: false, error: "no_stages_dir" }
	}
	let reviewsRefreshed = 0
	let approvalsRefreshed = 0
	for (const stageEntry of readdirSync(stagesDir, { withFileTypes: true })) {
		if (!stageEntry.isDirectory()) continue
		const unitsDir = join(stagesDir, stageEntry.name, "units")
		if (!existsSync(unitsDir)) continue
		for (const unitFile of readdirSync(unitsDir).filter((f) =>
			f.endsWith(".md"),
		)) {
			const unitPath = join(unitsDir, unitFile)
			const fm = parseFrontmatter(readFileSync(unitPath, "utf8")).data
			const outputs = Array.isArray(fm.outputs) ? (fm.outputs as string[]) : []
			const reviews =
				fm.reviews && typeof fm.reviews === "object"
					? { ...(fm.reviews as Record<string, unknown>) }
					: {}
			for (const role of Object.keys(reviews)) {
				reviews[role] = buildReviewRecord(unitPath)
				reviewsRefreshed++
			}
			const approvals =
				fm.approvals && typeof fm.approvals === "object"
					? { ...(fm.approvals as Record<string, unknown>) }
					: {}
			for (const role of Object.keys(approvals)) {
				approvals[role] = buildApprovalRecord(dir, outputs)
				approvalsRefreshed++
			}
			if (Object.keys(reviews).length > 0)
				setFrontmatterField(unitPath, "reviews", reviews)
			if (Object.keys(approvals).length > 0)
				setFrontmatterField(unitPath, "approvals", approvals)
		}
	}
	return {
		ok: true,
		reviews_refreshed: reviewsRefreshed,
		approvals_refreshed: approvalsRefreshed,
	}
}

/** Write the `iterations[]` array on a unit's frontmatter — the one
 *  FSM-driven field agents normally cannot touch (the schema's
 *  propertyNames deny-list rejects writes, and the handler at
 *  state-tools.ts:7571 blocks them with a clear error). This debug
 *  escape hatch exists because force_stage_complete refuses to sign
 *  units whose iterations[] lacks a terminal `advance` entry — but
 *  some legacy / partial-state units never had iterations recorded,
 *  and their outputs already landed on disk.
 *
 *  When `iterations` is omitted, synthesizes one `{ hat, result:
 *  "advance" }` entry per hat in the stage's `hats:` sequence — the
 *  shape force_stage_complete needs to see to count the unit as
 *  terminal-advance. When `iterations` is provided, writes it
 *  verbatim (with no validation beyond the schema's per-entry
 *  shape check).
 *
 *  Safe because: the debug op routes through `runPicker` confirmation
 *  before any state mutation. The agent cannot reach this without an
 *  explicit user click. */
export function setUnitIterations(args: {
	slug: string
	stage: string
	unit: string
	iterations?: Array<{ hat: string; result: "advance" | "reject"; at?: string }>
}):
	| { ok: true; unit_file: string; iterations_written: number }
	| { ok: false; error: string; details?: unknown } {
	const dir = intentDir(args.slug)
	const intentMdPath = join(dir, "intent.md")
	if (!existsSync(intentMdPath)) {
		return { ok: false, error: "intent_not_found" }
	}
	const intentFm = parseFrontmatter(readFileSync(intentMdPath, "utf8")).data
	const studio = (intentFm.studio as string) || ""
	if (!studio) return { ok: false, error: "intent_missing_studio" }

	const unitsDir = join(dir, "stages", args.stage, "units")
	if (!existsSync(unitsDir)) {
		return {
			ok: false,
			error: "units_dir_not_found",
			details: { stage: args.stage },
		}
	}
	// Accept "unit-03-slug" exact, "unit-03" prefix, or just the digits.
	const found = readdirSync(unitsDir)
		.filter((f) => f.endsWith(".md"))
		.find((f) => {
			const stem = f.replace(/\.md$/, "")
			if (stem === args.unit) return true
			if (stem.startsWith(`${args.unit}-`)) return true
			// Numeric-only input ("03" or "3") matches the unit-NN- prefix.
			const numMatch = args.unit.match(/^(?:unit-)?(\d+)$/i)
			if (numMatch) {
				const n = Number.parseInt(numMatch[1], 10)
				const fileNum = stem.match(/^unit-(\d+)-/)
				if (fileNum && Number.parseInt(fileNum[1], 10) === n) return true
			}
			return false
		})
	if (!found) {
		return {
			ok: false,
			error: "unit_not_found",
			details: { stage: args.stage, unit: args.unit },
		}
	}
	const unitPath = join(unitsDir, found)

	let iterations: Array<{ hat: string; result: string; at: string }>
	if (args.iterations && args.iterations.length > 0) {
		const nowIso = new Date().toISOString()
		iterations = args.iterations.map((it) => ({
			hat: it.hat,
			result: it.result,
			at: it.at || nowIso,
		}))
	} else {
		// Auto-synthesize from the stage's hats: sequence — one advance
		// entry per hat. This is the "I have a finished unit with no
		// recorded iterations" recovery shape.
		const hats = resolveStageHats(studio, args.stage)
		if (hats.length === 0) {
			return {
				ok: false,
				error: "no_hats_defined_for_stage",
				details: { studio, stage: args.stage },
			}
		}
		const nowIso = new Date().toISOString()
		iterations = hats.map((hat) => ({
			hat,
			result: "advance",
			at: nowIso,
		}))
	}
	setFrontmatterField(unitPath, "iterations", iterations)
	return {
		ok: true,
		unit_file: found,
		iterations_written: iterations.length,
	}
}

/** Mutate any feedback FM field set. Caller passes the FB ID + a
 *  partial dict of FM keys to set (status, closed_at, resolution,
 *  targets.*, etc.). No FSM checks. */
export function mutateFeedback(args: {
	slug: string
	stage: string | null
	feedbackId: string
	patch: Record<string, unknown>
}): { ok: true; written_keys: string[] } | { ok: false; error: string } {
	const dir = intentDir(args.slug)
	const fbDir = args.stage
		? join(dir, "stages", args.stage, "feedback")
		: join(dir, "feedback")
	if (!existsSync(fbDir)) return { ok: false, error: "feedback_dir_not_found" }
	// Lookup mirrors `findFeedbackFile` in state-tools.ts so we accept the
	// same input shapes the rest of the engine does:
	//   - "FB-001" / "FB-1" / "001" / "1"  — canonical IDs
	//   - "001-some-slug" / "01-some-slug" — filename stems (legacy + current)
	// Files on disk may be 2-digit (pre-2026-05-07) or 3-digit padded.
	// Match by parsed integer regardless of width on either side.
	const idMatch = args.feedbackId.match(/^(?:FB-)?(\d+)/i)
	if (!idMatch) return { ok: false, error: "invalid_feedback_id_shape" }
	const targetNum = Number.parseInt(idMatch[1], 10)
	const found = readdirSync(fbDir)
		.filter((f) => f.endsWith(".md"))
		.find((f) => {
			const fileNumMatch = f.match(/^(\d+)-/)
			return fileNumMatch && Number.parseInt(fileNumMatch[1], 10) === targetNum
		})
	if (!found) return { ok: false, error: "feedback_not_found" }
	const fbPath = join(fbDir, found)
	const writtenKeys: string[] = []
	for (const [key, value] of Object.entries(args.patch)) {
		setFrontmatterField(fbPath, key, value)
		writtenKeys.push(key)
	}
	return { ok: true, written_keys: writtenKeys }
}

/** Read-only: what would the cursor return if we ticked right now?
 *  Used by the SPA debug screen to preview "after my edits, this is
 *  what the next tick will produce." No mutation; safe to call as
 *  often as the SPA wants. */
export function previewCursor(args: {
	slug: string
}): { ok: true; position: CursorPosition } | { ok: false; error: string } {
	const dir = intentDir(args.slug)
	const intentMdPath = join(dir, "intent.md")
	if (!existsSync(intentMdPath)) return { ok: false, error: "intent_not_found" }
	// `parseFrontmatter` (not raw `matter`) recovers from duplicate YAML
	// keys via `dedupeFrontmatterKeys` — exactly the corrupted-FM scenario
	// callers reach for this op to diagnose.
	const fm = parseFrontmatter(readFileSync(intentMdPath, "utf8")).data
	const studio = (fm.studio as string) || ""
	if (!studio) return { ok: false, error: "intent_missing_studio" }
	const position = derivePosition({
		slug: args.slug,
		intentDir: dir,
		studio,
	})
	return { ok: true, position }
}
