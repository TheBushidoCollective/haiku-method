import type { HTMLAttributes, ReactNode } from "react"

export type ChipTone = "neutral" | "teal" | "muted"

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
	tone?: ChipTone
	onRemove?: () => void
	children?: ReactNode
}

const toneClasses: Record<ChipTone, string> = {
	neutral:
		"border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300",
	teal: "border-transparent bg-teal-600 text-white dark:bg-teal-500",
	muted:
		"border-stone-300 dark:border-stone-600 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300",
}

const REMOVE_BUTTON_CLASS =
	"-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-current hover:bg-stone-100 dark:hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-stone-900"

/**
 * Chip — small inline tag with optional remove affordance. Tone surface per
 * DESIGN-BRIEF §2 (filter pill + teal-active treatment) and DESIGN-TOKENS §1.9.
 */
export function Chip({
	tone = "neutral",
	onRemove,
	className = "",
	children,
	...rest
}: ChipProps) {
	const combined =
		`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${toneClasses[tone]} ${className}`.trim()
	return (
		<span {...rest} className={combined}>
			{children}
			{onRemove ? (
				<button
					type="button"
					aria-label="Remove chip"
					onClick={onRemove}
					className={REMOVE_BUTTON_CLASS}
				>
					×
				</button>
			) : null}
		</span>
	)
}
