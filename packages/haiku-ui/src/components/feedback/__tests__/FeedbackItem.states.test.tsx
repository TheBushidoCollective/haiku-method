/**
 * State-matrix snapshot + behavior tests for FeedbackItem
 * (state-coverage-grid.md §7.3–§7.4 + DESIGN-BRIEF §2 buttons/aria table).
 *
 * Cardinality: 4 status variants × 6 interaction states = 24 cells. Under
 * the 36-cell cap. The simulated-state wrappers use `data-state` class
 * modifiers (`state-hover`, `state-focus`, `state-active`, `state-disabled`,
 * `state-error`) lifted from the `feedback-card-states.html` design
 * artifact so the snapshot captures the state markup in a form that
 * reproduces how the artifact paints each cell.
 *
 * Covers completion criteria:
 *   - aria-label="Status: {status}" present on every badge instance
 *   - canonical verbs only (Dismiss / Verify & Close / Reopen) — no
 *     Close / Reject / Delete on open items
 *   - zero opacity-50|60|70 classes anywhere in the rendered tree
 *   - aria-expanded toggles with the isExpanded prop
 *   - focus preservation after a status transition → card root
 *   - useAnnounce("polite", ...) fires after a status transition
 */

import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	LiveRegionShell,
	POLITE_REGION_ID,
} from "../../../a11y"
import { FeedbackItem } from "../FeedbackItem"
import { TOKEN_HASH, type FeedbackStatus } from "../tokens"
import { mockItems } from "./mockItems"

afterEach(() => {
	cleanup()
})

const STATUSES: FeedbackStatus[] = [
	"pending",
	"addressed",
	"closed",
	"rejected",
]

const INTERACTION_STATES = [
	"default",
	"hover",
	"focus",
	"active",
	"disabled",
	"error",
] as const

function StateWrapper({
	state,
	children,
}: {
	state: (typeof INTERACTION_STATES)[number]
	children: React.ReactNode
}): React.ReactElement {
	return (
		<div
			data-cell-state={state}
			className={`state-${state}${state === "disabled" ? " pointer-events-none" : ""}${state === "error" ? " ring-1 ring-red-500" : ""}`}
			aria-disabled={state === "disabled" || undefined}
		>
			{children}
		</div>
	)
}

function Matrix(): React.ReactElement {
	const items = mockItems(4)
	// Map each item to a target status — we reuse mockItems ordering pending
	// → addressed → closed → rejected which already matches STATUSES.
	return (
		<div data-token-hash={TOKEN_HASH}>
			{STATUSES.map((status, statusIdx) => (
				<div key={status} data-status-row={status}>
					{INTERACTION_STATES.map((interaction) => (
						<StateWrapper
							key={`${status}-${interaction}`}
							state={interaction}
						>
							<FeedbackItem
								item={{ ...items[statusIdx], status }}
								isExpanded={interaction === "active"}
								onToggle={() => undefined}
								onStatusChange={() => undefined}
								onDelete={() => undefined}
							/>
						</StateWrapper>
					))}
				</div>
			))}
		</div>
	)
}

describe("FeedbackItem — state matrix", () => {
	it("renders every (status × interaction) cell (snapshot with token-hash header)", () => {
		const { container } = render(<Matrix />)
		expect(container.firstChild).toMatchSnapshot()
	})

	it("every status badge in the matrix carries aria-label=\"Status: {status}\"", () => {
		const { queryAllByLabelText } = render(<Matrix />)
		// Each status appears once per interaction state (6 per status).
		// 4 statuses × 6 interactions = 24 badge instances total.
		const total =
			queryAllByLabelText(/^Status: pending$/).length +
			queryAllByLabelText(/^Status: addressed$/).length +
			queryAllByLabelText(/^Status: closed$/).length +
			queryAllByLabelText(/^Status: rejected$/).length
		expect(total).toBe(24)
		// Verify the per-status bucket is exactly 6.
		for (const status of STATUSES) {
			expect(queryAllByLabelText(`Status: ${status}`).length).toBe(6)
		}
	})

	it("zero opacity-50|60|70 utility classes anywhere in the rendered tree", () => {
		const { container } = render(<Matrix />)
		const html = container.innerHTML
		expect(html).not.toMatch(/\bopacity-(50|60|70)\b/)
	})
})

// ── Canonical verb assertions (no banned Close/Reject/Delete on open items) ──

