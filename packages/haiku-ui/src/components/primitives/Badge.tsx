import type { HTMLAttributes } from "react"

export type BadgeTone =
	| "neutral"
	| "success"
	| "warning"
	| "info"
	| "danger"

export type BadgeSize = "sm" | "md"

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	tone?: BadgeTone
	size?: BadgeSize
}

/**
 * Tone map per DESIGN-TOKENS §2.1 + DESIGN-BRIEF §2. `neutral` is the
 * FB-15-lifted fallback (text-stone-600 / dark:text-stone-300) — the
 * pre-FB-15 `text-stone-500` pair failed AA on `bg-stone-100` (4.40:1).
 */
const toneClasses: Record<BadgeTone, string> = {
	neutral:
		"bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
	success:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
	warning:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
	danger:
		"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const sizeClasses: Record<BadgeSize, string> = {
	md: "px-2.5 py-0.5 text-xs font-semibold",
	// Typography-floor exception: text-[11px] permitted ONLY with font-bold
	// (DESIGN-TOKENS §1.4). Used where `text-xs` would overflow a compact pill.
	sm: "px-2 py-0 text-[11px] font-bold",
}

export function Badge({
	tone = "neutral",
	size = "md",
	className = "",
	...rest
}: BadgeProps) {
	const combined =
		`inline-flex items-center rounded-full ${sizeClasses[size]} ${toneClasses[tone]} ${className}`.trim()
	return <span {...rest} className={combined} />
}
