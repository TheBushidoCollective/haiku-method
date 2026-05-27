/**
 * FeedbackSheet — Completion-Criteria regression coverage per unit-10,
 * reshaped to the NON-MODAL RIGHT-EDGE SLIDE-OUT drawer contract.
 *
 * The drawer opens with `dialog.show()` (non-modal) so the rest of the page —
 * header, content, and the sticky GateDecisionBar — stays visible AND
 * interactive while feedback is open. It slides in from the RIGHT edge
 * (transform-based: `translate-x-full` closed → `translate-x-0` open). The
 * behavior contract: Escape closes (via onClose, controlled), the × button
 * calls onClose, focus returns to the rail on close, the title renders. The
 * MODAL-only pieces are GONE: no `aria-modal`, no focus-trap (the user tabs
 * freely between the drawer and the gate), no scroll-lock, no backdrop-click
 * close.
 *
 * CONTROLLED-CLOSE regression (the load-bearing bug this suite guards): this
 * component is CONTROLLED — the × button and the Escape handler call
 * `onClose()` ONLY, never `dialog.close()` directly. The old code called
 * `dialog.close(); return` from the × handler, which hid the native dialog but
 * left the parent's `open` at `true`, so the open/close effect immediately
 * re-`show()`-ed it — net "× does nothing". The CC3 close-button test below
 * proves `onClose` fires and the parent-driven close actually sticks.
 *
 * jsdom notes:
 *   - jsdom 25 ships `HTMLDialogElement` with `open` / `show()` / `close()`
 *     but the `close` event is not dispatched in every version. The
 *     `beforeAll` below polyfills `show` (sets `open`) and `close` (removes
 *     `open` + fires the native `close` event) to a canonical shape — note
 *     the component no longer relies on the native `close` event for its
 *     close pipeline (it is controlled), so the polyfill is only here to keep
 *     `dialog.close()` (driven by the parent flipping `open`) well-behaved.
 *   - A non-modal <dialog> does NOT fire `cancel`/`close` on Escape (that is
 *     modal-only) in any environment, so the component installs its own
 *     `keydown` Escape→onClose handler — that handler IS the Escape close path
 *     the CC3 test drives.
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
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest"
import { installMatchMediaStub } from "../../a11y/__tests__/matchMedia.stub"
import { FeedbackRail } from "../FeedbackRail"
import { FeedbackSheet } from "../FeedbackSheet"

// ── jsdom <dialog> polyfill ────────────────────────────────────────────────
// jsdom 25 has show()/close() but close() does not dispatch the native
// `close` event in every version. Force-polyfill both to a canonical shape:
// show sets the open attribute; close removes it and fires a `close` event.

beforeAll(() => {
	if (typeof HTMLDialogElement !== "undefined") {
		type DialogWithInternals = HTMLDialogElement & {
			__haikuTestShimInstalled?: boolean
		}
		const proto = HTMLDialogElement.prototype as DialogWithInternals
		if (!proto.__haikuTestShimInstalled) {
			// Non-modal open path used by the drawer.
			HTMLDialogElement.prototype.show = function show(
				this: HTMLDialogElement,
			) {
				this.setAttribute("open", "")
			}
			// showModal kept polyfilled for any environment feature-detecting
			// it, but the component no longer calls it.
			HTMLDialogElement.prototype.showModal = function showModal(
				this: HTMLDialogElement,
			) {
				this.setAttribute("open", "")
			}
			HTMLDialogElement.prototype.close = function close(
				this: HTMLDialogElement,
			) {
				if (!this.hasAttribute("open")) return
				this.removeAttribute("open")
				this.dispatchEvent(new Event("close"))
			}
			proto.__haikuTestShimInstalled = true
		}
	}
})

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

	it("has role='dialog' on the dialog root (belt-and-suspenders)", () => {
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

	// FB-34 — CSS selector alignment regression guard.
	//
	// `packages/haiku-ui/src/index.css` ships a block keyed on
	// `dialog.feedback-sheet` (surface background). If the rendered root is
	// ever downgraded back to a `<div role="dialog">` the selector silently
	// stops matching. Pin the tagName + className here so that regression
	// fails loudly.
	it("renders as a native <dialog class='feedback-sheet'> root (FB-34 alignment)", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.tagName).toBe("DIALOG")
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

	it("slides off-screen (translate-x-full) when closed", () => {
		render(<Harness initialOpen={false} />)
		const sheet = screen.getByTestId("feedback-sheet")
		expect(sheet.className).toMatch(/\btranslate-x-full\b/)
		expect(sheet.className).not.toMatch(/\btranslate-x-0\b/)
	})
})

// ── CC2 — focus is NOT trapped (non-modal drawer) ──────────────────────────

describe("FeedbackSheet — focus is not trapped (non-modal CC2)", () => {
	it("does NOT steal focus to the drawer on open (no auto-focus-into-trap)", () => {
		render(<Harness />)
		const rail = screen.getByRole("button", { name: /open feedback panel/i })
		rail.focus()
		expect(document.activeElement).toBe(rail)
		// Opening the non-modal drawer must not yank focus into it — the user
		// is free to keep operating the page (incl. the gate) behind it.
		fireEvent.click(rail)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.contains(document.activeElement)).toBe(false)
	})

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
	it("× button calls onClose (controlled) — the spy fires", () => {
		const onCloseSpy = vi.fn()
		render(<Harness initialOpen onCloseSpy={onCloseSpy} />)
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		expect(onCloseSpy).toHaveBeenCalledTimes(1)
	})

	it("× button closes the dialog (parent-driven) and restores focus to the rail", () => {
		render(<Harness initialOpen />)
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		// onClose flips the parent's `open` → false → the effect closes the
		// native dialog. The dialog element loses its `open` attribute and the
		// `role="dialog"` no longer resolves (closed <dialog> is not exposed).
		expect(screen.queryByRole("dialog")).toBeNull()
		// Focus restored to the rail by the open/close effect's cleanup.
		const rail = screen.getByRole("button", { name: /open feedback panel/i })
		expect(document.activeElement).toBe(rail)
	})

	it("Escape-driven close path calls onClose + restores focus", async () => {
		const onCloseSpy = vi.fn()
		render(<Harness initialOpen onCloseSpy={onCloseSpy} />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		// Dispatch a REAL Escape keydown on the dialog root. This exercises the
		// full input path:
		//   keydown(Escape) → FeedbackSheet's keydown listener calls onClose()
		//   → parent flips open → false → effect closes the dialog → rail focus
		//   restore.
		//
		// CONTROLLED discipline: the handler calls onClose(), NOT
		// dialog.close() directly. A non-modal <dialog> does not auto-fire
		// `cancel`/`close` on Escape in any environment, so the component's own
		// keydown handler IS the close path under test.
		await act(async () => {
			fireEvent.keyDown(sheet, { key: "Escape", code: "Escape" })
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

	it("dialog drops the transition-transform class under reduced motion (snaps, no slide)", () => {
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

	it("dialog carries the transition-transform slide class when motion is allowed", () => {
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
