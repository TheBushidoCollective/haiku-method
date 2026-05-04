/**
 * StagedFileRow — one row in the staged-files list (DESIGN-BRIEF Screen 1
 * Component inventory, unit-11).
 *
 * Renders icon + filename (truncate, mono) + size (text-xs tabular-nums) +
 * remove × button (44×44 hit-area). When `progress` is supplied it shows
 * an inline determinate fill 0…100% and the size text is replaced with
 * "Uploading…".
 *
 * A11y:
 *   - Each row is a `<li role="listitem">` (the parent list wraps with
 *     role="list").
 *   - Remove button has the canonical literal aria-label
 *     `Remove ${file.name} from upload` (asserted by tests).
 *   - When `error` is supplied, the row gets a left border accent (rose)
 *     and the error message renders below it for screen readers; a Retry
 *     button replaces Remove.
 *
 * Token discipline:
 *   - Tailwind utilities only — no raw hex.
 *   - Light + dark pairs across hover/focus/error states.
 *   - `.touch-target.touch-target--hit-area` augments the 28px visual ×
 *     to a 44×44 click target on mobile.
 */

import { touchTargetHitAreaClass } from "../a11y"

export interface StagedFileRowProps {
	file: File
	onRemove?: (file: File) => void
	onRetry?: (file: File) => void
	/** 0–1 during upload; omit when not uploading. */
	progress?: number
	error?: string
	disabled?: boolean
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function StagedFileRow({
	file,
	onRemove,
	onRetry,
	progress,
	error,
	disabled = false,
}: StagedFileRowProps): React.ReactElement {
	const uploading = typeof progress === "number"
	const showError = !!error
	const showRetry = showError && !!onRetry
	const pct = uploading ? Math.max(0, Math.min(1, progress ?? 0)) : 0

	const containerBorder = showError
		? "border-l-[3px] border-l-rose-500 bg-rose-50/40 dark:bg-rose-900/20"
		: "border-l-[3px] border-l-transparent"

	return (
		<li
			// biome-ignore lint/a11y/noRedundantRoles: DESIGN-BRIEF Screen 1 §"Accessibility requirements" mandates the explicit role="listitem" string — the regression test asserts on it as a literal-string contract from SPA-UI-SPECS.md §1.4.
			role="listitem"
			data-testid="staged-file-row"
			data-error={showError || undefined}
			className={`flex flex-col gap-1 rounded px-2 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800/60 ${containerBorder}`}
		>
			<div className="flex items-center gap-2">
				<span aria-hidden="true" className="text-stone-600 dark:text-stone-300">
					{uploading ? "↺" : "📄"}
				</span>
				<span
					className="flex-1 truncate font-mono text-xs text-stone-700 dark:text-stone-200"
					title={file.name}
				>
					{file.name}
				</span>
				<span className="text-xs tabular-nums text-stone-600 dark:text-stone-300">
					{uploading ? "Uploading…" : formatBytes(file.size)}
				</span>
				{showRetry ? (
					<button
						type="button"
						aria-label={`Retry upload of ${file.name}`}
						onClick={() => onRetry?.(file)}
						disabled={disabled}
						className={`${touchTargetHitAreaClass} inline-flex h-7 w-7 items-center justify-center rounded text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-300`}
					>
						<span aria-hidden="true">↻</span>
					</button>
				) : (
					<button
						type="button"
						aria-label={`Remove ${file.name} from upload`}
						onClick={() => onRemove?.(file)}
						disabled={disabled || uploading}
						className={`${touchTargetHitAreaClass} inline-flex h-7 w-7 items-center justify-center rounded text-stone-600 hover:bg-stone-100 hover:text-rose-700 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-300`}
					>
						<span aria-hidden="true">×</span>
					</button>
				)}
			</div>
			{uploading ? (
				<div
					className="h-1 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
					role="progressbar"
					aria-valuenow={Math.round(pct * 100)}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label={`Uploading ${file.name}`}
				>
					<div
						className="h-full bg-teal-500 transition-[width] duration-150"
						style={{ width: `${pct * 100}%` }}
					/>
				</div>
			) : null}
			{showError ? (
				<p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
			) : null}
		</li>
	)
}
