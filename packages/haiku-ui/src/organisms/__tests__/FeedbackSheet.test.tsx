/**
 * FeedbackSheet — Completion-Criteria regression coverage per unit-10,
 * reshaped to the NON-MODAL RIGHT-EDGE SLIDE-OUT drawer contract.
 *
 * The drawer is a PLAIN CONTROLLED `<aside role="dialog">` — NOT a native
 * `<dialog>`. It stays mounted in the DOM at all times; `open` drives the
 * slide transform (`translate-x-full` closed → `translate-x-0` open) and the
 * a11y visibility (`aria-hidden` + `pointer-events-none` when closed). The
 * rest of the page — header, content, sticky GateDecisionBar — stays visible
 * AND interactive while feedback is open (non-modal). The behavior contract:
 * Escape closes (via onClose, controlled), the × button calls onClose, focus
 * returns to the rail on close, the title renders. The MODAL-only pieces are
 * GONE: no `aria-modal`, no focus-trap, no scroll-lock, no backdrop-click.
 *
 * CONTROLLED-CLOSE regression (the load-bearing bug this suite guards): the ×
 * button and the Escape handler call `onClose()` ONLY — there is no imperative
 * `dialog.close()` anymore. The old `<dialog>` code called `dialog.close();
 * return` from the × handler, which hid the native dialog but left the parent's
 * `open` at `true`, so the open/close effect immediately re-`show()`-ed it —
 * net "× does nothing". The CC3 close-button test below proves `onClose` fires
 * exactly once and the parent-driven close actually sticks.
 *
 * jsdom notes:
 *   - The `<aside>` root needs no polyfill — it is a plain element. The closed
 *     drawer carries `aria-hidden`, so `getByRole("dialog")` (which excludes
 *     aria-hidden subtrees) only resolves while open, and `queryByRole` returns
 *     null once closed.
 *   - The reduced-motion branch installs `installMatchMediaStub(...)` BEFORE
 *     render because `useReducedMotion()` reads matchMedia in its useState
 *     initializer on first render.
 */

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react"
import { useRef, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installMatchMediaStub } from "../../a11y/__tests__/matchMedia.stub"
import { FeedbackRail } from "../FeedbackRail"
import { FeedbackSheet } from "../FeedbackSheet"

// ── Harness ────────────────────────────────────────────────────────────────
// Controlled pair that mirrors the downstream review-page wiring.

function Harness({
	initialOpen = false,
	count = 3,
	onCloseSpy,
}: {
	initialOpen?: boolean
	count?: number
	onCloseSpy?: () => void
}) {
	const [open, setOpen] = useState(initialOpen)
	const railRef = useRef<HTMLButtonElement>(null)
	return (
		<>
			<FeedbackRail
				ref={railRef}
				open={open}
				onToggle={() => setOpen((o) => !o)}
				count={count}
			/>
			<FeedbackSheet
				open={open}
				triggerRef={railRef}
				onClose={() => {
					onCloseSpy?.()
					setOpen(false)
				}}
			>
				{/* Body contents — ordinary tabbable children the test
				    assertions rely on. */}
				<button type="button" data-testid="body-dismiss">
					Dismiss
				</button>
				<button type="button" data-testid="body-verify-close">
					Verify & Close
				</button>
			</FeedbackSheet>
		</>
	)
}

afterEach(() => {
	cleanup()
	document.documentElement.style.overflow = ""
})

// ── CC1 — dialog semantics when open (non-modal drawer) ────────────────────

