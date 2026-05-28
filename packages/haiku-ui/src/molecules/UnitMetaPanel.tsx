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
 * below.
 *
 * Resolution has two layers (first hit wins):
 *
 *   1. SHAPE rules — paths whose route can be read off the string alone:
 *      - bare `unit-*` → /stages/<currentStage>/units/<name>
 *      - `knowledge/<NAME>.md` → /stages/<currentStage>/knowledge/<NAME>.md
 *      - `stages/<stage>/units/<file>` → /stages/<stage>/units/<file>
 *      - `stages/<stage>/artifacts/<file>` → /stages/<stage>/outputs/<file>
 *      - `stages/<stage>/<file>` (root-level) → /stages/<stage>/other/<file>
 *
 *   2. ARTIFACT-INDEX lookup — paths that DON'T carry their own stage
 *      segment but DO point at a real artifact the session knows about.
 *      Units routinely declare inputs/outputs as INTENT-dir-relative
 *      paths outside the `stages/` tree (`product/ACCEPTANCE-CRITERIA.md`,
 *      `features/worker_new_badge.feature`) — these are `scope: intent`
 *      discovery artifacts that the server surfaces as output / knowledge
 *      artifacts carrying the PRODUCING stage. The shape rules can't infer
 *      that stage from the string, so before falling back to plain text we
 *      look the path up in the index the caller builds from the session's
 *      `output_artifacts` + `stage_artifacts` + `knowledge_files`. A hit
 *      routes to the producing stage's outputs / knowledge tab. (Pre-fix,
 *      these inputs fell through to inert gray text while siblings like
 *      `knowledge/…` linked — the "half-state" the reviewer reported.)
 *
 * Only renders the rows that have data — empty arrays + missing
 * fields collapse the panel completely so we never show a stub
 * frame.
 */

import { useNavigate } from "@tanstack/react-router"

/**
 * One resolvable artifact the session knows about, keyed by its
 * intent-dir-relative path. Built by the caller (StageReview) from the
 * session's output / stage / knowledge artifact lists. The `name` is
 * exactly what the artifact-detail route matches on, so a hit can route
 * straight to `/stages/<stage>/<kind>/<name>`.
 */
export interface ArtifactIndexEntry {
	stage: string
	kind: "knowledge" | "outputs" | "other"
	name: string
}

export type ArtifactIndex = Map<string, ArtifactIndexEntry>

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
	/** Index of every artifact the session can route to, keyed by the
	 *  artifact's intent-dir-relative path. Lets the resolver link paths
	 *  that don't carry a stage segment (e.g. `product/foo.md`,
	 *  `features/bar.feature`) by matching them against real artifacts.
	 *  Optional — without it, only the shape rules apply. */
	artifactIndex?: ArtifactIndex
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
	artifactIndex?: ArtifactIndex,
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
	// Artifact-index lookup — for paths the shape rules couldn't claim
	// (no `stages/`-rooted or `knowledge/`-rooted prefix), match against
	// real artifacts the session surfaced. Covers intent-dir-relative
	// `scope: intent` discovery artifacts a unit declares directly
	// (`product/ACCEPTANCE-CRITERIA.md`, `features/worker_new_badge.feature`)
	// — the server emits these as outputs/knowledge keyed by the producing
	// stage, which the string alone can't tell us. Tolerate a
	// workspace-relative `.haiku/intents/<slug>/` prefix on the declared
	// path by also probing the segment after `intents/<slug>/`.
	if (artifactIndex) {
		const direct = artifactIndex.get(path)
		if (direct) {
			return { stage: direct.stage, kind: direct.kind, name: direct.name }
		}
		const wsMatch = path.match(/^\.haiku\/intents\/[^/]+\/(.+)$/)
		if (wsMatch) {
			const stripped = artifactIndex.get(wsMatch[1])
			if (stripped) {
				return {
					stage: stripped.stage,
					kind: stripped.kind,
					name: stripped.name,
				}
			}
		}
	}
	return null
}

function PathLink({
	path,
	sessionId,
	currentStage,
	artifactIndex,
}: {
	path: string
	sessionId?: string
	currentStage?: string
	artifactIndex?: ArtifactIndex
}) {
	const navigate = useNavigate()
	const route =
		sessionId && currentStage
			? pathToReviewRoute(path, currentStage, artifactIndex)
			: null
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
	artifactIndex,
}: {
	paths: string[]
	sessionId?: string
	currentStage?: string
	artifactIndex?: ArtifactIndex
}) {
	return (
		<ul className="space-y-0.5">
			{paths.map((p) => (
				<li key={p} className="truncate">
					<PathLink
						path={p}
						sessionId={sessionId}
						currentStage={currentStage}
						artifactIndex={artifactIndex}
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
	artifactIndex,
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
						artifactIndex={artifactIndex}
					/>
				</MetaRow>
			)}
			{hasOutputs && (
				<MetaRow label="Outputs">
					<PathList
						paths={outputs as string[]}
						sessionId={sessionId}
						currentStage={currentStage}
						artifactIndex={artifactIndex}
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
									artifactIndex={artifactIndex}
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
