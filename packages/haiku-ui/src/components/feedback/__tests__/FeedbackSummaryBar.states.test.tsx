/**
 * State-matrix + filter-button behavior for FeedbackSummaryBar
 * (state-coverage-grid.md §7.6).
 *
 * Cardinality: 4 status buttons × (default + active) + 1 empty cell = 9.
 * Well under 36.
 */

import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FeedbackSummaryBar } from "../FeedbackSummaryBar"
import { type FeedbackStatus, TOKEN_HASH } from "../tokens"
import { mockItems } from "./mockItems"

afterEach(() => {
	cleanup()
})

function Matrix(): React.ReactElement {
	const items = mockItems(20)
	const statuses: (FeedbackStatus | null)[] = [
		null,
		"pending",
		"addressed",
		"closed",
		"rejected",
	]
	return (
		<div data-token-hash={TOKEN_HASH}>
			{statuses.map((status) => (
				<div key={status ?? "none"} data-cell={`active-${status ?? "none"}`}>
					<FeedbackSummaryBar
						items={items}
						activeStatus={status}
						onFilter={() => undefined}
					/>
				</div>
			))}
			<div data-cell="empty">
				<FeedbackSummaryBar
					items={[]}
					activeStatus={null}
					onFilter={() => undefined}
				/>
			</div>
		</div>
	)
}

describe("FeedbackSummaryBar — state matrix", () => {
	it("renders (active filter × status) + empty cells (snapshot)", () => {
		const { container } = render(<Matrix />)
		expect(container.firstChild).toMatchSnapshot()
	})

	it("hides entirely when items is empty", () => {
		const { queryByTestId } = render(
			<FeedbackSummaryBar
				items={[]}
				activeStatus={null}
				onFilter={() => undefined}
			/>,
		)
		expect(queryByTestId("feedback-summary-bar")).toBeNull()
	})

	it("each filter button has aria-pressed tied to activeStatus", () => {
		const items = mockItems(10)
		const { container } = render(
			<FeedbackSummaryBar
				items={items}
				activeStatus="pending"
				onFilter={() => undefined}
			/>,
		)
		const pending = container.querySelector<HTMLButtonElement>(
			"[data-status='pending']",
		)
		const addressed = container.querySelector<HTMLButtonElement>(
			"[data-status='addressed']",
		)
		expect(pending?.getAttribute("aria-pressed")).toBe("true")
		expect(addressed?.getAttribute("aria-pressed")).toBe("false")
	})

	it("clicking a button fires onFilter with the status", () => {
		const onFilter = vi.fn()
		const items = mockItems(10)
		const { container } = render(
			<FeedbackSummaryBar
				items={items}
				activeStatus={null}
				onFilter={onFilter}
			/>,
		)
		const closed = container.querySelector<HTMLButtonElement>(
			"[data-status='closed']",
		)
		if (!closed) throw new Error("closed button missing")
		fireEvent.click(closed)
		expect(onFilter).toHaveBeenCalledWith("closed")
	})

	it("clicking the active button toggles off (fires null)", () => {
		const onFilter = vi.fn()
		const items = mockItems(10)
		const { container } = render(
			<FeedbackSummaryBar
				items={items}
				activeStatus="pending"
				onFilter={onFilter}
			/>,
		)
		const pending = container.querySelector<HTMLButtonElement>(
			"[data-status='pending']",
		)
		if (!pending) throw new Error("pending button missing")
		fireEvent.click(pending)
		expect(onFilter).toHaveBeenCalledWith(null)
	})
})
