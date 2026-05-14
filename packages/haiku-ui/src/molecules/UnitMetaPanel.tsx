/**
 * Distilled view of a unit's frontmatter — the subset that's worth
 * showing in the review screen alongside the unit body. The header
 * already carries title / type / model / status; this panel surfaces
 * the file-graph fields (inputs / outputs / depends_on) that the
 * markdown body would otherwise leak as raw YAML text.
 *
 * Each path is rendered as a clickable link that navigates to the
 * corresponding artifact's review URL (added 2026-05-13 — pre-fix
 * these were inert text and reviewers had to manually jump around
 * the stepper). Path-to-route mapping lives in `pathToReviewRoute`
 * below; it covers the four kinds the SPA can route to:
 *   - `units/<name>` → /stages/<stage>/units/<name>
 *   - `knowledge/<NAME>.md` → /stages/<stage>/knowledge/<NAME>.md
 *   - `stages/<stage>/artifacts/<file>` → /stages/<stage>/outputs/<file>
 *   - `stages/<stage>/<file>` (root-level stage file) →
 *     /stages/<stage>/other/<file>
 *
 * Only renders the rows that have data — empty arrays + missing
 * fields collapse the panel completely so we never show a stub
 * frame.
 */

import { useNavigate } from "@tanstack/react-router"

interface UnitMetaPanelProps {
	inputs?: string[]
	outputs?: string[]
	dependsOn?: string[]
	hat?: string
	bolt?: number
	/** Routing context for the path → URL mapping. When omitted, paths
	 *  fall back to plain non-clickable text — preserves the older
	 *  panel contract for any caller that hasn't wired routing yet. */
	sessionId?: string
	currentStage?: string
}

interface ParsedPath {
	stage: string
	kind: "units" | "knowledge" | "outputs" | "other"
	name: string
}

/**
 * Resolve a path string from a unit FM field (inputs / outputs /
 * depends_on) to its SPA review route. Returns null when the path
 * shape isn't routable — the caller falls back to plain text.
 *
 * Inputs vs outputs vs depends_on use different shapes:
 *   - `depends_on` entries are bare unit names ("unit-01-foo") with
 *     no stage prefix — they always belong to the CURRENT stage.
 *   - `inputs` / `outputs` are path strings relative to the intent
 *     dir. They carry their own stage in the path.
 */
export function pathToReviewRoute(
	path: string,
	currentStage: string,
): ParsedPath | null {
	// Bare unit name (no slash) → depends_on shape, current stage.
	if (!path.includes("/") && /^unit-/.test(path)) {
		return { stage: currentStage, kind: "units", name: path }
	}
	// knowledge/<file> — intent-scope knowledge artifact. Route under
	// the CURRENT stage's knowledge tab (knowledge is intent-wide so
	// any stage's surface is fine; the current stage matches what the
	// reviewer's already viewing).
	const knowledgeMatch = path.match(/^knowledge\/(.+)$/)
	if (knowledgeMatch) {
		return {
			stage: currentStage,
			kind: "knowledge",
			name: knowledgeMatch[1],
		}
	}
	// stages/<stage>/units/<file>.md → units tab. The optional `(?:\.md)?$`
	// suffix is captured outside group 2, so unitsMatch[2] is already the
	// extension-less unit name.
	const unitsMatch = path.match(/^stages\/([^/]+)\/units\/(.+?)(?:\.md)?$/)
	if (unitsMatch) {
		return {
			stage: unitsMatch[1],
			kind: "units",
			name: unitsMatch[2],
		}
	}
	// stages/<stage>/artifacts/<file> → outputs tab.
	const artifactsMatch = path.match(/^stages\/([^/]+)\/artifacts\/(.+)$/)
	if (artifactsMatch) {
		return {
			stage: artifactsMatch[1],
			kind: "outputs",
			name: artifactsMatch[2],
		}
	}
	// stages/<stage>/<file> (root-level stage file, not under units/
	// or artifacts/) → other tab.
	const stageRootMatch = path.match(/^stages\/([^/]+)\/([^/]+)$/)
	if (stageRootMatch) {
		return {
			stage: stageRootMatch[1],
			kind: "other",
			name: stageRootMatch[2],
		}
	}
	return null
}

function PathLink({
	path,
	sessionId,
	currentStage,
}: {
	path: string
	sessionId?: string
	currentStage?: string
}) {
	const navigate = useNavigate()
	const route =
		sessionId && currentStage ? pathToReviewRoute(path, currentStage) : null
	if (!route) {
		// Non-routable path or no routing context — render plain text
		// (preserves the older panel contract).
		return (
			<span className="text-xs font-mono text-stone-700 dark:text-stone-300">
				{path}
			</span>
		)
	}
	return (
		<button
			type="button"
			onClick={() =>
				navigate({
					to: "/review/$sessionId/stages/$stage/$kind/$name",
					params: {
						sessionId: sessionId as string,
						stage: route.stage,
						kind: route.kind,
						name: route.name,
					},
				})
			}
			className="text-xs font-mono text-teal-700 dark:text-teal-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 rounded text-left"
			aria-label={`Open ${path}`}
		>
			{path}
		</button>
	)
}

function PathList({
	paths,
	sessionId,
	currentStage,
}: {
	paths: string[]
	sessionId?: string
	currentStage?: string
}) {
	return (
		<ul className="space-y-0.5">
			{paths.map((p) => (
				<li key={p} className="truncate">
					<PathLink
						path={p}
						sessionId={sessionId}
						currentStage={currentStage}
					/>
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
	sessionId,
	currentStage,
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
					<PathList
						paths={inputs as string[]}
						sessionId={sessionId}
						currentStage={currentStage}
					/>
				</MetaRow>
			)}
			{hasOutputs && (
				<MetaRow label="Outputs">
					<PathList
						paths={outputs as string[]}
						sessionId={sessionId}
						currentStage={currentStage}
					/>
				</MetaRow>
			)}
			{hasDeps && (
				<MetaRow label="Depends on">
					<ul className="flex flex-wrap gap-1">
						{(dependsOn as string[]).map((d) => (
							<li
								key={d}
								className="px-1.5 py-0.5 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700"
							>
								<PathLink
									path={d}
									sessionId={sessionId}
									currentStage={currentStage}
								/>
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
