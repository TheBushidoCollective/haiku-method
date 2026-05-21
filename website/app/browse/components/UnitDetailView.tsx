"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { resolveLinks } from "@/lib/browse/resolve-links"
import type {
	BrowseProvider,
	HaikuAsset,
	HaikuFeedback,
	HaikuUnit,
} from "@/lib/browse/types"
import { formatDate, formatDuration } from "@/lib/browse/types"
import { AssetLightbox } from "./AssetLightbox"
import { AuthenticatedMedia } from "./AuthenticatedMedia"
import { RenderedHtmlFrame } from "./RenderedHtmlFrame"

function titleCase(s: string): string {
	return s
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")
}

/** Split a `unit-NNN-slug` name into a "Unit NNN" badge label + a
 *  title-cased name. Falls back to the whole name when it doesn't match. */
function splitUnitName(name: string): { badge: string | null; title: string } {
	const m = name.match(/^unit-(\d+)-(.+)$/)
	if (m) return { badge: `Unit ${m[1]}`, title: titleCase(m[2]) }
	return { badge: null, title: titleCase(name) }
}

const FIELD_LABELS: Record<string, string> = {
	ticket: "Ticket",
	epic: "Epic",
	design_ref: "Design",
	spec_url: "Spec",
	branch: "Branch",
}

interface Props {
	unit: HaikuUnit
	stageName: string
	intentSlug: string
	provider: BrowseProvider
	assets?: HaikuAsset[]
	host?: string
	feedback?: HaikuFeedback[]
	onBack: () => void
}

