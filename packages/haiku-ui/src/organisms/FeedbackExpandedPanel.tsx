/**
 * Slide-over reading panel for long feedback bodies. Opened from the
 * "Read more" affordance on `FeedbackItem` when the body exceeds the
 * inline preview budget (~280 chars) — the sidebar column is too
 * narrow to read wall-of-text findings inline, so the full markdown
 * surface lives in this side panel.
 *
 * Contract:
 *   - Opens as a fixed-position panel along the right edge, ~32rem
 *     wide, full viewport height.
 *   - Renders the full markdown body via the same `feedback-markdown
 *     prose` styling used inline, so code blocks / headings / images
 *     are formatted consistently.
 *   - Closes on Escape, on overlay click, or via the explicit close
 *     button. Focus returns to the opening "Read more" button (caller
 *     responsibility — handled in `FeedbackItem`).
 *   - Stops propagation on the panel itself so card-level interactions
 *     (collapse on Enter/Space) don't fire underneath.
 *
 * Markdown rendering uses `marked` since the inline body does the
 * same; consistency over duplication.
 */

import { MarkdownViewer } from "@haiku/shared"
import { useEffect, useRef } from "react"

export interface FeedbackExpandedPanelProps {
	feedbackId: string
	title: string
	body: string
	onClose: () => void
}

export function FeedbackExpandedPanel({
	feedbackId,
	title,
	body,
	onClose,
}: FeedbackExpandedPanelProps): React.ReactElement {
	const closeBtnRef = useRef<HTMLButtonElement | null>(null)
	const panelRef = useRef<HTMLDivElement | null>(null)

	// Focus the close button on open so keyboard users can Tab/Esc out
	// immediately. The panel itself takes the role=dialog hat.
	useEffect(() => {
		closeBtnRef.current?.focus()
	}, [])

	// Escape closes. Listener is panel-scoped — won't fire when the
	// user is typing into an unrelated input elsewhere on the page
	// (the panel mounts/unmounts, so the listener turns over with it).
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation()
				onClose()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])

	return (
		<div
			className="fixed inset-0 z-50 flex"
			role="dialog"
			aria-modal="true"
			aria-label={`Feedback ${feedbackId}: ${title}`}
			data-testid={`feedback-expanded-${feedbackId}`}
			onClick={onClose}
			onKeyDown={(e) => {
				// Don't let card-level handlers re-trigger from this
				// overlay; keyboard interactions inside the panel itself
				// stop propagation on the panel element below.
				e.stopPropagation()
			}}
		>
			<div className="flex-1 bg-stone-900/40 backdrop-blur-[1px]" />
			{/* biome-ignore lint/a11y/noStaticElementInteractions: the panel is the slide-over body; click/key handlers here exist solely to stop propagation so the outer overlay's close-on-click doesn't fire when interacting with content inside the panel. role="dialog" sits on the parent wrapper. */}
			<div
				ref={panelRef}
				className="w-[32rem] max-w-[90vw] h-full bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-700 shadow-2xl flex flex-col"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-700">
					<div className="min-w-0">
						<div className="text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
							{feedbackId}
						</div>
						<h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
							{title}
						</h2>
					</div>
					<button
						ref={closeBtnRef}
						type="button"
						onClick={onClose}
						aria-label="Close feedback panel"
						className="shrink-0 rounded p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 dark:hover:text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<path d="M3 3l10 10M13 3L3 13" />
						</svg>
					</button>
				</div>
				<div className="flex-1 overflow-y-auto px-4 py-4">
					<div className="text-sm text-stone-700 dark:text-stone-300 feedback-markdown prose prose-stone prose-sm dark:prose-invert max-w-none">
						<MarkdownViewer id={`feedback-expanded-body-${feedbackId}`}>
							{body}
						</MarkdownViewer>
					</div>
				</div>
			</div>
		</div>
	)
}
