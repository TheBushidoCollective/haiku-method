/**
 * Post-close-hook for `haiku_feedback_advance_hat`. Runs when the
 * fix-loop terminal hat closes an FB. Splits two responsibilities the
 * close-time path used to share with the orchestrator's
 * `close_feedback` action (in `haiku_run_next`):
 *
 * 1. Walk `targets.invalidates` and delete the named review/approval
 *    roles on the targeted unit's frontmatter. Without this, an
 *    FB-closure that promises to "clear the user approval" via
 *    `target_invalidates: ["user"]` would silently leave the witnessed
 *    slot alive — the cursor never re-routes through the gate, and
 *    drift sweeps that key on a stale witness keep firing forever
 *    (reported 2026-05-14 on `admin-portal-reimagine` design stage).
 *
 * 2. For `origin: drift` FBs only, REBUILD the surviving review and
 *    approval slots on the targeted unit using the CURRENT on-disk
 *    content as the witness. This is what unwedges the drift loop:
 *    the next drift sweep tick hashes today's bytes and matches the
 *    refreshed witness, instead of the pre-fix-loop SHAs.
 *
 * Lives in its own module so `state-tools.ts` (whose
 * `haiku_feedback_advance_hat` handler invokes this) doesn't have to
 * import from `orchestrator/workflow/dispatch-stamps.js` —
 * `dispatch-stamps` already imports the other way, and dropping that
 * arrow in would close a circular dependency. By colocating the
 * sign-slot + dispatch-stamps consumers HERE, the import graph stays
 * acyclic: `feedback-close-hook` → `dispatch-stamps` + `sign-slot`
 * (both downstream of `state-tools`), and `state-tools` →
 * `feedback-close-hook` (forward only).
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { applyFeedbackInvalidations } from "./orchestrator/workflow/dispatch-stamps.js"
import { bodySha256 } from "./orchestrator/workflow/sign-slot.js"
import { findHaikuRoot, setFrontmatterField } from "./state-tools.js"
import { emitTelemetry } from "./telemetry.js"

export interface CloseFeedbackPostHookArgs {
	slug: string
	stage: string | undefined
	feedbackId: string
	fbFm: Record<string, unknown>
}

export function closeFeedbackPostHook(args: CloseFeedbackPostHookArgs): void {
	const targets =
		(args.fbFm.targets as Record<string, unknown> | undefined) ?? {}
	const targetUnit = typeof targets.unit === "string" ? targets.unit : undefined
	const invalidates = Array.isArray(targets.invalidates)
		? (targets.invalidates as unknown[]).filter(
				(r): r is string => typeof r === "string",
			)
		: []

	// (1) Clear named roles on the targeted unit. Stage-scoped only —
	// intent-scope FB closures have a separate code path (sealIntent
	// already runs before this hook fires).
	if (targetUnit && args.stage && invalidates.length > 0) {
		try {
			applyFeedbackInvalidations({
				slug: args.slug,
				stage: args.stage,
				targetUnit,
				invalidates,
			})
		} catch (err) {
			emitTelemetry("haiku.feedback.invalidations_failed", {
				intent: args.slug,
				stage: args.stage,
				feedback_id: args.feedbackId,
				target_unit: targetUnit,
				invalidates: invalidates.join(","),
				error: String((err as Error)?.message ?? err),
			})
		}
	}

	// (2) Restamp surviving review/approval `body_sha256` witnesses on
	// the targeted unit (2026-05-18 — haiku-loop-bug regression fix).
	//
	// When a fix-loop hat edits the unit body to address THIS finding,
	// the body_sha256 of any review/approval role NOT in
	// `targets.invalidates` becomes stale. The next drift sweep sees
	// `body_sha256 != current` for those still-signed roles and fires
	// `spec` drift events for each one — even though the modification
	// was a deliberate, on-script fix the classifier already routed.
	// The drift handler restamps the witness AND files an FB for each
	// detected event; the FB queue fills up with self-healed-by-design
	// findings the fix-loop can't actually act on (the work that
	// "caused" the drift already happened — there's nothing to fix).
	//
	// Reported 2026-05-18 on admin-portal-reimagine/design: FB-160
	// (continuity) was closed after the designer added LAYOUT-GRID
	// citations to specs 01-05; the next sweep filed FB-161 through
	// FB-165 against the same files for `input_mutation drift`, all
	// classified as intent-scope with `target_unit: null` and all 7
	// roles invalidated. The fix loop tried to designer-fix them, made
	// no on-disk progress (nothing actionable), and `loop_halted`.
	//
	// The fix: at close time, restamp `body_sha256` on every still-
	// signed review/approval slot to the unit's CURRENT body sha. The
	// roles named in `targets.invalidates` are already deleted by (1)
	// above; only the SURVIVING roles get restamped. Semantic: "the
	// fix-loop's body modification is authoritative; non-invalidated
	// roles re-witness against the new body."
	//
	// Scoped to fix-loop closures (closed_by starts with "fix-loop:")
	// — manual closes via `haiku_feedback_reject` or other paths
	// don't reach this hook by definition (it's only called by
	// `haiku_feedback_advance_hat`'s terminal-hat path), so the prefix
	// check is belt-and-suspenders against future call sites.
	if (targetUnit && args.stage) {
		try {
			restampSurvivingWitnesses({
				slug: args.slug,
				stage: args.stage,
				targetUnit,
				invalidates,
			})
		} catch (err) {
			emitTelemetry("haiku.feedback.witness_restamp_failed", {
				intent: args.slug,
				stage: args.stage,
				feedback_id: args.feedbackId,
				target_unit: targetUnit,
				error: String((err as Error)?.message ?? err),
			})
		}
	}

}

/** Restamp `body_sha256` on every signed review/approval role on the
 *  target unit (except those just invalidated). Caller passes the
 *  invalidates list so we don't re-stamp slots the caller deleted. */
function restampSurvivingWitnesses(args: {
	slug: string
	stage: string
	targetUnit: string
	invalidates: string[]
}): void {
	const root = findHaikuRoot()
	const unitPath = join(
		root,
		"intents",
		args.slug,
		"stages",
		args.stage,
		"units",
		`${args.targetUnit}.md`,
	)
	if (!existsSync(unitPath)) return
	const currentBodySha = bodySha256(unitPath)
	if (!currentBodySha) return
	const raw = readFileSync(unitPath, "utf8")
	const parsed = matter(raw)
	const fm = parsed.data as Record<string, unknown>
	const invalidatesSet = new Set(args.invalidates)
	const restamped = (
		fieldName: "reviews" | "approvals",
	): Record<string, unknown> | null => {
		const slots = fm[fieldName]
		if (!slots || typeof slots !== "object" || Array.isArray(slots)) return null
		const next: Record<string, unknown> = { ...(slots as Record<string, unknown>) }
		let changed = false
		for (const [role, slot] of Object.entries(next)) {
			if (invalidatesSet.has(role)) continue
			if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue
			const slotRec = slot as Record<string, unknown>
			if (typeof slotRec.at !== "string") continue
			if (slotRec.body_sha256 === currentBodySha) continue
			next[role] = { ...slotRec, body_sha256: currentBodySha }
			changed = true
		}
		return changed ? next : null
	}
	const newReviews = restamped("reviews")
	if (newReviews) setFrontmatterField(unitPath, "reviews", newReviews)
	const newApprovals = restamped("approvals")
	if (newApprovals) setFrontmatterField(unitPath, "approvals", newApprovals)
}
