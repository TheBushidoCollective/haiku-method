import { type ButtonHTMLAttributes, forwardRef } from "react"

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost"
export type ButtonSize = "sm" | "md" | "lg"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant
	size?: ButtonSize
}

/**
 * Variant class strings derived from DESIGN-BRIEF §2 + DESIGN-TOKENS §1.9.
 * Disabled state uses token-based muted backgrounds + full-opacity text per
 * DESIGN-TOKENS §1.7 — never composite-opacity shortcuts (they collapse
 * text contrast below AA and are banned repo-wide by audit-banned-patterns).
 */
const variantEnabled: Record<ButtonVariant, string> = {
	primary: "bg-teal-600 hover:bg-teal-700 text-white",
	secondary:
		"bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200",
	danger: "bg-red-600 hover:bg-red-700 text-white",
	ghost:
		"bg-transparent hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300",
}

const variantDisabled: Record<ButtonVariant, string> = {
	primary:
		"bg-green-300 text-green-800 dark:bg-green-900/40 dark:text-green-200 cursor-not-allowed",
	secondary:
		"bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed",
	danger:
		"bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed",
	ghost:
		"bg-transparent text-stone-500 dark:text-stone-400 cursor-not-allowed",
}

const sizeClasses: Record<ButtonSize, string> = {
	sm: "px-3 py-1.5 text-xs font-medium rounded-md",
	md: "px-4 py-2.5 text-sm font-semibold rounded-lg",
	lg: "px-6 py-3 text-sm font-semibold rounded-lg",
}

const FOCUS_RING =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	function Button(
		{
			variant = "primary",
			size = "md",
			disabled = false,
			className = "",
			type = "button",
			...rest
		},
		ref,
	) {
		const variantClass = disabled
			? variantDisabled[variant]
			: variantEnabled[variant]
		const combined =
			`inline-flex items-center justify-center transition-colors ${sizeClasses[size]} ${variantClass} ${FOCUS_RING} ${className}`.trim()

		return (
			<button
				{...rest}
				// biome-ignore lint/a11y/useButtonType: type is explicitly forwarded via destructured default
				type={type}
				ref={ref}
				disabled={disabled}
				aria-disabled={disabled || undefined}
				className={combined}
			/>
		)
	},
)
