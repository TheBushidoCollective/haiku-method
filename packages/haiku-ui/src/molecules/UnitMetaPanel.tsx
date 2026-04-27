/**
 * Distilled view of a unit's frontmatter — the subset that's worth
 * showing in the review screen alongside the unit body. The header
 * already carries title / type / model / status; this panel surfaces
 * the file-graph fields (inputs / outputs / depends_on) that the
 * markdown body would otherwise leak as raw YAML text.
 *
 * Only renders the rows that have data — empty arrays + missing
 * fields collapse the panel completely so we never show a stub
 * frame.
 */

interface UnitMetaPanelProps {
	inputs?: string[]
	outputs?: string[]
	dependsOn?: string[]
	hat?: string
	bolt?: number
}

function PathList({ paths }: { paths: string[] }) {
	return (
		<ul className="space-y-0.5 text-xs font-mono text-stone-700 dark:text-stone-300">
			{paths.map((p) => (
				<li key={p} className="truncate" title={p}>
					{p}
				</li>
			))}
		</ul>
	)
}

function MetaRow({
	label,
	children,
}: {
	label: string
	children: React.ReactNode
}) {
	return (
		<div className="grid grid-cols-[6rem_1fr] gap-3 items-start">
			<dt className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 pt-0.5">
				{label}
			</dt>
			<dd className="min-w-0">{children}</dd>
		</div>
	)
}

export function UnitMetaPanel({
	inputs,
	outputs,
	dependsOn,
	hat,
	bolt,
}: UnitMetaPanelProps): React.ReactElement | null {
	const hasInputs = inputs && inputs.length > 0
	const hasOutputs = outputs && outputs.length > 0
	const hasDeps = dependsOn && dependsOn.length > 0
	const hasHat = !!hat
	const hasBolt = typeof bolt === "number" && bolt > 0

	if (!hasInputs && !hasOutputs && !hasDeps && !hasHat && !hasBolt) {
		return null
	}

	return (
		<dl className="mb-4 px-3 py-2.5 rounded-md bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700 space-y-2">
			{hasInputs && (
				<MetaRow label="Inputs">
					<PathList paths={inputs as string[]} />
				</MetaRow>
			)}
			{hasOutputs && (
				<MetaRow label="Outputs">
					<PathList paths={outputs as string[]} />
				</MetaRow>
			)}
			{hasDeps && (
				<MetaRow label="Depends on">
					<ul className="flex flex-wrap gap-1 text-xs font-mono text-stone-700 dark:text-stone-300">
						{(dependsOn as string[]).map((d) => (
							<li
								key={d}
								className="px-1.5 py-0.5 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
							>
								{d}
							</li>
						))}
					</ul>
				</MetaRow>
			)}
			{hasHat && (
				<MetaRow label="Hat">
					<span className="text-xs font-mono text-stone-700 dark:text-stone-300">
						{hat}
					</span>
				</MetaRow>
			)}
			{hasBolt && (
				<MetaRow label="Bolt">
					<span className="text-xs font-mono text-stone-700 dark:text-stone-300">
						#{bolt}
					</span>
				</MetaRow>
			)}
		</dl>
	)
}
