// Iteration-history timelines for the browse views — the per-hat handoff
// messages the engine records on every advance/reject as a unit walks its
// hat sequence or a finding goes through its fix loop. Shared by
// UnitDetailView (unit "Hat history" + UnitFeedbackCard "Fix history") and
// IntentDetailView (FeedbackCard "Fix history") so both read the handoff
// the same way.

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

/** Tailwind classes for an iteration's result pill, covering both the unit
 *  (`advance`/`reject`) and feedback (`advanced`/`closed`/`reopened`/
 *  `rejected`) result vocabularies. */
export function iterationResultClass(result?: string | null): string {
	if (result === "advance" || result === "advanced" || result === "closed") {
		return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
	}
	if (result === "reject" || result === "rejected" || result === "reopened") {
		return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
	}
	return "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
}

/** The visible heading row for one iteration — hat name, result pill, and the
 *  optional bolt index / commit short-sha. Used as the `<summary>` of a
 *  collapsible iteration (or standalone when there's no handoff body). */
function IterationHeading({
	hat,
	result,
	commit,
	bolt,
}: {
	hat?: string
	result?: string | null
	commit?: string
	bolt?: number
}) {
	return (
		<>
			{typeof bolt === "number" && (
				<span className="font-mono text-[10px] text-stone-400">
					bolt {bolt}
				</span>
			)}
			<span className="font-semibold text-stone-800 dark:text-stone-200">
				{hat ?? "—"}
			</span>
			{result && (
				<span
					className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${iterationResultClass(result)}`}
				>
					{result}
				</span>
			)}
			{commit && (
				<code
					className="font-mono text-[11px] text-stone-500 dark:text-stone-400"
					title={commit}
				>
					{commit.slice(0, 7)}
				</code>
			)}
		</>
	)
}

/** Hat-history timeline for a browsed unit — the per-hat handoffs the
 *  engine recorded as the unit walked its hat sequence. Reads
 *  `iterations[]` from the unit frontmatter; renders nothing when absent. */
export function HatHistory({ iterations }: { iterations?: unknown }) {
	if (!Array.isArray(iterations) || iterations.length === 0) return null
	const items = iterations as HatIteration[]
	return (
		<section className="mt-8">
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
				Hat history
			</h2>
			<ol className="space-y-3 rounded-xl border border-stone-200 p-6 dark:border-stone-700">
				{items.map((it, idx) => {
					const handoff = it.message ?? it.reason
					return (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: append-only ordered log
							key={`hat-iter-${idx}`}
							className="border-l-2 border-stone-200 pl-3 dark:border-stone-700"
						>
							{handoff ? (
								<details className="group">
									<summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
										<span className="text-stone-400 transition-transform group-open:rotate-90">
											▸
										</span>
										<IterationHeading
											hat={it.hat}
											result={it.result}
											commit={it.commit}
										/>
									</summary>
									<div className={`mt-2 ${BATON_MARKDOWN_CLASS}`}>
										<BrowseMarkdown>{handoff}</BrowseMarkdown>
									</div>
								</details>
							) : (
								<div className="flex flex-wrap items-center gap-2">
									<IterationHeading
										hat={it.hat}
										result={it.result}
										commit={it.commit}
									/>
								</div>
							)}
						</li>
					)
				})}
			</ol>
		</section>
	)
}

/** Compact fix-history timeline for a browsed feedback card — the per-hat
 *  handoff messages the fix loop recorded against the finding. Reads
 *  `iterations[]` from the FB frontmatter; renders nothing when absent. */
export function FixHistory({ iterations }: { iterations?: unknown }) {
	if (!Array.isArray(iterations) || iterations.length === 0) return null
	const items = iterations as HatIteration[]
	return (
		<div className="mt-3">
			<div className="mb-1 text-[10px] uppercase tracking-wider text-stone-400">
				Fix history
			</div>
			<ol className="space-y-2 border-l-2 border-stone-200 pl-3 dark:border-stone-700">
				{items.map((it, idx) => {
					const handoff = it.message ?? it.reason
					return (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: append-only ordered log
							key={`fb-iter-${idx}`}
						>
							{handoff ? (
								<details className="group">
									<summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
										<span className="text-[10px] text-stone-400 transition-transform group-open:rotate-90">
											▸
										</span>
										<IterationHeading
											hat={it.hat}
											result={it.result}
											bolt={it.bolt}
										/>
									</summary>
									<div className={`mt-1 ${BATON_MARKDOWN_CLASS}`}>
										<BrowseMarkdown>{handoff}</BrowseMarkdown>
									</div>
								</details>
							) : (
								<div className="flex flex-wrap items-center gap-2">
									<IterationHeading
										hat={it.hat}
										result={it.result}
										bolt={it.bolt}
									/>
								</div>
							)}
						</li>
					)
				})}
			</ol>
		</div>
	)
}
