/**
 * FeedbackSheet — mobile left-edge SLIDE-OUT feedback drawer.
 *
 * A plain controlled `<aside>`, NOT a native `<dialog>`. The previous
 * `<dialog>` implementation kept rendering as a small floating box instead of
 * a docked drawer: a non-modal `<dialog>` carries UA-default positioning
 * (`position: absolute; margin: auto; width/height: fit-content`) that fought
 * the Tailwind `fixed top-0 left-0 bottom-0` classes, and its imperative
 * `show()`/`close()` lifecycle desynced from the controlled `open` prop (the
 * "× does nothing" bug — the button hid the dialog while the parent still
 * thought it was open, so the effect re-`show()`-ed it). A plain `<aside>`
 * with `position: fixed` has none of those surprises: positioning is exactly
 * what the classes say, and close is a pure parent state flip.
 *
 * Geometry: full-height panel docked to the LEFT edge
 * (`fixed top-0 left-0 bottom-0 w-[min(85vw,360px)]`), transform-based slide
 * (`-translate-x-full` closed → `translate-x-0` open — off-screen to the
 * LEFT). It is NON-modal — the page behind it (header, content, and the
 * sticky `GateDecisionBar` at the bottom) stays visible and interactive. The
 * drawer sits at `z-50`; the route docks the gate bar at `z-[60]` so it paints
 * over the drawer's bottom edge and stays clickable, and the drawer body
 * carries bottom padding so the last feedback item scrolls clear of the bar.
 *
 * Controlled-only API: the parent owns `open` and supplies `onClose`. The rail
 * (`FeedbackRail`) is the trigger and lives one level up. Close paths — the ×
 * button, Escape, and re-clicking the rail — ALL call `onClose()`; the parent
 * flips `open` → false. Nothing in here closes imperatively.
 *
 * CSS: styling rides Tailwind utility classes on the root + the shared
 * `.feedback-sheet` class (matched by `index.css`); the root is an `<aside>`,
 * so the CSS selector is class-based, NOT `dialog.feedback-sheet`.
 */

import type { ReactNode, RefObject } from "react"
import { useEffect, useRef } from "react"
import { focusRingClass, touchTargetClass, useReducedMotion } from "../a11y"

export interface FeedbackSheetProps {
	/** Current open state. Drives the slide transform + a11y visibility. */
	open: boolean
	/**
	 * Fires when the sheet should close (× button, Escape). The parent flips
	 * `open` to `false` in response — this component never closes itself.
	 */
	onClose: () => void
	/**
	 * Ref to the rail that opened the drawer. On close, focus returns here.
	 */
	triggerRef?: RefObject<HTMLButtonElement | null>
	/** Accessible-name id override. Defaults to `"feedback-sheet-title"`. */
	titleId?: string
	/** Heading content; defaults to the string `"Feedback"`. */
	title?: ReactNode
	/** Sheet body contents (AgentFeedbackToggle, FeedbackList, footer). */
	children?: ReactNode
	/** `id` on the panel; wires with the rail's `aria-controls`. */
	id?: string
	/** Extra class names appended to the panel root. */
	className?: string
}

function panelClass(open: boolean, prefersReducedMotion: boolean): string {
	return [
		"feedback-sheet",
		// Panel docked to the LEFT edge, BELOW the app header. `fixed` anchors
		// to the viewport (a plain element has no `<dialog>` UA-position
		// surprises). The top is pinned to the header's bottom edge via the
		// `--review-header-h` CSS custom property the review page writes from a
		// ResizeObserver on the header (the header is dynamic — two rows, the
		// H·AI·K·U bar + the stage-progress strip). Falls back to `0px` (full
		// height) when the var is unset, so the drawer never collapses.
		"fixed top-[var(--review-header-h,0px)] left-0 bottom-0 z-50",
		"w-[min(85vw,360px)] max-w-full",
		"flex flex-col",
		// Surface — explicit on the element (no dependency on a CSS selector).
		"bg-white dark:bg-stone-900",
		"text-stone-900 dark:text-stone-100",
		"border-r border-stone-200 dark:border-stone-700 shadow-2xl",
		// Transform slide from the left edge. Closed → off-screen
		// (`-translate-x-full`); open → in place (`translate-x-0`). Reduced
		// motion drops the transition so it snaps.
		open ? "translate-x-0" : "-translate-x-full",
		prefersReducedMotion ? "" : "transition-transform duration-300 ease-out",
		// Closed → not interactive (it's off-screen to the left; this keeps it
		// from catching clicks or stealing focus during/after the slide-out).
		open ? "" : "pointer-events-none",
	]
		.filter(Boolean)
		.join(" ")
}

