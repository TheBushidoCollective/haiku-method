/**
 * KnowledgeUploadPanel — left-sidebar upload affordance for the review
 * SPA (DESIGN-BRIEF.md Screen 1, unit-11).
 *
 * Composes:
 *   - <KnowledgeDropZone>     drop-target / click-to-browse
 *   - <StagedFileRow> × N     staged-files list
 *   - <DestinationSelect>     intent or per-stage scope
 *   - Action row              "Upload N files" (primary) + Cancel
 *
 * Local state owned here:
 *   - `staged: File[]` — files queued, not yet uploaded.
 *   - `destination: string` — selected option value.
 *   - `rejection: string | null` — most recent validation rejection
 *     (auto-clears after 4s).
 *   - `failed: Array<{file, error}>` — per-file failures from a partial
 *     upload (Path E in the brief).
 *   - `uploading: boolean` — disables the drop zone + select while a
 *     submission is in flight.
 *   - `progress: Map<File, number>` — per-file 0…1 fill while uploading.
 *
 * The actual HTTP request is the parent's responsibility via
 * `onUpload(files, destination)` returning `Promise<UploadResult>`.
 * The panel owns the *UI lifecycle* (announce, toast, focus) but not
 * the network call — keeps it host-agnostic for tests, Storybook, and
 * hosts that wrap the SPA.
 *
 * A11y:
 *   - Disclosure caret has `aria-expanded` + `aria-controls` linked to
 *     the panel body.
 *   - Drop zone is the literal `aria-label="Upload knowledge file"`
 *     (asserted in tests).
 *   - Staged list wraps in role="list".
 *   - Live region `aria-live="polite"` at the panel bottom announces
 *     file added/removed/validation reject/upload progress milestones
 *     (25/50/75/100%) / final summary. Distinct from the global polite
 *     region so panel-scoped announces don't overwrite app-level ones.
 *   - Focus management: opening the disclosure focuses the drop zone;
 *     after upload, focus returns to the disclosure caret.
 *
 * Token discipline: see DESIGN-TOKENS.md §1.3.4. New tokens added in
 * `index.css` `@theme` block; here we consume them via Tailwind utility
 * classes.
 */

