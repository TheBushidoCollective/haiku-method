import type { HTMLAttributes } from "react"

export type DividerOrientation = "horizontal" | "vertical"

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
	orientation?: DividerOrientation
}

const orientationClasses: Record<DividerOrientation, string> = {
	horizontal: "h-px w-full bg-stone-200 dark:bg-stone-700",
	vertical: "w-px h-full bg-stone-200 dark:bg-stone-700",
}

/**
 * Thin visual separator. Carries `role="separator"` and `aria-orientation`
 * so assistive tech can convey the break in content.
 */
export function Divider({
	orientation = "horizontal",
	className = "",
	...rest
}: DividerProps) {
	const combined =
		`${orientationClasses[orientation]} ${className}`.trim()
	return (
		<div
			{...rest}
			role="separator"
			aria-orientation={orientation}
			className={combined}
		/>
	)
}
