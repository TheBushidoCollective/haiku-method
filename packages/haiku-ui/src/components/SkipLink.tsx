/**
 * Skip-to-main-content link — first focusable element on every page.
 *
 * Source of truth:
 *   - `stages/design/artifacts/skip-link-spec.html §1` (canonical pattern)
 *   - `stages/design/artifacts/aria-landmark-spec.md §1, §7` (DOM order + target id)
 *   - Unit-06 completion criteria: "Skip-link renders first in tab order in
 *     every page ... Regression guard for missing-skip-link class of issue."
 *
 * The anchor is `sr-only` until it receives keyboard focus, at which point
 * `focus-visible:not-sr-only` makes it visible in the top-left corner at
 * `z-[100]`, above the sticky header. Activation jumps focus to the `<main>`
 * element (its `tabIndex={-1}` from the Main landmark primitive allows
 * programmatic focus).
 */

export function SkipLink(): React.ReactElement {
	return (
		<a
			href="#main-content"
			className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-[100] focus-visible:px-3 focus-visible:py-2 focus-visible:bg-teal-600 focus-visible:text-white focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 focus-visible:outline-none focus-visible:shadow-lg focus-visible:font-medium"
		>
			Skip to main content
		</a>
	)
}
