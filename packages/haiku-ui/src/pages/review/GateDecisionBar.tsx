/**
 * GateDecisionBar — the review gate's composer + smart decision controls,
 * self-contained so it can render at every viewport width.
 *
 * Two render sites, never co-rendered (the route toggles on
 * `useIsMobile()`):
 *   - the pinned bottom of the desktop `FeedbackSidebar` (≥ xl) —
 *     `composer` defaults to true, so the FULL composer + decision render
 *     together (unchanged), and
 *   - a sticky bottom bar in the route's mobile branch (< xl) — rendered
 *     with `composer={false}`, so it is DECISION-ONLY. On mobile the
 *     comment composer lives inside the feedback drawer
 *     (`<FeedbackComposer/>`), not the bottom bar — "the approve button is
 *     its own thing, not part of feedback authoring."
 *
 * Because the two sites never mount together, this component owns its own
 * local composer state (`composerText`, `addingComment`, `submitting`,
 * `revisitOpen`) — no shared-state plumbing needed. It reads the feedback
 * list + mutators from `useFeedbackSidebarController()`, the API client,
 * and the announcer; everything else (the gate props) is passed in by the
 * render site.
 *
 * When `composer={false}` the textarea + Add-comment button are omitted;
 * `composerText` stays empty so `hasTyped` is always false and the gate
 * mode is driven purely by pending / unverified / approve state. The
 * Request-Changes path (RevisitModal) and Approve stay in the bar.
 *
 * Smart decision button (canonical mockup §onApprove/onRequestChanges):
 *   - If there is any pending feedback on this stage OR the composer has
 *     typed text, the button is "Request Changes" (amber) and clicking it
 *     opens the RevisitModal with the current stage pinned as the revisit
 *     target. The composer text becomes the first reason.
 *   - Otherwise, if the selected stage IS the current active stage, the
 *     button is "Approve" (green) and posts to `submitDecision`.
 *   - Otherwise (non-current stage, nothing pending, nothing typed), the
 *     button is a disabled hint "Add feedback above to enable".
 */

import type { ApproveAction, ReviewAnnotations } from "haiku-api"
import { useCallback, useState } from "react"
import {
	focusRingClass,
	focusRingVariantClasses,
	touchTargetClass,
	useAnnounce,
} from "../../a11y"
import { useApiClient } from "../../api/context"
import { RevisitModal } from "../../organisms/RevisitModal"
import {
	countItemsAwaitingUserSubmission,
	countItemsNeedingUserVerification,
	DECISION_ANNOUNCE,
	DECISION_LABELS,
	type DecisionKind,
	type DecisionMode,
	decideMode,
	gateAcceptsLocalApprove,
	isExternalGate,
} from "./review-decision"
import { useFeedbackSidebarController } from "./useFeedbackSidebarController"

export interface GateDecisionBarProps {
	stage: string | null
	activeStage?: string | null
	sessionId: string
	gateType?: string
	/** Server-computed Approve button copy + kind. Reflects the actual
	 *  consequence of clicking Approve (e.g. "Complete Development Stage",
	 *  "Open Pull Request", "Mark Intent Done"). Falls back to the static
	 *  "Approve" string when undefined. */
	approveAction?: ApproveAction
	getAnnotations?: () => ReviewAnnotations | undefined
	onDecisionSuccess?: (decision: DecisionKind) => void
	/** When true, the pane is an ad-hoc on-demand review. Approve is
	 *  hidden (no gate to advance); the primary button becomes "Done"
	 *  (no pending feedback) or "Request Changes" (pending feedback
	 *  persists and will be picked up by the next run_next). */
	adHoc: boolean
	/** True while a haiku_await_gate tool call is currently blocked on
	 *  this session. When false, Approve is disabled — the engine isn't
	 *  asking for a decision right now. Feedback authoring stays open
	 *  regardless, and the empty-state hint nudges the user toward
	 *  leaving feedback to force a decision on the next tick. */
	awaitActive?: boolean
	/** Set when the SPA submitted a decision while no await was open.
	 *  The next haiku_await_gate call drains it on entry. While set,
	 *  Approve is disabled and the hint shows "decision queued, waiting
	 *  for engine." */
	pendingDecisionQueued?: boolean
	/** Applied to the outer footer wrapper so the route can position it
	 *  (sticky bottom bar) differently from the in-sidebar use. */
	className?: string
	/** Whether to render the inline comment composer (textarea +
	 *  Add-comment button). Defaults to true — the desktop sidebar
	 *  pins the FULL composer + decision together. The mobile bottom
	 *  bar passes `false` so it renders DECISION-ONLY; the composer
	 *  lives inside the feedback drawer there. */
	composer?: boolean
}

