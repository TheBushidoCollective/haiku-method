import type { HTMLAttributes, ReactNode } from "react"

export type CardElevation = "flat" | "raised"
export type CardPadding = "none" | "sm" | "md" | "lg"

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
	elevation?: CardElevation
	padding?: CardPadding
	children?: ReactNode
}

/**
 * Primitive Card — sibling of the existing `src/components/Card.tsx`
 * (which is a page-scaffolding wrapper tuned to a single layout). Downstream
 * units migrate callers.
 *
 * Token map derived from DESIGN-BRIEF §2 "Card" pattern and DESIGN-TOKENS §1.5.
 */
const elevationClasses: Record<CardElevation, string> = {
	flat: "bg-white dark:bg-stone-900 shadow-sm",
	raised: "bg-stone-50/50 dark:bg-stone-800/50 shadow-md",
}

const paddingClasses: Record<CardPadding, string> = {
	none: "p-0",
	sm: "p-3",
	md: "p-6",
	lg: "p-8",
}

export function Card({
	elevation = "flat",
	padding = "md",
	className = "",
	children,
	...rest
}: CardProps) {
	const combined =
		`rounded-xl border border-stone-200 dark:border-stone-700 ${elevationClasses[elevation]} ${paddingClasses[padding]} ${className}`.trim()
	return (
		<div {...rest} className={combined}>
			{children}
		</div>
	)
}
