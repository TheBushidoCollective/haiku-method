/**
 * FeedbackPanelBody — the shared body composition used by both the desktop
 * sidebar and the mobile sheet. Owns the per-status filter state
 * (`activeStatus`) and lays out `FeedbackSummaryBar` over `FeedbackList`.
 *
 * Extracted from `FeedbackSidebar.tsx` per FB-38.
 */

import { useMemo, useState } from "react"
import type { FeedbackStatus } from "../../atoms/feedback-tokens"
import { AgentFeedbackToggle } from "../../molecules/AgentFeedbackToggle"
import { FeedbackSummaryBar } from "../../molecules/FeedbackSummaryBar"
import { FeedbackList } from "../../organisms/FeedbackList"
import type { FeedbackItemData } from "../../types"

export interface FeedbackPanelBodyProps {
	items: FeedbackItemData[]
	loading: boolean
	error: string | null
	onStatusChange: (id: string, next: FeedbackStatus) => void
	onDelete: (id: string) => void
	onRetry: () => void
	onReply?: (
		id: string,
		body: string,
		closeAsAnswered?: boolean,
	) => Promise<void>
	onDismissClosureReply?: (id: string) => Promise<void>
	/** Feedback ids currently in flight — surfaced per-row as a
	 *  "Saving…" spinner + disabled action buttons. */
	busyIds?: ReadonlySet<string>
	/** A create request is in flight (typically from the annotation
	 *  overlay). When true, we paint a slim progress strip at the top
	 *  of the panel so the reviewer knows their submission landed. */
	creating?: boolean
}

export function FeedbackPanelBody({
	items,
	loading,
	error,
	onStatusChange,
	onDelete,
	onRetry,
	onReply,
	onDismissClosureReply,
	busyIds,
	creating,
}: FeedbackPanelBodyProps): React.ReactElement {
	// Default the filter to "pending" — reviewers are here to work through
	// the open items, not to audit closed/addressed history. Flipping to
	// "All" / another status via the summary bar stays sticky for the
	// session.
	const [activeStatus, setActiveStatus] = useState<FeedbackStatus | null>(
		"pending",
	)
	// Independent toggle for "unread closure replies only" — orthogonal
	// to the status filter (a reply lives on a closed FB; the user
	// filtering by "pending" never sees them otherwise).
	const [unreadReplyOnly, setUnreadReplyOnly] = useState(false)
	// Agent-item visibility (task #32). Default OFF: agent-authored FBs
	// at non-escalated statuses (pending, fixing, addressed, answered,
	// closed, rejected) are noise to a human reviewer — the engine
	// handles them. Only items the human MUST see surface by default:
	//   - every human-authored item, regardless of status
	//   - agent-authored items at `escalated` (bolt cap exhausted; needs
	//     human intervention)
	// Toggling on reveals the full agent set so a reviewer can audit
	// without flipping context.
	const [showAgentItems, setShowAgentItems] = useState(false)

	// Count of agent-authored items hidden when the toggle is off, so
	// the toggle chip surfaces it as "{N} hidden". Must match the
	// filter's hide predicate exactly — `system`-authored FBs pass
	// through the filter unconditionally (engine-authored notifications
	// the user always sees), so they don't count as hidden here.
	const hiddenAgentCount = useMemo(
		() =>
			items.filter((i) => i.author_type === "agent" && i.status !== "escalated")
				.length,
		[items],
	)

	const filtered = useMemo(() => {
		let next = items
		// Agent-item filter is a HARD pre-filter — it determines what's
		// even visible to the rest of the pipeline. The status filter
		// then applies on top of the visible set.
		if (!showAgentItems) {
			next = next.filter(
				(i) =>
					i.author_type === "human" ||
					i.author_type === "system" ||
					i.status === "escalated",
			)
		}
		if (unreadReplyOnly) {
			next = next.filter((i) => i.closure_reply_unread === true)
		}
		if (activeStatus && !unreadReplyOnly) {
			// When the unread-reply filter is on, the status filter is
			// implicitly disabled — closure replies live on closed FBs
			// which would never match a "pending" status filter. Without
			// this carve-out, toggling unread-replies returns zero rows.
			next = next.filter((item) => item.status === activeStatus)
		}
		return next
	}, [items, activeStatus, unreadReplyOnly, showAgentItems])

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{creating && (
				<div
					className="h-0.5 w-full overflow-hidden bg-teal-100 dark:bg-teal-900/40"
					role="progressbar"
					aria-label="Submitting feedback"
				>
					<div className="h-full w-1/3 animate-pulse bg-teal-500 dark:bg-teal-400" />
				</div>
			)}
			<div className="shrink-0 px-4 py-3 border-b border-stone-200 dark:border-stone-700 space-y-2">
				<FeedbackSummaryBar
					items={items}
					activeStatus={activeStatus}
					onFilter={setActiveStatus}
					unreadReplyOnly={unreadReplyOnly}
					onToggleUnreadReplyOnly={() => setUnreadReplyOnly((v) => !v)}
				/>
				{hiddenAgentCount > 0 || showAgentItems ? (
					<AgentFeedbackToggle
						checked={showAgentItems}
						onChange={setShowAgentItems}
						count={hiddenAgentCount}
					/>
				) : null}
			</div>
			{/* The FeedbackList owns its own scroll: the plain <ul> branch
			    sets `h-full overflow-y-auto` directly so it fills the
			    flex-1 parent. The outer `overflow-hidden` here prevents
			    the scrollbar from escaping the panel shell. */}
			<div className="flex-1 min-h-0 overflow-hidden">
				<FeedbackList
					items={filtered}
					isLoading={loading}
					error={error}
					onRetry={onRetry}
					onStatusChange={onStatusChange}
					onDelete={onDelete}
					onReply={onReply}
					onDismissClosureReply={onDismissClosureReply}
					busyIds={busyIds}
				/>
			</div>
		</div>
	)
}
