/**
 * FeedbackRail — mobile left-edge vertical TAB that toggles the FeedbackSheet
 * slide-out drawer (replaces the legacy circular bottom-right FAB).
 *
 * Why a rail instead of a FAB:
 *   The FAB sat in the bottom-right corner and had to be lifted clear of the
 *   sticky `GateDecisionBar` that docks full-width at the very bottom on
 *   mobile — that clearance offset left a "mystery gap" band at the bottom of
 *   the page. The rail moves the trigger out of the bottom band entirely: a
 *   thin FULL-HEIGHT column pinned to the LEFT edge, so it never collides
 *   with the gate and needs no bottom offset.
 *
 * Closed rail = DEDICATED LAYOUT SPACE, zero overlap:
 *   The rail is `fixed` to the left edge spanning the full viewport height,
 *   but it is NOT a floating tab over content. The review content container
 *   reserves a matching left-padding gutter (`RAIL_GUTTER_CLASS`, the same
 *   width as `RAIL_WIDTH_CLASS` in `feedbackRailLayout.ts`) on the mobile
 *   branch, so page content is inset by the rail's width and never renders
 *   underneath it. The gutter is the rail's permanent home.
 *
 * Geometry: `fixed left-0 top-0 bottom-0` full-height column, ~36px wide
 * (`RAIL_WIDTH_CLASS`), `rounded-r-lg` (only the right corners round — the
 * left edge is flush with the viewport). The word FEEDBACK is rendered
 * vertically via `[writing-mode:vertical-rl]` so it reads top-to-bottom (the
 * natural left-edge-tab orientation), centered in the full-height column. The
 * OPEN drawer floats ON TOP of content as a separate out-of-flow overlay (see
 * `FeedbackSheet`) — opening it causes NO layout shift; only this rail gutter
 * is permanent layout.
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
import { focusRingClass } from "../a11y"
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
	// Column pinned to the LEFT edge, starting BELOW the app header. The
	// content container reserves a matching `RAIL_GUTTER_CLASS` left-padding
	// gutter so content never renders underneath this column — closed rail
	// overlays NOTHING. z-30 sits BELOW the header (a flex item at z-40, whose
	// z-index applies) and BELOW the drawer (z-50) + gate bar (z-[60]); it's
	// still above page content. The top is pinned to the header's bottom edge
	// via the `--review-header-h` CSS var the review page writes (same anchor
	// as the drawer, so rail + drawer top-align below the header). Falls back
	// to `0px` when the var is unset.
	// Sits in the band BETWEEN the header and the gate bar — top at
	// `--review-header-h`, bottom at `--review-gatebar-h` — over NEITHER. Both
	// vars default to 0px when unset.
	// bottom = gate-bar height MINUS 2px: the var is a rounded pixel measure
	// and can land ~1px short of the gate bar's actual top, leaving a hairline
	// gap. Overlapping by 2px closes it — the overlap tucks behind the gate
	// bar (z-30 < z-[60]), so it's invisible.
	`fixed left-0 top-[var(--review-header-h,0px)] bottom-[calc(var(--review-gatebar-h,0px)-2px)] z-30 ${RAIL_WIDTH_CLASS}`,
	// Square edges (no rounding) — flush left with the viewport, butting the
	// content gutter on the right.
	"bg-teal-700 hover:bg-teal-800 dark:bg-teal-700 dark:hover:bg-teal-800",
	"text-white",
	"shadow-lg",
	// Label centered in the full-height column.
	"inline-flex items-center justify-center",
	// NOTE: no `md:hidden`. The rail is JS-gated to the mobile layout already
	// (`{isMobile && <MobileFeedbackSection/>}`, isMobile = <1280px). A
	// `md:hidden` CSS hide (≥768px) fought that gate: in the 768–1280px band
	// the layout dropped the desktop sidebar AND hid the rail, leaving an
	// empty reserved gutter and no feedback affordance. The JS gate is the
	// single source of truth for when the rail shows.
].join(" ")

// Vertical label: rotate the writing mode so "FEEDBACK" reads top-to-bottom
// along the LEFT edge (the natural left-tab orientation — no rotate-180, which
// would flip it to bottom-to-top for a right tab).
const LABEL_CLASSES = [
	"[writing-mode:vertical-rl]",
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

		// NOTE: deliberately NOT `touchTargetClass`. That utility sets
		// `position: relative`, which OVERRODE the rail's `position: fixed`
		// (verified via Playwright: with touch-target the rail computed to
		// position:relative and sat unpositioned at the bottom-left; without
		// it the `fixed right-0 top-0 bottom-0 w-9` pins it full-height to the
		// right edge). The rail doesn't need the 44px min-size anyway — it's a
		// full-height edge column, a huge touch target vertically.
		const composedClass = [RAIL_CLASSES, focusRingClass, className ?? ""]
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
