/**
 * FeedbackPanel — compatibility shim.
 *
 * Unit-08 replaces the monolithic pre-cluster implementation with a clustered
 * layout under `./feedback/*`. To avoid touching every consumer call-site in
 * the same unit, this file re-exports a drop-in wrapper that mounts
 * `FeedbackList` inside the existing tabs + filter-pills chrome.
 *
 * Scope for downstream unification:
 *   - unit-09 (`AgentFeedbackToggle`) replaces the Feedback/Mine tab block.
 *   - unit-11 (copy audit) will rewrite the filter pills against the
 *     canonical `FeedbackSummaryBar`.
 * When both units land, this file can be deleted and consumers can import
 * `FeedbackList` / `FeedbackSummaryBar` from `./feedback` directly.
 *
 * The shim preserves the pre-unit-08 `Props = { items, loading, onUpdate,
 * onDelete }` signature exactly so `ReviewPage.tsx` and `ReviewCurrentPage.tsx`
 * keep working without a single line changed.
 */

import { useMemo, useState } from "react"
import type { FeedbackItemData } from "../types"
import type { FeedbackStatus } from "./feedback"
import { FeedbackList } from "./feedback"

type FilterMode = "all" | "pending" | "addressed"
type TabMode = "feedback" | "mine"

interface Props {
	items: FeedbackItemData[]
	loading: boolean
	onUpdate?: (feedbackId: string, fields: { status?: string }) => void
	onDelete?: (feedbackId: string) => void
}

export function FeedbackPanel({
	items,
	loading,
	onUpdate,
	onDelete,
}: Props): React.ReactElement {
	const [tab, setTab] = useState<TabMode>("feedback")
	const [filter, setFilter] = useState<FilterMode>("all")

	const filtered = useMemo<FeedbackItemData[]>(
		() =>
			items.filter((item) => {
				if (tab === "mine" && item.author_type !== "human") return false
				if (filter === "pending" && item.status !== "pending") return false
				if (filter === "addressed" && item.status !== "addressed") return false
				return true
			}),
		[items, tab, filter],
	)

	const handleStatusChange = (id: string, next: FeedbackStatus): void => {
		if (onUpdate) onUpdate(id, { status: next })
	}

	return (
		<div className="flex flex-col h-full">
			{/* Segmented toggle — unit-09 AgentFeedbackToggle target. */}
			<div className="shrink-0 px-4 py-3 border-b border-stone-200 dark:border-stone-700">
				<div className="flex gap-1 p-0.5 rounded-lg bg-stone-100 dark:bg-stone-800">
					<button
						type="button"
						onClick={() => setTab("feedback")}
						className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
							tab === "feedback"
								? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
								: "text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-200"
						}`}
					>
						Feedback ({items.length})
					</button>
					<button
						type="button"
						onClick={() => setTab("mine")}
						className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
							tab === "mine"
								? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
								: "text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-200"
						}`}
					>
						Mine ({items.filter((i) => i.author_type === "human").length})
					</button>
				</div>
				<div className="flex gap-1.5 mt-2">
					{(["all", "pending", "addressed"] as const).map((f) => (
						<button
							key={f}
							type="button"
							onClick={() => setFilter(f)}
							className={`px-2 py-1 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
								filter === f
									? "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700"
									: "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600"
							}`}
						>
							{f.charAt(0).toUpperCase() + f.slice(1)}
						</button>
					))}
				</div>
			</div>
			<div className="flex-1 overflow-y-auto p-3">
				<FeedbackList
					items={filtered}
					isLoading={loading}
					onStatusChange={handleStatusChange}
					onDelete={onDelete}
				/>
			</div>
		</div>
	)
}