export function UnitDetailView({
	unit,
	stageName,
	intentSlug,
	provider,
	assets = [],
	host,
	feedback = [],
	onBack,
}: Props) {
	const checkedCount = unit.criteria.filter((c) => c.checked).length
	const totalCriteria = unit.criteria.length
	const progress = totalCriteria > 0 ? (checkedCount / totalCriteria) * 100 : 0
	const [settings, setSettings] = useState<Record<string, unknown> | null>(null)

	useEffect(() => {
		provider.getSettings().then(setSettings)
	}, [provider])

	const providerLinks = resolveLinks(unit.raw, settings)

	return (
		<div className="mx-auto max-w-4xl px-4 py-8 lg:py-12">
			{/* Breadcrumb */}
			<button
				type="button"
				onClick={onBack}
				className="mb-4 text-sm text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
			>
				&larr; Back to {titleCase(stageName)}
			</button>

			{/* Header */}
			<header className="mb-8">
				<div className="flex items-center gap-3">
					{(() => {
						const { badge, title } = splitUnitName(unit.name)
						return (
							<div className="flex items-center gap-2 min-w-0">
								{badge && (
									<span className="flex-shrink-0 rounded-md bg-stone-100 px-2 py-1 font-mono text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
										{badge}
									</span>
								)}
								<h1 className="truncate text-2xl font-bold tracking-tight">
									{title}
								</h1>
							</div>
						)
					})()}
					<StatusBadge status={unit.status} />
				</div>
				<p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
					Stage: {titleCase(stageName)}
				</p>
			</header>

			{/* Quick Stats */}
			<div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
				<div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
					<div className="text-xs font-medium uppercase tracking-wider text-stone-400">
						Criteria
					</div>
					<div className="mt-1 text-2xl font-bold">
						{checkedCount}
						<span className="text-stone-400">/{totalCriteria}</span>
					</div>
					{totalCriteria > 0 && (
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
							<div
								className={`h-full rounded-full transition-all ${progress === 100 ? "bg-green-500" : "bg-teal-500"}`}
								style={{ width: `${progress}%` }}
							/>
						</div>
					)}
				</div>
				<div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
					<div className="text-xs font-medium uppercase tracking-wider text-stone-400">
						Bolt
					</div>
					<div className="mt-1 text-2xl font-bold">{unit.bolt || 0}</div>
				</div>
				<div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
					<div className="text-xs font-medium uppercase tracking-wider text-stone-400">
						Hat
					</div>
					<div className="mt-1 text-lg font-semibold">
						{unit.hat ? titleCase(unit.hat) : "—"}
					</div>
				</div>
				<div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
					<div className="text-xs font-medium uppercase tracking-wider text-stone-400">
						Status
					</div>
					<div className="mt-1 text-lg font-semibold">
						{titleCase(unit.status)}
					</div>
				</div>
				{unit.startedAt && (
					<div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
						<div className="text-xs font-medium uppercase tracking-wider text-stone-400">
							{unit.completedAt ? "Duration" : "Elapsed"}
						</div>
						<div className="mt-1 text-lg font-semibold">
							{formatDuration(unit.startedAt, unit.completedAt)}
						</div>
						<div className="mt-0.5 text-xs text-stone-400">
							{formatDate(unit.startedAt)}
							{unit.completedAt ? ` — ${formatDate(unit.completedAt)}` : ""}
						</div>
					</div>
				)}
			</div>

			{/* Completion Criteria */}
			{unit.criteria.length > 0 && (
				<section className="mb-8">
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
						Completion Criteria
					</h2>
					<div className="rounded-xl border border-stone-200 dark:border-stone-700">
						{unit.criteria.map((criterion, i) => (
							<div
								key={criterion.text}
								className={`flex items-start gap-3 px-5 py-3 ${
									i < unit.criteria.length - 1
										? "border-b border-stone-100 dark:border-stone-800"
										: ""
								}`}
							>
								<div
									className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${
										criterion.checked
											? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
											: "bg-stone-100 text-stone-400 dark:bg-stone-800"
									}`}
								>
									{criterion.checked ? (
										<svg
											className="h-3.5 w-3.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											aria-hidden="true"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={3}
												d="M5 13l4 4L19 7"
											/>
										</svg>
									) : (
										<span className="h-3 w-3" />
									)}
								</div>
								<span
									className={`text-sm ${
										criterion.checked
											? "text-stone-500 line-through dark:text-stone-500"
											: "text-stone-800 dark:text-stone-200"
									}`}
								>
									{criterion.text}
								</span>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Review + approval sign-offs stamped on the unit */}
			<SignOffsSection unit={unit} />

			{/* Feedback targeting this unit */}
			{feedback.length > 0 && (
				<section className="mb-8">
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
						Feedback ({feedback.length})
					</h2>
					<div className="space-y-2">
						{feedback.map((fb) => (
							<UnitFeedbackCard key={fb.id} fb={fb} />
						))}
					</div>
				</section>
			)}

			{/* Dependencies */}
			{unit.dependsOn.length > 0 && (
				<section className="mb-8">
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
						Dependencies
					</h2>
					<div className="flex flex-wrap gap-2">
						{unit.dependsOn.map((dep) => (
							<span
								key={dep}
								className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 dark:border-stone-700 dark:text-stone-400"
							>
								{dep}
							</span>
						))}
					</div>
				</section>
			)}

			{/* Outputs (artifacts produced by this unit) */}
			{unit.outputs.length > 0 && (
				<OutputsSection
					outputs={unit.outputs}
					intentSlug={intentSlug}
					provider={provider}
				/>
			)}

			{/* Referenced Artifacts (from unit refs) */}
			{unit.refs.length > 0 && (
				<RefsSection
					refs={unit.refs}
					intentSlug={intentSlug}
					provider={provider}
					assets={assets}
					host={host}
				/>
			)}

			{/* Provider Links / References */}
			{providerLinks.length > 0 && (
				<section className="mb-8">
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
						References
					</h2>
					<div className="flex flex-wrap gap-3">
						{providerLinks.map((link) => {
							const label = FIELD_LABELS[link.field] || titleCase(link.field)
							if (link.url) {
								return (
									<a
										key={link.field}
										href={link.url}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-teal-600 transition hover:border-teal-300 hover:bg-teal-50 dark:border-stone-700 dark:text-teal-400 dark:hover:border-teal-700 dark:hover:bg-teal-950"
									>
										<svg
											className="h-4 w-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											aria-hidden="true"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
											/>
										</svg>
										<span className="text-stone-500 dark:text-stone-400">
											{label}:
										</span>
										{link.value}
									</a>
								)
							}
							return (
								<span
									key={link.field}
									className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-400"
								>
									<span className="font-medium text-stone-500 dark:text-stone-400">
										{label}:
									</span>
									{link.value}
								</span>
							)
						})}
					</div>
				</section>
			)}

			{/* Unit Content */}
			{unit.content && (
				<section>
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
						Specification
					</h2>
					<div className="rounded-xl border border-stone-200 p-6 dark:border-stone-700">
						<div className="prose prose-sm prose-stone dark:prose-invert max-w-none">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{unit.content}
							</ReactMarkdown>
						</div>
					</div>
				</section>
			)}

			{/* Frontmatter Debug (collapsed) */}
			{Object.keys(unit.raw).length > 0 && (
				<details className="mt-8">
					<summary className="cursor-pointer text-xs text-stone-400 hover:text-stone-600">
						Raw frontmatter
					</summary>
					<pre className="mt-2 overflow-x-auto rounded-lg bg-stone-50 p-4 text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-400">
						{JSON.stringify(unit.raw, null, 2)}
					</pre>
				</details>
			)}
		</div>
	)
}

function UnitFeedbackCard({ fb }: { fb: HaikuFeedback }) {
	const [open, setOpen] = useState(false)
	const isHuman = fb.authorType === "human"
	const isClosed = fb.closedAt != null
	const pillClass = isHuman
		? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
		: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
	const statusLabel = isClosed ? "closed" : "open"
	const statusClass = isClosed
		? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
		: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
	return (
		<div
			className={`rounded-lg border ${
				isClosed
					? "border-stone-200 dark:border-stone-700"
					: "border-amber-200 dark:border-amber-900/50"
			}`}
		>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="w-full px-4 py-2.5 text-left"
			>
				<div className="flex flex-wrap items-center gap-2">
					<span
						className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${pillClass}`}
					>
						{isHuman ? "user" : "agent"}
					</span>
					<span
						className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusClass}`}
					>
						{statusLabel}
					</span>
					{fb.origin && (
						<span className="rounded bg-stone-50 dark:bg-stone-900 px-1.5 py-0.5 text-[10px] font-mono text-stone-500 dark:text-stone-400">
							{fb.origin}
						</span>
					)}
					<span
						className={`text-sm font-medium text-stone-800 dark:text-stone-200 ${
							isClosed ? "line-through text-stone-400 dark:text-stone-500" : ""
						}`}
					>
						{fb.title ?? fb.id}
					</span>
					<span className="ml-auto text-[10px] text-stone-400 font-mono">
						{fb.id}
					</span>
				</div>
			</button>
			{open && (
				<div className="border-t border-stone-100 dark:border-stone-800 px-4 py-3 text-sm text-stone-700 dark:text-stone-300">
					{fb.body ? (
						<pre className="whitespace-pre-wrap font-sans text-sm">
							{fb.body}
						</pre>
					) : (
						<p className="text-stone-400 italic">No body.</p>
					)}
					{fb.closureReply && (
						<div className="mt-3 rounded-md bg-stone-50 dark:bg-stone-900 px-3 py-2">
							<div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">
								Closure reply
							</div>
							<div className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
								{fb.closureReply.text}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

const TEXT_EXTENSIONS = new Set([
	"md",
	"json",
	"yaml",
	"yml",
	"txt",
	"toml",
	"csv",
	"xml",
	"html",
])

function isTextFile(path: string): boolean {
	const ext = path.split(".").pop()?.toLowerCase() || ""
	return TEXT_EXTENSIONS.has(ext)
}

function RefsSection({
	refs,
	intentSlug,
	provider,
	assets,
	host,
}: {
	refs: string[]
	intentSlug: string
	provider: BrowseProvider
	assets: HaikuAsset[]
	host?: string
}) {
	// Build a lookup from relative path (relative to intent dir) to asset
	const assetByRelPath = new Map<string, HaikuAsset>()
	const intentPrefix = `.haiku/intents/${intentSlug}/`
	for (const asset of assets) {
		if (asset.path.startsWith(intentPrefix)) {
			assetByRelPath.set(asset.path.slice(intentPrefix.length), asset)
		}
	}

	return (
		<section className="mb-8">
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
				Referenced Artifacts
			</h2>
			<div className="space-y-2">
				{refs.map((ref) => {
					const matchedAsset = assetByRelPath.get(ref)
					if (matchedAsset && host) {
						return (
							<AssetRefItem
								key={ref}
								ref_={ref}
								asset={matchedAsset}
								host={host}
							/>
						)
					}
					if (isTextFile(ref)) {
						return (
							<TextRefItem
								key={ref}
								ref_={ref}
								intentSlug={intentSlug}
								provider={provider}
							/>
						)
					}
					return <GenericRefItem key={ref} ref_={ref} />
				})}
			</div>
		</section>
	)
}

function AssetRefItem({
	ref_,
	asset,
	host,
}: {
	ref_: string
	asset: HaikuAsset
	host: string
}) {
	const [showLightbox, setShowLightbox] = useState(false)
	const fileName = ref_.split("/").pop() || ref_
	const dirPath = ref_.includes("/")
		? ref_.substring(0, ref_.lastIndexOf("/"))
		: ""

	return (
		<>
			<button
				type="button"
				onClick={() => setShowLightbox(true)}
				className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-teal-300 hover:shadow-sm dark:border-stone-700 dark:hover:border-teal-700"
			>
				<div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-stone-100 dark:bg-stone-800">
					<AuthenticatedMedia
						rawUrl={asset.rawUrl}
						name={asset.name}
						host={host}
						className="rounded"
					/>
				</div>
				<div className="min-w-0">
					<p className="truncate text-sm font-medium text-stone-700 dark:text-stone-300">
						{fileName}
					</p>
					{dirPath && (
						<p className="truncate text-xs text-stone-400">{dirPath}</p>
					)}
				</div>
			</button>
			{showLightbox && (
				<AssetLightbox
					asset={asset}
					host={host}
					onClose={() => setShowLightbox(false)}
				/>
			)}
		</>
	)
}

function TextRefItem({
	ref_,
	intentSlug,
	provider,
}: {
	ref_: string
	intentSlug: string
	provider: BrowseProvider
}) {
	const [content, setContent] = useState<string | null>(null)
	const [showModal, setShowModal] = useState(false)

	const fileName = ref_.split("/").pop() || ref_
	const dirPath = ref_.includes("/")
		? ref_.substring(0, ref_.lastIndexOf("/"))
		: ""
	const isMarkdown = ref_.endsWith(".md")

	const handleOpen = async () => {
		if (content === null) {
			const raw = await provider.readFile(
				`.haiku/intents/${intentSlug}/${ref_}`,
			)
			setContent(raw || "(empty)")
		}
		setShowModal(true)
	}

	return (
		<>
			<button
				type="button"
				onClick={handleOpen}
				className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-stone-200 p-3 text-left transition hover:border-teal-300 hover:shadow-sm dark:border-stone-700 dark:hover:border-teal-700"
			>
				<div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded bg-stone-100 text-2xl dark:bg-stone-800">
					{isMarkdown ? "📄" : "📋"}
				</div>
				<div className="min-w-0">
					<p className="truncate text-sm font-medium text-stone-700 dark:text-stone-300">
						{fileName}
					</p>
					{dirPath && (
						<p className="truncate text-xs text-stone-400">{dirPath}</p>
					)}
				</div>
			</button>
			{showModal && content && (
				<DocModal
					fileName={fileName}
					filePath={ref_}
					content={content}
					isMarkdown={isMarkdown}
					onClose={() => setShowModal(false)}
				/>
			)}
		</>
	)
}

function DocModal({
	fileName,
	filePath,
	content,
	isMarkdown,
	onClose,
}: {
	fileName: string
	filePath: string
	content: string
	isMarkdown: boolean
	onClose: () => void
}) {
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		document.addEventListener("keydown", handleEsc)
		return () => document.removeEventListener("keydown", handleEsc)
	}, [onClose])

	// Strip frontmatter for display
	let displayContent = content
	let frontmatter = ""
	if (isMarkdown && content.startsWith("---")) {
		const endIdx = content.indexOf("---", 3)
		if (endIdx !== -1) {
			frontmatter = content.slice(3, endIdx).trim()
			displayContent = content.slice(endIdx + 3).trim()
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
			onClick={onClose}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose()
			}}
			role="dialog"
			aria-modal="true"
			aria-label={`File viewer: ${fileName}`}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: inner container stops backdrop-close propagation */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation is click-capture suppression */}
			<div
				className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between border-b border-stone-200 px-5 py-3 dark:border-stone-700">
					<div>
						<h3 className="font-mono text-sm font-semibold text-stone-900 dark:text-stone-100">
							{fileName}
						</h3>
						<p className="font-mono text-xs text-stone-400">{filePath}</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
					>
						&#10005;
					</button>
				</div>
				{frontmatter && (
					<div className="border-b border-stone-100 bg-stone-50 px-5 py-2 dark:border-stone-800 dark:bg-stone-950/50">
						<pre className="font-mono text-[11px] text-stone-500">
							{frontmatter}
						</pre>
					</div>
				)}
				<div className="flex-1 overflow-y-auto px-5 py-4">
					{isMarkdown ? (
						<div className="prose prose-sm prose-stone dark:prose-invert max-w-none">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>
								{displayContent}
							</ReactMarkdown>
						</div>
					) : (
						<pre className="overflow-x-auto text-xs text-stone-600 dark:text-stone-400">
							{content}
						</pre>
					)}
				</div>
			</div>
		</div>
	)
}

function GenericRefItem({ ref_ }: { ref_: string }) {
	const fileName = ref_.split("/").pop() || ref_
	const dirPath = ref_.includes("/")
		? ref_.substring(0, ref_.lastIndexOf("/"))
		: ""

	return (
		<div className="flex items-center gap-3 rounded-lg border border-stone-200 px-4 py-3 dark:border-stone-700">
			<svg
				className="h-5 w-5 flex-shrink-0 text-stone-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
				/>
			</svg>
			<div className="min-w-0">
				<p className="truncate text-sm font-mono text-stone-600 dark:text-stone-400">
					{fileName}
				</p>
				{dirPath && (
					<p className="truncate text-xs text-stone-400">{dirPath}</p>
				)}
			</div>
		</div>
	)
}

/** Read review/approval slots off unit FM. A slot present + truthy = signed
 *  (the cursor only writes a role's slot when it signs, so unsigned roles are
 *  simply absent); `at` carries the timestamp. Witness fields (body_sha256,
 *  witnesses[]) are ignored — engine bookkeeping, noise to a reviewer. */
function readSignOffs(
	raw: unknown,
): Array<{ role: string; signed: boolean; signedAt: string | null }> {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return []
	return Object.entries(raw as Record<string, unknown>).map(([role, v]) => {
		const signed = v != null
		let signedAt: string | null = null
		if (v && typeof v === "object" && !Array.isArray(v)) {
			const at = (v as Record<string, unknown>).at
			if (typeof at === "string") signedAt = at
		}
		return { role, signed, signedAt }
	})
}

/** Human label for a review/approval role. Raw role names read fine; we just
 *  tidy the multi-word engine roles and the special gates. */
function roleLabel(role: string): string {
	if (role === "user") return "User"
	if (role === "quality_gates") return "Quality Gates"
	if (role === "cross-stage-consistency") return "Cross-stage Consistency"
	return role
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")
}

/**
 * Per-unit review + approval sign-offs. The cursor stamps `reviews.<role>` as
 * each pre-execute reviewer signs the spec and `approvals.<role>` as each
 * post-execute approver signs the work (the `user` gate lands in the same
 * structure, so "all reviews/approvals" covers it). Surfaces who has signed
 * and when, so a viewer can see the audit trail on the unit itself.
 */
function SignOffsSection({ unit }: { unit: HaikuUnit }) {
	const reviews = readSignOffs(unit.raw.reviews)
	const approvals = readSignOffs(unit.raw.approvals)
	if (reviews.length === 0 && approvals.length === 0) return null
	return (
		<section className="mb-8">
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
				Reviews &amp; Approvals
			</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				{reviews.length > 0 && (
					<SignOffGroup title="Reviews" entries={reviews} />
				)}
				{approvals.length > 0 && (
					<SignOffGroup title="Approvals" entries={approvals} />
				)}
			</div>
		</section>
	)
}

function SignOffGroup({
	title,
	entries,
}: {
	title: string
	entries: Array<{ role: string; signed: boolean; signedAt: string | null }>
}) {
	return (
		<div className="rounded-xl border border-stone-200 dark:border-stone-700">
			<div className="border-b border-stone-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:border-stone-800">
				{title}
			</div>
			<ul className="divide-y divide-stone-100 dark:divide-stone-800">
				{entries.map(({ role, signed, signedAt }) => (
					<li
						key={role}
						className="flex items-center justify-between gap-3 px-4 py-2.5"
					>
						<div className="flex items-center gap-2 min-w-0">
							<span
								className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
									signed
										? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
										: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
								}`}
							>
								{signed ? (
									<svg
										className="h-3 w-3"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										aria-hidden="true"
									>
										<title>signed</title>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={3}
											d="M5 13l4 4L19 7"
										/>
									</svg>
								) : (
									<span
										className="h-1.5 w-1.5 rounded-full bg-current"
										aria-hidden="true"
									/>
								)}
							</span>
							<span className="truncate text-sm text-stone-700 dark:text-stone-300">
								{roleLabel(role)}
							</span>
						</div>
						<span className="flex-shrink-0 text-xs text-stone-400">
							{signedAt ? formatDate(signedAt) : signed ? "signed" : "pending"}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}

const OUTPUT_IMAGE_EXTS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"svg",
	"webp",
	"avif",
	"bmp",
	"ico",
])

type OutputKind = "image" | "html" | "text" | "other"

/** Classify a unit output by extension. ASCII/binary split: `text` (the
 *  isTextFile allowlist) and `html` are renderable as text; `image` and
 *  `other` are binary — `image` previews, `other` downloads. */
function classifyOutput(path: string): OutputKind {
	const ext = path.split(".").pop()?.toLowerCase() || ""
	if (OUTPUT_IMAGE_EXTS.has(ext)) return "image"
	if (ext === "html" || ext === "htm") return "html"
	if (isTextFile(path)) return "text"
	return "other"
}

function fileNameOf(path: string): string {
	return path.split("/").pop() || path
}
function dirOf(path: string): string {
	return path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : ""
}

/**
 * Unit outputs, made viewable. Outputs are intent-relative paths
 * (`.haiku/intents/<slug>/<output>`). Mockups + images get their own
 * "Visual Outputs" grid (thumbnails open fullscreen); everything else lists
 * below, clickable to view (text in a doc modal, binary as a download). HTML
 * outputs render with relative CSS/images resolved against the provider, so a
 * wireframe authored as `index.html` + `./styles.css` renders correctly.
 */
function OutputsSection({
	outputs,
	intentSlug,
	provider,
}: {
	outputs: string[]
	intentSlug: string
	provider: BrowseProvider
}) {
	const intentPrefix = `.haiku/intents/${intentSlug}/`
	const classified = outputs.map((path) => ({
		path,
		kind: classifyOutput(path),
	}))
	const visual = classified.filter(
		(o) => o.kind === "image" || o.kind === "html",
	)
	const files = classified.filter(
		(o) => o.kind === "text" || o.kind === "other",
	)

	return (
		<>
			{visual.length > 0 && (
				<section className="mb-8">
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
						Visual Outputs
					</h2>
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
						{visual.map((o) =>
							o.kind === "image" ? (
								<OutputImageCard
									key={o.path}
									path={o.path}
									repoPath={`${intentPrefix}${o.path}`}
									provider={provider}
								/>
							) : (
								<OutputHtmlCard
									key={o.path}
									path={o.path}
									repoPath={`${intentPrefix}${o.path}`}
									baseDir={`${intentPrefix}${dirOf(o.path)}${dirOf(o.path) ? "/" : ""}`}
									provider={provider}
								/>
							),
						)}
					</div>
				</section>
			)}
			{files.length > 0 && (
				<section className="mb-8">
					<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
						Outputs
					</h2>
					<div className="space-y-1">
						{files.map((o) =>
							o.kind === "text" ? (
								<OutputTextItem
									key={o.path}
									path={o.path}
									repoPath={`${intentPrefix}${o.path}`}
									provider={provider}
								/>
							) : (
								<OutputDownloadItem
									key={o.path}
									path={o.path}
									repoPath={`${intentPrefix}${o.path}`}
									provider={provider}
								/>
							),
						)}
					</div>
				</section>
			)}
		</>
	)
}

/** Image output — resolves to a data URL (works for a dragged folder and a
 *  private git repo) and previews it; click to view fullscreen. */
function OutputImageCard({
	path,
	repoPath,
	provider,
}: {
	path: string
	repoPath: string
	provider: BrowseProvider
}) {
	const [url, setUrl] = useState<string | null>(null)
	const [full, setFull] = useState(false)
	useEffect(() => {
		let cancelled = false
		provider.resolveAssetUrl?.(repoPath).then((u) => {
			if (!cancelled) setUrl(u)
		})
		return () => {
			cancelled = true
		}
	}, [repoPath, provider])
	return (
		<>
			<button
				type="button"
				onClick={() => url && setFull(true)}
				className="group flex flex-col overflow-hidden rounded-lg border border-stone-200 text-left transition hover:border-teal-300 hover:shadow-sm dark:border-stone-700 dark:hover:border-teal-700"
			>
				<div className="flex h-[150px] w-full items-center justify-center overflow-hidden bg-stone-50 dark:bg-stone-800/50">
					{url ? (
						// biome-ignore lint/performance/noImgElement: data URL from provider-resolved bytes; next/image can't consume a data URL via its loader pipeline
						<img
							src={url}
							alt={fileNameOf(path)}
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-teal-500" />
					)}
				</div>
				<div className="border-t border-stone-100 px-3 py-2 dark:border-stone-800">
					<p className="truncate text-xs font-medium text-stone-700 group-hover:text-teal-600 dark:text-stone-300 dark:group-hover:text-teal-400">
						{fileNameOf(path)}
					</p>
				</div>
			</button>
			{full && url && (
				<OutputOverlay name={fileNameOf(path)} onClose={() => setFull(false)}>
					{/* biome-ignore lint/performance/noImgElement: data URL */}
					<img
						src={url}
						alt={fileNameOf(path)}
						className="max-h-[85vh] max-w-[90vw] rounded-lg"
					/>
				</OutputOverlay>
			)}
		</>
	)
}

/** HTML output — reads the source, previews it in a scaled iframe with
 *  relative assets resolved; click to view fullscreen. */
function OutputHtmlCard({
	path,
	repoPath,
	baseDir,
	provider,
}: {
	path: string
	repoPath: string
	baseDir: string
	provider: BrowseProvider
}) {
	const [html, setHtml] = useState<string | null>(null)
	const [full, setFull] = useState(false)
	useEffect(() => {
		let cancelled = false
		// Load the source the same way images do — resolveAssetUrl fetches
		// the raw bytes (a data: URL), which always works. readFile goes
		// through the git provider's GraphQL `text`, which returns null when
		// the host flags an HTML file as binary/large, leaving the frame
		// blank. Fall back to readFile only if the raw path is unavailable.
		const load = async (): Promise<string | null> => {
			const url = await provider.resolveAssetUrl?.(repoPath)
			if (url) {
				try {
					return await (await fetch(url)).text()
				} catch {
					/* fall through to readFile */
				}
			}
			return provider.readFile(repoPath)
		}
		load().then((c) => {
			if (!cancelled) setHtml(c)
		})
		return () => {
			cancelled = true
		}
	}, [repoPath, provider])
	return (
		<>
			<button
				type="button"
				onClick={() => html && setFull(true)}
				className="group flex flex-col overflow-hidden rounded-lg border border-stone-200 text-left transition hover:border-teal-300 hover:shadow-sm dark:border-stone-700 dark:hover:border-teal-700"
			>
				<div className="relative aspect-[4/3] w-full overflow-hidden bg-white dark:bg-stone-900">
					{html ? (
						<div
							className="absolute inset-0 h-[300%] w-[300%] origin-top-left"
							style={{ transform: "scale(0.3333)", pointerEvents: "none" }}
						>
							<RenderedHtmlFrame
								html={html}
								baseDir={baseDir}
								provider={provider}
								title={fileNameOf(path)}
								className="h-full w-full border-0"
							/>
						</div>
					) : (
						<div className="flex h-full items-center justify-center">
							<div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-teal-500" />
						</div>
					)}
				</div>
				<div className="border-t border-stone-100 px-3 py-2 dark:border-stone-800">
					<p className="truncate text-xs font-medium text-stone-700 group-hover:text-teal-600 dark:text-stone-300 dark:group-hover:text-teal-400">
						{fileNameOf(path)}
					</p>
				</div>
			</button>
			{full && html && (
				<OutputOverlay
					name={fileNameOf(path)}
					onClose={() => setFull(false)}
					fill
				>
					<RenderedHtmlFrame
						html={html}
						baseDir={baseDir}
						provider={provider}
						title={fileNameOf(path)}
						className="h-full w-full flex-1 border-0 bg-white"
					/>
				</OutputOverlay>
			)}
		</>
	)
}

/** Text output — reads the source and opens it in the shared doc modal. */
function OutputTextItem({
	path,
	repoPath,
	provider,
}: {
	path: string
	repoPath: string
	provider: BrowseProvider
}) {
	const [content, setContent] = useState<string | null>(null)
	const [open, setOpen] = useState(false)
	const isMarkdown = path.endsWith(".md")
	const handleOpen = async () => {
		if (content === null) {
			setContent((await provider.readFile(repoPath)) || "(empty)")
		}
		setOpen(true)
	}
	return (
		<>
			<button
				type="button"
				onClick={handleOpen}
				className="flex w-full items-center gap-3 rounded-lg border border-stone-200 px-4 py-2.5 text-left transition hover:border-teal-300 hover:shadow-sm dark:border-stone-700 dark:hover:border-teal-700"
			>
				<svg
					className="h-4 w-4 flex-shrink-0 text-teal-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				<div className="min-w-0">
					<p className="truncate text-sm font-mono text-stone-700 dark:text-stone-300">
						{fileNameOf(path)}
					</p>
					{dirOf(path) && (
						<p className="truncate text-xs text-stone-400">{dirOf(path)}</p>
					)}
				</div>
			</button>
			{open && content !== null && (
				<DocModal
					fileName={fileNameOf(path)}
					filePath={path}
					content={content}
					isMarkdown={isMarkdown}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	)
}

/** Binary / unrecognized output — resolve to a data URL for download. */
function OutputDownloadItem({
	path,
	repoPath,
	provider,
}: {
	path: string
	repoPath: string
	provider: BrowseProvider
}) {
	const [url, setUrl] = useState<string | null>(null)
	useEffect(() => {
		let cancelled = false
		provider.resolveAssetUrl?.(repoPath).then((u) => {
			if (!cancelled) setUrl(u)
		})
		return () => {
			cancelled = true
		}
	}, [repoPath, provider])
	const inner = (
		<>
			<svg
				className="h-4 w-4 flex-shrink-0 text-stone-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				aria-hidden="true"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={1.5}
					d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
				/>
			</svg>
			<div className="min-w-0">
				<p className="truncate text-sm font-mono text-stone-700 dark:text-stone-300">
					{fileNameOf(path)}
				</p>
				{dirOf(path) && (
					<p className="truncate text-xs text-stone-400">{dirOf(path)}</p>
				)}
			</div>
		</>
	)
	const cls =
		"flex items-center gap-3 rounded-lg border border-stone-200 px-4 py-2.5 dark:border-stone-700"
	return url ? (
		<a
			href={url}
			download={fileNameOf(path)}
			className={`${cls} hover:border-teal-300`}
		>
			{inner}
		</a>
	) : (
		<div className={cls}>{inner}</div>
	)
}

/** Fullscreen overlay shell for an output preview (image or HTML). Escape /
 *  backdrop close. `fill` lays the body out as a full-height column (HTML
 *  iframe); otherwise it centers (image). */
function OutputOverlay({
	name,
	onClose,
	children,
	fill,
}: {
	name: string
	onClose: () => void
	children: React.ReactNode
	fill?: boolean
}) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		document.addEventListener("keydown", onKey)
		document.body.style.overflow = "hidden"
		return () => {
			document.removeEventListener("keydown", onKey)
			document.body.style.overflow = ""
		}
	}, [onClose])
	return (
		<div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-stone-950">
			<div className="flex items-center justify-between border-b border-stone-200 px-4 py-2 dark:border-stone-800">
				<span className="font-mono text-sm text-stone-600 dark:text-stone-400">
					{name}
				</span>
				<button
					type="button"
					onClick={onClose}
					className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
				>
					Close
				</button>
			</div>
			{fill ? (
				<div className="flex flex-1 flex-col">{children}</div>
			) : (
				<div className="flex flex-1 items-center justify-center overflow-auto p-4">
					{children}
				</div>
			)}
		</div>
	)
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		completed:
			"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
		active: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
		pending:
			"bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
		blocked: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
	}
	return (
		<span
			className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] || colors.pending}`}
		>
			{status}
		</span>
	)
}
