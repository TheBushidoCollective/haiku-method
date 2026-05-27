/**
 * FeedbackSheet — mobile NON-MODAL bottom DRAWER backed by native <dialog>
 * (unit-10, reshaped to a non-blocking drawer).
 *
 * Canonical references:
 *   - stages/development/units/unit-10-feedback-sheet-mobile.md — scope +
 *     completion criteria (the a11y close-path + FAB-focus-restore contract
 *     survives; the modal-only pieces do not — see below).
 *   - stages/development/artifacts/unit-10-tactical-plan.md §A — component
 *     tree, effect wiring.
 *   - packages/haiku-ui/BROWSER-SUPPORT.md — native <dialog> policy, jsdom
 *     caveats.
 *
 * Why a non-modal drawer (the reshape):
 *   The previous implementation opened with `showModal()` and styled the
 *   dialog `fixed inset-0` — a FULL-VIEWPORT modal. On mobile the gate's
 *   decision bar (`GateDecisionBar`) now docks at the bottom of the
 *   viewport; a full-screen modal covered the header, the content, AND the
 *   gate, so opening feedback obliterated the Approve / Request-Changes
 *   controls. The fix: open with `show()` (NON-modal) and position the
 *   dialog as a partial bottom drawer ABOVE the decision bar. The rest of
 *   the page stays visible and INTERACTIVE while the drawer is open — the
 *   user reads the content and clicks Approve / Request-Changes without
 *   closing feedback.
 *
 * What that means for the implementation:
 *   - `dialog.show()` (non-modal), NOT `showModal()`. No top-layer, no
 *     background `inert`, no `::backdrop`.
 *   - NO scroll-lock. The page must scroll behind the drawer.
 *   - NO focus-trap. A non-modal drawer must let the user tab freely between
 *     the drawer and the gate — `useFocusTrap` (which confines tabbing) is
 *     deliberately gone.
 *   - NO backdrop-click close — there is no backdrop. The explicit close
 *     paths (× button, Escape) remain.
 *   - The dialog drops `aria-modal="true"` (it is not modal). It keeps
 *     `role="dialog"` + `aria-labelledby` + the title.
 *
 * What survives (the a11y contract that still makes sense for a drawer):
 *   - Escape closes it (`cancel`/`keydown` → `dialog.close()`).
 *   - The × button calls `dialog.close()` → `onClose`.
 *   - On close, focus returns to the FAB (the unit-spec CC3 "Focus returns
 *     to FAB" contract) — done explicitly here since there is no focus-trap
 *     priorFocus restore anymore.
 *
 * CSS selector alignment (FB-34): the rendered root is still a native
 * `<dialog className="feedback-sheet">`, matched by the `dialog.feedback-sheet`
 * block in `packages/haiku-ui/src/index.css`. The block was retuned alongside
 * this reshape (drawer sizing, slide-up retained, `::backdrop` removed). Do
 * NOT regress the root element to a div without rewriting those selectors.
 *
 * Controlled-only API: the parent owns `open` and supplies `onClose`. The FAB
 * (`FeedbackFloatingButton`) is always the trigger and lives one level up.
 */

import type { ReactNode, RefObject } from "react"
import { useEffect, useRef } from "react"
import { focusRingClass, touchTargetClass, useReducedMotion } from "../a11y"
import { MOBILE_FEEDBACK_BOTTOM_OFFSET } from "./mobileFeedbackLayout"

export interface FeedbackSheetProps {
	/** Current open state. Drives `dialog.show()` / `dialog.close()`. */
	open: boolean
	/**
	 * Fires when the sheet closes through any path (Escape, explicit close
	 * button). Parent is responsible for flipping `open` to `false` in
	 * response.
	 */
	onClose: () => void
	/**
	 * Ref to the FAB that opened the drawer. On close, focus is returned to
	 * this element (unit spec CC3 "Focus returns to FAB"). A non-modal drawer
	 * has no focus-trap to snapshot/restore prior focus, so this restore is
	 * done explicitly in the open/close effect.
	 */
	triggerRef?: RefObject<HTMLButtonElement | null>
	/** Accessible-name id override. Defaults to `"feedback-sheet-title"`. */
	titleId?: string
	/** Heading content; defaults to the string `"Feedback"`. */
	title?: ReactNode
	/** Sheet body contents (AgentFeedbackToggle, FeedbackList, footer). */
	children?: ReactNode
	/** `id` on the <dialog>; wires with FAB's `aria-controls`. */
	id?: string
	/** Extra class names appended to the dialog root. */
	className?: string
	/**
	 * Bottom-offset utility class — anchors the drawer's bottom edge ABOVE
	 * the sticky `GateDecisionBar` so the two never overlap. Defaults to the
	 * shared `MOBILE_FEEDBACK_BOTTOM_OFFSET` (the same offset the FAB uses),
	 * keeping the FAB, drawer, and gate in geometric sync.
	 */
	bottomClass?: string
}

