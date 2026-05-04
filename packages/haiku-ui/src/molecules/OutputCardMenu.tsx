/**
 * OutputCardMenu — `⋯` trigger + popover menu attached to the artifact
 * card in the StageReview Outputs tab (DESIGN-BRIEF Screen 2 Component
 * inventory, unit-12).
 *
 * Menu items:
 *   - Open in new tab
 *   - Copy permalink
 *   - Replace this output…   ← the new (unit-12) action
 *   - Download original
 *
 * Behavior:
 *   - Click / Enter / Space toggles the popover.
 *   - Arrow keys navigate menu items (vertical wrap-around).
 *   - Enter / Space activates the focused item.
 *   - Esc closes the popover and returns focus to the trigger.
 *   - Click outside closes the popover.
 *
 * A11y (DESIGN-BRIEF Screen 2 §"Accessibility requirements"):
 *   - Trigger: `aria-label="Output actions for {artifact-name}"` (literal
 *     interpolated string asserted by tests),
 *     `aria-haspopup="menu"`, `aria-expanded` reflects the open state.
 *   - Popover: `role="menu"`; items: `role="menuitem"`.
 *   - Hover-reveal at >=md is provided by the parent (group-hover).
 *
 * Token discipline:
 *   - Tailwind utilities only — no raw hex.
 *   - Stone neutrals + teal focus ring (existing Input.tsx convention).
 */

import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import { focusRingCompactClass, touchTargetHitAreaClass } from "../a11y"

export interface OutputCardMenuProps {
	/** Artifact filename — interpolated into the trigger's aria-label. */
	artifactName: string
	onReplace: () => void
	onDownload?: () => void
	onOpen?: () => void
	onCopyLink?: () => void
	disabled?: boolean
}

interface MenuItem {
	id: string
	label: string
	action: () => void
	disabled?: boolean
	testId: string
}

