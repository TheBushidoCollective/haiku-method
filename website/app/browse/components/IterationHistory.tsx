"use client"

// Iteration-history timelines for the browse views — the per-hat handoff
// messages the engine records on every advance/reject as a unit walks its
// hat sequence or a finding goes through its fix loop. Shared by
// UnitDetailView (unit "Hat history" + UnitFeedbackCard "Fix history") and
// IntentDetailView (FeedbackCard "Fix history") so both read the handoff
// the same way. Rendered as a horizontal stepper: the hat sequence as
// connected dots, click a step to read its handoff below.

import { Fragment, useState } from "react"
import { BrowseMarkdown } from "./BrowseMarkdown"

// Markdown styling for a handoff baton. Tones down the default `prose`
// blockquote (which renders oversized italic text wrapped in curly quotation
// marks — it looked weird for a one-line `>` aside in a baton) into a quiet
// left-ruled note, and drops the auto-inserted quote glyphs.
const BATON_MARKDOWN_CLASS =
	"prose prose-sm prose-stone max-w-none [overflow-wrap:anywhere] dark:prose-invert " +
	"prose-blockquote:border-l-2 prose-blockquote:border-stone-300 prose-blockquote:pl-3 " +
	"prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-stone-500 " +
	"dark:prose-blockquote:border-stone-600 dark:prose-blockquote:text-stone-400 " +
	"[&_blockquote_p:first-of-type]:before:content-none [&_blockquote_p:last-of-type]:after:content-none"

/** One hat-loop iteration from a unit or feedback frontmatter
 *  (VCS-parsed). Units use `result: advance | reject`; feedback uses
 *  `advanced | closed | reopened | rejected`. */
export interface HatIteration {
	hat?: string
	bolt?: number
	result?: string | null
	commit?: string
	/** v9 handoff baton — what the hat did + what the next hat needs. */
	message?: string
	/** Pre-v9 legacy reject text — surfaced as a fallback. */
	reason?: string
}

function isAdvance(result?: string | null): boolean {
	return result === "advance" || result === "advanced" || result === "closed"
}
function isReject(result?: string | null): boolean {
	return result === "reject" || result === "rejected" || result === "reopened"
}

/** Tailwind classes for an iteration's result pill, covering both the unit
 *  (`advance`/`reject`) and feedback (`advanced`/`closed`/`reopened`/
 *  `rejected`) result vocabularies. */
export function iterationResultClass(result?: string | null): string {
	if (isAdvance(result)) {
		return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
	}
	if (isReject(result)) {
		return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
	}
	return "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
}

/** The step node's dot — filled when selected, result-colored either way. */
function dotClass(result: string | null | undefined, active: boolean): string {
	const base = "h-3.5 w-3.5 flex-shrink-0 rounded-full border-2 transition"
	if (isAdvance(result)) {
		return `${base} border-emerald-500 ${active ? "bg-emerald-500" : "bg-emerald-100 dark:bg-emerald-900/40"}`
	}
	if (isReject(result)) {
		return `${base} border-rose-500 ${active ? "bg-rose-500" : "bg-rose-100 dark:bg-rose-900/40"}`
	}
	return `${base} border-stone-400 ${active ? "bg-stone-400" : "bg-stone-100 dark:bg-stone-800"}`
}

function handoffOf(it: HatIteration): string | undefined {
	return it.message ?? it.reason
}

/** Horizontal stepper for a hat sequence / fix loop. Each iteration is a
 *  connected dot with its hat name + result; clicking one opens its handoff
 *  baton (rendered markdown) in a panel below. Nothing is selected initially —
 *  the timeline reads as a flow first, detail on demand. */
function IterationStepper({ items }: { items: HatIteration[] }) {
	const [selected, setSelected] = useState<number | null>(null)
	const active = selected != null ? items[selected] : null
	const activeHandoff = active ? handoffOf(active) : undefined
	return (
		<div>
			<div className="flex items-start overflow-x-auto pb-1">
				{items.map((it, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: append-only ordered log
					<Fragment key={`step-${i}`}>
						{i > 0 && (
							<div className="mt-[7px] h-px min-w-[16px] flex-1 bg-stone-200 dark:bg-stone-700" />
						)}
						<button
							type="button"
							onClick={() => setSelected((s) => (s === i ? null : i))}
							className="flex flex-col items-center gap-1 px-2"
						>
							<span className={dotClass(it.result, selected === i)} />
							<span
								className={`whitespace-nowrap text-xs font-semibold ${selected === i ? "text-stone-900 dark:text-white" : "text-stone-600 dark:text-stone-300"}`}
							>
								{it.hat ?? "—"}
							</span>
							{it.result && (
								<span
									className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${iterationResultClass(it.result)}`}
								>
									{it.result}
								</span>
							)}
						</button>
					</Fragment>
				))}
			</div>
			{active ? (
				<div className="mt-3 rounded-lg border border-stone-200 p-4 dark:border-stone-700">
					<div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
						<span className="font-semibold text-stone-700 dark:text-stone-200">
							{active.hat ?? "—"}
						</span>
						{typeof active.bolt === "number" && (
							<span className="font-mono text-stone-400">
								bolt {active.bolt}
							</span>
						)}
						{active.commit && (
							<code className="font-mono text-stone-400" title={active.commit}>
								{active.commit.slice(0, 7)}
							</code>
						)}
					</div>
					{activeHandoff ? (
						<div className={BATON_MARKDOWN_CLASS}>
							<BrowseMarkdown>{activeHandoff}</BrowseMarkdown>
						</div>
					) : (
						<p className="text-xs italic text-stone-400">
							No handoff recorded.
						</p>
					)}
				</div>
			) : (
				<p className="mt-2 text-xs text-stone-400">
					Click a step to read its handoff.
				</p>
			)}
		</div>
	)
}

/** Hat-history stepper for a browsed unit — the per-hat handoffs the engine
 *  recorded as the unit walked its hat sequence. Reads `iterations[]` from the
 *  unit frontmatter; renders nothing when absent. */
export function HatHistory({ iterations }: { iterations?: unknown }) {
	if (!Array.isArray(iterations) || iterations.length === 0) return null
	return (
		<section className="mt-8">
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
				Hat history
			</h2>
			<div className="rounded-xl border border-stone-200 p-6 dark:border-stone-700">
				<IterationStepper items={iterations as HatIteration[]} />
			</div>
		</section>
	)
}

/** Compact fix-history stepper for a browsed feedback card — the per-hat
 *  handoffs the fix loop recorded against the finding. Reads `iterations[]`
 *  from the FB frontmatter; renders nothing when absent. */
export function FixHistory({ iterations }: { iterations?: unknown }) {
	if (!Array.isArray(iterations) || iterations.length === 0) return null
	return (
		<div className="mt-3">
			<div className="mb-2 text-[10px] uppercase tracking-wider text-stone-400">
				Fix history
			</div>
			<IterationStepper items={iterations as HatIteration[]} />
		</div>
	)
}
