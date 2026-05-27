/**
 * FeedbackSheet — mobile NON-MODAL right-edge SLIDE-OUT DRAWER backed by a
 * native <dialog> (reshaped from the legacy bottom drawer).
 *
 * Canonical references:
 *   - stages/development/units/unit-10-feedback-sheet-mobile.md — scope +
 *     completion criteria (the a11y close-path + trigger-focus-restore
 *     contract survives; the modal-only pieces do not — see below).
 *   - packages/haiku-ui/BROWSER-SUPPORT.md — native <dialog> policy, jsdom
 *     caveats.
 *
 * Why a right-edge slide-out drawer (the reshape):
 *   The trigger is now a vertical FEEDBACK rail pinned to the right edge
 *   (`FeedbackRail`). The drawer slides in from the SAME edge — a full-height
 *   panel on the right, transform-based (`translate-x-full` closed →
 *   `translate-x-0` open). It stays NON-modal so the page behind it —
 *   header, content, AND the sticky `GateDecisionBar` docked at the bottom —
 *   stays visible and INTERACTIVE. The user reads the feedback list and clicks
 *   Approve / Request-Changes without closing feedback.
 *
 * Avoiding the gate: the drawer sits at `z-50`; the route docks the
 * `GateDecisionBar` wrapper at a HIGHER z (`z-[60]`) so the bar paints over
 * the drawer's bottom edge and stays clickable. Belt-and-suspenders, the
 * drawer body carries bottom padding (`pb-44`) so the last feedback item
 * scrolls clear of the bar rather than hiding behind it.
 *
 * What that means for the implementation:
 *   - `dialog.show()` (non-modal), NOT `showModal()`. No top-layer, no
 *     background `inert`, no `::backdrop`.
 *   - NO scroll-lock. The page must scroll behind the drawer.
 *   - NO focus-trap. A non-modal drawer must let the user tab freely between
 *     the drawer and the gate — `useFocusTrap` is deliberately absent.
 *   - NO backdrop-click close — there is no backdrop. The explicit close
 *     paths (× button, Escape, clicking the rail again) remain.
 *   - The dialog drops `aria-modal="true"` (it is not modal). It keeps
 *     `role="dialog"` + `aria-labelledby` + the title.
 *
 * Controlled-only API: the parent owns `open` and supplies `onClose`. The rail
 * (`FeedbackRail`) is always the trigger and lives one level up.
 *
 * THE CLOSE CONTRACT (FB regression — was broken): this component is
 * CONTROLLED. The × button and the Escape handler MUST call `onClose()` ONLY —
 * never `dialog.close()` directly. The parent flips `open` → false in
 * response, and the open/close effect closes the native dialog. Calling
 * `dialog.close()` from the button hid the dialog but left the parent's `open`
 * at `true`, so the effect immediately re-`show()`-ed it — the "× does
 * nothing" bug. The native `close` event is no longer the close pipeline.
 *
 * CSS selector alignment (FB-34): the rendered root is still a native
 * `<dialog className="feedback-sheet">`, matched by the `dialog.feedback-sheet`
 * block in `packages/haiku-ui/src/index.css`. Do NOT regress the root element
 * to a div without rewriting those selectors.
 */

import type { ReactNode, RefObject } from "react"
import { useEffect, useRef } from "react"
import { focusRingClass, touchTargetClass, useReducedMotion } from "../a11y"

export interface FeedbackSheetProps {
	/** Current open state. Drives `dialog.show()` / `dialog.close()`. */
	open: boolean
	/**
	 * Fires when the sheet should close (× button, Escape). The parent is
	 * responsible for flipping `open` to `false` in response — this component
	 * NEVER closes the native dialog directly from a user gesture.
	 */
	onClose: () => void
	/**
	 * Ref to the rail that opened the drawer. On close, focus is returned to
	 * this element. A non-modal drawer has no focus-trap to snapshot/restore
	 * prior focus, so this restore is done explicitly in the open/close effect.
	 */
	triggerRef?: RefObject<HTMLButtonElement | null>
	/** Accessible-name id override. Defaults to `"feedback-sheet-title"`. */
	titleId?: string
	/** Heading content; defaults to the string `"Feedback"`. */
	title?: ReactNode
	/** Sheet body contents (AgentFeedbackToggle, FeedbackList, footer). */
	children?: ReactNode
	/** `id` on the <dialog>; wires with the rail's `aria-controls`. */
	id?: string
	/** Extra class names appended to the dialog root. */
	className?: string
}

function dialogBaseClass(open: boolean, prefersReducedMotion: boolean): string {
	return [
		"feedback-sheet",
		// Full-height panel anchored to the RIGHT edge. NOT `inset-0` (not a
		// full-viewport modal) — the page (header, content, gate) stays
		// visible and interactive in the band to the left.
		"fixed top-0 right-0 bottom-0 z-50",
		"w-[min(85vw,360px)] max-w-full",
		"flex flex-col",
		// Drawer chrome — left border + shadow read as a panel lifted off the
		// page rather than a full-bleed modal.
		"border-l border-stone-200 dark:border-stone-700 shadow-2xl",
		"text-stone-900 dark:text-stone-100",
		// Transform-based slide from the right edge. Closed → off-screen
		// (`translate-x-full`); open → in place (`translate-x-0`). Under
		// reduced motion we drop the transition so it snaps into place.
		open ? "translate-x-0" : "translate-x-full",
		prefersReducedMotion ? "" : "transition-transform duration-300 ease-out",
	]
		.filter(Boolean)
		.join(" ")
}

