/**
 * DriftEntryRow — one row in the expanded drift list inside `DriftBanner`.
 *
 * Layout (DESIGN-BRIEF Screen 3 §"Drift entry row"):
 *   [stage chip] [intent chip] [monospace path · truncate-mid]   [age] [action]
 *
 * The stage / intent chips reuse the KIND_BADGE palette pattern from
 * `StageReview.tsx` (sky for discovery/diagram, violet for artifact/
 * wireframe). For drift rows we map the existing palettes through to
 * stone for unknown stages and intent (since the chip's job is only
 * to communicate scope, not category).
 *
 * Path text is wrapped in `<bdi>` for RTL safety per DESIGN-BRIEF Screen 3
 * §"Accessibility requirements". When a path is wider than its column we
 * truncate-middle (head + tail visible, ellipsis in the middle) — this
 * keeps both the stage prefix and the file name readable without forcing
 * the row to wrap. Long single-token filenames fall back to plain
 * truncate at the tail.
 *
 * Token discipline: every color reference is either a Tailwind palette
 * utility (`bg-stone-100`, `text-stone-700`) or a token reference
 * (`bg-[var(--color-…)]`). No raw hex — the `no-raw-hex` gate is the
 * regression guard.
 */

export type DriftAction = "modified" | "added" | "deleted"

export interface DriftEntry {
	path: string
	stage: string
	intent: string
	action: DriftAction
	/** ISO-8601 timestamp; rendered via a relative-time formatter. */
	age: string
}

export interface DriftEntryRowProps {
	entry: DriftEntry
	/** When supplied, the row's primary affordance becomes a button labelled
	 *  "View {path}" — used by the SPA to open the file or its diff. When
	 *  omitted, the row is a plain `<div>` with no focus (per DESIGN-BRIEF
	 *  Screen 3 §"Accessibility requirements"). */
	onView?: (entry: DriftEntry) => void
}

const ACTION_LABEL: Record<DriftAction, string> = {
	modified: "Modified",
	added: "Added",
	deleted: "Deleted",
}

const ACTION_CLASS: Record<DriftAction, string> = {
	modified:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	added: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	deleted: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
}

const STAGE_CHIP_CLASS =
	"bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border-sky-200 dark:border-sky-800"

const INTENT_CHIP_CLASS =
	"bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border-violet-200 dark:border-violet-800"

/**
 * Render a path with a middle-ellipsis when it is wider than ~52 chars.
 * Keeps the leading directory and the trailing filename visible. For
 * shorter paths the middle-ellipsis collapses to the original string.
 */
function truncateMiddle(path: string, maxChars = 52): string {
	if (path.length <= maxChars) return path
	const keepEachSide = Math.floor((maxChars - 1) / 2)
	const head = path.slice(0, keepEachSide)
	const tail = path.slice(path.length - keepEachSide)
	return `${head}…${tail}`
}

/**
 * Format an ISO-8601 timestamp as a compact relative string.
 * "just now" / "5m ago" / "2h ago" / "3d ago".
 */
function formatAge(iso: string, now: number = Date.now()): string {
	const then = new Date(iso).getTime()
	if (!Number.isFinite(then)) return ""
	const diff = Math.max(0, now - then)
	const mins = Math.round(diff / 60_000)
	if (mins < 1) return "just now"
	if (mins < 60) return `${mins}m ago`
	const hours = Math.round(mins / 60)
	if (hours < 24) return `${hours}h ago`
	const days = Math.round(hours / 24)
	return `${days}d ago`
}

export function DriftEntryRow({
	entry,
	onView,
}: DriftEntryRowProps): React.ReactElement {
	const truncatedPath = truncateMiddle(entry.path)
	const ageLabel = formatAge(entry.age)
	const actionLabel = ACTION_LABEL[entry.action]
	const actionClasses = ACTION_CLASS[entry.action]

	const inner = (
		<div className="flex items-center gap-2 min-w-0 w-full">
			<span
				className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium uppercase tracking-wider ${STAGE_CHIP_CLASS}`}
				title={`Stage: ${entry.stage}`}
			>
				{entry.stage}
			</span>
			<span
				className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${INTENT_CHIP_CLASS}`}
				title={`Intent: ${entry.intent}`}
			>
				{entry.intent}
			</span>
			<bdi
				className="font-mono text-xs text-stone-700 dark:text-stone-200 truncate flex-1 min-w-0"
				title={entry.path}
			>
				{truncatedPath}
			</bdi>
			<span
				className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${actionClasses}`}
			>
				{actionLabel}
			</span>
			<span className="text-xs tabular-nums text-stone-500 dark:text-stone-400 shrink-0">
				{ageLabel}
			</span>
		</div>
	)

	if (onView) {
		return (
			<button
				type="button"
				onClick={() => onView(entry)}
				aria-label={`View ${entry.path}`}
				className="flex w-full items-center gap-2 px-3 py-2 rounded text-left hover:bg-stone-100 dark:hover:bg-stone-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"
			>
				{inner}
			</button>
		)
	}

	return (
		<div
			data-testid="drift-entry-row"
			className="flex items-center gap-2 px-3 py-2"
		>
			{inner}
		</div>
	)
}
