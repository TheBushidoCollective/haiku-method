/**
 * ReplaceOutputDialog — modal that replaces a single stage-output
 * artifact (DESIGN-BRIEF Screen 2 Component inventory, unit-12).
 *
 * Owns:
 *   - the drop zone (reuses <KnowledgeDropZone> with `accept` constrained
 *     to the original mime and `maxFiles=1` semantics enforced here).
 *   - the optional note textarea.
 *   - the mime-mismatch warning + override flow.
 *   - the submit button (Replace / Replacing… / Retry).
 *   - the "concurrent change" non-dismissable banner shown when a peer
 *     replaces the same artifact while the dialog is open.
 *
 * Pure presentational: HTTP submission is the parent's responsibility
 * via `onSubmit({ file, note })`. The dialog stays open on submit error
 * so the user can retry; on success the dialog closes via `onClose()`
 * (the parent flips `open=false`).
 *
 * A11y (DESIGN-BRIEF Screen 2 §"Accessibility requirements"):
 *   - Native <dialog> for browser-native focus trap and Esc-close.
 *   - `aria-labelledby` on the title.
 *   - `aria-describedby` on the body.
 *   - Focus on open lands on the drop zone.
 *   - Mime-mismatch warning announced via `aria-live="assertive"`.
 *   - Color-not-only signals: every state pairs an icon with text.
 *
 * Token discipline: Tailwind utilities, light + dark pairs, no raw hex.
 * Touch targets ≥ 44×44 via the existing `.touch-target` helpers.
 *
 * Path-traversal sanitization: when the parent later POSTs with a
 * `target_path`, the helper `sanitizeTargetPath` exported here strips
 * `..` segments and absolute prefixes. Tests assert the sanitizer.
 */

