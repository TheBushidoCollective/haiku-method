/**
 * Container-state snapshot coverage for FeedbackList
 * (state-coverage-grid.md §7.5): default / empty / loading / error.
 *
 * Interactive states live on FeedbackItem; they're covered by
 * `FeedbackItem.states.test.tsx`. The list itself is a scrollable container
 * that is never itself focusable, so the matrix here is small (4 cells).
 */

import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FeedbackList } from "../FeedbackList"
import { TOKEN_HASH } from "../tokens"
import { mockItems } from "./mockItems"

afterEach(() => {
	cleanup()
})

describe("FeedbackList — container state matrix", () => {
	it("default: renders non-virtualized list for ≤ VIRTUALIZE_THRESHOLD items (snapshot)", () => {
		const { container } = render(
			<div data-token-hash={TOKEN_HASH}>
				<FeedbackList items={mockItems(8)} />
			</div>,
		)
		expect(container.firstChild).toMatchSnapshot()
	})

	it("loading: aria-busy=true + skeleton rows (snapshot)", () => {
		const { container, getByTestId } = render(
			<div data-token-hash={TOKEN_HASH}>
				<FeedbackList items={[]} isLoading />
			</div>,
		)
		expect(getByTestId("feedback-list").getAttribute("aria-busy")).toBe("true")
		expect(container.firstChild).toMatchSnapshot()
	})

	it("error: alert role + Retry button (snapshot)", () => {
		const onRetry = vi.fn()
		const { container, getByText } = render(
			<div data-token-hash={TOKEN_HASH}>
				<FeedbackList items={[]} error="Boom" onRetry={onRetry} />
			</div>,
		)
		expect(container.firstChild).toMatchSnapshot()
		fireEvent.click(getByText("Retry"))
		expect(onRetry).toHaveBeenCalledOnce()
	})

	it("empty: canonical empty copy (snapshot)", () => {
		const { container, getByText } = render(
			<div data-token-hash={TOKEN_HASH}>
				<FeedbackList items={[]} />
			</div>,
		)
		expect(getByText(/No feedback yet\. Select text or drop pins/)).toBeTruthy()
		expect(container.firstChild).toMatchSnapshot()
	})

	it("default list: every rendered item carries data-testid='feedback-item'", () => {
		const { container } = render(<FeedbackList items={mockItems(10)} />)
		const items = container.querySelectorAll("[data-testid='feedback-item']")
		expect(items.length).toBe(10)
	})

	it("default list: each item's listitem wrapper carries aria-posinset and aria-setsize", () => {
		const { container } = render(<FeedbackList items={mockItems(3)} />)
		// aria-setsize / aria-posinset live on the <li> wrapper (which is the
		// list-role-compatible ancestor), not on the FeedbackItem root — <li>
		// and role=listitem support these attributes; role=button does not.
		const wrappers = container.querySelectorAll("[aria-posinset]")
		expect(wrappers.length).toBe(3)
		for (let i = 0; i < wrappers.length; i++) {
			expect(wrappers[i].getAttribute("aria-setsize")).toBe("3")
			expect(wrappers[i].getAttribute("aria-posinset")).toBe(String(i + 1))
		}
	})
})
