/**
 * useFeedbackListKeyboardNav — arrow-key roving focus for FeedbackList.
 *
 * Works on both the plain (non-virtualized) and virtualized branches. The
 * listener attaches to the *container*, not per item, so a keystroke that
 * happens to unmount the previously-focused row (virtualized branch; row
 * scrolls out of the window) still fires on the container and advances the
 * focus target correctly.
 *
 * Flow per ArrowDown / ArrowUp:
 *   1. Compute `nextIndex` (clamped to [0, itemCount - 1]).
 *   2. Call `scrollToIndex(nextIndex)` if provided — virtualized branch mounts
 *      the target row.
 *   3. In `requestAnimationFrame` (runs after react-window commits the new
 *      window), focus `itemRefs.current[nextIndex]`.
 *
 * Enter simulates a click on the currently-focused row (toggles expand).
 */

import { useCallback, useEffect, useRef, useState } from "react"

export interface UseFeedbackListKeyboardNavOptions {
	itemCount: number
	containerRef: React.RefObject<HTMLElement | null>
	itemRefs: React.MutableRefObject<Array<HTMLElement | null>>
	/** For virtualized lists — called before re-focus so the target mounts. */
	scrollToIndex?: (index: number) => void
	/** Initial focus index. Defaults to 0. */
	initialIndex?: number
}

export interface FeedbackListKeyboardNavHandle {
	focusedIndex: number
	setFocusedIndex: (index: number) => void
}

function raf(cb: () => void): void {
	if (typeof requestAnimationFrame === "function") {
		requestAnimationFrame(cb)
		return
	}
	// Fallback for non-browser test envs that don't stub rAF.
	setTimeout(cb, 0)
}

export function useFeedbackListKeyboardNav({
	itemCount,
	containerRef,
	itemRefs,
	scrollToIndex,
	initialIndex = 0,
}: UseFeedbackListKeyboardNavOptions): FeedbackListKeyboardNavHandle {
	const [focusedIndex, setFocusedIndexState] = useState<number>(initialIndex)
	// Track the latest focusedIndex in a ref so the keydown handler (bound
	// once) always sees the fresh value without re-binding on every render.
	const focusedIndexRef = useRef<number>(initialIndex)
	focusedIndexRef.current = focusedIndex

	const setFocusedIndex = useCallback((index: number) => {
		setFocusedIndexState(index)
		focusedIndexRef.current = index
	}, [])

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		function move(delta: number): void {
			if (itemCount === 0) return
			const current = focusedIndexRef.current
			const next = Math.max(0, Math.min(itemCount - 1, current + delta))
			if (next === current) return
			focusedIndexRef.current = next
			setFocusedIndexState(next)
			if (scrollToIndex) scrollToIndex(next)
			raf(() => {
				const node = itemRefs.current[next]
				if (node) node.focus()
			})
		}

		function onKeyDown(event: KeyboardEvent): void {
			if (event.key === "ArrowDown") {
				event.preventDefault()
				move(1)
				return
			}
			if (event.key === "ArrowUp") {
				event.preventDefault()
				move(-1)
				return
			}
			if (event.key === "Enter") {
				const current = focusedIndexRef.current
				const node = itemRefs.current[current]
				if (node) {
					event.preventDefault()
					node.click()
				}
			}
		}

		container.addEventListener("keydown", onKeyDown)
		return () => {
			container.removeEventListener("keydown", onKeyDown)
		}
	}, [containerRef, itemCount, itemRefs, scrollToIndex])

	return { focusedIndex, setFocusedIndex }
}
