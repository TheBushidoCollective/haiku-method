import ReactMarkdown from "react-markdown"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import { artifactSummary, type ArtifactDef } from "@/lib/studios"

export function titleCase(s: string): string {
	return s
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")
}

export const reviewBadge: Record<string, { label: string; color: string }> = {
	auto: {
		label: "Auto",
		color:
			"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
	},
	ask: {
		label: "Ask",
		color:
			"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	},
	external: {
		label: "External",
		color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
	},
	"external, ask": {
		label: "External / Ask",
		color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
	},
	await: {
		label: "Await",
		color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
	},
}

/** Accent palettes keyed by lifecycle phase, so each phase reads distinctly. */
export type PhaseAccent =
	| "elaborate"
	| "review"
	| "execute"
	| "approve"
	| "fix"
	| "gate"
	| "intent"
	| "neutral"

const accentMap: Record<PhaseAccent, { dot: string; ring: string }> = {
	elaborate: {
		dot: "bg-sky-500",
		ring: "border-sky-200 dark:border-sky-900/60",
	},
	review: {
		dot: "bg-violet-500",
		ring: "border-violet-200 dark:border-violet-900/60",
	},
	execute: {
		dot: "bg-teal-500",
		ring: "border-teal-200 dark:border-teal-900/60",
	},
	approve: {
		dot: "bg-emerald-500",
		ring: "border-emerald-200 dark:border-emerald-900/60",
	},
	fix: {
		dot: "bg-amber-500",
		ring: "border-amber-200 dark:border-amber-900/60",
	},
	gate: {
		dot: "bg-rose-500",
		ring: "border-rose-200 dark:border-rose-900/60",
	},
	intent: {
		dot: "bg-indigo-500",
		ring: "border-indigo-200 dark:border-indigo-900/60",
	},
	neutral: {
		dot: "bg-stone-400",
		ring: "border-stone-200 dark:border-stone-700",
	},
}

/** A labelled phase section with an accent rail and optional ordinal. */
export function PhaseSection({
	accent = "neutral",
	step,
	label,
	caption,
	children,
}: {
	accent?: PhaseAccent
	step?: number
	label: string
	caption?: string
	children: React.ReactNode
}) {
	const a = accentMap[accent]
	return (
		<section className="relative pl-6">
			<span
				className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ${a.dot}`}
				aria-hidden="true"
			/>
			<span
				className="absolute left-[5px] top-5 bottom-0 w-px bg-stone-200 dark:bg-stone-800"
				aria-hidden="true"
			/>
			<div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-200">
					{typeof step === "number" && (
						<span className="mr-2 text-stone-400">{step}</span>
					)}
					{label}
				</h3>
				{caption && (
					<span className="text-xs text-stone-500 dark:text-stone-400">
						{caption}
					</span>
				)}
			</div>
			<div className="pb-6">{children}</div>
		</section>
	)
}

/**
 * One artifact rendered brief-by-default: title + one-line summary always
 * visible; the full markdown body expands on click. No client JS — native
 * <details>.
 */
export function ExpandableArtifact({
	def,
	eyebrow,
	id,
}: {
	def: ArtifactDef | { name: string; content: string }
	eyebrow?: string
	id?: string
}) {
	const data = "data" in def ? def.data : undefined
	const summary = artifactSummary({ content: def.content, data })
	const hasBody = def.content.trim().length > 0
	return (
		<details
			id={id}
			className="group rounded-lg border border-stone-200 bg-white open:shadow-sm dark:border-stone-700 dark:bg-stone-900"
		>
			<summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
				<svg
					className="mt-1 h-4 w-4 flex-shrink-0 text-stone-400 transition-transform group-open:rotate-90"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9 5l7 7-7 7"
					/>
				</svg>
				<span className="min-w-0">
					{eyebrow && (
						<span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-stone-400">
							{eyebrow}
						</span>
					)}
					<span className="block text-sm font-semibold text-stone-900 dark:text-stone-100">
						{titleCase(def.name)}
					</span>
					{summary && (
						<span className="mt-0.5 block text-xs text-stone-500 group-open:hidden dark:text-stone-400">
							{summary}
						</span>
					)}
				</span>
			</summary>
			{hasBody && (
				<div className="border-t border-stone-100 px-4 py-3 dark:border-stone-800">
					<div className="prose prose-sm prose-stone dark:prose-invert max-w-none">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeSlug]}
						>
							{def.content}
						</ReactMarkdown>
					</div>
				</div>
			)}
		</details>
	)
}
