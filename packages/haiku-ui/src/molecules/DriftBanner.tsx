/**
 * DriftBanner — sticky banner mounted in the ReviewPage main pane between
 * `StageBanner` and `RereviewBanner` (DESIGN-BRIEF Screen 3 + unit-13).
 *
 * Rendered ONLY when the SPA's WS feed indicates `drift_detected: true`
 * for the active stage. Auto-unmounts when `tick_complete` /
 * `assessment_recorded` events fire — the host owns the WS plumbing and
 * either passes `drift={[]}` (which causes this component to render
 * nothing) or unmounts the component entirely.
 *
 * Layout:
 *   [⚠] Out-of-band change detected
 *       N files changed since the last tick. The next workflow tick will
 *       assess impact.                                    [▾ disclosure]
 *   ─── (when expanded) ────────────────────────────────────────────────
 *   <DriftEntryRow entry={…} … />
 *   <DriftEntryRow entry={…} … />
 *
 * Architecture-vs-design conflict resolution: the banner does NOT include
 * a "Run now" button. The DESIGN-BRIEF Screen 3 wording mentioned one,
 * but SPA-UI-SPECS.md §0 / §4.6 (passive observer, Direction A) and
 * ARCHITECTURE.md §7.3 take precedence (architecture wins per the
 * precedence rule in ARCHITECTURE.md §1). The header reads "The next
 * workflow tick will assess impact." with no manual-trigger affordance —
 * autopilot already drives the next tick (AC-OM1) and the harness does
 * not pre-classify (AC-G3).
 *
 * A11y (DESIGN-BRIEF Screen 3 §"Accessibility requirements"):
 *   - container: `role="status"` + `aria-live="polite"` so screen readers
 *     announce the drift on mount without yanking focus
 *   - disclosure caret: `<button>` with `aria-expanded` + `aria-controls`
 *     pointing to the entry-list region
 *   - amber leading icon + stripe border act as the non-color signal
 *     paired with text — color-not-only per SC-5.3
 *   - reduced-motion: the unmount fade is replaced by immediate
 *     disappearance via the global `transition-duration: 0.01ms` clamp
 *     in `index.css` (consumer + spec assertion)
 *   - banner sits BEFORE the tabs in DOM order (parent ReviewPage wires
 *     this; this component only owns its internal DOM order)
 */

import { useId, useState } from "react"
import { type DriftEntry, DriftEntryRow } from "../atoms/DriftEntryRow"

export type { DriftEntry } from "../atoms/DriftEntryRow"

export interface DriftBannerProps {
	/** Drift entries for the active stage — when empty, the banner renders
	 *  nothing (the WS plumbing is consulted upstream). */
	drift: DriftEntry[]
	/** Optional — wired to the row's primary affordance when supplied. */
	onOpenFile?: (entry: DriftEntry) => void
	/** Optional — second row affordance for "view diff" (the spec exposes
	 *  both as separate props but the row itself dispatches whichever is
	 *  present; current row impl uses a single onView callback that
	 *  defaults to onOpenFile, falling back to onViewDiff). */
	onViewDiff?: (entry: DriftEntry) => void
	/** When true, the banner mounts in its expanded state. Used by tests
	 *  that need to assert on the entry list without simulating a click. */
	defaultExpanded?: boolean
}

export function DriftBanner({
	drift,
	onOpenFile,
	onViewDiff,
	defaultExpanded = false,
}: DriftBannerProps): React.ReactElement | null {
	const [expanded, setExpanded] = useState(defaultExpanded)
	const listId = useId()

	if (!drift || drift.length === 0) return null

	const count = drift.length
	const onView = onOpenFile ?? onViewDiff

	return (
		<section
			data-testid="drift-banner"
			role="status"
			aria-live="polite"
			className="mb-4 rounded-lg border-l-4 border-l-amber-500 border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 transition-[opacity] duration-150"
		>
			<header className="flex items-center gap-3 px-4 py-3">
				<span
					aria-hidden="true"
					className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800/60 text-amber-900 dark:text-amber-200 text-sm shrink-0"
				>
					{/* Triangle warning glyph — decorative; the title carries the meaning. */}
					⚠
				</span>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold text-amber-900 dark:text-amber-100 leading-tight">
						Out-of-band change detected
					</p>
					<p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
						{count} {count === 1 ? "file" : "files"} changed since the last
						tick. The next workflow tick will assess impact.
					</p>
				</div>
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					aria-expanded={expanded}
					aria-controls={listId}
					aria-label={expanded ? "Hide changed files" : "Show changed files"}
					className="inline-flex items-center justify-center w-8 h-8 rounded text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-amber-950 shrink-0"
				>
					<span aria-hidden="true" className="text-base leading-none">
						{expanded ? "▴" : "▾"}
					</span>
				</button>
			</header>
			{expanded && (
				<section
					id={listId}
					aria-label="Changed files"
					className="border-t border-amber-200 dark:border-amber-900/60 px-2 py-2 space-y-1"
				>
					{drift.map((entry) => (
						<DriftEntryRow
							key={`${entry.stage}/${entry.path}`}
							entry={entry}
							onView={onView}
						/>
					))}
				</section>
			)}
		</section>
	)
}
