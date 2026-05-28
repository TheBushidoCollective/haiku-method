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

	// Runs ONCE (`[]`). The observers below are created once and live for the
	// mount; nothing here depends on a re-render, so re-running the effect each
	// render (the old no-deps form) only churned a fresh ResizeObserver per
	// render for no benefit.
	//
	// The subtlety the plain `[]` form misses: the gate bar is CONDITIONALLY
	// mounted (the mobile, non-terminal branch), so its element identity changes
	// over the page's life — a ResizeObserver set up once at mount would never
	// observe a gate bar that appears later (viewport crosses the mobile
	// breakpoint, or the intent settles out of its terminal state). A
	// MutationObserver on the page subtree catches those mount/unmount events
	// and re-points the ResizeObserver + re-measures, while a same-elements
	// guard keeps unrelated DOM churn (feedback typing, list updates) from
	// thrashing layout.
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

		// ResizeObserver isn't present in jsdom; the one-shot write above covers
		// that path. Created once — size changes of the observed elements drive
		// it via its own callback.
		const ro =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(writeAll)

		// Re-point the RO + re-measure ONLY when the set of chrome elements
		// actually changes (e.g. the gate bar mounts/unmounts). Tracked so the
		// MutationObserver can fire on any subtree mutation cheaply.
		let lastHeader: Element | null = null
		let lastGateBar: Element | null = null
		const syncObservations = () => {
			if (
				headerRef.current === lastHeader &&
				gateBarRef.current === lastGateBar
			) {
				return
			}
			lastHeader = headerRef.current
			lastGateBar = gateBarRef.current
			writeAll()
			if (!ro) return
			ro.disconnect()
			if (headerRef.current) ro.observe(headerRef.current)
			if (gateBarRef.current) ro.observe(gateBarRef.current)
		}
		syncObservations()

		// Watch the page subtree so a late-mounting gate bar gets observed +
		// measured without re-running this effect on every render.
		const mo =
			typeof MutationObserver === "undefined"
				? null
				: new MutationObserver(syncObservations)
		mo?.observe(root, { childList: true, subtree: true })

		return () => {
			ro?.disconnect()
			mo?.disconnect()
		}
	}, [])

	return { rootRef, headerRef, gateBarRef }
}
