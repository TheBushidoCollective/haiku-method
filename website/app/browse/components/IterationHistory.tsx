// Iteration-history timelines for the browse views — the per-hat handoff
// messages the engine records on every advance/reject as a unit walks its
// hat sequence or a finding goes through its fix loop. Shared by
// UnitDetailView (unit "Hat history" + UnitFeedbackCard "Fix history") and
// IntentDetailView (FeedbackCard "Fix history") so both read the handoff
// the same way.

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
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-semibold text-stone-800 dark:text-stone-200">
									{it.hat ?? "—"}
								</span>
								{it.result && (
									<span
										className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${iterationResultClass(it.result)}`}
									>
										{it.result}
									</span>
								)}
								{it.commit && (
									<code
										className="font-mono text-[11px] text-stone-500 dark:text-stone-400"
										title={it.commit}
									>
										{it.commit.slice(0, 7)}
									</code>
								)}
							</div>
							{handoff && (
								<p className="mt-1 text-sm text-stone-600 [overflow-wrap:anywhere] dark:text-stone-300">
									{handoff}
								</p>
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
							<div className="flex flex-wrap items-center gap-2">
								{typeof it.bolt === "number" && (
									<span className="font-mono text-[10px] text-stone-400">
										bolt {it.bolt}
									</span>
								)}
								<span className="text-sm font-medium text-stone-800 dark:text-stone-200">
									{it.hat ?? "—"}
								</span>
								{it.result && (
									<span
										className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${iterationResultClass(it.result)}`}
									>
										{it.result}
									</span>
								)}
							</div>
							{handoff && (
								<p className="mt-0.5 text-sm text-stone-600 [overflow-wrap:anywhere] dark:text-stone-300">
									{handoff}
								</p>
							)}
						</li>
					)
				})}
			</ol>
		</div>
	)
}