export function GateDecisionBar({
	stage,
	activeStage,
	sessionId,
	gateType,
	approveAction,
	getAnnotations,
	onDecisionSuccess,
	adHoc,
	awaitActive,
	pendingDecisionQueued,
	className,
	composer = true,
}: GateDecisionBarProps): React.ReactElement {
	const { items, createFeedback, refetch } = useFeedbackSidebarController()

	const client = useApiClient()
	const announce = useAnnounce()
	// `composerText` stages the NEXT comment. Pressing "Add" creates a
	// pending feedback item; the textarea clears. Request Changes then
	// fires revisit with whatever pending items have accumulated — no
	// blob-text pooling at the decide step.
	const [composerText, setComposerText] = useState("")
	// (2026-05-06) The `resolution` dropdown was removed. Comments now
	// always create with `origin: "user-chat"` and `resolution: null`;
	// the agent classifies routing via target_unit / target_invalidates
	// at FB-create time + (future) classifier-hat analysis of the body.
	// The reviewer's job is to type what they mean, not to triage.
	const [addingComment, setAddingComment] = useState(false)
	const [submitting, setSubmitting] = useState<DecisionKind | null>(null)
	const [revisitOpen, setRevisitOpen] = useState(false)

	// Only HUMAN-authored pending FBs count toward the "Send N to
	// agent" affordance. Agent / system FBs at pending are already
	// queued for the next tick's feedback walk — surfacing them as
	// "items to hand to the agent" lies about the workflow state and
	// confused reviewers (reported 2026-05-13: 23 agent-authored
	// pending FBs surfaced "Send 23 to agent"). Logic in
	// `countItemsAwaitingUserSubmission`.
	const pendingCount = countItemsAwaitingUserSubmission(items)
	const hasPending = pendingCount > 0
	// Items the agent has marked as addressed / answered but the user
	// has not yet verified (set to `closed` via the review UI's
	// "Verify & Close" button). These block Approve too — per the
	// workflow principle "a person cannot approve a stage if there is
	// still open feedback" (2026-05-12). SCOPE: ONLY human-authored
	// items require user verification. Logic lives in
	// `countItemsNeedingUserVerification`.
	const unverifiedCount = countItemsNeedingUserVerification(items)
	const hasUnverified = unverifiedCount > 0

	// `hasTyped` gates the "add" mode. When the inline composer is hidden
	// (mobile bottom bar — authoring moved to the drawer) there is no
	// textarea, so typing is impossible and the bar is decision-only.
	const hasTyped = composer && composerText.trim().length > 0
	const showExternal = isExternalGate(gateType)
	const showLocalApprove = gateAcceptsLocalApprove(gateType)
	const isCurrent = !!stage && stage === activeStage

	// Decide which action to emphasize. Typed text → Add is the primary
	// action (stage a comment). Any pending items → Request Changes is
	// primary (fire revisit). Addressed-but-unverified items →
	// `verify-required` mode (the user MUST click "Verify & Close" on
	// each addressed FB before the stage can be approved). Otherwise
	// the stage is clean and we offer Approve.
	//
	// Ad-hoc pane: Approve is never shown (no gate). When nothing is
	// pending the primary button becomes "Done" (just close the tab —
	// the mode label stays "approve" internally but the rendered button
	// is swapped below). When feedback is pending it becomes "Request
	// Changes" that closes the tab without firing revisit — the next
	// run_next picks the feedback up via the normal fix-loop.
	const mode: DecisionMode = decideMode({
		hasTyped,
		hasPending,
		hasUnverified,
		adHoc,
		isCurrent,
	})

	const handleAddComment = useCallback(async () => {
		const body = composerText.trim()
		if (!body) return
		setAddingComment(true)
		try {
			const firstLine = body.split("\n")[0]?.slice(0, 80) || "Comment"
			await createFeedback({
				title: firstLine,
				body,
				origin: "user-chat",
				source_ref: null,
			})
			setComposerText("")
			announce("polite", "Comment added")
		} catch (err) {
			announce(
				"assertive",
				err instanceof Error ? err.message : "Failed to add comment",
			)
		} finally {
			setAddingComment(false)
		}
	}, [announce, composerText, createFeedback])

	const submit = useCallback(
		async (decision: DecisionKind): Promise<void> => {
			setSubmitting(decision)
			try {
				await client.submitDecision(sessionId, {
					decision,
					feedback: composerText,
					annotations: getAnnotations?.(),
				})
				announce("polite", DECISION_ANNOUNCE[decision])
				setComposerText("")
				onDecisionSuccess?.(decision)
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Decision failed to submit"
				announce("assertive", message)
			} finally {
				setSubmitting(null)
			}
		},
		[
			announce,
			client,
			composerText,
			getAnnotations,
			sessionId,
			onDecisionSuccess,
		],
	)

	// Live-session gating: in non-ad-hoc gate review, Approve is only
	// active when an MCP haiku_await_gate is currently waiting on a
	// decision (awaitActive=true). When the engine isn't asking
	// (awaitActive=false), Approve is disabled — the user can still
	// leave feedback, and the next workflow tick will pick it up. When
	// a decision is already queued (pendingDecisionQueued), Approve is
	// disabled with a "waiting for engine to consume" hint.
	const approveGated =
		mode === "approve" && !adHoc && (!awaitActive || !!pendingDecisionQueued)

	const hintText = adHoc
		? mode === "add"
			? "Adds a pending feedback item. Persisted immediately — the next run_next picks it up via the normal fix-loop."
			: mode === "request"
				? `${pendingCount} pending item${pendingCount === 1 ? "" : "s"} already persisted. Request Changes closes this pane; the next run_next routes each item through the normal fix-loop.`
				: mode === "verify-required"
					? `${unverifiedCount} addressed item${unverifiedCount === 1 ? "" : "s"} waiting for your verification. Click "Verify & Close" on each card above to confirm the agent's fix, or "Reopen" to send it back to the agent.`
					: "Ad-hoc review — no gate to advance. Done closes the pane without touching the workflow engine."
		: mode === "add"
			? 'Adds a pending feedback item. Use the Route dropdown to steer the agent, or leave it on "Let agent decide" and the triage pass will classify.'
			: mode === "request"
				? `Hands ${pendingCount} item${pendingCount === 1 ? "" : "s"} to the agent on ${stage ?? "(stage)"}. Each routes per its resolution: reply, inline fix, stage revisit, or upstream rewind.`
				: mode === "verify-required"
					? `Approve is blocked: ${unverifiedCount} addressed item${unverifiedCount === 1 ? "" : "s"} need${unverifiedCount === 1 ? "s" : ""} your verification before the stage can advance. Click "Verify & Close" on each card above to confirm the agent's fix, or "Reopen" to send it back. The stage cannot be approved while any feedback is open.`
					: mode === "approve"
						? pendingDecisionQueued
							? "Decision queued — waiting for the engine to consume it on the next tick."
							: awaitActive
								? "Engine is waiting on your decision. Approve to advance, or leave feedback to request changes."
								: "No engine call is awaiting a decision right now. Leave feedback to force one on the next tick, or wait for the agent to drive back to a gate."
						: composer
							? "Type a comment above to leave feedback on this stage. Only the active stage can be approved — select it to approve."
							: "Open the feedback panel to leave a comment on this stage. Only the active stage can be approved — select it to approve."

	return (
		<>
			{/* Composer + decision actions — pinned bottom. Base class kept
			    byte-for-byte identical to the legacy in-sidebar footer; the
			    optional positional `className` is joined without a trailing
			    space so the desktop render matches the committed DOM
			    snapshot. */}
			<div
				data-testid="review-footer-bar"
				className={[
					"shrink-0 border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 space-y-2",
					className ?? "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				{composer && (
					<textarea
						value={composerText}
						onChange={(e) => setComposerText(e.target.value)}
						onKeyDown={(e) => {
							// Meta/Ctrl+Enter adds the comment without reaching
							// for the mouse. Plain Enter still inserts a newline
							// — reviewers type multi-line comments often enough
							// that hijacking Enter would be a footgun.
							if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
								e.preventDefault()
								void handleAddComment()
							}
						}}
						placeholder="Add a comment on this stage…"
						rows={2}
						disabled={addingComment}
						aria-disabled={addingComment || undefined}
						className="w-full text-xs p-2 border border-stone-300 dark:border-stone-600 rounded-lg bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none disabled:bg-stone-100 disabled:text-stone-500 dark:disabled:bg-stone-800 dark:disabled:text-stone-400 disabled:cursor-not-allowed"
					/>
				)}
				<div className="flex gap-2 flex-wrap">
					{composer && (mode === "add" || mode === "disabled") && (
						<button
							type="button"
							onClick={() => void handleAddComment()}
							disabled={!hasTyped || addingComment}
							className={`${touchTargetClass} flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 hover:bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition-colors disabled:bg-stone-200 disabled:text-stone-500 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 dark:disabled:bg-stone-700 dark:disabled:text-stone-400`}
						>
							{addingComment
								? "Adding…"
								: hasTyped
									? "Add comment (⌘↵)"
									: "Type a comment to add"}
						</button>
					)}
					{mode === "request" && !adHoc && (
						<button
							type="button"
							onClick={() => setRevisitOpen(true)}
							disabled={submitting !== null}
							data-decision="changes_requested"
							className={`${touchTargetClass} ${focusRingClass} ${focusRingVariantClasses.requestChanges} flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 hover:bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`}
						>
							{isCurrent
								? `Send ${pendingCount} to agent`
								: `Send ${pendingCount} on ${stage}`}
						</button>
					)}
					{mode === "request" && adHoc && (
						<button
							type="button"
							onClick={() => void submit("changes_requested")}
							disabled={submitting !== null}
							data-decision="ad_hoc_request_changes"
							className={`${touchTargetClass} ${focusRingClass} ${focusRingVariantClasses.requestChanges} flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 hover:bg-amber-700 px-3 py-2 text-xs font-semibold text-white transition-colors`}
							title="Ad-hoc review: pending feedback is already persisted. Clicking this closes the pane and signals the MCP call to return; the next run_next routes each item through the normal fix-loop."
						>
							{submitting ? "Submitting…" : `Request Changes (${pendingCount})`}
						</button>
					)}
					{mode === "verify-required" && (
						<button
							type="button"
							disabled
							data-decision="approve-blocked-verify"
							data-testid="approve-blocked-verify"
							title={`Approve is blocked. ${unverifiedCount} addressed item${unverifiedCount === 1 ? "" : "s"} need${unverifiedCount === 1 ? "s" : ""} your verification — click "Verify & Close" on each card above. The stage cannot be approved while any feedback is open.`}
							className={`${touchTargetClass} flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-md bg-emerald-100 border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 cursor-not-allowed`}
						>
							Verify {unverifiedCount} to approve
						</button>
					)}
					{mode === "approve" && !adHoc && showLocalApprove && (
						<button
							type="button"
							onClick={() => void submit("approved")}
							disabled={submitting !== null || approveGated}
							data-decision="approved"
							data-await-gated={approveGated || undefined}
							title={
								pendingDecisionQueued
									? "Decision queued — waiting for the engine to consume it on the next tick."
									: !awaitActive
										? "No engine call is awaiting a decision right now. Leave feedback to force one on the next tick."
										: undefined
							}
							className={`${touchTargetClass} ${focusRingClass} ${focusRingVariantClasses.approve} flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-green-300 disabled:text-green-800 dark:disabled:bg-green-900/40 dark:disabled:text-green-200`}
						>
							{approveAction?.label ?? DECISION_LABELS.approved}
						</button>
					)}
					{mode === "approve" && adHoc && (
						<button
							type="button"
							onClick={() => void submit("approved")}
							disabled={submitting !== null}
							data-decision="ad_hoc_done"
							className={`${touchTargetClass} ${focusRingClass} flex-1 min-w-0 inline-flex items-center justify-center gap-2 rounded-md bg-stone-700 hover:bg-stone-800 px-3 py-2 text-xs font-semibold text-white transition-colors`}
							title="Ad-hoc review — no gate to advance. Closes the pane and signals the MCP call to return."
						>
							{submitting ? "Submitting…" : "Done"}
						</button>
					)}
					{showExternal && mode === "approve" && !adHoc && (
						<button
							type="button"
							onClick={() => void submit("external")}
							disabled={submitting !== null || approveGated}
							data-decision="external"
							data-await-gated={approveGated || undefined}
							className={`${touchTargetClass} ${focusRingClass} inline-flex items-center gap-2 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50`}
						>
							{DECISION_LABELS.external}
						</button>
					)}
				</div>
				<p className="text-xs text-stone-500 dark:text-stone-300 leading-snug pt-1 border-t border-stone-100 dark:border-stone-800">
					{hintText}
				</p>
			</div>

			<RevisitModal
				sessionId={sessionId}
				open={revisitOpen}
				onClose={() => setRevisitOpen(false)}
				onSuccess={() => {
					announce("polite", "Feedback sent to agent")
					setComposerText("")
					// Re-pull the feedback list so the previously-pending
					// items show their new server-side status instead of
					// staying stuck on "pending" — that lag is what made
					// reviewers think the modal "did nothing" (Matt's
					// session, L996 — items showed pending after a
					// successful revisit submit).
					void refetch()
				}}
				targetStage={stage ?? undefined}
				pendingItems={items.filter((i) => i.status === "pending")}
			/>
		</>
	)
}
