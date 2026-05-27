/**
 * useReviewChromeHeightVars — keep two CSS custom properties on the review
 * page root in sync with the live pixel heights of the page chrome:
 *   - `--review-header-h`  — the app header (top bar + stage-progress strip)
 *   - `--review-gatebar-h` — the sticky bottom gate/decision bar
 *
 * Why measured vars instead of fixed offsets: both pieces are dynamic. The
 * header renders two stacked rows whose strip height varies by intent (stage
 * count, optional chips, wrapping). The gate bar's height varies with its hint
 * text + which decision button shows. Hardcoding either would leave a gap or
 * an overlap whenever it moved.
 *
 * The left-edge `FeedbackRail` and the slide-out `FeedbackSheet` drawer anchor
 * BETWEEN the two: `top-[var(--review-header-h,0px)]` +
 * `bottom-[var(--review-gatebar-h,0px)]`, so the feedback bar sits strictly in
 * the band between the header and the button bar — over neither. Both vars
 * default to `0px` when unset (desktop, or before first measure), so the
 * elements never collapse.
 *
 * Returns the refs to attach: `rootRef` on the page root the vars are written
 * to, `headerRef` on the header element, and `gateBarRef` on the gate-bar
 * wrapper. The gate bar only renders on the mobile branch; when its ref is
 * unattached the var simply stays at its last value / the `0px` fallback.
 */

import { useEffect, useRef } from "react"

export function useReviewChromeHeightVars(): {
	rootRef: React.RefObject<HTMLDivElement | null>
	headerRef: React.RefObject<HTMLElement | null>
	gateBarRef: React.RefObject<HTMLDivElement | null>
} {
	const rootRef = useRef<HTMLDivElement | null>(null)
	const headerRef = useRef<HTMLElement | null>(null)
	const gateBarRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const root = rootRef.current
		if (!root) return

		const writeVar = (el: Element | null, varName: string) => {
			root.style.setProperty(
				varName,
				`${el ? Math.round(el.getBoundingClientRect().height) : 0}px`,
			)
		}
		const writeAll = () => {
			writeVar(headerRef.current, "--review-header-h")
			writeVar(gateBarRef.current, "--review-gatebar-h")
		}
		writeAll()

		// ResizeObserver isn't present in jsdom; degrade to the one-shot write.
		if (typeof ResizeObserver === "undefined") return
		const ro = new ResizeObserver(writeAll)
		if (headerRef.current) ro.observe(headerRef.current)
		if (gateBarRef.current) ro.observe(gateBarRef.current)
		return () => ro.disconnect()
	})

	return { rootRef, headerRef, gateBarRef }
}
