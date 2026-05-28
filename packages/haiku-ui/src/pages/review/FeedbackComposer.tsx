/**
 * FeedbackComposer — the comment-authoring surface: a textarea + an
 * "Add comment" button that creates a pending feedback item.
 *
 * WHY this is its own component (mobile split, 2026-05-27): on mobile the
 * feedback rail + drawer dock to the LEFT edge and the gate decision lives
 * in a sticky bottom bar. Feedback AUTHORING belongs WITH the feedback list
 * (inside the drawer), and the gate DECISION (Approve / Request Changes)
 * is its own thing at the bottom — "the approve button is not part of
 * feedback authoring." So the composer was lifted OUT of `GateDecisionBar`
 * into this standalone piece. The mobile drawer renders `<FeedbackComposer/>`
 * alongside `FeedbackPanelBody`; the mobile bottom bar renders
 * `<GateDecisionBar composer={false}/>` (decision-only).
 *
 * Desktop is UNCHANGED: the desktop `FeedbackSidebar` still renders the full
 * `GateDecisionBar` (default `composer={true}`), which keeps its own inline
 * composer — so the composer + decision stay together in the desktop
 * sidebar's pinned-bottom footer, byte-for-byte as before.
 *
 * Self-contained state: this component owns `composerText` + `addingComment`
 * and reads `createFeedback` from `useFeedbackSidebarController()` + the
 * announcer. Pressing "Add" (or ⌘/Ctrl+Enter) creates a pending feedback
 * item with `origin: "user-chat"` and clears the textarea; the next
 * run_next picks it up via the normal triage/fix-loop. The agent classifies
 * routing via target_unit / target_invalidates at FB-create time.
 */

import { useCallback, useState } from "react"
import { touchTargetClass, useAnnounce } from "../../a11y"
import { useFeedbackSidebarController } from "./useFeedbackSidebarController"

export interface FeedbackComposerProps {
	/** Applied to the outer wrapper so the render site can position it
	 *  (e.g. a footer band inside the feedback drawer). Joined onto the
	 *  base classes without a trailing space. */
	className?: string
}

export function FeedbackComposer({
	className,
}: FeedbackComposerProps): React.ReactElement {
	const { createFeedback } = useFeedbackSidebarController()
	const announce = useAnnounce()
	const [composerText, setComposerText] = useState("")
	const [addingComment, setAddingComment] = useState(false)

	const hasTyped = composerText.trim().length > 0

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

	return (
		<div
			data-testid="feedback-composer"
			className={[
				"shrink-0 border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 space-y-2",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<textarea
				value={composerText}
				onChange={(e) => setComposerText(e.target.value)}
				onKeyDown={(e) => {
					// Meta/Ctrl+Enter adds the comment without reaching for the
					// mouse. Plain Enter still inserts a newline — reviewers type
					// multi-line comments often enough that hijacking Enter would
					// be a footgun.
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
			<button
				type="button"
				onClick={() => void handleAddComment()}
				disabled={!hasTyped || addingComment}
				className={`${touchTargetClass} w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 hover:bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition-colors disabled:bg-stone-200 disabled:text-stone-500 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 dark:disabled:bg-stone-700 dark:disabled:text-stone-400`}
			>
				{addingComment
					? "Adding…"
					: hasTyped
						? "Add comment (⌘↵)"
						: "Type a comment to add"}
			</button>
		</div>
	)
}
