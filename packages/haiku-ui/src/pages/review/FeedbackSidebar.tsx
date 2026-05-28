/**
 * FeedbackSidebar — desktop LEFT-column composition of the review page.
 *
 * Matches the canonical design mockup (`stages/design/artifacts/review-ui-mockup.html`):
 *
 *   [Reviewing context]       stage title + current/gate badges + intent title
 *   [Feedback count header]   "Feedback — N" chip + tagline
 *   [Feedback list]           scrollable list of feedback cards
 *   [Composer + actions]      pinned bottom: textarea + smart decision button
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
 *
 * Item-click bridge: a single delegated click handler on the list body
 * surfaces the clicked feedback's id to the parent `ReviewPage`, which
 * routes a highlight request to `StageReview` to scroll-and-flash the
 * matching artifact card.
 */

import type { ApproveAction, ReviewAnnotations } from "haiku-api"
import { useCallback } from "react"
import { Aside } from "../../a11y"
import { FeedbackPanelBody } from "./FeedbackPanelBody"
import { GateDecisionBar } from "./GateDecisionBar"
import {
	KnowledgeUploadPanel,
	type KnowledgeUploadResult,
} from "./KnowledgeUploadPanel"
import {
	countItemsAwaitingUserSubmission,
	countItemsNeedingUserVerification,
	type DecisionKind,
} from "./review-decision"
import { useFeedbackSidebarController } from "./useFeedbackSidebarController"

export interface FeedbackSidebarProps {
	stage: string | null
	activeStage?: string | null
	sessionId: string
	/** Intent slug — required for the embedded KnowledgeUploadPanel's
	 *  `POST /api/intents/:intent/uploads/knowledge` calls. When omitted,
	 *  the upload panel is hidden (e.g., session not yet bound to an
	 *  intent). */
	intentSlug?: string | null
	intentTitle?: string
	gateBadges?: Array<{ label: string; classes: string }>
	gateType?: string
	/** Server-computed Approve button copy + kind. Reflects the actual
	 *  consequence of clicking Approve (e.g. "Complete Development Stage",
	 *  "Open Pull Request", "Mark Intent Done"). Falls back to the static
	 *  "Approve" string when undefined. */
	approveAction?: ApproveAction
	getAnnotations?: () => ReviewAnnotations | undefined
	onFeedbackItemClick?: (feedbackId: string) => void
	onDecisionSuccess?: (decision: DecisionKind) => void
	/** When true, the pane is an ad-hoc on-demand review. Approve is
	 *  hidden (no gate to advance); the primary button becomes "Done"
	 *  (no pending feedback) or "Request Changes" (pending feedback
	 *  persists and will be picked up by the next run_next). */
	adHoc?: boolean
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
	className?: string
}