function dialogBaseClass(bottomClass: string): string {
	return [
		"feedback-sheet",
		// Partial bottom drawer: span the viewport width, anchor ABOVE the
		// sticky decision bar. NOT `inset-0` — the page (header, content,
		// gate) stays visible and interactive in the band above the drawer.
		`fixed inset-x-0 ${bottomClass} z-30`,
		// Cap the height so the header + top of the content stay visible
		// above the drawer.
		"max-h-[55vh]",
		"flex flex-col",
		// Drawer chrome — rounded top, top border + shadow read as a sheet
		// lifted off the page rather than a full-bleed modal.
		"rounded-t-2xl border-t border-stone-200 dark:border-stone-700 shadow-2xl",
		"text-stone-900 dark:text-stone-100",
	].join(" ")
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

const BODY_CLASS = ["feedback-sheet__body", "flex-1 overflow-y-auto"].join(" ")

export function FeedbackSheet({
	open,
	onClose,
	triggerRef,
	titleId,
	title,
	children,
	id,
	className,
	bottomClass,
}: FeedbackSheetProps): React.ReactElement {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const prefersReducedMotion = useReducedMotion()

	const resolvedTitleId = titleId ?? "feedback-sheet-title"
	const resolvedId = id ?? "feedback-sheet"
	const resolvedTitle: ReactNode = title ?? "Feedback"
	const resolvedBottomClass = bottomClass ?? MOBILE_FEEDBACK_BOTTOM_OFFSET

	// Imperative open/close + Escape wiring + FAB focus restore.
	//
	// Non-modal drawer: NO scroll-lock, NO focus-trap, NO backdrop. The only
	// close paths are the × button and Escape; on close we explicitly return
	// focus to the FAB (there is no focus-trap priorFocus snapshot to do it).
	useEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return

		function handleClose(): void {
			onClose()
		}

		// Escape keydown → close (FB-60).
		//
		// A non-modal <dialog> does NOT fire `cancel`/`close` on Escape in
		// real browsers (that behavior is modal-only), and jsdom never fires
		// it either. So this handler IS the Escape close path in BOTH
		// environments: it calls `dialog.close()`, which fires the `close`
		// event → onClose() → FAB focus restore.
		function handleKeyDown(event: KeyboardEvent): void {
			if (!dialog) return
			if (event.key === "Escape") {
				event.preventDefault()
				dialog.close()
			}
		}

		if (open) {
			// Guard against InvalidStateError when already open.
			if (!dialog.open) {
				// Non-modal show(). The test harness polyfills it; production
				// browsers use the real impl.
				if (typeof dialog.show === "function") {
					try {
						dialog.show()
					} catch {
						// Last-resort fallback — force the attribute so tests
						// + any degraded environment still observe the dialog
						// as open. Real browsers never hit this path.
						dialog.setAttribute("open", "")
					}
				} else {
					dialog.setAttribute("open", "")
				}
			}

			dialog.addEventListener("close", handleClose)
			dialog.addEventListener("keydown", handleKeyDown)

			return () => {
				dialog.removeEventListener("close", handleClose)
				dialog.removeEventListener("keydown", handleKeyDown)
				// Return focus to the FAB per unit spec CC3 "Focus returns to
				// FAB". With the focus-trap removed there is no priorFocus
				// snapshot, so this is the sole focus-restore path.
				const fab = triggerRef?.current
				if (fab && document.contains(fab)) {
					try {
						fab.focus()
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

	// Animation class — only applied while open. Under reduced-motion we swap
	// the `sheet-enter` slide-up class for the `sheet-enter--reduced` sentinel
	// so the test can assert className presence without depending on CSS.
	const animationClass = open
		? prefersReducedMotion
			? "sheet-enter--reduced"
			: "sheet-enter"
		: ""

	const dialogClassName = [
		dialogBaseClass(resolvedBottomClass),
		animationClass,
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
					onClick={() => {
						const dialog = dialogRef.current
						if (dialog && typeof dialog.close === "function") {
							try {
								dialog.close()
								return
							} catch {
								// Fall through to onClose() below.
							}
						}
						onClose()
					}}
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