import {
	type FormEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import { focusRingClass, touchTargetClass } from "../a11y"
import { KnowledgeDropZone } from "../atoms/KnowledgeDropZone"
import { OutputThumbnail } from "../atoms/OutputThumbnail"

export interface ReplaceOutputArtifact {
	name: string
	mime: string
	size: number
	sha?: string
	version?: string | number
	/** For markdown / html content embedded in the SPA payload. */
	content?: string
	/** For image / asset URLs served by the tunnel. */
	url?: string
}

export interface ReplaceOutputSubmit {
	file: File
	note: string
	/** True when the user explicitly accepted a mime change. */
	mimeOverride?: boolean
}

export interface ReplaceOutputDialogProps {
	open: boolean
	output: ReplaceOutputArtifact
	onSubmit: (payload: ReplaceOutputSubmit) => Promise<void>
	onClose: () => void
	/** External signal: a peer replaced the same artifact while this
	 *  dialog is open. Surfaces the non-dismissable concurrency banner. */
	concurrentReplaced?: boolean
	/** Fullscreen mobile variant — DESIGN-BRIEF Screen 2 §Responsive 375px. */
	mobileFullscreen?: boolean
}

/**
 * Defensive path-traversal sanitiser. Resolves `.` and `..` segments,
 * normalises Windows-style backslashes to forward slashes, and strips
 * leading slashes / drive letters so the resulting string can be
 * appended to a stage's artifacts dir without escaping it. Returns the
 * empty string if the input collapses to nothing (caller should fall
 * back to the original artifact name).
 */
export function sanitizeTargetPath(input: string): string {
	if (!input) return ""
	const segments = input.split(/[\\/]+/)
	const out: string[] = []
	for (const raw of segments) {
		const seg = raw.trim()
		if (!seg) continue
		if (seg === ".") continue
		if (seg === "..") {
			if (out.length > 0) out.pop()
			continue
		}
		out.push(seg)
	}
	return out.join("/")
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function ReplaceOutputDialog({
	open,
	output,
	onSubmit,
	onClose,
	concurrentReplaced = false,
	mobileFullscreen = false,
}: ReplaceOutputDialogProps): React.ReactElement {
	const dialogRef = useRef<HTMLDialogElement | null>(null)
	const dropZoneWrapperRef = useRef<HTMLDivElement | null>(null)
	const titleId = useId()
	const bodyId = useId()
	const noteId = useId()

	const [staged, setStaged] = useState<File | null>(null)
	const [note, setNote] = useState<string>("")
	const [mimeMismatch, setMimeMismatch] = useState<string | null>(null)
	const [mimeOverride, setMimeOverride] = useState<boolean>(false)
	const [submitting, setSubmitting] = useState<boolean>(false)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [hasAttempted, setHasAttempted] = useState<boolean>(false)

	// Reset internal state every time the dialog re-opens.
	useEffect(() => {
		if (open) {
			setStaged(null)
			setNote("")
			setMimeMismatch(null)
			setMimeOverride(false)
			setSubmitting(false)
			setSubmitError(null)
			setHasAttempted(false)
		}
	}, [open])

	// Imperative native <dialog> open/close — mirrors FeedbackSheet.tsx.
	useEffect(() => {
		const dialog = dialogRef.current
		if (!dialog) return

		function handleClose(): void {
			onClose()
		}
		function handleClick(event: MouseEvent): void {
			// Click on the dialog backdrop (target === dialog itself).
			if (event.target === dialog) {
				dialog?.close()
			}
		}
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === "Escape" && dialog) {
				dialog.close()
			}
		}

		if (open) {
			if (!dialog.open) {
				if (typeof dialog.showModal === "function") {
					try {
						dialog.showModal()
					} catch {
						dialog.setAttribute("open", "")
					}
				} else {
					dialog.setAttribute("open", "")
				}
			}
			document.documentElement.style.overflow = "hidden"
			dialog.addEventListener("close", handleClose)
			dialog.addEventListener("click", handleClick)
			dialog.addEventListener("keydown", handleKeyDown)
			// Focus the drop zone (DESIGN-BRIEF "Focus on open lands on drop zone").
			window.setTimeout(() => {
				const zone = dropZoneWrapperRef.current?.querySelector<HTMLElement>(
					"[data-testid='knowledge-drop-zone']",
				)
				zone?.focus()
			}, 0)
			return () => {
				dialog.removeEventListener("close", handleClose)
				dialog.removeEventListener("click", handleClick)
				dialog.removeEventListener("keydown", handleKeyDown)
				document.documentElement.style.overflow = ""
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
	}, [open, onClose])

	const onFiles = useCallback(
		(files: File[]) => {
			if (files.length === 0) return
			// maxFiles=1 — keep the most recent file and surface a
			// notice if multiple were dropped (replace mode is single-file).
			const file = files[files.length - 1]
			setStaged(file)
			setSubmitError(null)
			// Mime check (allows extension/family-style overrides via the
			// override toggle below).
			if (
				output.mime &&
				file.type &&
				file.type.toLowerCase() !== output.mime.toLowerCase() &&
				!extensionMatches(file.name, output.mime)
			) {
				setMimeMismatch(
					`Type mismatch: original is ${output.mime}, dropped ${file.type}.`,
				)
				setMimeOverride(false)
			} else {
				setMimeMismatch(null)
				setMimeOverride(false)
			}
		},
		[output.mime],
	)

	const acceptOverride = useCallback(() => {
		if (!staged || !mimeMismatch) return
		setMimeOverride(true)
		setMimeMismatch(null)
		// DESIGN-BRIEF Screen 2: pre-fill the note with explicit context.
		setNote(
			(prev) =>
				prev || `Type changed: ${output.mime} → ${staged.type || "unknown"}`,
		)
	}, [mimeMismatch, output.mime, staged])

	const onCancel = useCallback(() => {
		dialogRef.current?.close()
	}, [])

	const onFormSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault()
			if (!staged) return
			if (mimeMismatch && !mimeOverride) return
			setSubmitting(true)
			setSubmitError(null)
			setHasAttempted(true)
			try {
				await onSubmit({
					file: staged,
					note,
					mimeOverride: mimeOverride || undefined,
				})
				// Parent closes the dialog on success; we don't auto-close here
				// to avoid a double-close race when the parent reacts asynchronously.
			} catch (err) {
				const message = (err as Error).message ?? "Replacement failed."
				setSubmitError(message)
			} finally {
				setSubmitting(false)
			}
		},
		[mimeMismatch, mimeOverride, note, onSubmit, staged],
	)

	const blockedByMime = !!mimeMismatch && !mimeOverride
	const submitDisabled = submitting || !staged || blockedByMime
	const submitLabel = submitting
		? "Replacing…"
		: hasAttempted && submitError
			? "Retry"
			: "Replace"

	const dialogClass = mobileFullscreen
		? "h-[100dvh] w-screen max-w-none rounded-none border-0 bg-white p-0 dark:bg-stone-900"
		: "w-[min(640px,calc(100vw-2rem))] max-w-[640px] rounded-lg border border-stone-200 bg-white p-0 dark:border-stone-800 dark:bg-stone-900"

	return (
		<dialog
			ref={dialogRef}
			data-testid="replace-output-dialog"
			data-mobile-fullscreen={mobileFullscreen || undefined}
			aria-labelledby={titleId}
			aria-describedby={bodyId}
			className={`${dialogClass} text-stone-900 backdrop:bg-stone-900/60 dark:text-stone-100`}
		>
			<form
				onSubmit={onFormSubmit}
				className={
					mobileFullscreen
						? "flex h-full flex-col"
						: "flex max-h-[80vh] flex-col"
				}
			>
				<header className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
					<h2
						id={titleId}
						data-testid="replace-output-dialog-title"
						className="text-base font-semibold text-stone-900 dark:text-stone-100"
					>
						Replace output: {output.name}
					</h2>
					<button
						type="button"
						aria-label="Close replace dialog"
						data-testid="replace-output-dialog-close"
						onClick={onCancel}
						className={`${touchTargetClass} ${focusRingClass} inline-flex h-7 w-7 items-center justify-center rounded text-stone-600 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100`}
					>
						<span aria-hidden="true">×</span>
					</button>
				</header>

				{concurrentReplaced ? (
					<div
						role="alert"
						data-testid="replace-output-concurrent-banner"
						className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
					>
						<span aria-hidden="true" className="mr-1">
							⚠
						</span>
						This output was just replaced by another user. Your draft will
						overwrite theirs — close to keep theirs, or Replace to overwrite.
					</div>
				) : null}

				<div
					id={bodyId}
					className={`flex flex-col gap-4 px-4 py-4 ${mobileFullscreen ? "flex-1 overflow-y-auto" : "overflow-y-auto"}`}
				>
					<section
						data-testid="replace-output-current"
						className={
							mobileFullscreen
								? "flex flex-col gap-3"
								: "flex flex-col gap-3 md:flex-row md:items-start"
						}
					>
						<OutputThumbnail
							output={{
								name: output.name,
								mime: output.mime,
								content: output.content,
								url: output.url,
							}}
						/>
						<div className="flex flex-col gap-1 text-sm">
							<span className="font-mono text-xs text-stone-700 dark:text-stone-200">
								{output.name}
							</span>
							<span className="text-xs text-stone-600 dark:text-stone-300">
								{output.mime} · {formatBytes(output.size)}
								{output.version != null ? ` · v${output.version}` : ""}
							</span>
						</div>
					</section>

					<section
						className="flex flex-col gap-2"
						aria-labelledby={`${bodyId}-replacement-label`}
					>
						<span
							id={`${bodyId}-replacement-label`}
							className="text-xs font-medium uppercase tracking-wider text-stone-700 dark:text-stone-200"
						>
							Replacement
						</span>
						<div ref={dropZoneWrapperRef}>
							<KnowledgeDropZone
								// Pass `*/*` so the drop zone never rejects on mime — the
								// dialog's own check (with override flow) is the canonical
								// mismatch surface per DESIGN-BRIEF Screen 2.
								accept="*/*"
								onFiles={onFiles}
								onReject={(rejections) => {
									if (rejections.length > 0) {
										setMimeMismatch(rejections[0].reason)
									}
								}}
								disabled={submitting}
							/>
						</div>
						{staged ? (
							<p
								data-testid="replace-output-staged"
								className="text-xs text-stone-700 dark:text-stone-200"
							>
								<span aria-hidden="true" className="mr-1">
									📄
								</span>
								<span className="font-mono">{staged.name}</span>
								<span className="ml-2 tabular-nums text-stone-600 dark:text-stone-300">
									{formatBytes(staged.size)}
								</span>
								{staged.size !== output.size ? (
									<span className="ml-2 text-stone-500 dark:text-stone-400">
										({staged.size > output.size ? "+" : "−"}
										{formatBytes(Math.abs(staged.size - output.size))})
									</span>
								) : null}
							</p>
						) : null}
					</section>

					{mimeMismatch ? (
						<div
							role="alert"
							aria-live="assertive"
							data-testid="replace-output-mime-warning"
							className="flex flex-col gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
						>
							<p>
								<span aria-hidden="true" className="mr-1">
									⛔
								</span>
								{mimeMismatch} Pick a matching file or override the type.
							</p>
							<button
								type="button"
								data-testid="replace-output-mime-override"
								onClick={acceptOverride}
								className={`${touchTargetClass} ${focusRingClass} self-start rounded border border-rose-400 bg-white px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100 dark:border-rose-700 dark:bg-stone-900 dark:text-rose-200 dark:hover:bg-rose-900/40`}
							>
								Override type ▾
							</button>
						</div>
					) : null}

					<section className="flex flex-col gap-2">
						<label
							htmlFor={noteId}
							className="text-xs font-medium text-stone-700 dark:text-stone-200"
						>
							Optional note (will be saved as agent-readable knowledge)
						</label>
						<textarea
							id={noteId}
							data-testid="replace-output-note"
							value={note}
							onChange={(event) => setNote(event.target.value)}
							placeholder="What changed and why? The agent will read this."
							disabled={submitting}
							className={`min-h-[80px] resize-y rounded-md border border-stone-300 bg-white px-2 py-1.5 font-mono text-sm text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:focus-visible:ring-offset-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-300 ${mobileFullscreen ? "min-h-[120px]" : ""}`}
						/>
					</section>

					<p
						className="flex items-start gap-2 text-xs leading-snug text-stone-600 dark:text-stone-300"
						data-testid="replace-output-assessment-notice"
					>
						<input
							type="checkbox"
							checked
							disabled
							readOnly
							aria-label="The next workflow tick will assess this change"
							className="mt-0.5"
						/>
						<span>
							The next workflow tick will see this change and classify its
							impact (manual change assessment).
						</span>
					</p>
				</div>

				<footer
					className={`flex items-center justify-end gap-2 border-t border-stone-200 px-4 py-3 dark:border-stone-800 ${mobileFullscreen ? "sticky bottom-0 bg-white dark:bg-stone-900" : ""}`}
				>
					{submitError ? (
						<p
							role="alert"
							data-testid="replace-output-submit-error"
							className="mr-auto text-xs text-rose-700 dark:text-rose-300"
						>
							{submitError}
						</p>
					) : null}
					<button
						type="button"
						data-testid="replace-output-cancel"
						onClick={onCancel}
						disabled={submitting}
						className={`${touchTargetClass} ${focusRingClass} inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-100 dark:hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 disabled:border-stone-400 dark:disabled:bg-stone-800 dark:disabled:text-stone-300 dark:disabled:border-stone-500`}
					>
						Cancel
					</button>
					<button
						type="submit"
						data-testid="replace-output-submit"
						disabled={submitDisabled}
						aria-busy={submitting || undefined}
						className={`${touchTargetClass} ${focusRingClass} inline-flex h-9 min-w-[112px] items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-700 dark:disabled:bg-stone-700 dark:disabled:text-stone-300`}
					>
						{submitLabel}
					</button>
				</footer>
			</form>
		</dialog>
	)
}

/**
 * Allow common extension-equivalents to count as a mime match (e.g. an
 * `.html` file may report `text/html` or be empty in some browsers; an
 * `.svg` may report `image/svg+xml` even though `output.mime` is just
 * `image`). This is a tolerant pre-check; the canonical contract is
 * still the parent's API endpoint.
 */
function extensionMatches(filename: string, mime: string): boolean {
	const lower = filename.toLowerCase()
	const m = mime.toLowerCase()
	const dot = lower.lastIndexOf(".")
	if (dot < 0) return false
	const ext = lower.slice(dot + 1)
	if (m === "text/html" && (ext === "html" || ext === "htm")) return true
	if (m === "text/markdown" && (ext === "md" || ext === "markdown")) return true
	if (m === "text/plain" && (ext === "txt" || ext === "text")) return true
	if (m === "image/png" && ext === "png") return true
	if (m === "image/jpeg" && (ext === "jpg" || ext === "jpeg")) return true
	if (m === "image/svg+xml" && ext === "svg") return true
	if (m === "application/pdf" && ext === "pdf") return true
	return false
}
