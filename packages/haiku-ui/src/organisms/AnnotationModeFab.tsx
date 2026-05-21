/**
 * AnnotationModeFab — the single global pencil FAB that toggles
 * annotation mode for every surface on the page (text highlight, image
 * pin/pen canvas, mockup draw overlay).
 *
 * Rendered once per artifact-bearing surface (review, design-direction,
 * question). `position: fixed` docks it to the viewport's bottom-right
 * so it stays put as the reviewer scrolls a long mockup. Clicking it
 * flips the persistent mode; holding Alt/Option flips the transient
 * mode — both feed `active`, so the FAB lights up either way and the
 * label tells the reviewer which path is live.
 */

import { useAnnotationMode } from "../hooks/AnnotationModeContext"

export interface AnnotationModeFabProps {
	/** Lift the FAB above the bottom-right corner so it clears another
	 *  fixed control docked there (the review page's mobile feedback
	 *  button). Default sits flush at `bottom-4 right-4`. */
	stacked?: boolean
}

export function AnnotationModeFab({
	stacked = false,
}: AnnotationModeFabProps): React.ReactElement {
	const { active, pinned, transient, toggle } = useAnnotationMode()

	// While Alt is held (transient) the FAB lights up to confirm the
	// gesture is registered, but the click still toggles the *pinned*
	// mode — that's the only thing a click owns.
	const label = active
		? pinned
			? "Exit annotation mode"
			: "Annotation mode active (Option held) — click to keep it on"
		: "Enter annotation mode"

	return (
		<button
			type="button"
			data-annotation-fab
			onClick={toggle}
			aria-pressed={pinned}
			aria-label={label}
			title="Annotate — click to toggle, or hold ⌥ Option for a quick pass"
			className={`fixed ${stacked ? "bottom-20" : "bottom-4"} right-4 z-40 inline-flex items-center justify-center rounded-full shadow-lg w-12 h-12 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 ${
				active
					? pinned
						? "bg-teal-700 hover:bg-teal-800 border-teal-800 text-white"
						: // transient-only: dashed ring marks it as a momentary,
							// not-yet-pinned activation.
							"bg-teal-700/90 hover:bg-teal-800 border-teal-300 border-dashed text-white"
					: "bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
			}`}
		>
			{/* Pencil glyph — single SVG path, no external dep. */}
			<svg
				aria-hidden="true"
				viewBox="0 0 24 24"
				width="22"
				height="22"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<title>{active ? "Annotation mode on" : "Annotation mode off"}</title>
				<path d="M12 20h9" />
				<path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
			</svg>
			{/* Transient-only pulse dot so the held-Option state reads at a
			    glance even before the reviewer hovers for the label. */}
			{transient && !pinned && (
				<span
					aria-hidden="true"
					className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 border-2 border-white dark:border-stone-900"
				/>
			)}
		</button>
	)
}