export function FeedbackSidebar({
	stage,
	activeStage,
	sessionId,
	intentSlug,
	intentTitle,
	gateBadges,
	gateType,
	approveAction,
	getAnnotations,
	onFeedbackItemClick,
	onDecisionSuccess,
	adHoc = false,
	awaitActive,
	pendingDecisionQueued,
	className,
}: FeedbackSidebarProps): React.ReactElement {
	const {
		items,
		loading,
		error,
		busyIds,
		creating,
		retry,
		handleStatusChange,
		handleDelete,
		handleReply,
		handleDismissClosureReply,
	} = useFeedbackSidebarController()

	// Only HUMAN-authored pending FBs count toward the "Send N to
	// agent" affordance. Agent / system FBs at pending are already
	// queued for the next tick's feedback walk — surfacing them as
	// "items to hand to the agent" lies about the workflow state and
	// confused reviewers (reported 2026-05-13: 23 agent-authored
	// pending FBs surfaced "Send 23 to agent"). Logic in
	// `countItemsAwaitingUserSubmission`. Used here for the header
	// badges; the decision controls compute their own copy in
	// `GateDecisionBar`.
	const pendingCount = countItemsAwaitingUserSubmission(items)
	// Items the agent has marked as addressed / answered but the user
	// has not yet verified. Surfaced here only for the header badge +
	// the empty-state ("0") chip; the verify gate itself lives in
	// `GateDecisionBar`. SCOPE: ONLY human-authored items require user
	// verification. Logic lives in `countItemsNeedingUserVerification`.
	const unverifiedCount = countItemsNeedingUserVerification(items)
	const openCount = pendingCount + unverifiedCount

	// Upload handler — POSTs each file to
	// `/api/intents/:intent/uploads/knowledge` (registered in
	// http/upload-routes.ts). Returns the canonical KnowledgeUploadResult
	// shape so the panel can render success/failure toasts and progress
	// bars without further translation. Empty / failure cases return
	// structurally-valid results so the panel never throws on a half-done
	// upload — partial successes show in `uploaded`, partial failures in
	// `failed`.
	const handleKnowledgeUpload = useCallback(
		async (
			files: File[],
			destination: string,
		): Promise<KnowledgeUploadResult> => {
			if (!intentSlug) {
				return {
					ok: false,
					uploaded: [],
					failed: files.map((f) => ({
						file: f,
						error: "Intent context unavailable — refresh and retry.",
					})),
				}
			}
			const uploaded: File[] = []
			const failed: KnowledgeUploadResult["failed"] = []
			for (const file of files) {
				const form = new FormData()
				form.append("file", file)
				form.append("destination", destination)
				try {
					const res = await fetch(
						`/api/intents/${encodeURIComponent(intentSlug)}/uploads/knowledge`,
						{ method: "POST", body: form, credentials: "include" },
					)
					if (!res.ok) {
						const detail = await res.text().catch(() => "")
						failed.push({
							file,
							error: `Upload failed (HTTP ${res.status}): ${detail || "no response body"}`,
						})
						continue
					}
					uploaded.push(file)
				} catch (err) {
					failed.push({
						file,
						error: err instanceof Error ? err.message : String(err),
					})
				}
			}
			return { ok: failed.length === 0, uploaded, failed }
		},
		[intentSlug],
	)
	const isCurrent = !!stage && stage === activeStage

	const handleBodyClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>): void => {
			if (!onFeedbackItemClick) return
			const card = (e.target as HTMLElement).closest<HTMLElement>(
				"[data-feedback-id]",
			)
			if (!card) return
			const id = card.getAttribute("data-feedback-id")
			if (id) onFeedbackItemClick(id)
		},
		[onFeedbackItemClick],
	)

	return (
		<Aside
			data-testid="feedback-sidebar-desktop"
			ariaLabel="Review sidebar"
			className={`hidden xl:flex w-[var(--sidebar-width)] xl:w-[var(--sidebar-width-xl)] shrink-0 flex-col bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 overflow-hidden ${className ?? ""}`}
		>
			{/* Reviewing context */}
			<div className="shrink-0 px-4 py-3 border-b border-stone-200 dark:border-stone-800">
				<p className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-stone-500 mb-1">
					Reviewing
				</p>
				<h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-tight capitalize">
					{stage ?? "Intent"}
				</h2>
				<div className="flex items-center gap-1.5 mt-2 flex-wrap">
					{stage && (
						<span
							className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${isCurrent ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"}`}
						>
							{isCurrent ? "current" : "viewing"}
						</span>
					)}
					{/* Gate badges describe the workflow gate that's currently
					    open (e.g. "Approve specs", "External review"). They're
					    meaningless on an ad-hoc review pane — there's no gate
					    to advance — and surfacing them makes ad-hoc panes
					    visually indistinguishable from gate reviews. Skip
					    them when adHoc, and render an "Ad-hoc" pill instead
					    so the state is explicit. */}
					{adHoc ? (
						<span
							className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
							title="Ad-hoc review — not a gate. Feedback routes through the normal fix-loop on the next run_next."
						>
							Ad-hoc
						</span>
					) : (
						gateBadges?.map((b) => (
							<span
								key={b.label}
								className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${b.classes}`}
							>
								{b.label}
							</span>
						))
					)}
					{intentTitle && (
						<span className="text-xs text-stone-500 truncate">
							{intentTitle}
						</span>
					)}
				</div>
			</div>

			{/* Feedback count header */}
			<div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50">
				<div className="flex items-center gap-2">
					<span className="text-xs font-semibold text-stone-700 dark:text-stone-200 uppercase tracking-wider">
						Feedback
					</span>
					{pendingCount > 0 && (
						<span
							className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
							title={`${pendingCount} pending — awaiting agent fix`}
							data-testid="feedback-count-pending"
						>
							{pendingCount}
						</span>
					)}
					{unverifiedCount > 0 && (
						<span
							className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
							title={`${unverifiedCount} addressed — verify each before approving`}
							data-testid="feedback-count-unverified"
						>
							{unverifiedCount} to verify
						</span>
					)}
					{openCount === 0 && (
						<span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300">
							0
						</span>
					)}
				</div>
				<span className="text-xs text-stone-500 italic">
					everything is specification
				</span>
			</div>

			{/* Feedback list — scrollable; delegated click surfaces item id */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: delegated click bridges list-item clicks to the parent highlight controller without wrapping every item */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard nav lives on the contained FeedbackItem disclosure buttons; this wrapper is mouse-position-routing only */}
			<div className="flex flex-col flex-1 min-h-0" onClick={handleBodyClick}>
				<FeedbackPanelBody
					items={items}
					loading={loading}
					error={error}
					onStatusChange={handleStatusChange}
					onDelete={handleDelete}
					onRetry={retry}
					onReply={handleReply}
					onDismissClosureReply={handleDismissClosureReply}
					busyIds={busyIds}
					creating={creating}
				/>
			</div>

			{/* Knowledge upload panel — collapsible <details> below the
			    feedback list, above the composer. Per SPA-UI-SPECS §1.1.
			    Hidden when the session has no intent context (ad-hoc reviews
			    pre-bind sometimes). `defaultOpen={false}` keeps the panel
			    collapsed at first paint so its drop-zone autofocus doesn't
			    steal Tab order from the SkipLink (the FB-30 regression
			    guard test asserts the first Tab lands on the skip-link). */}
			{intentSlug && (
				<div className="shrink-0 border-t border-stone-200 dark:border-stone-700">
					<KnowledgeUploadPanel
						intentSlug={intentSlug}
						currentStage={stage ?? activeStage ?? ""}
						onUpload={handleKnowledgeUpload}
						defaultOpen={false}
					/>
				</div>
			)}

			{/* Composer + decision actions — pinned bottom. Self-contained
			    so the same controls render as a sticky bottom bar on mobile
			    (route's mobile branch); the two render sites never co-render
			    so each owns its own composer state. */}
			<GateDecisionBar
				stage={stage}
				activeStage={activeStage}
				sessionId={sessionId}
				gateType={gateType}
				approveAction={approveAction}
				getAnnotations={getAnnotations}
				onDecisionSuccess={onDecisionSuccess}
				adHoc={adHoc}
				awaitActive={awaitActive}
				pendingDecisionQueued={pendingDecisionQueued}
			/>
		</Aside>
	)
}
