/**
 * Canonical color map for the shared StatusBadge.
 *
 * Per DESIGN-TOKENS §1.2 + §1.2a:
 *   • The default / fallback key is `idle` (lifted from `text-stone-500` → `text-stone-600`
 *     to clear WCAG AA on `bg-stone-100` — FB-15 explicit remediation).
 *   • Legacy callers passing `status === "pending"` are routed to the same `idle` colors
 *     via a back-compat branch below. The string "pending" will be removed from callers
 *     in a follow-up; meanwhile the shared StatusBadge OWNS `idle` and never again emits
 *     `text-stone-500` on `bg-stone-100` (which measures 4.40:1 — AA FAIL).
 *   • Feedback contexts must use `FeedbackStatusBadge` (amber/blue/green/stone), NOT this
 *     component — see DESIGN-TOKENS §1.2a cross-component policy.
 */
const colors: Record<string, string> = {
	completed:
		"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	in_progress:
		"bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
	active: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
	idle: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
	blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
	unit: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
	intent:
		"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
}

interface Props {
	label?: string
	status: string
}

export function StatusBadge({ label, status }: Props) {
	const normalized = status.toLowerCase().replace(/\s+/g, "_")
	// Back-compat: legacy callers emit status="pending" and expect a neutral stone
	// fallback. Route to `idle` so they inherit the AA-lifted token pair.
	const key = normalized === "pending" ? "idle" : normalized
	const colorClass = colors[key] ?? colors.idle

	return (
		<span
			role="status"
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}
			aria-label={label ? `${label}: ${status}` : status}
		>
			{status.replace(/_/g, " ")}
		</span>
	)
}