const HEADER_CLASS = [
	"feedback-sheet__header",
	"shrink-0 px-4 py-3",
	"border-b border-stone-200 dark:border-stone-700",
	"flex items-center justify-between",
].join(" ")

const CLOSE_BUTTON_CLASS = [
	"feedback-sheet__close",
	"text-stone-600 dark:text-stone-300",
	"hover:text-stone-800 dark:hover:text-stone-100",
	"inline-flex items-center justify-center",
	"text-lg",
].join(" ")

// The body is a flex COLUMN, not the scroll container — so a consumer can pin
// a composer (shrink-0) and let the feedback list scroll in the remaining
// space (the list carries its own bottom padding to clear the sticky gate
// bar). Making the body itself `overflow-y-auto` scrolled the composer away
// with the list — it ended up buried below a long feedback list.
const BODY_CLASS = [
	"feedback-sheet__body",
	"flex-1 flex flex-col min-h-0",
].join(" ")

export function FeedbackSheet({
	open,
	onClose,
	triggerRef,
	titleId,
	title,
	children,
	id,
	className,
}: FeedbackSheetProps): React.ReactElement {
	const prefersReducedMotion = useReducedMotion()
	const closeButtonRef = useRef<HTMLButtonElement>(null)

	const resolvedTitleId = titleId ?? "feedback-sheet-title"
	const resolvedId = id ?? "feedback-sheet"
	const resolvedTitle: ReactNode = title ?? "Feedback"

	// Escape-to-close + focus management. CONTROLLED: every close path calls
	// `onClose()`; the parent flips `open`. On open we move focus into the
	// drawer (the close button); on close we return focus to the rail.
	useEffect(() => {
		if (!open) return

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === "Escape") {
				event.preventDefault()
				onClose()
			}
		}
		document.addEventListener("keydown", handleKeyDown)

		// Move focus into the drawer so keyboard users land on it.
		try {
			closeButtonRef.current?.focus()
		} catch {
			/* non-focusable in some environments — ignore */
		}

		return () => {
			document.removeEventListener("keydown", handleKeyDown)
			// Return focus to the rail that opened it.
			const trigger = triggerRef?.current
			if (trigger && document.contains(trigger)) {
				try {
					trigger.focus()
				} catch {
					/* defensive — detached/non-focusable node */
				}
			}
		}
	}, [open, onClose, triggerRef])

	const rootClassName = [
		panelClass(open, prefersReducedMotion),
		className ?? "",
	]
		.filter(Boolean)
		.join(" ")

	return (
		<aside
			id={resolvedId}
			aria-labelledby={resolvedTitleId}
			aria-hidden={open ? undefined : true}
			role="dialog"
			data-testid="feedback-sheet"
			className={rootClassName}
		>
			<header className={HEADER_CLASS}>
				<h2
					id={resolvedTitleId}
					className="text-sm font-semibold text-stone-700 dark:text-stone-300"
				>
					{resolvedTitle}
				</h2>
				<button
					ref={closeButtonRef}
					type="button"
					// CONTROLLED close: call onClose() so the parent flips `open` →
					// false. (The old code called the native dialog.close() and
					// returned, so onClose never fired and the effect re-opened it
					// — the "× does nothing" bug.)
					onClick={onClose}
					aria-label="Close feedback panel"
					className={[
						CLOSE_BUTTON_CLASS,
						touchTargetClass,
						focusRingClass,
					].join(" ")}
					data-testid="feedback-sheet-close"
				>
					<span aria-hidden="true">&times;</span>
				</button>
			</header>
			<div className={BODY_CLASS}>{children}</div>
		</aside>
	)
}