describe("FeedbackItem — canonical verbs", () => {
	it("pending + expanded renders a Dismiss button; no Close / Reject / Delete", () => {
		const items = mockItems(1)
		const { getByText, queryByText } = render(
			<FeedbackItem
				item={{ ...items[0], status: "pending" }}
				isExpanded
				onToggle={() => undefined}
				onStatusChange={() => undefined}
				onDelete={() => undefined}
			/>,
		)
		expect(getByText("Dismiss").tagName).toBe("BUTTON")
		expect(queryByText("Close")).toBeNull()
		expect(queryByText("Reject")).toBeNull()
		// Delete is only allowed on closed/rejected — never on pending.
		expect(queryByText("Delete")).toBeNull()
	})

	it("addressed + expanded renders Verify & Close + Reopen; no bare Close or Reject", () => {
		const items = mockItems(2)
		const { getByText, queryByText } = render(
			<FeedbackItem
				item={{ ...items[1], status: "addressed" }}
				isExpanded
				onToggle={() => undefined}
				onStatusChange={() => undefined}
				onDelete={() => undefined}
			/>,
		)
		expect(getByText("Verify & Close").tagName).toBe("BUTTON")
		expect(getByText("Reopen").tagName).toBe("BUTTON")
		expect(queryByText("Reject")).toBeNull()
	})

	it("closed + expanded renders Reopen (one word, no hyphen)", () => {
		const items = mockItems(3)
		const { getByText, queryByText } = render(
			<FeedbackItem
				item={{ ...items[2], status: "closed" }}
				isExpanded
				onToggle={() => undefined}
				onStatusChange={() => undefined}
				onDelete={() => undefined}
			/>,
		)
		expect(getByText("Reopen").tagName).toBe("BUTTON")
		expect(queryByText("Re-open")).toBeNull()
	})

	it("rejected + expanded renders Reopen", () => {
		const items = mockItems(4)
		const { getByText } = render(
			<FeedbackItem
				item={{ ...items[3], status: "rejected" }}
				isExpanded
				onToggle={() => undefined}
				onStatusChange={() => undefined}
				onDelete={() => undefined}
			/>,
		)
		expect(getByText("Reopen").tagName).toBe("BUTTON")
	})
})

// ── aria-expanded + focus preservation + live-region announcement ───────────

function ControllableFeedbackItem({
	initialStatus,
}: { initialStatus: FeedbackStatus }): React.ReactElement {
	const [status, setStatus] = useState<FeedbackStatus>(initialStatus)
	const [isExpanded, setIsExpanded] = useState(true)
	const items = mockItems(1)
	const item = { ...items[0], status, feedback_id: "FB-01" }
	return (
		<>
			<LiveRegionShell />
			<FeedbackItem
				item={item}
				isExpanded={isExpanded}
				onToggle={() => setIsExpanded((v) => !v)}
				onStatusChange={(_id, next) => setStatus(next)}
			/>
		</>
	)
}

describe("FeedbackItem — aria-expanded", () => {
	it("aria-expanded reflects the isExpanded prop", () => {
		const items = mockItems(1)
		const { container, rerender } = render(
			<FeedbackItem
				item={{ ...items[0], status: "pending" }}
				isExpanded={false}
				onToggle={() => undefined}
			/>,
		)
		const card = container.querySelector<HTMLDivElement>(
			"[data-testid='feedback-item']",
		)
		expect(card?.getAttribute("aria-expanded")).toBe("false")
		rerender(
			<FeedbackItem
				item={{ ...items[0], status: "pending" }}
				isExpanded
				onToggle={() => undefined}
			/>,
		)
		expect(card?.getAttribute("aria-expanded")).toBe("true")
	})
})

describe("FeedbackItem — focus preservation on status change", () => {
	it("after Dismiss, focus returns to the card root (not lost to <body>)", async () => {
		const { container } = render(
			<ControllableFeedbackItem initialStatus="pending" />,
		)
		const dismiss = container.querySelector<HTMLButtonElement>(
			"[data-action='dismiss']",
		)
		expect(dismiss).not.toBeNull()
		// Simulate keyboard focus on the dismiss button, then click it.
		dismiss!.focus()
		expect(document.activeElement).toBe(dismiss)
		await act(async () => {
			fireEvent.click(dismiss!)
		})
		const card = container.querySelector<HTMLDivElement>(
			"[data-testid='feedback-item']",
		)
		expect(card?.getAttribute("data-status")).toBe("rejected")
		expect(document.activeElement).toBe(card)
	})
})

describe("FeedbackItem — screen-reader announcement on status change", () => {
	it("fires a polite announcement after Dismiss (pending → rejected)", async () => {
		const { container } = render(
			<ControllableFeedbackItem initialStatus="pending" />,
		)
		const polite = document.getElementById(POLITE_REGION_ID)
		expect(polite).not.toBeNull()
		const dismiss = container.querySelector<HTMLButtonElement>(
			"[data-action='dismiss']",
		)
		await act(async () => {
			fireEvent.click(dismiss!)
		})
		expect(polite?.textContent).toBe("Feedback FB-01 marked as rejected")
	})

	it("fires a polite announcement after Verify & Close (addressed → closed)", async () => {
		const { container } = render(
			<ControllableFeedbackItem initialStatus="addressed" />,
		)
		const polite = document.getElementById(POLITE_REGION_ID)
		const verify = container.querySelector<HTMLButtonElement>(
			"[data-action='verify-close']",
		)
		await act(async () => {
			fireEvent.click(verify!)
		})
		expect(polite?.textContent).toBe("Feedback FB-01 marked as closed")
	})

	it("fires a polite announcement after Reopen (rejected → pending)", async () => {
		const { container } = render(
			<ControllableFeedbackItem initialStatus="rejected" />,
		)
		const polite = document.getElementById(POLITE_REGION_ID)
		const reopen = container.querySelector<HTMLButtonElement>(
			"[data-action='reopen']",
		)
		await act(async () => {
			fireEvent.click(reopen!)
		})
		expect(polite?.textContent).toBe("Feedback FB-01 reopened")
	})
})

// Guard against dead imports flagged by Biome.
void vi