const HEADER_CLASS = [
	"feedback-sheet__header",
	"shrink-0 px-4 py-3",
	"border-b border-stone-200 dark:border-stone-700",
	"flex items-center justify-between",
].join(" ")

const CLOSE_BUTTON_CLASS = [
	"feedback-sheet__close",
	"text-stone-600 dark:text-stone-300",
	"hover:text-stone-800 dark:hover:text-stone-100",
	"inline-flex items-center justify-center",
	"text-lg",
].join(" ")

// `pb-44` (11rem) keeps the last feedback item scrollable clear of the sticky
// GateDecisionBar that docks full-width at the very bottom — belt-and-
// suspenders on top of the z-order that already keeps the bar clickable.
const BODY_CLASS = [
	"feedback-sheet__body",
	"flex-1 overflow-y-auto",
	"pb-44",
].join(" ")

export function FeedbackSheet({
	open,
	onClose,
	triggerRef,
	titleId,
	title,
	children,
	id,
	className,
}: FeedbackSheetProps): React.ReactElement {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const prefersReducedMotion = useReducedMotion()

	const resolvedTitleId = titleId ?? "feedback-sheet-title"
	const resolvedId = id ?? "feedback-sheet"
	const resolvedTitle: ReactNode = title ?? "Feedback"

	// Imperative open/close + Escape wiring + trigger focus restore.
	//
	// Non-modal drawer: NO scroll-lock, NO focus-trap, NO backdrop. The only
	// close paths are the × button, Escape, and re-clicking the rail; on close
	// we explicitly return focus to the rail (there is no focus-trap priorFocus
	// snapshot to do it).
	useEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return

		// Escape keydown → request close. CONTROLLED discipline: call
		// `onClose()` so the parent flips `open` → false; never call
		// `dialog.close()` directly (the parent owns the lifecycle).
		//
		// A non-modal <dialog> does NOT fire `cancel`/`close` on Escape in real
		// browsers (that is modal-only), and jsdom never fires it either — so
		// this handler IS the Escape close path in BOTH environments.
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === "Escape") {
				event.preventDefault()
				onClose()
			}
		}

		if (open) {
			// Guard against InvalidStateError when already open.
			if (!dialog.open) {
				if (typeof dialog.show === "function") {
					try {
						dialog.show()
					} catch {
						// Last-resort fallback — force the attribute so tests +
						// any degraded environment still observe the dialog as
						// open. Real browsers never hit this path.
						dialog.setAttribute("open", "")
					}
				} else {
					dialog.setAttribute("open", "")
				}
			}

			dialog.addEventListener("keydown", handleKeyDown)

			return () => {
				dialog.removeEventListener("keydown", handleKeyDown)
				// Return focus to the rail. With the focus-trap removed there is
				// no priorFocus snapshot, so this is the sole focus-restore path.
				const trigger = triggerRef?.current
				if (trigger && document.contains(trigger)) {
					try {
						trigger.focus()
					} catch {
						// Defensive: some environments throw when focusing a
						// detached or non-focusable node. Swallow.
					}
				}
			}
		}

		if (!open && dialog.open) {
			if (typeof dialog.close === "function") {
				try {
					dialog.close()
				} catch {
					dialog.removeAttribute("open")
				}
			} else {
				dialog.removeAttribute("open")
			}
		}

		return undefined
	}, [open, onClose, triggerRef])

	const dialogClassName = [
		dialogBaseClass(open, prefersReducedMotion),
		className ?? "",
	]
		.filter(Boolean)
		.join(" ")

	return (
		<dialog
			ref={dialogRef}
			id={resolvedId}
			aria-labelledby={resolvedTitleId}
			// biome-ignore lint/a11y/noRedundantRoles: Unit-10 completion criterion requires explicit role="dialog" on the sheet root — belt-and-suspenders for axe audits and RTL `getByRole` ergonomics in environments (jsdom, some legacy screen readers) where the implicit <dialog> role is not always surfaced. NOTE: `aria-modal` is intentionally absent — this is a NON-modal drawer; the page behind it stays interactive.
			role="dialog"
			data-testid="feedback-sheet"
			className={dialogClassName}
		>
			<header className={HEADER_CLASS}>
				<h2
					id={resolvedTitleId}
					className="text-sm font-semibold text-stone-700 dark:text-stone-300"
				>
					{resolvedTitle}
				</h2>
				<button
					type="button"
					// CONTROLLED close: call onClose() ONLY. The parent flips
					// `open` → false → the open/close effect closes the native
					// dialog. Calling dialog.close() here would hide it while the
					// parent still thinks it's open, and the effect would
					// immediately re-show() it — the "× does nothing" bug.
					onClick={onClose}
					aria-label="Close feedback panel"
					className={[
						CLOSE_BUTTON_CLASS,
						touchTargetClass,
						focusRingClass,
					].join(" ")}
					data-testid="feedback-sheet-close"
				>
					<span aria-hidden="true">&times;</span>
				</button>
			</header>
			<div className={BODY_CLASS}>{children}</div>
		</dialog>
	)
}
