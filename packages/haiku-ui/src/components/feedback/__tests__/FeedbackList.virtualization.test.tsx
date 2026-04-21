/**
 * Perf test: `FeedbackList` with 500 mock items renders ≤ 30
 * `[data-testid="feedback-item"]` nodes at steady state.
 *
 * Unit spec completion criterion:
 *   "Virtualization perf test: render FeedbackList with 500 mock items,
 *    query document.querySelectorAll('[data-testid=feedback-item]').length
 *    ≤ 30 at steady state."
 *
 * With fixed height=600 and itemSize=88, react-window mounts ~7 visible
 * rows + default overscan (5) = ~12 at steady state. Cap of 30 gives
 * headroom for overscan tuning without breaking the gate.
 */

import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import {
	DEFAULT_ITEM_SIZE,
	DEFAULT_LIST_HEIGHT,
	FeedbackList,
	VIRTUALIZE_THRESHOLD,
} from "../FeedbackList"
import { mockItems } from "./mockItems"

afterEach(() => {
	cleanup()
})

describe("FeedbackList — virtualization perf", () => {
	it("500 items → steady-state mounted count ≤ 30", async () => {
		const { container } = render(
			<FeedbackList
				items={mockItems(500)}
				height={DEFAULT_LIST_HEIGHT}
				itemSize={DEFAULT_ITEM_SIZE}
			/>,
		)
		await act(async () => {
			// Flush any scheduled microtasks / rAFs in jsdom.
			await new Promise((resolve) => setTimeout(resolve, 0))
		})
		const mounted = container.querySelectorAll("[data-testid='feedback-item']")
		expect(mounted.length).toBeLessThanOrEqual(30)
		// Sanity: the container itself marks virtualized=true.
		const list = container.querySelector("[data-testid='feedback-list']")
		expect(list?.getAttribute("data-virtualized")).toBe("true")
	})

	it(`below the threshold (${VIRTUALIZE_THRESHOLD}), list is non-virtualized`, () => {
		const { container } = render(
			<FeedbackList items={mockItems(VIRTUALIZE_THRESHOLD)} />,
		)
		const list = container.querySelector("[data-testid='feedback-list']")
		expect(list?.getAttribute("data-virtualized")).toBe("false")
		const items = container.querySelectorAll("[data-testid='feedback-item']")
		expect(items.length).toBe(VIRTUALIZE_THRESHOLD)
	})

	it(`above the threshold (${VIRTUALIZE_THRESHOLD + 1}), list becomes virtualized`, () => {
		const { container } = render(
			<FeedbackList items={mockItems(VIRTUALIZE_THRESHOLD + 1)} />,
		)
		const list = container.querySelector("[data-testid='feedback-list']")
		expect(list?.getAttribute("data-virtualized")).toBe("true")
	})
})
