import type { MDXComponents } from "mdx/types"
import Link from "next/link"
import type { HTMLAttributes, ReactNode } from "react"
import { CursorCascade } from "./CursorCascade"
import { ExpandableDiagram } from "./ExpandableDiagram"
import { Mermaid } from "./Mermaid"
import { TickCard, TickSequence } from "./TickSequence"

interface CalloutProps {
	tone?: "info" | "good" | "warn" | "bad"
	title?: string
	children: ReactNode
}

function Callout({ tone = "info", title, children }: CalloutProps) {
	const tones = {
		info: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
		good: "border-l-green-500 bg-green-50 dark:bg-green-950/30",
		warn: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/30",
		bad: "border-l-red-500 bg-red-50 dark:bg-red-950/30",
	}
	return (
		<aside
			className={`not-prose my-8 rounded-r-lg border-l-4 px-6 py-4 ${tones[tone]}`}
		>
			{title ? (
				<div className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
					{title}
				</div>
			) : null}
			<div className="text-stone-700 dark:text-stone-200">{children}</div>
		</aside>
	)
}

interface CardProps {
	title?: string
	eyebrow?: string
	accent?: "good" | "bad" | "info" | "warn" | "alert"
	children: ReactNode
}

function Card({ title, eyebrow, accent = "info", children }: CardProps) {
	const accents = {
		info: "border-t-blue-500",
		good: "border-t-green-500",
		bad: "border-t-red-500",
		warn: "border-t-amber-400",
		alert: "border-t-orange-500",
	}
	return (
		<div
			className={`rounded-lg border border-stone-200 border-t-4 bg-white p-6 dark:border-stone-800 dark:bg-stone-900 ${accents[accent]}`}
		>
			{eyebrow ? (
				<div className="mb-1 font-mono text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
					{eyebrow}
				</div>
			) : null}
			{title ? (
				<h3 className="mb-3 text-lg font-semibold text-stone-900 dark:text-white">
					{title}
				</h3>
			) : null}
			<div className="text-sm text-stone-700 dark:text-stone-300 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1">
				{children}
			</div>
		</div>
	)
}

function Grid({ children }: { children: ReactNode }) {
	return (
		<div className="not-prose my-8 grid gap-4 sm:grid-cols-2">{children}</div>
	)
}

function KeyPoints({
	title,
	children,
}: {
	title?: string
	children: ReactNode
}) {
	return (
		<div className="not-prose my-10 rounded-xl border border-stone-200 bg-stone-50 p-6 dark:border-stone-800 dark:bg-stone-900/50">
			{title ? (
				<div className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
					{title}
				</div>
			) : null}
			<div className="text-stone-700 dark:text-stone-200 [&_ol]:my-0 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-2 [&_strong]:text-stone-900 dark:[&_strong]:text-white">
				{children}
			</div>
		</div>
	)
}

function Pill({ children }: { children: ReactNode }) {
	return (
		<span className="inline-block rounded-full border border-stone-300 bg-stone-100 px-2.5 py-0.5 font-mono text-[11px] text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
			{children}
		</span>
	)
}

type CompareVerdict = "match" | "diverge" | "gap" | "win"

interface CompareProps {
	verdict?: CompareVerdict
	title: string
	children: ReactNode
}

const COMPARE_VERDICT_LABELS: Record<CompareVerdict, string> = {
	match: "Match",
	diverge: "Diverge",
	gap: "Gap",
	win: "Ours",
}

const COMPARE_VERDICT_PILL: Record<CompareVerdict, string> = {
	match:
		"border-green-400/40 bg-green-500/10 text-green-700 dark:border-green-500/40 dark:bg-green-500/15 dark:text-green-300",
	diverge:
		"border-amber-400/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
	gap: "border-red-400/40 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300",
	win: "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300",
}

/**
 * Side-by-side comparison block. Carries a verdict pill + title and
 * wraps one or more <Side label="…"> children. With two Sides the
 * layout is a two-column grid (stacks on mobile); with one Side the
 * grid collapses to a single column — useful for the "Ours" sections
 * that don't have a counterpart.
 */
function Compare({ verdict = "match", title, children }: CompareProps) {
	const pillCls = COMPARE_VERDICT_PILL[verdict]
	const label = COMPARE_VERDICT_LABELS[verdict]
	return (
		<div className="not-prose my-10">
			<h3 className="mb-3 flex items-center gap-3 text-lg font-semibold text-stone-900 dark:text-white">
				<span
					className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${pillCls}`}
				>
					{label}
				</span>
				<span>{title}</span>
			</h3>
			<div className="grid gap-0 overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] [&>div+div]:border-t [&>div+div]:border-stone-200 dark:[&>div+div]:border-stone-800 sm:[&>div+div]:border-t-0 sm:[&>div+div]:border-l">
				{children}
			</div>
		</div>
	)
}

interface SideProps {
	label?: string
	children: ReactNode
}

function Side({ label, children }: SideProps) {
	return (
		<div className="px-5 py-4">
			{label ? (
				<div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
					{label}
				</div>
			) : null}
			<div className="text-sm leading-relaxed text-stone-700 dark:text-stone-200 [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-700 dark:[&_a]:text-blue-400 [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] dark:[&_code]:bg-stone-800 [&_strong]:font-semibold [&_strong]:text-stone-900 dark:[&_strong]:text-white">
				{children}
			</div>
		</div>
	)
}

/**
 * Base MDX components — maps standard markdown elements to prose-styled
 * Tailwind output plus exposes custom components by name.
 */
export const mdxComponents: MDXComponents = {
	a: ({
		href,
		children,
		...rest
	}: HTMLAttributes<HTMLAnchorElement> & { href?: string }) => {
		if (href?.startsWith("/")) {
			return (
				<Link
					href={href}
					className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
				>
					{children}
				</Link>
			)
		}
		const isExternal = /^(https?:)?\/\//.test(href ?? "")
		return (
			<a
				href={href}
				target={isExternal ? "_blank" : undefined}
				rel={isExternal ? "noopener noreferrer" : undefined}
				className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
				{...rest}
			>
				{children}
			</a>
		)
	},
	// Intercept fenced code blocks tagged ```mermaid and render as diagram
	pre: ({ children, ...rest }: HTMLAttributes<HTMLPreElement>) => {
		const child = (
			children as {
				props?: { className?: string; children?: string }
			}
		)?.props
		const className = child?.className || ""
		const isMermaid = className.includes("language-mermaid")
		if (isMermaid && typeof child?.children === "string") {
			return <ExpandableDiagram chart={child.children.replace(/\n$/, "")} />
		}
		return <pre {...rest}>{children}</pre>
	},
	// Custom components available by name in MDX
	ExpandableDiagram,
	Mermaid,
	Callout,
	Card,
	Compare,
	CursorCascade,
	Grid,
	KeyPoints,
	Pill,
	Side,
	TickCard,
	TickSequence,
}