export function OutputCardMenu({
	artifactName,
	onReplace,
	onDownload,
	onOpen,
	onCopyLink,
	disabled = false,
}: OutputCardMenuProps): React.ReactElement {
	const triggerRef = useRef<HTMLButtonElement | null>(null)
	const popoverRef = useRef<HTMLDivElement | null>(null)
	const menuId = useId()
	const [open, setOpen] = useState(false)
	const [activeIndex, setActiveIndex] = useState(0)

	const items: MenuItem[] = useMemo(
		() => [
			{
				id: "open",
				label: "Open in new tab",
				action: () => onOpen?.(),
				disabled: !onOpen,
				testId: "output-menu-open",
			},
			{
				id: "copy",
				label: "Copy permalink",
				action: () => onCopyLink?.(),
				disabled: !onCopyLink,
				testId: "output-menu-copy",
			},
			{
				id: "replace",
				label: "Replace this output…",
				action: onReplace,
				testId: "output-menu-replace",
			},
			{
				id: "download",
				label: "Download original",
				action: () => onDownload?.(),
				disabled: !onDownload,
				testId: "output-menu-download",
			},
		],
		[onOpen, onCopyLink, onReplace, onDownload],
	)

	const closeAndRestore = useCallback(() => {
		setOpen(false)
		// Defer focus to the next microtask so the popover is unmounted.
		window.setTimeout(() => {
			triggerRef.current?.focus()
		}, 0)
	}, [])

	const runItem = useCallback((item: MenuItem) => {
		if (item.disabled) return
		setOpen(false)
		item.action()
		window.setTimeout(() => {
			triggerRef.current?.focus()
		}, 0)
	}, [])

	// Click-outside handler.
	useEffect(() => {
		if (!open) return
		const onDocClick = (event: MouseEvent) => {
			const target = event.target as Node | null
			if (!target) return
			if (popoverRef.current?.contains(target)) return
			if (triggerRef.current?.contains(target)) return
			setOpen(false)
		}
		document.addEventListener("mousedown", onDocClick)
		return () => {
			document.removeEventListener("mousedown", onDocClick)
		}
	}, [open])

	// Reset active index when popover opens.
	useEffect(() => {
		if (open) {
			// Land on the first enabled item.
			const firstEnabled = items.findIndex((item) => !item.disabled)
			setActiveIndex(firstEnabled >= 0 ? firstEnabled : 0)
		}
	}, [open, items])

	// Focus the active menu item when it changes (when open).
	useEffect(() => {
		if (!open) return
		const popover = popoverRef.current
		if (!popover) return
		const buttons = popover.querySelectorAll<HTMLElement>("[role='menuitem']")
		buttons[activeIndex]?.focus()
	}, [open, activeIndex])

	const onTriggerKeyDown = useCallback(
		(event: KeyboardEvent<HTMLButtonElement>) => {
			if (disabled) return
			if (
				event.key === "Enter" ||
				event.key === " " ||
				event.key === "ArrowDown"
			) {
				event.preventDefault()
				setOpen(true)
			}
		},
		[disabled],
	)

	const onMenuKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "Escape") {
				event.preventDefault()
				closeAndRestore()
				return
			}
			if (event.key === "ArrowDown") {
				event.preventDefault()
				setActiveIndex((prev) => {
					let next = (prev + 1) % items.length
					// Skip disabled items.
					for (let i = 0; i < items.length; i += 1) {
						if (!items[next].disabled) return next
						next = (next + 1) % items.length
					}
					return prev
				})
				return
			}
			if (event.key === "ArrowUp") {
				event.preventDefault()
				setActiveIndex((prev) => {
					let next = (prev - 1 + items.length) % items.length
					for (let i = 0; i < items.length; i += 1) {
						if (!items[next].disabled) return next
						next = (next - 1 + items.length) % items.length
					}
					return prev
				})
				return
			}
			if (event.key === "Home") {
				event.preventDefault()
				const firstEnabled = items.findIndex((item) => !item.disabled)
				setActiveIndex(firstEnabled >= 0 ? firstEnabled : 0)
				return
			}
			if (event.key === "End") {
				event.preventDefault()
				for (let i = items.length - 1; i >= 0; i -= 1) {
					if (!items[i].disabled) {
						setActiveIndex(i)
						return
					}
				}
			}
		},
		[closeAndRestore, items],
	)

	return (
		<div className="relative inline-block">
			<button
				ref={triggerRef}
				type="button"
				aria-label={`Output actions for ${artifactName}`}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				data-testid="output-card-menu-trigger"
				disabled={disabled}
				onClick={() => {
					if (disabled) return
					setOpen((prev) => !prev)
				}}
				onKeyDown={onTriggerKeyDown}
				className={`${touchTargetHitAreaClass} ${focusRingCompactClass} inline-flex h-7 w-7 items-center justify-center rounded text-stone-600 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-300 ${open ? "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100" : ""}`}
			>
				<span aria-hidden="true" className="select-none text-base leading-none">
					⋯
				</span>
			</button>
			{open ? (
				<div
					ref={popoverRef}
					id={menuId}
					role="menu"
					aria-label={`Output actions for ${artifactName}`}
					data-testid="output-card-menu-popover"
					onKeyDown={onMenuKeyDown}
					className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-stone-200 bg-white p-1 text-sm shadow-lg dark:border-stone-700 dark:bg-stone-900"
				>
					{items.map((item, index) => {
						if (item.id === "replace") {
							// Separator above Replace per DESIGN-BRIEF Screen 2 layout.
							return (
								<div key={item.id}>
									<div
										aria-hidden="true"
										className="my-1 h-px bg-stone-200 dark:bg-stone-700"
									/>
									<button
										type="button"
										role="menuitem"
										data-testid={item.testId}
										data-active={index === activeIndex || undefined}
										onClick={() => runItem(item)}
										disabled={item.disabled}
										className={`flex h-9 w-full items-center rounded px-2 text-left text-sm text-stone-800 hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none dark:text-stone-100 dark:hover:bg-stone-800 dark:focus-visible:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-300`}
									>
										{item.label}
									</button>
								</div>
							)
						}
						return (
							<button
								key={item.id}
								type="button"
								role="menuitem"
								data-testid={item.testId}
								data-active={index === activeIndex || undefined}
								onClick={() => runItem(item)}
								disabled={item.disabled}
								className={`flex h-9 w-full items-center rounded px-2 text-left text-sm text-stone-800 hover:bg-stone-100 focus-visible:bg-stone-100 focus-visible:outline-none dark:text-stone-100 dark:hover:bg-stone-800 dark:focus-visible:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-300`}
							>
								{item.label}
							</button>
						)
					})}
				</div>
			) : null}
		</div>
	)
}
