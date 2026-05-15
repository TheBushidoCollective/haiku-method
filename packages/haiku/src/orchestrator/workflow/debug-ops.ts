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

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	intentDir,
	parseFrontmatter,
	setFrontmatterField,
} from "../../state-tools.js"
import { resolveStudioStages } from "../studio.js"
import { type CursorPosition, derivePosition } from "./cursor.js"
import { approvalRolesFor, reviewRolesFor } from "./derived-stage-state.js"
import { buildApprovalRecord, buildReviewRecord } from "./sign-slot.js"

export interface DebugForceStageResult {
	stages_processed: string[]
	units_signed: number
	intent_quality_gates_signed: boolean
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

	return {
		ok: true,
		result: {
			stages_processed: stagesProcessed,
			units_signed: unitsSigned,
			intent_quality_gates_signed: igsSigned,
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
	// Find the FB file by ID prefix (FB-NN-slug.md → match on numeric prefix).
	// `$` anchor matters: without it `"FB-037-anything"` silently matches.
	// FB files on disk are `NNN-slug.md`, never `FB-NNN-slug.md`, so a
	// single startsWith on the zero-padded numeric prefix is enough.
	const numMatch = args.feedbackId.match(/^(?:FB-)?(\d+)$/)
	if (!numMatch) return { ok: false, error: "invalid_feedback_id_shape" }
	const nn = numMatch[1].padStart(3, "0")
	const found = readdirSync(fbDir).find((f) => f.startsWith(`${nn}-`))
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