describe("FeedbackSheet — dialog semantics when open (CC1)", () => {
	it("resolves screen.getByRole('dialog', { name: /feedback/i }) when open", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet).toBeTruthy()
	})

	it("is NON-modal — does NOT carry aria-modal on the dialog root", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		// A non-modal drawer must not advertise itself as modal — the page
		// behind it stays interactive.
		expect(sheet.getAttribute("aria-modal")).toBeNull()
	})

	it("has role='dialog' on the drawer root (belt-and-suspenders)", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.getAttribute("role")).toBe("dialog")
	})

	it("aria-labelledby points at the visible 'Feedback' heading", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		const titleId = sheet.getAttribute("aria-labelledby")
		expect(titleId).toBeTruthy()
		const heading = document.getElementById(titleId as string)
		expect(heading).not.toBeNull()
		expect(heading?.textContent).toBe("Feedback")
	})

	// FB-34 — root-element alignment regression guard.
	//
	// The drawer surface bg now lives in Tailwind classes on the element
	// (`bg-white dark:bg-stone-900`), and the root is a class-matched
	// `<aside role="dialog">`. There is no `dialog.feedback-sheet` CSS selector
	// anymore. Pin the tagName (ASIDE) + the `feedback-sheet` class so a
	// regression back to a `<div>` or to a native `<dialog>` fails loudly.
	it("renders as an <aside class='feedback-sheet'> root (FB-34 alignment)", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.tagName).toBe("ASIDE")
		expect(sheet.classList.contains("feedback-sheet")).toBe(true)
	})

	// Right-edge slide-out geometry — full-height panel anchored to the RIGHT
	// edge, transform-driven (`translate-x-0` when open). Pin the drawer-shape
	// utilities so a regression back to a bottom drawer or a full-viewport
	// modal fails loudly.
	it("is a right-edge slide-out drawer (right-0 + full height + translate), not full-screen or bottom drawer", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		const cls = sheet.className
		expect(cls).toMatch(/\bfixed\b/)
		expect(cls).toMatch(/\bright-0\b/)
		expect(cls).toMatch(/\btop-0\b/)
		expect(cls).toMatch(/\bbottom-0\b/)
		expect(cls).toMatch(/w-\[min\(85vw,360px\)\]/)
		// Open → slid into place.
		expect(cls).toMatch(/\btranslate-x-0\b/)
		// Must NOT be a full-screen modal nor a bottom drawer.
		expect(cls).not.toMatch(/\binset-0\b/)
		expect(cls).not.toMatch(/\binset-x-0\b/)
		expect(cls).not.toMatch(/\bbottom-44\b/)
	})

	it("slides off-screen (translate-x-full + pointer-events-none + aria-hidden) when closed", () => {
		render(<Harness initialOpen={false} />)
		const sheet = screen.getByTestId("feedback-sheet")
		expect(sheet.className).toMatch(/\btranslate-x-full\b/)
		expect(sheet.className).not.toMatch(/\btranslate-x-0\b/)
		// Closed → not interactive + removed from the a11y tree.
		expect(sheet.className).toMatch(/\bpointer-events-none\b/)
		expect(sheet.getAttribute("aria-hidden")).toBe("true")
	})
})

// ── CC2 — focus is NOT trapped (non-modal drawer) ──────────────────────────

describe("FeedbackSheet — focus is not trapped (non-modal CC2)", () => {
	it("Tab does NOT wrap inside the drawer — focus can leave it freely", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		const bodyVerify = screen.getByTestId("body-verify-close")
		// Focus the last tabbable in the drawer, then press Tab. A modal trap
		// would preventDefault + wrap to the first child; the non-modal drawer
		// installs no such handler, so focus stays put (jsdom does not advance
		// focus on synthetic Tab) and is NOT force-wrapped to the close button.
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		bodyVerify.focus()
		expect(document.activeElement).toBe(bodyVerify)
		fireEvent.keyDown(sheet, { key: "Tab", code: "Tab" })
		// No trap → focus was not yanked back to the first tabbable.
		expect(document.activeElement).not.toBe(closeBtn)
		expect(document.activeElement).toBe(bodyVerify)
	})
})

// ── CC3 — close paths: ×, Escape; controlled close; focus returns to rail ──

describe("FeedbackSheet — close paths + focus restore (CC3)", () => {
	// THE controlled-close regression. Against the old `dialog.close(); return`
	// × handler this FAILS: that handler hid the dialog without calling
	// onClose, so the spy never fired AND the parent's `open` stayed true →
	// the effect re-opened it.
	it("× button calls onClose exactly once (controlled)", () => {
		const onCloseSpy = vi.fn()
		render(<Harness initialOpen onCloseSpy={onCloseSpy} />)
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		expect(onCloseSpy).toHaveBeenCalledTimes(1)
	})

	it("× button closes the drawer (parent-driven) and does NOT leave it open", () => {
		render(<Harness initialOpen />)
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		// onClose flips the parent's `open` → false → the drawer slides out and
		// goes aria-hidden, so the `role="dialog"` no longer resolves (getByRole
		// excludes aria-hidden subtrees).
		expect(screen.queryByRole("dialog")).toBeNull()
		// The aside is still mounted but hidden + slid off-screen.
		const sheet = screen.getByTestId("feedback-sheet")
		expect(sheet.getAttribute("aria-hidden")).toBe("true")
		expect(sheet.className).toMatch(/\btranslate-x-full\b/)
	})

	it("× button restores focus to the rail", () => {
		render(<Harness initialOpen />)
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		// Focus restored to the rail by the open/close effect's cleanup.
		const rail = screen.getByRole("button", { name: /open feedback panel/i })
		expect(document.activeElement).toBe(rail)
	})

	it("Escape-driven close path calls onClose + restores focus", async () => {
		const onCloseSpy = vi.fn()
		render(<Harness initialOpen onCloseSpy={onCloseSpy} />)
		// Dispatch a REAL Escape keydown on the document. This exercises the
		// full input path:
		//   keydown(Escape) → FeedbackSheet's document keydown listener calls
		//   onClose() → parent flips open → false → drawer hides → rail focus
		//   restore.
		//
		// CONTROLLED discipline: the handler calls onClose(), NOT any imperative
		// close. The component's own document keydown handler IS the close path.
		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape", code: "Escape" })
		})
		await waitFor(() => {
			expect(onCloseSpy).toHaveBeenCalled()
			expect(screen.queryByRole("dialog")).toBeNull()
		})
		const rail = screen.getByRole("button", { name: /open feedback panel/i })
		expect(document.activeElement).toBe(rail)
	})
})

