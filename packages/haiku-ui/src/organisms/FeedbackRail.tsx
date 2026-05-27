/**
 * FeedbackRail — mobile right-edge vertical TAB that toggles the FeedbackSheet
 * slide-out drawer (replaces the legacy circular bottom-right FAB).
 *
 * Why a rail instead of a FAB:
 *   The FAB sat in the bottom-right corner and had to be lifted clear of the
 *   sticky `GateDecisionBar` that docks full-width at the very bottom on
 *   mobile — that clearance offset left a "mystery gap" band at the bottom of
 *   the page. The rail moves the trigger out of the bottom band entirely: a
 *   thin FULL-HEIGHT column pinned to the RIGHT edge, so it never collides
 *   with the gate and needs no bottom offset.
 *
 * Closed rail = DEDICATED LAYOUT SPACE, zero overlap:
 *   The rail is `fixed` to the right edge spanning the full viewport height,
 *   but it is NOT a floating tab over content. The review content container
 *   reserves a matching right-padding gutter (`RAIL_GUTTER_CLASS`, the same
 *   width as `RAIL_WIDTH_CLASS` in `feedbackRailLayout.ts`) on the mobile
 *   branch, so page content is inset by the rail's width and never renders
 *   underneath it. The gutter is the rail's permanent home.
 *
 * Geometry: `fixed right-0 top-0 bottom-0` full-height column, ~36px wide
 * (`RAIL_WIDTH_CLASS`), `rounded-l-lg` (only the left corners round — the
 * right edge is flush with the viewport). The word FEEDBACK is rendered
 * vertically via `[writing-mode:vertical-rl]` + `rotate-180` so it reads
 * bottom-to-top (the conventional right-edge-tab orientation), centered in the
 * full-height column. The OPEN drawer floats ON TOP of content as a separate
 * out-of-flow overlay (see `FeedbackSheet`) — opening it causes NO layout
 * shift; only this rail gutter is permanent layout.
 *
 * a11y wiring (unchanged contract from the old FAB):
 *   - `aria-haspopup="dialog"`, `aria-expanded` (driven by `open`),
 *     `aria-controls` the drawer id, dynamic accessible name
 *     `"Open feedback panel, {count} pending"` / `"Open feedback panel"`.
 *   - The pending-count badge survives — a small amber chip on the rail.
 *
 * The rail does NOT own the drawer state — the parent review page does, so the
 * same `open` boolean drives the rail's `aria-expanded` and the drawer's
 * `show()`/`close()` lifecycle. Clicking the rail toggles open/closed.
 *
 * NOTE: `data-testid="feedback-fab"` is retained (not renamed to
 * `feedback-rail`) so the structural `layout.test.tsx` mobile assertion — "FAB
 * instead of sidebar" — keeps resolving the trigger by its stable testid.
 */

import { forwardRef } from "react"
import { focusRingClass, touchTargetClass } from "../a11y"
import { RAIL_WIDTH_CLASS } from "./feedbackRailLayout"

export interface FeedbackRailProps {
	/** Current open state of the paired FeedbackSheet. Drives `aria-expanded`. */
	open: boolean
	/**
	 * Fires when the user clicks the rail. The parent is responsible for
	 * flipping its `open` state.
	 */
	onToggle: () => void
	/**
	 * Pending-count badge. When > 0, a visible amber chip renders with the
	 * count AND the accessible name becomes
	 * `"Open feedback panel, {count} pending"`. Undefined or 0 renders no
	 * badge and the shorter `"Open feedback panel"` label.
	 */
	count?: number
	/** `id` of the paired dialog — wires `aria-controls`. Defaults to
	 *  `"feedback-sheet"` which is also the default `FeedbackSheet` id. */
	ariaControlsId?: string
	/** Optional className passthrough; appended to the canonical classes. */
	className?: string
}

const RAIL_CLASSES = [
	// Full-height column pinned to the RIGHT edge. The content container
	// reserves a matching `RAIL_GUTTER_CLASS` right-padding gutter so content
	// never renders underneath this column — closed rail overlays NOTHING.
	`fixed right-0 top-0 bottom-0 z-40 ${RAIL_WIDTH_CLASS}`,
	// Only the LEFT corners round (right edge is flush with the viewport).
	"rounded-l-lg",
	"bg-teal-700 hover:bg-teal-800 dark:bg-teal-700 dark:hover:bg-teal-800",
	"text-white",
	"shadow-lg",
	// Label centered in the full-height column.
	"inline-flex items-center justify-center",
	// Mobile-only affordance — the desktop sidebar owns feedback at ≥ xl.
	"md:hidden",
].join(" ")

// Vertical label: rotate the writing mode and flip 180° so "FEEDBACK" reads
// bottom-to-top along the right edge (the conventional right-tab orientation).
const LABEL_CLASSES = [
	"[writing-mode:vertical-rl] rotate-180",
	"text-xs font-bold tracking-wider uppercase",
	"select-none",
].join(" ")

// FB-70 contrast pairing carried over from the old FAB badge: light-mode
// `text-amber-800` on `bg-amber-100` (6.37:1, AA pass); dark-mode
// `amber-300 on amber-900/40` clears AA.
const BADGE_CLASSES = [
	"absolute top-1 left-1/2 -translate-x-1/2",
	"inline-flex items-center justify-center",
	"min-w-[20px] h-[20px] rounded-full",
	"text-xs font-bold",
	"bg-amber-100 text-amber-800",
	"dark:bg-amber-900/40 dark:text-amber-300",
	"border-2 border-white dark:border-stone-900",
].join(" ")

export const FeedbackRail = forwardRef<HTMLButtonElement, FeedbackRailProps>(
	function FeedbackRail(
		{ open, onToggle, count, ariaControlsId, className },
		ref,
	) {
		const hasBadge = typeof count === "number" && count > 0
		const label = hasBadge
			? `Open feedback panel, ${count} pending`
			: "Open feedback panel"

		const composedClass = [
			RAIL_CLASSES,
			touchTargetClass,
			focusRingClass,
			className ?? "",
		]
			.filter(Boolean)
			.join(" ")

		return (
			<button
				ref={ref}
				type="button"
				onClick={onToggle}
				aria-haspopup="dialog"
				aria-expanded={open ? "true" : "false"}
				aria-controls={ariaControlsId ?? "feedback-sheet"}
				aria-label={label}
				className={composedClass}
				data-testid="feedback-fab"
			>
				{hasBadge ? (
					<span className={BADGE_CLASSES} aria-hidden="true">
						{count}
					</span>
				) : null}
				<span className={LABEL_CLASSES} aria-hidden="true">
					Feedback
				</span>
			</button>
		)
	},
)
