/**
 * FeedbackRail — regression coverage for the right-edge vertical FEEDBACK tab
 * that replaced the legacy circular bottom-right FAB, plus a state-matrix
 * snapshot for audit-state-coverage.mjs.
 *
 * Covers:
 *   - aria-haspopup / aria-expanded / aria-controls wiring (the dialog-trigger
 *     contract carried over from the old FAB).
 *   - Dynamic accessible name (count > 0 → "…, N pending").
 *   - Renders the vertical "Feedback" label text.
 *   - Click dispatches onToggle.
 *   - Ref forwarding surfaces the <button>.
 *   - Focus ring + touch-target canonical classes.
 *   - Right-edge geometry (right-0, vertical center, vertical writing-mode),
 *     NOT a bottom-right circular FAB.
 *   - md:hidden (mobile-only affordance).
 *   - State-matrix snapshot (6 cells).
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FeedbackRail } from "../FeedbackRail"
import { RAIL_GUTTER_CLASS, RAIL_WIDTH_CLASS } from "../feedbackRailLayout"

afterEach(() => {
	cleanup()
})

describe("FeedbackRail — default render & dialog wiring", () => {
	it("resolves as a button with aria-haspopup='dialog'", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button", { name: /open feedback panel/i })
		expect(btn.getAttribute("aria-haspopup")).toBe("dialog")
	})

	it("defaults aria-controls to 'feedback-sheet'", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button", { name: /open feedback panel/i })
		expect(btn.getAttribute("aria-controls")).toBe("feedback-sheet")
	})

	it("honors a custom ariaControlsId", () => {
		render(
			<FeedbackRail
				open={false}
				onToggle={() => {}}
				ariaControlsId="custom-sheet-id"
			/>,
		)
		const btn = screen.getByRole("button", { name: /open feedback panel/i })
		expect(btn.getAttribute("aria-controls")).toBe("custom-sheet-id")
	})

	it("renders as <button type='button'> to prevent form submission", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button") as HTMLButtonElement
		expect(btn.tagName).toBe("BUTTON")
		expect(btn.getAttribute("type")).toBe("button")
	})

	it("renders the visible vertical 'Feedback' label", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		expect(btn.textContent).toMatch(/Feedback/)
	})
})

describe("FeedbackRail — aria-expanded reflects open prop", () => {
	it("aria-expanded='false' when open=false", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		expect(btn.getAttribute("aria-expanded")).toBe("false")
	})

	it("aria-expanded='true' when open=true", () => {
		render(<FeedbackRail open={true} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		expect(btn.getAttribute("aria-expanded")).toBe("true")
	})
})

describe("FeedbackRail — accessible-name + count badge", () => {
	it("label is 'Open feedback panel' without count", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		expect(btn.getAttribute("aria-label")).toBe("Open feedback panel")
	})

	it("label is 'Open feedback panel' when count is 0 (no badge)", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} count={0} />)
		const btn = screen.getByRole("button")
		expect(btn.getAttribute("aria-label")).toBe("Open feedback panel")
		expect(btn.textContent).not.toMatch(/0/)
	})

	it("label includes pending count when count > 0", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} count={3} />)
		const btn = screen.getByRole("button")
		expect(btn.getAttribute("aria-label")).toBe(
			"Open feedback panel, 3 pending",
		)
	})

	it("renders the visible count badge when count > 0", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} count={5} />)
		const btn = screen.getByRole("button")
		// Badge is aria-hidden; the DOM text still contains the count.
		expect(btn.textContent).toMatch(/5/)
	})
})

describe("FeedbackRail — click dispatches onToggle", () => {
	it("calls onToggle once per click", () => {
		const onToggle = vi.fn()
		render(<FeedbackRail open={false} onToggle={onToggle} />)
		const btn = screen.getByRole("button")
		fireEvent.click(btn)
		fireEvent.click(btn)
		expect(onToggle).toHaveBeenCalledTimes(2)
	})
})

describe("FeedbackRail — ref forwarding", () => {
	it("forwards ref to the underlying <button>", () => {
		const ref = createRef<HTMLButtonElement>()
		render(<FeedbackRail ref={ref} open={false} onToggle={() => {}} />)
		expect(ref.current).not.toBeNull()
		expect(ref.current?.tagName).toBe("BUTTON")
	})
})

describe("FeedbackRail — canonical a11y classes", () => {
	it("carries focusRingClass tokens for :focus-visible", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		expect(btn.className).toMatch(/focus-visible:ring-2/)
		expect(btn.className).toMatch(/focus-visible:ring-teal-500/)
	})

	it("carries touch-target class", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		expect(btn.classList.contains("touch-target")).toBe(true)
	})

	it("hides on md: breakpoint via md:hidden", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		expect(btn.className).toMatch(/\bmd:hidden\b/)
	})
})

describe("FeedbackRail — full-height right-edge column geometry", () => {
	it("is a full-height column pinned to the right edge (right-0 + top-0 + bottom-0 + fixed width), not a bottom FAB nor a floating centered tab", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		const cls = btn.className
		expect(cls).toMatch(/\bright-0\b/)
		expect(cls).toMatch(/\btop-0\b/)
		expect(cls).toMatch(/\bbottom-0\b/)
		expect(cls).toMatch(/\bfixed\b/)
		// Reserved width — matches RAIL_WIDTH_CLASS / RAIL_GUTTER_CLASS.
		expect(cls).toMatch(/\bw-9\b/)
		expect(cls).toMatch(/rounded-l-lg/)
		// Not the old bottom-right circular FAB.
		expect(cls).not.toMatch(/\brounded-full\b/)
		expect(cls).not.toMatch(/\bbottom-44\b/)
		// No longer a floating vertically-centered tab — it spans full height.
		expect(cls).not.toMatch(/\btop-1\/2\b/)
		expect(cls).not.toMatch(/-translate-y-1\/2/)
	})

	it("rail width and reserved content gutter resolve to the same Tailwind scale step (no drift, no overlap)", () => {
		// The gutter the content container reserves MUST match the rail's own
		// width, or content would either slip under the rail (gutter too
		// narrow) or leave a dead band (gutter too wide). Pin them to the same
		// numeric step.
		const widthStep = RAIL_WIDTH_CLASS.replace(/^w-/, "")
		const gutterStep = RAIL_GUTTER_CLASS.replace(/^pr-/, "")
		expect(widthStep).toBe(gutterStep)
		// And the rail actually carries that width class.
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		expect(screen.getByRole("button").className).toMatch(
			new RegExp(`\\b${RAIL_WIDTH_CLASS}\\b`),
		)
	})

	it("renders the FEEDBACK label with a vertical writing mode", () => {
		render(<FeedbackRail open={false} onToggle={() => {}} />)
		const btn = screen.getByRole("button")
		// The vertical label class is applied to the label span inside the
		// button — assert it appears in the rendered markup.
		const label = btn.querySelector("[class*='writing-mode']")
		expect(label).not.toBeNull()
		expect(label?.className).toMatch(/rotate-180/)
	})
})

describe("FeedbackRail — state matrix", () => {
	it("renders every documented state cell (snapshot)", () => {
		const { container } = render(
			<div>
				<div data-cell="closed-no-count">
					<FeedbackRail open={false} onToggle={() => {}} />
				</div>
				<div data-cell="closed-pending-1">
					<FeedbackRail open={false} onToggle={() => {}} count={1} />
				</div>
				<div data-cell="closed-pending-5">
					<FeedbackRail open={false} onToggle={() => {}} count={5} />
				</div>
				<div data-cell="open">
					<FeedbackRail open={true} onToggle={() => {}} />
				</div>
				<div data-cell="open-with-count">
					<FeedbackRail open={true} onToggle={() => {}} count={2} />
				</div>
				<div data-cell="closed-zero">
					<FeedbackRail open={false} onToggle={() => {}} count={0} />
				</div>
			</div>,
		)
		expect(container.firstChild).toMatchSnapshot()
	})
})