// ── CC4 — accessibility tree ──────────────────────────────────────────────

describe("FeedbackSheet — accessibility tree (CC4)", () => {
	it("getByRole('dialog', { name: /feedback/i }) resolves when open", () => {
		render(<Harness initialOpen />)
		expect(screen.getByRole("dialog", { name: /feedback/i })).toBeTruthy()
	})

	it("heading text 'Feedback' is present inside the dialog", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(within(sheet).getByText("Feedback")).toBeTruthy()
	})
})

// ── CC5 — reduced-motion drops the slide transition ───────────────────────

describe("FeedbackSheet — reduced-motion variant (CC5)", () => {
	let stub: ReturnType<typeof installMatchMediaStub>

	beforeEach(() => {
		// IMPORTANT: install BEFORE render — useReducedMotion reads matchMedia
		// via useState initializer on first render.
		stub = installMatchMediaStub({
			"(prefers-reduced-motion: reduce)": true,
		})
	})

	afterEach(() => {
		stub.restore()
	})

	it("drops the transition-transform class under reduced motion (snaps, no slide)", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.className).not.toMatch(/\btransition-transform\b/)
		// It still occupies its open position.
		expect(sheet.className).toMatch(/\btranslate-x-0\b/)
	})
})

describe("FeedbackSheet — motion variant (no reduced-motion)", () => {
	let stub: ReturnType<typeof installMatchMediaStub>

	beforeEach(() => {
		stub = installMatchMediaStub({
			"(prefers-reduced-motion: reduce)": false,
		})
	})

	afterEach(() => {
		stub.restore()
	})

	it("carries the transition-transform slide class when motion is allowed", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.className).toMatch(/\btransition-transform\b/)
	})
})

// ── Ancillary — rail aria-expanded flips on open/close ────────────────────

describe("FeedbackSheet — rail aria-expanded (ancillary)", () => {
	it("rail aria-expanded flips false → true → false across click + close", () => {
		render(<Harness />)
		const rail = screen.getByRole("button", { name: /open feedback panel/i })
		expect(rail.getAttribute("aria-expanded")).toBe("false")
		// Open
		fireEvent.click(rail)
		expect(rail.getAttribute("aria-expanded")).toBe("true")
		// Close via the close button
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		expect(rail.getAttribute("aria-expanded")).toBe("false")
	})

	it("clicking the rail while open toggles the drawer closed", () => {
		render(<Harness initialOpen />)
		const rail = screen.getByRole("button", { name: /open feedback panel/i })
		expect(rail.getAttribute("aria-expanded")).toBe("true")
		expect(screen.queryByRole("dialog")).not.toBeNull()
		// Re-clicking the rail is one of the documented close paths.
		fireEvent.click(rail)
		expect(rail.getAttribute("aria-expanded")).toBe("false")
		expect(screen.queryByRole("dialog")).toBeNull()
	})
})

// ── Ancillary — non-modal drawer does NOT lock page scroll ────────────────

describe("FeedbackSheet — no scroll lock (non-modal drawer)", () => {
	it("never sets overflow:hidden on <html> while open", () => {
		render(<Harness />)
		const rail = screen.getByRole("button", { name: /open feedback panel/i })
		expect(document.documentElement.style.overflow).toBe("")
		fireEvent.click(rail)
		// Non-modal: the page behind the drawer must stay scrollable.
		expect(document.documentElement.style.overflow).toBe("")
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		expect(document.documentElement.style.overflow).toBe("")
	})
})