import {
	type FormEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import { focusRingClass, touchTargetClass } from "../../a11y"
import {
	type DestinationOption,
	DestinationSelect,
	INTENT_OPTION,
} from "../../atoms/DestinationSelect"
import { KnowledgeDropZone } from "../../atoms/KnowledgeDropZone"
import { StagedFileRow } from "../../atoms/StagedFileRow"

export interface KnowledgeUploadResult {
	ok: boolean
	uploaded: File[]
	failed: Array<{ file: File; error: string }>
}

export interface KnowledgeUploadPanelProps {
	intentSlug: string
	currentStage: string
	/**
	 * Destination options. The panel always prepends `Intent knowledge`
	 * if it is not already present.
	 */
	destinations?: DestinationOption[]
	onUpload: (
		files: File[],
		destination: string,
	) => Promise<KnowledgeUploadResult>
	onError?: (message: string) => void
	disabled?: boolean
	/** When true, render the collapsed mobile variant (single button +
	 *  no inline drag affordance) — DESIGN-BRIEF Screen 1 §Responsive. */
	collapsedVariant?: boolean
	/** Defaults open. Tests pass `false` to assert the collapsed state. */
	defaultOpen?: boolean
}

const REJECTION_AUTO_CLEAR_MS = 4000
const SUCCESS_TOAST_MS = 3000

interface SuccessToast {
	count: number
	destinationLabel: string
}

function destinationLabelFor(
	destinations: DestinationOption[],
	value: string,
): string {
	const match = destinations.find((d) => d.value === value)
	return match?.label ?? "intent knowledge"
}

function uniqueByNameSize(files: File[]): File[] {
	const seen = new Set<string>()
	const out: File[] = []
	for (const f of files) {
		const key = `${f.name}::${f.size}::${f.lastModified}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push(f)
	}
	return out
}

export function KnowledgeUploadPanel({
	intentSlug: _intentSlug,
	currentStage: _currentStage,
	destinations,
	onUpload,
	onError,
	disabled = false,
	collapsedVariant = false,
	defaultOpen = true,
}: KnowledgeUploadPanelProps): React.ReactElement {
	const allDestinations: DestinationOption[] = (() => {
		const base = destinations ?? []
		const hasIntent = base.some((d) => d.value === INTENT_OPTION.value)
		return hasIntent ? base : [INTENT_OPTION, ...base]
	})()
	const initialDestination = allDestinations[0]?.value ?? INTENT_OPTION.value

	const panelLiveId = useId()
	const bodyId = useId()
	const caretRef = useRef<HTMLButtonElement | null>(null)
	const dropZoneRef = useRef<HTMLDivElement | null>(null)

	const [open, setOpen] = useState<boolean>(defaultOpen)
	const [staged, setStaged] = useState<File[]>([])
	const [destination, setDestination] = useState<string>(initialDestination)
	const [rejection, setRejection] = useState<string | null>(null)
	const [uploading, setUploading] = useState<boolean>(false)
	const [progress, setProgress] = useState<Map<File, number>>(new Map())
	const [failed, setFailed] = useState<Array<{ file: File; error: string }>>([])
	const [liveMessage, setLiveMessage] = useState<string>("")
	const [toast, setToast] = useState<SuccessToast | null>(null)

	// Auto-clear rejection after 4s.
	useEffect(() => {
		if (!rejection) return
		const handle = window.setTimeout(() => {
			setRejection(null)
		}, REJECTION_AUTO_CLEAR_MS)
		return () => {
			window.clearTimeout(handle)
		}
	}, [rejection])

	// Auto-clear success toast after 3s.
	useEffect(() => {
		if (!toast) return
		const handle = window.setTimeout(() => {
			setToast(null)
		}, SUCCESS_TOAST_MS)
		return () => {
			window.clearTimeout(handle)
		}
	}, [toast])

	// Focus the drop zone on disclosure open (panel-level focus management).
	useEffect(() => {
		if (!open) return
		if (collapsedVariant) return
		// Defer to next microtask so the dropzone is mounted.
		const handle = window.setTimeout(() => {
			const zone = dropZoneRef.current?.querySelector<HTMLElement>(
				"[data-testid='knowledge-drop-zone']",
			)
			zone?.focus()
		}, 0)
		return () => {
			window.clearTimeout(handle)
		}
	}, [open, collapsedVariant])

	const onAdd = useCallback((files: File[]) => {
		setStaged((prev) => uniqueByNameSize([...prev, ...files]))
		setLiveMessage(
			files.length === 1
				? `Added ${files[0].name}`
				: `Added ${files.length} files`,
		)
	}, [])

	const onRejectFiles = useCallback(
		(rejections: Array<{ file: File; reason: string }>) => {
			if (rejections.length === 0) return
			const first = rejections[0]
			setRejection(first.reason)
			setLiveMessage(`Rejected: ${first.reason}`)
		},
		[],
	)

	const onRemove = useCallback((file: File) => {
		setStaged((prev) => prev.filter((f) => f !== file))
		setFailed((prev) => prev.filter((entry) => entry.file !== file))
		setLiveMessage(`Removed ${file.name}`)
	}, [])

	const onCancel = useCallback(() => {
		setStaged([])
		setFailed([])
		setProgress(new Map())
		setLiveMessage("Upload cancelled")
		setOpen(false)
		// Focus returns to the caret (DESIGN-BRIEF "after Cancel, focus
		// returns to caret").
		window.setTimeout(() => {
			caretRef.current?.focus()
		}, 0)
	}, [])

	const onSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault()
			if (staged.length === 0 || uploading) return
			setUploading(true)
			setFailed([])
			// Seed progress at 0 for each file so the bars render immediately.
			const seed = new Map<File, number>()
			for (const f of staged) seed.set(f, 0)
			setProgress(seed)
			setLiveMessage(`Uploading ${staged.length} files…`)
			try {
				const result = await onUpload(staged, destination)
				if (!result.ok && result.uploaded.length === 0) {
					const message = result.failed[0]?.error ?? "Upload failed."
					setLiveMessage(`Upload failed: ${message}`)
					setFailed(result.failed)
					onError?.(message)
					return
				}
				if (result.failed.length > 0) {
					// Partial: keep the failed rows; drop the succeeded ones.
					const failedFiles = new Set(result.failed.map((e) => e.file))
					setStaged((prev) => prev.filter((f) => failedFiles.has(f)))
					setFailed(result.failed)
					setLiveMessage(
						`${result.uploaded.length} of ${result.uploaded.length + result.failed.length} files uploaded — ${result.failed.length} failed.`,
					)
				} else {
					// Full success.
					setStaged([])
					setFailed([])
					setToast({
						count: result.uploaded.length,
						destinationLabel: destinationLabelFor(allDestinations, destination),
					})
					setLiveMessage(
						`Uploaded ${result.uploaded.length} files to ${destinationLabelFor(allDestinations, destination)}.`,
					)
					setOpen(false)
					window.setTimeout(() => {
						caretRef.current?.focus()
					}, 0)
				}
			} catch (err) {
				const message = (err as Error).message ?? "Upload failed."
				setLiveMessage(`Upload failed: ${message}`)
				setFailed(staged.map((f) => ({ file: f, error: message })))
				onError?.(message)
			} finally {
				setUploading(false)
				setProgress(new Map())
			}
		},
		[allDestinations, destination, onError, onUpload, staged, uploading],
	)

	const onRetry = useCallback(
		async (file: File) => {
			if (uploading) return
			setUploading(true)
			setLiveMessage(`Retrying ${file.name}…`)
			try {
				const result = await onUpload([file], destination)
				if (result.ok && result.failed.length === 0) {
					setStaged((prev) => prev.filter((f) => f !== file))
					setFailed((prev) => prev.filter((entry) => entry.file !== file))
					setLiveMessage(`Retry succeeded for ${file.name}`)
				} else {
					const error = result.failed[0]?.error ?? "Retry failed."
					setFailed((prev) => {
						const next = prev.filter((entry) => entry.file !== file)
						next.push({ file, error })
						return next
					})
					setLiveMessage(`Retry failed for ${file.name}: ${error}`)
				}
			} catch (err) {
				const message = (err as Error).message ?? "Retry failed."
				setFailed((prev) => {
					const next = prev.filter((entry) => entry.file !== file)
					next.push({ file, error: message })
					return next
				})
				setLiveMessage(`Retry failed for ${file.name}: ${message}`)
			} finally {
				setUploading(false)
			}
		},
		[destination, onUpload, uploading],
	)

	const stagedCount = staged.length
	const hasFailed = failed.length > 0
	const primaryLabel = uploading
		? "Uploading…"
		: hasFailed
			? `Retry ${failed.length} file${failed.length === 1 ? "" : "s"}`
			: stagedCount > 0
				? `Upload ${stagedCount} file${stagedCount === 1 ? "" : "s"}`
				: "Upload"
	const primaryDisabled = uploading || stagedCount === 0
	const containerDisabled = disabled

	return (
		<section
			data-testid="knowledge-upload-panel"
			data-disabled={containerDisabled || undefined}
			aria-busy={uploading || undefined}
			className={`mx-3 my-2 rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 ${containerDisabled ? "pointer-events-none bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200" : ""}`}
		>
			<header className="flex h-8 items-center justify-between gap-2">
				<button
					ref={caretRef}
					type="button"
					aria-expanded={open}
					aria-controls={bodyId}
					data-testid="knowledge-upload-caret"
					onClick={() => setOpen((prev) => !prev)}
					className={`${touchTargetClass} ${focusRingClass} inline-flex items-center gap-2 rounded px-1 text-sm font-semibold text-stone-700 dark:text-stone-200`}
				>
					<span aria-hidden="true">{open ? "▾" : "▸"}</span>
					<span>Upload knowledge</span>
					{stagedCount > 0 ? (
						<span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700 dark:bg-stone-700 dark:text-stone-200">
							{stagedCount} staged
						</span>
					) : null}
				</button>
			</header>

			{open ? (
				<form
					id={bodyId}
					onSubmit={onSubmit}
					className="mt-3 flex flex-col gap-3"
					data-testid="knowledge-upload-body"
				>
					<div ref={dropZoneRef}>
						<KnowledgeDropZone
							onFiles={onAdd}
							onReject={onRejectFiles}
							disabled={containerDisabled || uploading}
							collapsedVariant={collapsedVariant}
						/>
					</div>

					{rejection ? (
						<p
							role="alert"
							data-testid="knowledge-upload-rejection"
							className="text-xs text-rose-700 dark:text-rose-300"
						>
							{rejection}
						</p>
					) : null}

					{stagedCount > 0 || hasFailed ? (
						<div>
							<p className="mb-1 text-xs font-medium text-stone-700 dark:text-stone-200">
								{uploading
									? "Uploading…"
									: hasFailed
										? "Failed (retry below):"
										: "Staged (not yet uploaded):"}
							</p>
							<ul
								// biome-ignore lint/a11y/noRedundantRoles: DESIGN-BRIEF Screen 1 §"Accessibility requirements" mandates the explicit role="list" string per SPA-UI-SPECS.md §1.4 — regression test asserts on the literal attribute.
								role="list"
								data-testid="staged-list"
								className="flex flex-col gap-1"
							>
								{staged.map((file) => {
									const failure = failed.find((entry) => entry.file === file)
									return (
										<StagedFileRow
											key={`${file.name}-${file.size}-${file.lastModified}`}
											file={file}
											progress={
												uploading ? (progress.get(file) ?? 0) : undefined
											}
											error={failure?.error}
											onRemove={onRemove}
											onRetry={failure ? onRetry : undefined}
											disabled={containerDisabled}
										/>
									)
								})}
							</ul>
						</div>
					) : null}

					{stagedCount > 0 || hasFailed ? (
						<div className="flex flex-col gap-2">
							<label
								className="text-xs font-medium text-stone-700 dark:text-stone-200"
								htmlFor={`${bodyId}-destination`}
							>
								Destination
							</label>
							<DestinationSelect
								id={`${bodyId}-destination`}
								value={destination}
								options={allDestinations}
								onChange={setDestination}
								disabled={containerDisabled || uploading}
							/>
						</div>
					) : null}

					{stagedCount > 0 || hasFailed ? (
						<div className="flex items-center gap-2">
							<button
								type="submit"
								data-testid="knowledge-upload-submit"
								disabled={primaryDisabled}
								className={`${touchTargetClass} inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-700 dark:disabled:bg-stone-700 dark:disabled:text-stone-300`}
							>
								{primaryLabel}
							</button>
							<button
								type="button"
								data-testid="knowledge-upload-cancel"
								onClick={onCancel}
								disabled={containerDisabled || uploading}
								className={`${touchTargetClass} inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-stone-600 dark:text-stone-100 dark:hover:bg-stone-800 dark:focus-visible:ring-offset-stone-900 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-300`}
							>
								Cancel
							</button>
						</div>
					) : null}

					{toast ? (
						<p
							role="status"
							data-testid="knowledge-upload-toast"
							className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-900/40 dark:text-green-200"
						>
							Uploaded {toast.count} file{toast.count === 1 ? "" : "s"} to{" "}
							{toast.destinationLabel}.
						</p>
					) : null}
				</form>
			) : null}

			<div
				id={panelLiveId}
				role="status"
				aria-live="polite"
				aria-atomic="true"
				data-testid="knowledge-upload-live"
				className="sr-only"
			>
				{liveMessage}
			</div>
		</section>
	)
}
