/**
 * FeedbackSheet — Completion-Criteria regression coverage per unit-10,
 * reshaped to the NON-MODAL bottom-drawer contract.
 *
 * The drawer opens with `dialog.show()` (non-modal) so the rest of the page —
 * header, content, and the sticky GateDecisionBar — stays visible AND
 * interactive while feedback is open. The behavior contract that survives the
 * reshape: Escape closes, the × button calls onClose, focus returns to the
 * FAB on close, the title renders. The MODAL-only pieces are GONE: no
 * `aria-modal`, no focus-trap (the user tabs freely between the drawer and the
 * gate), no scroll-lock, no backdrop-click close.
 *
 * jsdom notes:
 *   - jsdom 25 ships `HTMLDialogElement` with `open` / `show()` / `close()`
 *     but the `close` event is not dispatched in every version. The
 *     `beforeAll` below polyfills `show` (sets `open`) and `close` (removes
 *     `open` + fires the native `close` event) to a canonical shape.
 *   - A non-modal <dialog> does NOT fire `cancel`/`close` on Escape (that is
 *     modal-only) in any environment, so the component installs its own
 *     `keydown` Escape→close handler — that handler IS the Escape close path
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
import { FeedbackFloatingButton } from "../FeedbackFloatingButton"
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
	const fabRef = useRef<HTMLButtonElement>(null)
	return (
		<>
			<FeedbackFloatingButton
				ref={fabRef}
				open={open}
				onToggle={() => setOpen((o) => !o)}
				count={count}
			/>
			<FeedbackSheet
				open={open}
				triggerRef={fabRef}
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
	// `dialog.feedback-sheet` (surface background, sheet-up animation,
	// reduced-motion guard). If the rendered root is ever downgraded back to
	// a `<div role="dialog">` the selector silently stops matching. Pin the
	// tagName + className here so that regression fails loudly.
	it("renders as a native <dialog class='feedback-sheet'> root (FB-34 alignment)", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.tagName).toBe("DIALOG")
		expect(sheet.classList.contains("feedback-sheet")).toBe(true)
	})

	// Partial bottom-drawer geometry — anchored at the bottom band ABOVE the
	// sticky GateDecisionBar, NOT full-screen (`inset-0`). Pin the
	// drawer-shape utilities so a regression back to a full-viewport modal
	// fails loudly.
	it("is a partial bottom drawer (inset-x + bottom offset + capped height), not full-screen", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		const cls = sheet.className
		expect(cls).toMatch(/\binset-x-0\b/)
		expect(cls).toMatch(/\bbottom-44\b/)
		expect(cls).toMatch(/max-h-\[55vh\]/)
		expect(cls).toMatch(/\brounded-t-2xl\b/)
		// Must NOT be a full-screen modal.
		expect(cls).not.toMatch(/\binset-0\b/)
	})
})

// ── CC2 — focus is NOT trapped (non-modal drawer) ──────────────────────────

describe("FeedbackSheet — focus is not trapped (non-modal CC2)", () => {
	it("does NOT steal focus to the drawer on open (no auto-focus-into-trap)", () => {
		render(<Harness />)
		const fab = screen.getByRole("button", { name: /open feedback panel/i })
		fab.focus()
		expect(document.activeElement).toBe(fab)
		// Opening the non-modal drawer must not yank focus into it — the user
		// is free to keep operating the page (incl. the gate) behind it.
		fireEvent.click(fab)
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

// ── CC3 — close paths: Escape, close button; focus returns to FAB ──────────

describe("FeedbackSheet — close paths + focus restore (CC3)", () => {
	it("close button closes the dialog and restores focus to the FAB", () => {
		render(<Harness initialOpen />)
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		// After close, the dialog element loses its `open` attribute.
		expect(screen.queryByRole("dialog")).toBeNull()
		// Focus restored to the FAB by the open/close effect's cleanup.
		const fab = screen.getByRole("button", { name: /open feedback panel/i })
		expect(document.activeElement).toBe(fab)
	})

	it("Escape-driven close path dispatches close + restores focus", async () => {
		const onCloseSpy = vi.fn()
		render(<Harness initialOpen onCloseSpy={onCloseSpy} />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		// FB-60 — dispatch a REAL Escape keydown on the dialog root. This
		// exercises the full input path:
		//   keydown(Escape) → FeedbackSheet's keydown listener calls
		//   dialog.close() → `close` event → parent onClose → FAB focus
		//   restore.
		//
		// Do NOT short-circuit by calling `dialog.close()` directly — that
		// path would still pass even if the Escape binding regressed.
		//
		// A non-modal <dialog> does not auto-fire `cancel`/`close` on Escape
		// in any environment, so the component's own keydown handler IS the
		// close path under test.
		await act(async () => {
			fireEvent.keyDown(sheet, { key: "Escape", code: "Escape" })
		})
		await waitFor(() => {
			expect(onCloseSpy).toHaveBeenCalled()
			expect(screen.queryByRole("dialog")).toBeNull()
		})
		const fab = screen.getByRole("button", { name: /open feedback panel/i })
		expect(document.activeElement).toBe(fab)
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

// ── CC5 — reduced-motion animation class swap ─────────────────────────────

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

	it("dialog carries the sheet-enter--reduced sentinel class when open", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.className).toMatch(/\bsheet-enter--reduced\b/)
	})

	it("dialog does NOT carry the plain sheet-enter class under reduce", () => {
		render(<Harness initialOpen />)
		const sheet = screen.getByRole("dialog", { name: /feedback/i })
		expect(sheet.className).not.toMatch(/\bsheet-enter(?!--reduced)\b/)
	})
})

// ── Ancillary — FAB aria-expanded flips on open/close ─────────────────────

describe("FeedbackSheet — FAB aria-expanded (ancillary)", () => {
	it("FAB aria-expanded flips false → true → false across click + close", () => {
		render(<Harness />)
		const fab = screen.getByRole("button", { name: /open feedback panel/i })
		expect(fab.getAttribute("aria-expanded")).toBe("false")
		// Open
		fireEvent.click(fab)
		expect(fab.getAttribute("aria-expanded")).toBe("true")
		// Close via the close button
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		expect(fab.getAttribute("aria-expanded")).toBe("false")
	})
})

// ── Ancillary — non-modal drawer does NOT lock page scroll ────────────────

describe("FeedbackSheet — no scroll lock (non-modal drawer)", () => {
	it("never sets overflow:hidden on <html> while open", () => {
		render(<Harness />)
		const fab = screen.getByRole("button", { name: /open feedback panel/i })
		expect(document.documentElement.style.overflow).toBe("")
		fireEvent.click(fab)
		// Non-modal: the page behind the drawer must stay scrollable.
		expect(document.documentElement.style.overflow).toBe("")
		const closeBtn = screen.getByTestId("feedback-sheet-close")
		fireEvent.click(closeBtn)
		expect(document.documentElement.style.overflow).toBe("")
	})
})
