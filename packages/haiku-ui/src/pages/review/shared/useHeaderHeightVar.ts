/**
 * useHeaderHeightVar — keep the `--review-header-h` CSS custom property on
 * the review page root in sync with the live pixel height of the app header.
 *
 * Why a measured var instead of a fixed offset: the review header is dynamic
 * — it renders two stacked rows (the H·AI·K·U bar + the stage-progress strip),
 * and the strip's presence/height varies by intent (a 1-stage flow vs a
 * 6-stage flow, the optional pending-signal chips, wrapping at narrow widths).
 * Hardcoding ~158px would leave a gap or an overlap whenever the strip's
 * height moved.
 *
 * The left-edge `FeedbackRail` and the slide-out `FeedbackSheet` drawer anchor
 * their top to this var (`top-[var(--review-header-h,0px)]`) so they start
 * exactly at the header's bottom edge — the full header stays visible when the
 * drawer is open (it slides UNDER the header), and the rail aligns with it.
 *
 * Returns the two refs to attach: `rootRef` on the page root the var is
 * written to, and `headerRef` on the header element that gets measured.
 */

import { useEffect, useRef } from "react"

export function useHeaderHeightVar(): {
	rootRef: React.RefObject<HTMLDivElement | null>
	headerRef: React.RefObject<HTMLElement | null>
} {
	const rootRef = useRef<HTMLDivElement | null>(null)
	const headerRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		const header = headerRef.current
		const root = rootRef.current
		if (!header || !root) return

		const write = () => {
			root.style.setProperty(
				"--review-header-h",
				`${Math.round(header.getBoundingClientRect().height)}px`,
			)
		}
		write()

		// ResizeObserver isn't present in the jsdom test environment; guard
		// so the hook degrades to the one-shot write above without throwing.
		if (typeof ResizeObserver === "undefined") return
		const ro = new ResizeObserver(write)
		ro.observe(header)
		return () => ro.disconnect()
	}, [])

	return { rootRef, headerRef }
}
