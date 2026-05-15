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
import {
	buildApprovalRecord,
	buildReviewRecord,
} from "./orchestrator/workflow/sign-slot.js"
import { intentDir, setFrontmatterField } from "./state-tools.js"
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

	// (2) Drift-origin FBs: refresh witnesses on every surviving slot
	// so the next drift sweep compares against today's content. Without
	// this, even after step (1) clears the offending slot, other slots
	// on the same unit (e.g. `reviews.spec`) keep their pre-drift
	// witnesses and the sweep would re-fire.
	if (args.fbFm.origin === "drift" && targetUnit && args.stage) {
		try {
			const unitPath = join(
				intentDir(args.slug),
				"stages",
				args.stage,
				"units",
				`${targetUnit}.md`,
			)
			if (existsSync(unitPath)) {
				const raw = readFileSync(unitPath, "utf8")
				const parsed = matter(raw)
				const fm = parsed.data as Record<string, unknown>
				const outputs = Array.isArray(fm.outputs)
					? (fm.outputs as string[])
					: []
				const reviews =
					fm.reviews && typeof fm.reviews === "object"
						? { ...(fm.reviews as Record<string, unknown>) }
						: {}
				for (const role of Object.keys(reviews)) {
					reviews[role] = buildReviewRecord(unitPath)
				}
				const approvals =
					fm.approvals && typeof fm.approvals === "object"
						? { ...(fm.approvals as Record<string, unknown>) }
						: {}
				for (const role of Object.keys(approvals)) {
					approvals[role] = buildApprovalRecord(intentDir(args.slug), outputs)
				}
				setFrontmatterField(unitPath, "reviews", reviews)
				setFrontmatterField(unitPath, "approvals", approvals)
			}
		} catch (err) {
			emitTelemetry("haiku.feedback.drift_refresh_failed", {
				intent: args.slug,
				stage: args.stage,
				feedback_id: args.feedbackId,
				target_unit: targetUnit,
				error: String((err as Error)?.message ?? err),
			})
		}
	}
}
