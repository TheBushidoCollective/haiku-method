/**
 * review-decision — pure decision helpers + primitives for the review
 * gate controls.
 *
 * Extracted from `FeedbackSidebar.tsx` so the same logic backs both the
 * desktop sidebar's pinned-bottom action bar AND the route's mobile
 * sticky bottom bar (`GateDecisionBar`). These are pure functions +
 * constant tables with no React dependency — independently unit-testable.
 */

export type DecisionKind = "approved" | "external"

export const DECISION_LABELS: Record<DecisionKind, string> = {
	approved: "Approve",
	external: "External",
}

export const DECISION_ANNOUNCE: Record<DecisionKind, string> = {
	approved: "Review approved",
	external: "External review submitted",
}

export function isExternalGate(gateType: string | undefined): boolean {
	return !!gateType && gateType.includes("external")
}

/**
 * Whether the gate accepts the local Approve button. Pure-external gates
 * (gateType is exactly "external") satisfy ONLY through the external
 * VCS merge — local Approve would advance the workflow without the PR
 * actually merging, which is wrong. Compound gates ("external,ask" or
 * "ask,external") accept either path; ask/auto/await accept Approve.
 */
export function gateAcceptsLocalApprove(gateType: string | undefined): boolean {
	if (!gateType) return true
	const tokens = gateType
		.split(",")
		.map((t) => t.trim().toLowerCase())
		.filter(Boolean)
	if (tokens.length === 0) return true
	if (tokens.length === 1 && tokens[0] === "external") return false
	return true
}

export type DecisionMode =
	| "add"
	| "request"
	| "verify-required"
	| "approve"
	| "disabled"

/**
 * Pure mode-decision logic — exported for unit tests. Mirrors the
 * inline logic in `FeedbackSidebar` exactly.
 *
 * The principle (2026-05-12): "a person cannot approve a stage if
 * there is still open feedback." Open includes:
 *
 *   - `pending`  — awaiting agent fix-loop
 *   - `fixing`   — agent actively working
 *   - `addressed` — agent marked done; awaiting USER verification
 *                   via the FeedbackItem "Verify & Close" button
 *   - `answered`  — question-type FB answered; awaiting user
 *                   verification
 *
 * If any pending items exist, Request Changes is the primary action
 * (mode=`request`). If only addressed/answered items exist (agent has
 * worked everything but user hasn't verified yet), Approve is blocked
 * with mode=`verify-required` — the user must click "Verify & Close"
 * on each addressed card before the gate opens.
 */
export function decideMode(args: {
	hasTyped: boolean
	hasPending: boolean
	hasUnverified: boolean
	adHoc: boolean
	isCurrent: boolean
}): DecisionMode {
	if (args.hasTyped) return "add"
	if (args.hasPending) return "request"
	if (args.hasUnverified) return "verify-required"
	if (args.adHoc) return "approve"
	if (args.isCurrent) return "approve"
	return "disabled"
}

/**
 * Count addressed / answered feedback items that ONLY a human reviewer
 * can close — exported for unit tests. Exposed as a pure helper so the
 * filter is independently testable from the React render path.
 *
 * Why only `author_type === "human"`: agent- and system-authored FBs
 * (adversarial-review, drift, studio-review, etc.) auto-close on the
 * terminal fix-hat advance. They never need a human in the loop. If
 * they're sitting at `addressed`/`answered` without closing, that's an
 * engine bug to fix in the workflow — the SPA should not put a wall in
 * front of the user. Reported 2026-05-13 on `admin-portal-reimagine`
 * design (23 agent-authored items stuck at `addressed`, blocking
 * Approve with "23 to verify").
 */
export function countItemsNeedingUserVerification(
	items: ReadonlyArray<{
		status: string
		author_type: "agent" | "human" | "system" | null
	}>,
): number {
	return items.filter(
		(i) =>
			(i.status === "addressed" || i.status === "answered") &&
			i.author_type === "human",
	).length
}

/**
 * Count human-authored items the user might still hand to the agent
 * via the "Send N to agent" / "Request Changes" affordance — exported
 * for unit tests. Same reasoning as
 * `countItemsNeedingUserVerification`: agent- and system-authored
 * pending FBs are picked up by the cursor's feedback walk on the next
 * tick without any human action. They MUST NOT be surfaced as items
 * the user needs to "send" — that copy implies the agent doesn't know
 * about them yet, which is false. Reported 2026-05-13 on
 * `admin-portal-reimagine` design (23 agent-authored pending FBs
 * showing "Send 23 to agent").
 */
export function countItemsAwaitingUserSubmission(
	items: ReadonlyArray<{
		status: string
		author_type: "agent" | "human" | "system" | null
	}>,
): number {
	return items.filter(
		(i) => i.status === "pending" && i.author_type === "human",
	).length
}
