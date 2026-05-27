/**
 * StageReview — stage-scoped main content per canonical mockup
 * (`stages/design/artifacts/review-ui-mockup.html`).
 *
 * Filters session data to a single stage and renders the four tabs:
 *   - Overview: Stage Summary + condensed Units + 2-col Knowledge/Outputs
 *   - Units:    numbered unit cards with type pill + status + expand +
 *               NEW/CHANGED markers + feedback-count badges
 *   - Knowledge: kind-labeled rows with summary + expand + body preview
 *   - Outputs:   kind-labeled rows with summary + expand + body preview
 *
 * Next-unseen navigation:
 *   - Each of the three list tabs shows a "<kind> · N/M seen" counter.
 *   - When at least one item is unseen, a "Next unseen (N) →" teal button
 *     scrolls to the next unseen artifact (data-<kind>-card attribute) and
 *     flashes it via the `.unit-flash` class from index.css.
 *
 * Scope left on the follow-up list: inline per-line / pin annotation
 * overlays inside rendered artifact bodies (needs target.annotation
 * coordinates in FeedbackItemData).
 */

import { MarkdownViewer } from "@haiku/shared"
import DOMPurify from "dompurify"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, SectionHeading } from "../../../atoms/Card"
import { OutputCardMenu } from "../../../molecules/OutputCardMenu"
import { type TabDef, Tabs } from "../../../molecules/Tabs"
import {
	type ArtifactIndex,
	type ArtifactIndexEntry,
	UnitMetaPanel,
} from "../../../molecules/UnitMetaPanel"
import { ArtifactAnnotator } from "../../../organisms/ArtifactAnnotator"
import {
	type InlineCommentEntry,
	InlineComments,
} from "../../../organisms/InlineComments"
import {
	ReplaceOutputDialog,
	type ReplaceOutputSubmit,
} from "../../../organisms/ReplaceOutputDialog"
import type { ParsedUnit } from "../../../parsed"
import type { FeedbackItemData } from "../../../types"
import { authedAssetUrl } from "../shared/asset-url"
import { highlightCodeToHtml } from "../shared/codeHighlight"
import { DeclaringUnitsBanner } from "../shared/DeclaringUnitsBanner"
import { resolveEmbeddedAssetUrls } from "../shared/inline-asset-urls"
import {
	markdownToSimpleHtml,
	stripFrontmatter,
} from "../shared/section-helpers"
import type { ReviewPageSessionData } from "../shared/session-data"
import type { ReviewDetailKind } from "../shared/stage-tabs"
import { deriveUnitStatus } from "../shared/UnitsTable"
import {
	type ArtifactKind,
	type SeenState,
	shaOf,
	useSeenTracker,
} from "./useSeenTracker"
import {
	composeWalkthroughItems,
	resolveWalkthroughForDetail,
} from "./walkthrough"

export interface StageReviewProps {
	session: ReviewPageSessionData
	sessionId: string
	/** Intent slug — used as the persistent seen-state scope so
	 *  progress survives MCP restarts. */
	intentSlug: string | null
	stageName: string
	feedback: FeedbackItemData[]
	onHighlightRequestId?: string | null
	onHighlightConsumed?: () => void
	/** Controlled tab selection — the parent (ReviewPage) owns this so
	 *  it can mirror tab state to the URL. `undefined` is equivalent to
	 *  the "overview" default. */
	/** A fixed ReviewTab OR a dynamic per-directory tab id (a stage
	 *  subdirectory name). Typed `string` to admit the dir tabs. */
	tab?: string | undefined
	onTabChange?: (tab: string | undefined) => void
	/** Controlled detail selection — when set, the matching tab renders
	 *  the single-item focused view. */
	detail?: { kind: ReviewDetailKind; name: string } | null
	onDetailChange?: (
		detail: { kind: ReviewDetailKind; name: string } | null,
	) => void
	/** Inline-comment drafts surfaced by the detail views (select text →
	 *  add comment). Parent collects them and hands them to the sidebar
	 *  composer via `getAnnotations()`. */
	onInlineCommentsChange?: (comments: InlineCommentEntry[]) => void
	/** Persist an inline comment as a real feedback item. Called on
	 *  Save inside InlineComments. When omitted, comments stay in the
	 *  getAnnotations payload only — works for gate reviews (which
	 *  submit a decision) but not ad-hoc panes (which don't). */
	onSaveInline?: (entry: {
		selectedText: string
		comment: string
		paragraph: number
		location: string
		filePath?: string
		commentId: string
		contentSha?: string
	}) => Promise<void>
	/** Anchor of a persisted inline comment to scroll to + flash once
	 *  the detail view mounts. Set by the stage-content layer after a
	 *  feedback-card click resolves to an `inline_anchor`. */
	flashAnchor?: {
		commentId?: string
		selectedText: string
		paragraph?: number
	} | null
	onFlashCommentConsumed?: () => void
	/** Called by the artifact-annotator flow when the reviewer draws on
	 *  a wireframe/image, writes a comment, and hits submit. Receives
	 *  the artifact name, the comment text, and a `data:image/png;...`
	 *  screenshot of the artifact with the overlay baked in. Parent
	 *  routes this to the feedback API; the annotator clears its
	 *  overlay once the promise resolves. */
	onSubmitAnnotation?: (
		artifactName: string,
		comment: string,
		screenshotDataUrl: string,
	) => Promise<void>
	/** Output-replacement dispatcher — when wired, every output card in
	 *  the Outputs tab grows the per-card `⋯` menu with "Replace this
	 *  output…" (DESIGN-BRIEF Screen 2 / unit-12). The host owns the
	 *  multipart POST to `/api/intents/{intentSlug}/uploads/stage-output`;
	 *  the dialog passes the staged file + optional note up. Returning a
	 *  resolved promise closes the dialog. */
	onReplaceOutput?: (
		artifactName: string,
		payload: ReplaceOutputSubmit,
	) => Promise<void>
	/** Output names that drifted since last classification (post-replace
	 *  pre-classification window). Drives the amber stripe + chip on the
	 *  card. Driven by the `drift_detected` WS frame. */
	driftPendingOutputs?: Set<string>
	/** Output names that were replaced by a peer browser while the dialog
	 *  is open — surfaces the concurrency banner per DESIGN-BRIEF Screen 2
	 *  §"Concurrent change". Driven by the `output_replaced` WS frame. */
	concurrentReplacedOutputs?: Set<string>
}

const TYPE_BADGE: Record<string, string> = {
	implementation:
		"bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
	refactor:
		"bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800",
	bugfix:
		"bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border-rose-200 dark:border-rose-800",
	research:
		"bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border-sky-200 dark:border-sky-800",
	docs: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800",
	backend:
		"bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800",
}

const MODEL_BADGE: Record<string, string> = {
	opus: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
	sonnet:
		"bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800",
	haiku:
		"bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800",
}

function ModelBadge({ model }: { model: string | undefined }) {
	if (!model) return null
	const norm = model.toLowerCase().split(/[-\s]/)[0] // "claude-sonnet-4-6" → "claude", "sonnet" → "sonnet"
	const key = MODEL_BADGE[norm]
		? norm
		: Object.keys(MODEL_BADGE).find((k) => model.toLowerCase().includes(k))
	const cls =
		(key && MODEL_BADGE[key]) ??
		"bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700"
	return (
		<span
			className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${cls}`}
			title={`Model: ${model}`}
		>
			{key ?? model}
		</span>
	)
}

const KIND_BADGE: Record<string, string> = {
	discovery:
		"bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border-sky-200 dark:border-sky-800",
	diagram:
		"bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 border-sky-200 dark:border-sky-800",
	artifact:
		"bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border-violet-200 dark:border-violet-800",
	wireframe:
		"bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400 border-violet-200 dark:border-violet-800",
}

function statusPillClass(status: string | undefined): string {
	switch (status) {
		case "completed":
			return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
		case "in_progress":
		case "active":
			return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
		default:
			return "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
	}
}

/** Project the feedback items that carry an `inline_anchor` into the
 *  shape `<InlineComments>` needs for re-painting previously-saved
 *  highlights. Filters out closed / rejected items — those are
 *  resolved, no reason to clutter the artifact body.
 *
 *  IMPORTANT: this filter is for the PERSISTENT highlight layer
 *  (`inline-comments-saved`), NOT for the click-to-flash path. A
 *  reviewer clicking a closed feedback card still scrolls to the
 *  excerpt and flashes it for ~1.6s — that path is driven by
 *  `flashAnchor` (see `-stage-content.tsx`), which reads
 *  `item.inline_anchor` regardless of status. The closed-FB experience
 *  is "tap to remember what I said about this," not "show me a
 *  permanent yellow stripe over every prior comment." */
export function deriveExistingAnchors(
	items: readonly FeedbackItemData[],
): Array<{
	commentId?: string
	selectedText: string
	paragraph?: number
	contentSha?: string
}> {
	const out: Array<{
		commentId?: string
		selectedText: string
		paragraph?: number
		contentSha?: string
	}> = []
	for (const f of items) {
		if (f.status === "closed" || f.status === "rejected") continue
		const a = (
			f as unknown as {
				inline_anchor?: {
					selected_text?: string
					comment_id?: string
					paragraph?: number
					content_sha?: string
				}
			}
		).inline_anchor
		if (!a?.selected_text) continue
		out.push({
			selectedText: a.selected_text,
			...(a.comment_id ? { commentId: a.comment_id } : {}),
			...(typeof a.paragraph === "number" ? { paragraph: a.paragraph } : {}),
			...(a.content_sha ? { contentSha: a.content_sha } : {}),
		})
	}
	return out
}

function deriveExistingAnchorsForUnit(
	_unitSlug: string,
	items: readonly FeedbackItemData[],
): ReturnType<typeof deriveExistingAnchors> {
	return deriveExistingAnchors(items)
}

/** Re-paint anchors for a file-backed artifact that has NO per-target
 *  feedback bucket (the stage brief, observations, etc.). Those findings
 *  land in the general stage feedback pool — the only thing tying a
 *  comment to its surface is `inline_anchor.file_path`. Filter the full
 *  pool by that path, then run the same open-only projection
 *  `deriveExistingAnchors` applies. */
export function deriveExistingAnchorsForFile(
	filePath: string,
	items: readonly FeedbackItemData[],
): ReturnType<typeof deriveExistingAnchors> {
	const matching = items.filter((f) => {
		const a = (f as unknown as { inline_anchor?: { file_path?: string } })
			.inline_anchor
		return a?.file_path === filePath
	})
	return deriveExistingAnchors(matching)
}

function feedbackBadgeColor(status: string): string {
	switch (status) {
		case "pending":
			return "bg-amber-500 text-white"
		case "addressed":
			return "bg-blue-500 text-white"
		case "closed":
			return "bg-green-500 text-white"
		default:
			return "bg-stone-400 text-white"
	}
}

// Seen-state visible affordances removed 2026-05-13 — the tracker's
// indicators "didn't work" (state was unreliable, sha-keying drifted
// across renders). The hooks remain in place so the data still flows
// for future re-introduction, but the user-facing border color +
// "NEW" pill are no-ops: the rendering settles to the static "not
// seen" style and no badge is shown.
function seenBorderClass(_state: SeenState): string {
	return "border-stone-200 dark:border-stone-700"
}

function StateBadge(_props: { state: SeenState }) {
	return null
}

interface ArtifactViewModel {
	name: string
	kind: string
	summary: string
	body: string
	mime: string
	/** For `mime === "code"` — the highlight.js language id. Undefined for
	 *  text with no known grammar (renders as a plain escaped `<pre>`). */
	language?: string
	/** Intent-dir-relative path. Set for outputs that came through
	 *  parseOutputArtifacts (used to look the artifact up in
	 *  `output_declared_by` for the "Declared by" banner). Optional
	 *  because knowledge ViewModels don't carry it. */
	intentRelativePath?: string
	/** Server-rewritten tunnel URL for binary outputs (image, file) so
	 *  the SPA can use it as an `<img src>` / `<a href>`. Text-type
	 *  outputs (markdown, html) inline content in `body` instead and
	 *  leave this undefined. Reported 2026-05-13: image outputs in the
	 *  StageReview walkthrough rendered empty because the VM dropped
	 *  the tunnel URL the server prepared. */
	assetUrl?: string
}

export function StageReview({
	session,
	sessionId,
	intentSlug,
	stageName,
	feedback,
	onHighlightRequestId,
	onHighlightConsumed,
	tab,
	onTabChange,
	detail: detailProp,
	onDetailChange,
	onInlineCommentsChange,
	onSaveInline,
	flashAnchor,
	onFlashCommentConsumed,
	onSubmitAnnotation,
	onReplaceOutput,
	driftPendingOutputs,
	concurrentReplacedOutputs,
}: StageReviewProps): React.ReactElement {
	// Replace-output dialog state. Lives at the StageReview level so the
	// dialog persists across detail/list mode toggles inside the Outputs
	// tab. Setting `name` opens the dialog; null closes it.
	const [replaceTarget, setReplaceTarget] = useState<string | null>(null)
	// Controlled-or-uncontrolled tab: when the parent owns the tab (for
	// URL sync), `tab`/`onTabChange` drive it. When unused, fall back to
	// local state so tests + standalone uses still work.
	const [localTab, setLocalTab] = useState<string>(tab ?? "overview")
	const activeTab = onTabChange !== undefined ? (tab ?? "overview") : localTab
	const setActiveTab = useCallback(
		(next: string) => {
			if (onTabChange !== undefined) {
				onTabChange(next === "overview" ? undefined : next)
			} else {
				setLocalTab(next)
			}
		},
		[onTabChange],
	)
	// Seen-state scope: intent slug gives cross-session persistence; we
	// fall back to sessionId only if the intent slug isn't known yet.
	const seenScopeId = intentSlug ?? sessionId

	const units = (session.units ?? []).filter(
		(u) => (u.frontmatter.stage ?? "") === stageName,
	)
	const stageArtifacts = (session.stage_artifacts ?? []).filter(
		(a) => a.stage === stageName,
	)
	const outputArtifacts = (session.output_artifacts ?? []).filter(
		(a) => a.stage === stageName,
	)
	// Stray files for this stage — anything the parser saw under
	// `stages/<stage>/` that no unit declared and isn't in
	// artifacts/ / knowledge/ / discovery/. Surfaced in the "Other"
	// tab so a reviewer can associate them if needed.
	const otherFiles = (session.other_files ?? []).filter(
		(a) => a.stage === stageName,
	)
	// Intent-level knowledge files apply to every stage (per the
	// H·AI·K·U data model — `.haiku/intents/{slug}/knowledge/`). We merge
	// them with stage-scoped artifacts so stages that produce no new
	// discovery still surface the ambient knowledge reviewers need.
	const intentKnowledge = session.knowledge_files ?? []

	const knowledgeVMs: ArtifactViewModel[] = [
		...stageArtifacts.map((a) => ({
			name: a.name,
			kind: inferKind(a.name),
			summary: summaryFor(a.name, a.content),
			body: a.content,
			mime: inferMime(a.name),
		})),
		...intentKnowledge.map((k) => ({
			name: k.name,
			kind: inferKind(k.name),
			summary: summaryFor(k.name, k.content),
			body: k.content,
			mime: inferMime(k.name),
		})),
	]
	const toArtifactVM = (a: {
		name: string
		type: string
		language?: string
		content?: string
		relativePath?: string
		intentRelativePath?: string
	}): ArtifactViewModel => ({
		name: a.name,
		kind: inferOutputKind(a),
		summary: summaryFor(a.name, a.content ?? "", a.type),
		body: a.content ?? "",
		mime: a.type,
		language: a.language,
		intentRelativePath: a.intentRelativePath,
		// Server rewrote `relativePath` to a tunnel URL (see
		// `buildStageArtifactUrl` in server/tool-call.ts). Carry it
		// onto the VM so the image render below has a non-empty
		// `src`. Without this, image outputs render with `body: ""`
		// and the `<img src={body}>` guard rejects them — reviewer
		// sees a `<pre>` placeholder instead of the asset.
		assetUrl: a.relativePath ?? undefined,
	})
	const outputVMs: ArtifactViewModel[] = outputArtifacts.map(toArtifactVM)
	// "Other" files split: those living in a subdirectory get a per-directory
	// tab named after the directory (e.g. `proofs/`); stage-root loose files
	// (no `directory`) stay in the catch-all "Other" tab. Server tags
	// `directory` (parser.ts); the SPA groups on it here.
	const looseOtherVMs: ArtifactViewModel[] = otherFiles
		.filter((a) => !a.directory)
		.map(toArtifactVM)
	const dirTabGroups: Array<{ dir: string; vms: ArtifactViewModel[] }> =
		(() => {
			const byDir = new Map<string, ArtifactViewModel[]>()
			const order: string[] = []
			for (const a of otherFiles) {
				if (!a.directory) continue
				if (!byDir.has(a.directory)) {
					byDir.set(a.directory, [])
					order.push(a.directory)
				}
				byDir.get(a.directory)?.push(toArtifactVM(a))
			}
			order.sort((x, y) => x.localeCompare(y))
			return order.map((dir) => ({ dir, vms: byDir.get(dir) ?? [] }))
		})()

	// Artifact index for unit-input/output/depends_on link resolution
	// (UnitMetaPanel). Built from the FULL session artifact lists — NOT the
	// per-stage filtered views above — because a unit's input can point at an
	// artifact produced by ANOTHER stage (e.g. a development unit consumes
	// `product/ACCEPTANCE-CRITERIA.md`, produced by the product stage). The
	// index keys each artifact by its intent-dir-relative path (the artifact's
	// `name`) so `pathToReviewRoute` can resolve a bare intent-relative path
	// that carries no `stages/`/`knowledge/` prefix to the producing stage's
	// outputs / knowledge / other tab. First writer wins (output > knowledge >
	// other) so a path declared as a real output links to its Outputs view.
	const artifactIndex = useMemo<ArtifactIndex>(() => {
		const index: ArtifactIndex = new Map()
		const add = (name: string, entry: ArtifactIndexEntry) => {
			if (!index.has(name)) index.set(name, entry)
		}
		for (const a of session.output_artifacts ?? []) {
			add(a.name, { stage: a.stage, kind: "outputs", name: a.name })
		}
		for (const a of session.stage_artifacts ?? []) {
			add(a.name, { stage: a.stage, kind: "knowledge", name: a.name })
		}
		for (const a of session.other_files ?? []) {
			add(a.name, { stage: a.stage, kind: "other", name: a.name })
		}
		return index
	}, [session.output_artifacts, session.stage_artifacts, session.other_files])

	// Pre-compute feedback → target maps (keyed by unit slug / knowledge name / output name)
	const { feedbackByUnit, feedbackByKnowledge, feedbackByOutput } =
		useMemo(() => {
			const byUnit = new Map<string, FeedbackItemData[]>()
			const byKnowledge = new Map<string, FeedbackItemData[]>()
			const byOutput = new Map<string, FeedbackItemData[]>()
			for (const f of feedback) {
				const target = (
					f as unknown as {
						target?: {
							kind?: string
							unitName?: string
							knowledgeName?: string
							outputName?: string
						}
					}
				).target
				if (!target) continue
				let bucket: Map<string, FeedbackItemData[]> | null = null
				let key: string | undefined
				if (target.kind === "unit" && target.unitName) {
					bucket = byUnit
					key = target.unitName
				} else if (target.kind === "knowledge" && target.knowledgeName) {
					bucket = byKnowledge
					key = target.knowledgeName
				} else if (target.kind === "output" && target.outputName) {
					bucket = byOutput
					key = target.outputName
				}
				if (bucket && key) {
					const list = bucket.get(key) ?? []
					list.push(f)
					bucket.set(key, list)
				}
			}
			return {
				feedbackByUnit: byUnit,
				feedbackByKnowledge: byKnowledge,
				feedbackByOutput: byOutput,
			}
		}, [feedback])

	const stageSummary = resolveStageSummary(session, stageName)
	const stageBrief = resolveStageBrief(session, stageName)
	const stageObservations = resolveStageObservations(session, stageName)
	const stageElaboration = resolveStageElaboration(session, stageName)
	const seen = useSeenTracker(seenScopeId)

	// Detail mode: when set, the active tab renders a single-item focused
	// view with a prev/next stepper instead of the full list. Opening a
	// condensed row from the overview or a feedback target from the
	// sidebar drops the reviewer straight into detail for that item.
	// Controlled variant mirrors the `tab` prop pattern — parent owns
	// detail state for URL sync when `onDetailChange` is wired.
	const [localDetail, setLocalDetail] = useState<{
		// `string` not `ReviewDetailKind` — a dynamic per-directory tab id can
		// open a detail view too (its files reuse the Other render path).
		tab: string
		name: string
	} | null>(
		detailProp && onDetailChange === undefined
			? { tab: detailProp.kind, name: detailProp.name }
			: null,
	)
	const detail =
		onDetailChange !== undefined
			? detailProp
				? { tab: detailProp.kind, name: detailProp.name }
				: null
			: localDetail
	const setDetail = useCallback(
		(
			next: {
				tab: string
				name: string
			} | null,
		) => {
			if (onDetailChange !== undefined) {
				onDetailChange(
					next ? { kind: next.tab as ReviewDetailKind, name: next.name } : null,
				)
			} else {
				setLocalDetail(next)
			}
		},
		[onDetailChange],
	)

	const openDetail = useCallback(
		(tab: string, name: string) => {
			setActiveTab(tab)
			setDetail({ tab, name })
		},
		[setActiveTab, setDetail],
	)
	const closeDetail = useCallback(() => setDetail(null), [setDetail])

	// Reset detail + tab when the reviewer switches stages via the
	// stepper — detail state is stage-scoped and shouldn't bleed across.
	// Skip on the initial mount so deep-link URLs (stage+tab+detail) land
	// on the requested sub-view instead of being reset to overview.
	//
	// setDetail / setActiveTab are intentionally excluded from deps: the
	// parent's onDetailChange callback closes over `tab` (see routed
	// StageContent), so its identity flips every time tab changes. Listing
	// those setters here would fire the reset on every tab change during
	// walkthrough and yank the reviewer back to overview. Route them
	// through refs so the effect only reacts to stageName changes.
	const isInitialMountRef = useRef(true)
	const setDetailRef = useRef(setDetail)
	const setActiveTabRef = useRef(setActiveTab)
	setDetailRef.current = setDetail
	setActiveTabRef.current = setActiveTab
	useEffect(() => {
		if (isInitialMountRef.current) {
			isInitialMountRef.current = false
			return
		}
		setDetailRef.current(null)
		setActiveTabRef.current("overview")
	}, [])

	// Walkthrough list — orientation flips based on which gate fired.
	// `composeWalkthroughItems` owns the gate→items mapping; see that
	// module for the routing table. Memoized on the same triggers as
	// before — recomputing every render is intended.
	const gateContext = session.gate_context
	const gateWalkthroughItems = useMemo(
		() =>
			composeWalkthroughItems(gateContext, {
				units,
				knowledgeVMs,
				outputVMs,
			}),
		// biome-ignore lint/correctness/useExhaustiveDependencies: knowledgeVMs/outputVMs are derived arrays that change identity each render but only the contained name strings matter for walkthrough order; recomputing on every render is the intended behavior
		[gateContext, units, knowledgeVMs, outputVMs],
	)
	// UX fix (2026-05-06): when the reviewer is browsing a tab that's
	// NOT in the gate's walkthrough set (e.g. on Knowledge during an
	// elaborate_to_execute gate which scopes to units-only), the
	// prev/next buttons should walk WITHIN the current tab — not yank
	// the reviewer back to units they're not focused on.
	// `resolveWalkthroughForDetail` owns the fallback logic; covered
	// by walkthrough.test.ts.
	const walkthroughItems = useMemo(
		() =>
			resolveWalkthroughForDetail(
				gateWalkthroughItems,
				// The walkthrough only spans gate-relevant items
				// (units/knowledge/outputs). "Other" stray files and dynamic
				// per-directory tabs aren't gate-relevant, so when the reviewer
				// is browsing one, pass null — the resolver falls back to the
				// gate set instead of hunting for the item in units/knowledge/
				// outputs. (Also narrows `detail.tab` to the walkthrough kinds.)
				detail &&
					(detail.tab === "units" ||
						detail.tab === "knowledge" ||
						detail.tab === "outputs")
					? { tab: detail.tab, name: detail.name }
					: null,
				{ units, knowledgeVMs, outputVMs },
			),
		// biome-ignore lint/correctness/useExhaustiveDependencies: derived arrays whose identity flips per render; only the names matter
		[detail, gateWalkthroughItems, units, knowledgeVMs, outputVMs],
	)
	const walkIndex = detail
		? walkthroughItems.findIndex(
				(i) => i.tab === detail.tab && i.name === detail.name,
			)
		: -1
	// Walkthrough = the SET of items relevant to this gate. Order is
	// just file-natural; what matters is that every relevant item gets
	// reviewed. Next/Previous are plain index walks — seen-state-driven
	// navigation was removed 2026-05-13 because the indicators it relied
	// on were unreliable.
	// Find the next unseen item, scanning forward from walkIndex with
	// wraparound. Falls back to plain next-in-array when everything is
	// already seen — rare case where the reviewer revisits the
	// walkthrough after closing.
	// Next-in-list (no longer "next unseen" — see seen-state removal
	// note above startWalkthrough). When walkIndex === -1 (no detail
	// open yet), Next opens the first item; otherwise it advances by
	// one and stops at the end.
	const walkNext = useMemo(() => {
		if (walkthroughItems.length === 0) return null
		const nextIdx = walkIndex + 1
		if (nextIdx >= walkthroughItems.length) return null
		return walkthroughItems[nextIdx]
	}, [walkthroughItems, walkIndex])
	const walkPrev = walkIndex > 0 ? walkthroughItems[walkIndex - 1] : null
	const walkPrevHandler = useCallback(() => {
		if (walkPrev) openDetail(walkPrev.tab, walkPrev.name)
	}, [walkPrev, openDetail])
	const walkNextHandler = useCallback(() => {
		if (walkNext) openDetail(walkNext.tab, walkNext.name)
	}, [walkNext, openDetail])

	// "Start walkthrough" lands on the first item. We used to land on
	// the first UNSEEN item, but seen-state proved unreliable across
	// sessions and surfaced as broken indicators (2026-05-13). Strict
	// "open at index 0" gives the reviewer a stable starting point.
	const startWalkthrough = useCallback(() => {
		const target = walkthroughItems[0]
		if (target) openDetail(target.tab, target.name)
	}, [walkthroughItems, openDetail])

	const tabs: TabDef[] = [
		{
			id: "overview",
			label: "Overview",
			content: (
				<OverviewTab
					stageName={stageName}
					stageSummary={stageSummary}
					stageBrief={stageBrief}
					stageObservations={stageObservations}
					units={units}
					knowledge={knowledgeVMs}
					outputs={outputVMs}
					feedback={feedback}
					feedbackByUnit={feedbackByUnit}
					feedbackByKnowledge={feedbackByKnowledge}
					feedbackByOutput={feedbackByOutput}
					seen={seen}
					stageId={stageName}
					intentSlug={intentSlug}
					onNavigate={openDetail}
					onStartWalkthrough={startWalkthrough}
					onInlineCommentsChange={onInlineCommentsChange}
					onSaveInline={onSaveInline}
					flashAnchor={flashAnchor ?? null}
					onFlashCommentConsumed={onFlashCommentConsumed}
				/>
			),
		},
		{
			id: "elaboration",
			label: "Elaboration",
			// The decompose-phase narrative. Its own tab (BRIEF lives on
			// Overview); annotatable like the brief so a reviewer can comment
			// on the planning rationale.
			disabled: !stageElaboration,
			content: stageElaboration ? (
				(() => {
					const elabBody = stripFrontmatter(stageElaboration)
					const elabPath = intentSlug
						? `.haiku/intents/${intentSlug}/stages/${stageName}/elaboration.md`
						: undefined
					return (
						<Card as="article" ariaLabelledBy="stage-elaboration-heading">
							<SectionHeading id="stage-elaboration-heading" variant="eyebrow">
								Elaboration{" "}
								<span className="font-normal normal-case text-stone-500">
									(how this stage was broken into units)
								</span>
							</SectionHeading>
							{onInlineCommentsChange ? (
								<InlineComments
									htmlContent={markdownToSimpleHtml(elabBody)}
									rawContent={elabBody}
									location="Elaboration"
									filePath={elabPath}
									existingAnchors={
										elabPath
											? deriveExistingAnchorsForFile(elabPath, feedback)
											: []
									}
									onCommentsChange={onInlineCommentsChange}
									onSaveInline={onSaveInline}
									flashAnchor={flashAnchor ?? null}
									onFlashCommentConsumed={onFlashCommentConsumed}
								/>
							) : (
								<MarkdownViewer id={`elaboration-${stageName}`}>
									{stageElaboration}
								</MarkdownViewer>
							)}
						</Card>
					)
				})()
			) : (
				<Card>
					<p className="text-stone-500 dark:text-stone-400 italic">
						This stage hasn't elaborated yet.
					</p>
				</Card>
			),
		},
		{
			id: "units",
			label: `Units (${units.length})`,
			disabled: units.length === 0,
			content:
				detail?.tab === "units" ? (
					<UnitDetailView
						units={units}
						currentName={detail.name}
						seen={seen}
						stageId={stageName}
						sessionId={sessionId}
						intentSlug={intentSlug}
						artifactIndex={artifactIndex}
						feedbackByUnit={feedbackByUnit}
						walkIndex={walkIndex}
						walkTotal={walkthroughItems.length}
						onWalkPrev={walkPrevHandler}
						onWalkNext={walkNextHandler}
						hasWalkPrev={!!walkPrev}
						hasWalkNext={!!walkNext}
						onBack={closeDetail}
						onInlineCommentsChange={onInlineCommentsChange}
						onSaveInline={onSaveInline}
						flashAnchor={flashAnchor ?? null}
						onFlashCommentConsumed={onFlashCommentConsumed}
					/>
				) : (
					<UnitsTab
						units={units}
						feedbackByUnit={feedbackByUnit}
						seen={seen}
						stageId={stageName}
						highlightRequestId={onHighlightRequestId ?? null}
						onHighlightConsumed={onHighlightConsumed}
						feedback={feedback}
						onOpenDetail={(name) => openDetail("units", name)}
					/>
				),
		},
		{
			id: "knowledge",
			label: `Knowledge (${knowledgeVMs.length})`,
			disabled: knowledgeVMs.length === 0,
			content:
				detail?.tab === "knowledge" ? (
					<ArtifactDetailView
						kind="knowledge"
						artifacts={knowledgeVMs}
						currentName={detail.name}
						seen={seen}
						stageId={stageName}
						intentSlug={intentSlug}
						feedbackByName={feedbackByKnowledge}
						walkIndex={walkIndex}
						walkTotal={walkthroughItems.length}
						onWalkPrev={walkPrevHandler}
						onWalkNext={walkNextHandler}
						hasWalkPrev={!!walkPrev}
						hasWalkNext={!!walkNext}
						onBack={closeDetail}
						onInlineCommentsChange={onInlineCommentsChange}
						onSaveInline={onSaveInline}
						flashAnchor={flashAnchor ?? null}
						onFlashCommentConsumed={onFlashCommentConsumed}
						onSubmitAnnotation={onSubmitAnnotation}
					/>
				) : (
					<ArtifactsTab
						kind="knowledge"
						artifacts={knowledgeVMs}
						feedbackByName={feedbackByKnowledge}
						seen={seen}
						stageId={stageName}
						highlightRequestId={onHighlightRequestId ?? null}
						onHighlightConsumed={onHighlightConsumed}
						feedback={feedback}
						onOpenDetail={(name) => openDetail("knowledge", name)}
					/>
				),
		},
		{
			id: "outputs",
			label: `Outputs (${outputVMs.length})`,
			disabled: outputVMs.length === 0,
			content:
				detail?.tab === "outputs" ? (
					<ArtifactDetailView
						kind="output"
						artifacts={outputVMs}
						currentName={detail.name}
						seen={seen}
						stageId={stageName}
						intentSlug={intentSlug}
						feedbackByName={feedbackByOutput}
						walkIndex={walkIndex}
						walkTotal={walkthroughItems.length}
						onWalkPrev={walkPrevHandler}
						onWalkNext={walkNextHandler}
						hasWalkPrev={!!walkPrev}
						hasWalkNext={!!walkNext}
						onBack={closeDetail}
						onInlineCommentsChange={onInlineCommentsChange}
						onSaveInline={onSaveInline}
						flashAnchor={flashAnchor ?? null}
						onFlashCommentConsumed={onFlashCommentConsumed}
						onSubmitAnnotation={onSubmitAnnotation}
						outputDeclaredBy={session.output_declared_by}
						onDeclaringUnitClick={(unitSlug) => {
							// Open the unit's focused detail view. `openDetail`
							// switches to the Units tab AND mounts
							// `UnitDetailView` for this slug — same surface a
							// reviewer would land on by clicking the unit row
							// directly. Beats the previous DOM-querySelector
							// scroll which left the row collapsed and required
							// a second click.
							openDetail("units", unitSlug)
						}}
					/>
				) : (
					<ArtifactsTab
						kind="output"
						artifacts={outputVMs}
						feedbackByName={feedbackByOutput}
						seen={seen}
						stageId={stageName}
						highlightRequestId={onHighlightRequestId ?? null}
						onHighlightConsumed={onHighlightConsumed}
						feedback={feedback}
						onOpenDetail={(name) => openDetail("outputs", name)}
						onReplaceOutput={
							onReplaceOutput ? (name) => setReplaceTarget(name) : undefined
						}
						driftPendingByName={driftPendingOutputs}
					/>
				),
		},
		// One tab per asset SUBDIRECTORY under `stages/<stage>/` (e.g.
		// `proofs/`), named after the directory. Same list + detail render as
		// the Other tab, keyed off the directory id so the generic detail
		// mechanism (`openDetail(dir, name)` / `detail?.tab === dir`) works
		// without per-tab plumbing. Stage-root loose files stay in "Other".
		...dirTabGroups.map(
			({ dir, vms }): TabDef => ({
				id: dir,
				label: `${dir.charAt(0).toUpperCase() + dir.slice(1)} (${vms.length})`,
				content:
					detail?.tab === dir ? (
						<ArtifactDetailView
							kind="output"
							artifacts={vms}
							currentName={detail.name}
							seen={seen}
							stageId={stageName}
							intentSlug={intentSlug}
							feedbackByName={new Map()}
							walkIndex={vms.findIndex((a) => a.name === detail.name)}
							walkTotal={vms.length}
							onWalkPrev={() => {
								const idx = vms.findIndex((a) => a.name === detail.name)
								if (idx > 0) openDetail(dir, vms[idx - 1].name)
							}}
							onWalkNext={() => {
								const idx = vms.findIndex((a) => a.name === detail.name)
								if (idx >= 0 && idx < vms.length - 1)
									openDetail(dir, vms[idx + 1].name)
							}}
							hasWalkPrev={vms.findIndex((a) => a.name === detail.name) > 0}
							hasWalkNext={
								vms.findIndex((a) => a.name === detail.name) < vms.length - 1
							}
							onBack={closeDetail}
							onInlineCommentsChange={onInlineCommentsChange}
							onSaveInline={onSaveInline}
							flashAnchor={flashAnchor ?? null}
							onFlashCommentConsumed={onFlashCommentConsumed}
						/>
					) : (
						<ArtifactsTab
							kind="output"
							artifacts={vms}
							feedbackByName={new Map()}
							seen={seen}
							stageId={stageName}
							highlightRequestId={null}
							onHighlightConsumed={() => {}}
							feedback={feedback}
							onOpenDetail={(name) => openDetail(dir, name)}
						/>
					),
			}),
		),
		// Catchall tab for stray stage files: anything under
		// `stages/<stage>/` not declared by any unit, not under
		// `artifacts/`, `knowledge/`, or `discovery/`, AND not in a
		// subdirectory (those get their own tab above). Reviewer can see
		// them and link them if relevant. Disabled when empty so the tab
		// strip doesn't clutter with a noise tab. Same render shape as
		// Outputs (no per-file drift / replace surface — not tracked outputs).
		{
			id: "other",
			label: `Other (${looseOtherVMs.length})`,
			disabled: looseOtherVMs.length === 0,
			content:
				detail?.tab === "other" ? (
					<ArtifactDetailView
						kind="output"
						artifacts={looseOtherVMs}
						currentName={detail.name}
						seen={seen}
						stageId={stageName}
						intentSlug={intentSlug}
						feedbackByName={new Map()}
						walkIndex={looseOtherVMs.findIndex((a) => a.name === detail.name)}
						walkTotal={looseOtherVMs.length}
						onWalkPrev={() => {
							const idx = looseOtherVMs.findIndex((a) => a.name === detail.name)
							if (idx > 0) openDetail("other", looseOtherVMs[idx - 1].name)
						}}
						onWalkNext={() => {
							const idx = looseOtherVMs.findIndex((a) => a.name === detail.name)
							if (idx >= 0 && idx < looseOtherVMs.length - 1)
								openDetail("other", looseOtherVMs[idx + 1].name)
						}}
						hasWalkPrev={
							looseOtherVMs.findIndex((a) => a.name === detail.name) > 0
						}
						hasWalkNext={
							looseOtherVMs.findIndex((a) => a.name === detail.name) <
							looseOtherVMs.length - 1
						}
						onBack={closeDetail}
						onInlineCommentsChange={onInlineCommentsChange}
						onSaveInline={onSaveInline}
						flashAnchor={flashAnchor ?? null}
						onFlashCommentConsumed={onFlashCommentConsumed}
					/>
				) : (
					<ArtifactsTab
						kind="output"
						artifacts={looseOtherVMs}
						feedbackByName={new Map()}
						seen={seen}
						stageId={stageName}
						highlightRequestId={null}
						onHighlightConsumed={() => {}}
						feedback={feedback}
						onOpenDetail={(name) => openDetail("other", name)}
					/>
				),
		},
	]

	const replaceArtifact =
		replaceTarget != null
			? outputVMs.find((a) => a.name === replaceTarget)
			: null

	return (
		<>
			<Tabs
				groupId={`stage-${stageName}`}
				tabs={tabs}
				// Clamp to a real tab: a stale/typo'd tab id in the URL (e.g. a
				// dynamic dir tab that no longer exists) falls back to Overview
				// rather than rendering an empty body with no active tab.
				activeId={tabs.some((t) => t.id === activeTab) ? activeTab : "overview"}
				onActiveChange={setActiveTab}
			/>
			{replaceArtifact && onReplaceOutput ? (
				<ReplaceOutputDialog
					open={replaceTarget !== null}
					output={{
						name: replaceArtifact.name,
						mime: replaceArtifact.mime,
						size: replaceArtifact.body?.length ?? 0,
						content: replaceArtifact.body,
					}}
					onSubmit={async (payload) => {
						await onReplaceOutput(replaceArtifact.name, payload)
						setReplaceTarget(null)
					}}
					onClose={() => setReplaceTarget(null)}
					concurrentReplaced={
						concurrentReplacedOutputs?.has(replaceArtifact.name) ?? false
					}
				/>
			) : null}
		</>
	)
}

function OverviewTab({
	stageName,
	stageSummary,
	stageBrief,
	stageObservations,
	units,
	knowledge,
	outputs,
	feedback,
	feedbackByUnit,
	feedbackByKnowledge,
	feedbackByOutput,
	seen,
	stageId,
	intentSlug,
	onNavigate,
	onStartWalkthrough,
	onInlineCommentsChange,
	onSaveInline,
	flashAnchor,
	onFlashCommentConsumed,
}: {
	stageName: string
	stageSummary: string | null
	stageBrief: string | null
	stageObservations: string | null
	units: ParsedUnit[]
	knowledge: ArtifactViewModel[]
	outputs: ArtifactViewModel[]
	feedback: FeedbackItemData[]
	feedbackByUnit: Map<string, FeedbackItemData[]>
	feedbackByKnowledge: Map<string, FeedbackItemData[]>
	feedbackByOutput: Map<string, FeedbackItemData[]>
	seen: ReturnType<typeof useSeenTracker>
	stageId: string
	intentSlug: string | null
	onNavigate: (tab: "units" | "knowledge" | "outputs", name: string) => void
	onStartWalkthrough: () => void
	onInlineCommentsChange?: (comments: InlineCommentEntry[]) => void
	onSaveInline?: (entry: {
		selectedText: string
		comment: string
		paragraph: number
		location: string
		filePath?: string
		commentId: string
		contentSha?: string
	}) => Promise<void>
	flashAnchor?: {
		commentId?: string
		selectedText: string
		paragraph?: number
	} | null
	onFlashCommentConsumed?: () => void
}) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-end gap-3 flex-wrap">
				<button
					type="button"
					onClick={onStartWalkthrough}
					className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-teal-700 hover:bg-teal-800 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 transition-colors"
				>
					Start walkthrough →
				</button>
			</div>

			{stageBrief &&
				(() => {
					const briefBody = stripFrontmatter(stageBrief)
					const briefPath = intentSlug
						? `.haiku/intents/${intentSlug}/stages/${stageId}/BRIEF.md`
						: undefined
					return (
						<Card as="article" ariaLabelledBy="stage-brief-heading">
							<SectionHeading id="stage-brief-heading" variant="eyebrow">
								Brief{" "}
								<span className="font-normal normal-case text-stone-500">
									(what this stage delivers)
								</span>
							</SectionHeading>
							{onInlineCommentsChange ? (
								<InlineComments
									htmlContent={markdownToSimpleHtml(briefBody)}
									rawContent={briefBody}
									location="Brief"
									filePath={briefPath}
									existingAnchors={
										briefPath
											? deriveExistingAnchorsForFile(briefPath, feedback)
											: []
									}
									onCommentsChange={onInlineCommentsChange}
									onSaveInline={onSaveInline}
									flashAnchor={flashAnchor ?? null}
									onFlashCommentConsumed={onFlashCommentConsumed}
								/>
							) : (
								<MarkdownViewer id={`brief-${stageName}`}>
									{stageBrief}
								</MarkdownViewer>
							)}
						</Card>
					)
				})()}

			{stageObservations &&
				(() => {
					const obsBody = stripFrontmatter(stageObservations)
					const obsPath = intentSlug
						? `.haiku/intents/${intentSlug}/stages/${stageId}/observations.md`
						: undefined
					return (
						<Card as="article" ariaLabelledBy="stage-observations-heading">
							<SectionHeading id="stage-observations-heading" variant="eyebrow">
								Observations{" "}
								<span className="font-normal normal-case text-stone-500">
									(what the agent saw building this stage)
								</span>
							</SectionHeading>
							{onInlineCommentsChange ? (
								<InlineComments
									htmlContent={markdownToSimpleHtml(obsBody)}
									rawContent={obsBody}
									location="Observations"
									filePath={obsPath}
									existingAnchors={
										obsPath
											? deriveExistingAnchorsForFile(obsPath, feedback)
											: []
									}
									onCommentsChange={onInlineCommentsChange}
									onSaveInline={onSaveInline}
									flashAnchor={flashAnchor ?? null}
									onFlashCommentConsumed={onFlashCommentConsumed}
								/>
							) : (
								<MarkdownViewer id={`observations-${stageName}`}>
									{stageObservations}
								</MarkdownViewer>
							)}
						</Card>
					)
				})()}

			<Card as="article" ariaLabelledBy="stage-summary-heading">
				<SectionHeading id="stage-summary-heading" variant="eyebrow">
					Stage Summary{" "}
					<span className="font-normal normal-case text-stone-500">
						(from studio definition)
					</span>
				</SectionHeading>
				<p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
					{stageSummary ?? `No summary available for the ${stageName} stage.`}
				</p>
			</Card>

			{units.length > 0 && (
				<Card>
					<div className="flex items-center justify-between mb-3">
						<SectionHeading>Units ({units.length})</SectionHeading>
					</div>
					<div className="space-y-2">
						{units.slice(0, 5).map((u, i) => (
							<CondensedUnitRow
								key={u.slug}
								index={i}
								unit={u}
								feedback={feedbackByUnit.get(u.slug) ?? []}
								state={seen.state("unit", stageId, u.slug, shaOf(u))}
								onClick={() => onNavigate("units", u.slug)}
							/>
						))}
						{units.length > 5 && (
							<button
								type="button"
								onClick={() => onNavigate("units", units[5]?.slug ?? "")}
								className="block w-full text-xs text-center text-teal-600 dark:text-teal-400 hover:underline mt-3"
							>
								+ {units.length - 5} more — view all in Units tab
							</button>
						)}
					</div>
				</Card>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{knowledge.length > 0 && (
					<Card>
						<SectionHeading>Knowledge ({knowledge.length})</SectionHeading>
						<div className="space-y-2">
							{knowledge.slice(0, 5).map((a) => (
								<CondensedArtifactRow
									key={a.name}
									name={a.name}
									kind={a.kind}
									feedback={feedbackByKnowledge.get(a.name) ?? []}
									iconKind="knowledge"
									state={seen.state("knowledge", stageId, a.name, shaOf(a))}
									onClick={() => onNavigate("knowledge", a.name)}
								/>
							))}
							{knowledge.length > 5 && (
								<button
									type="button"
									onClick={() =>
										onNavigate("knowledge", knowledge[5]?.name ?? "")
									}
									className="block w-full text-xs text-center text-teal-600 dark:text-teal-400 hover:underline mt-2"
								>
									+ {knowledge.length - 5} more
								</button>
							)}
						</div>
					</Card>
				)}

				{outputs.length > 0 && (
					<Card>
						<SectionHeading>Outputs ({outputs.length})</SectionHeading>
						<div className="space-y-2">
							{outputs.slice(0, 5).map((a) => (
								<CondensedArtifactRow
									key={a.name}
									name={a.name}
									kind={a.kind}
									feedback={feedbackByOutput.get(a.name) ?? []}
									iconKind="output"
									state={seen.state("output", stageId, a.name, shaOf(a))}
									onClick={() => onNavigate("outputs", a.name)}
								/>
							))}
							{outputs.length > 5 && (
								<button
									type="button"
									onClick={() => onNavigate("outputs", outputs[5]?.name ?? "")}
									className="block w-full text-xs text-center text-teal-600 dark:text-teal-400 hover:underline mt-2"
								>
									+ {outputs.length - 5} more
								</button>
							)}
						</div>
					</Card>
				)}
			</div>
		</div>
	)
}

function SeenCounter({
	label,
	total,
	seenCount,
	onNextUnseen,
}: {
	label: string
	total: number
	seenCount: number
	onNextUnseen?: () => void
}) {
	const unseen = total - seenCount
	return (
		<div className="mb-3 flex items-center justify-between gap-3">
			<div className="flex items-center gap-2 text-xs">
				<span className="font-semibold text-stone-700 dark:text-stone-200">
					{label}
				</span>
				<span className="text-stone-500">·</span>
				<span className="font-mono text-stone-500 dark:text-stone-300">
					{seenCount}/{total} seen
				</span>
			</div>
			{unseen > 0 && onNextUnseen ? (
				<button
					type="button"
					onClick={onNextUnseen}
					className="px-3 py-1.5 text-xs font-semibold rounded-md bg-teal-700 hover:bg-teal-800 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"
				>
					Next unseen ({unseen}) →
				</button>
			) : (
				<span className="text-xs text-green-600 dark:text-green-400 font-semibold">
					✓ All seen
				</span>
			)}
		</div>
	)
}

function UnitsTab({
	units,
	feedbackByUnit,
	seen,
	stageId,
	highlightRequestId,
	onHighlightConsumed,
	feedback,
	onOpenDetail,
}: {
	units: ParsedUnit[]
	feedbackByUnit: Map<string, FeedbackItemData[]>
	seen: ReturnType<typeof useSeenTracker>
	stageId: string
	highlightRequestId: string | null
	onHighlightConsumed?: () => void
	feedback: FeedbackItemData[]
	onOpenDetail: (name: string) => void
}) {
	// External highlight request — route to the matching unit's detail.
	useEffect(() => {
		if (!highlightRequestId) return
		const target = feedback.find((f) => f.feedback_id === highlightRequestId)
		const unitName = (target as unknown as { target?: { unitName?: string } })
			?.target?.unitName
		if (!unitName) return
		onOpenDetail(unitName)
		onHighlightConsumed?.()
	}, [highlightRequestId, feedback, onHighlightConsumed, onOpenDetail])

	const seenCount = units.filter(
		(u) => seen.state("unit", stageId, u.slug, shaOf(u)) === "seen",
	).length

	const handleNextUnseen = (): void => {
		const next = units.find(
			(u) => seen.state("unit", stageId, u.slug, shaOf(u)) !== "seen",
		)
		if (!next) return
		onOpenDetail(next.slug)
	}

	return (
		<>
			<SeenCounter
				label="Units"
				total={units.length}
				seenCount={seenCount}
				onNextUnseen={handleNextUnseen}
			/>
			<div className="space-y-3">
				{units.map((u, i) => (
					<UnitCard
						key={u.slug}
						index={i}
						unit={u}
						feedback={feedbackByUnit.get(u.slug) ?? []}
						state={seen.state("unit", stageId, u.slug, shaOf(u))}
						onOpen={() => onOpenDetail(u.slug)}
					/>
				))}
			</div>
		</>
	)
}

function UnitCard({
	index,
	unit,
	feedback,
	state,
	onOpen,
}: {
	index: number
	unit: ParsedUnit
	feedback: FeedbackItemData[]
	state: SeenState
	onOpen: () => void
}) {
	const fm = unit.frontmatter as typeof unit.frontmatter & {
		type?: string
		description?: string
		model?: string
	}
	const type = fm.type ?? fm.discipline ?? ""
	const typeCls = type
		? (TYPE_BADGE[type.toLowerCase()] ??
			"bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700")
		: ""
	const description =
		fm.description ??
		(unit.sections[0]?.content ? unit.sections[0].content.split("\n")[0] : "")

	return (
		<button
			type="button"
			data-unit-card={unit.slug}
			onClick={onOpen}
			className={`w-full text-left bg-white dark:bg-stone-900 rounded-lg border-2 ${seenBorderClass(state)} overflow-hidden transition-colors hover:border-teal-400 dark:hover:border-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`}
		>
			<div className="flex items-start gap-3 px-4 py-3">
				<span className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-300 text-xs font-bold font-mono mt-0.5">
					{String(index + 1).padStart(2, "0")}
				</span>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-tight break-words">
							{unit.title || unit.slug}
						</span>
						<StateBadge state={state} />
						{type && (
							<span
								className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${typeCls}`}
							>
								{type}
							</span>
						)}
						<ModelBadge model={fm.model} />
					</div>
					<p className="text-xs font-mono text-stone-500 dark:text-stone-500 truncate mt-0.5">
						{unit.slug}
					</p>
					{description && (
						<p className="text-xs text-stone-600 dark:text-stone-300 leading-snug mt-1 line-clamp-1">
							{description}
						</p>
					)}
				</div>
				<div className="shrink-0 flex items-center gap-2 mt-0.5">
					{feedback.length > 0 && (
						<span className="inline-flex items-center gap-0.5">
							{feedback.slice(0, 3).map((f, i) => (
								<span
									key={f.feedback_id}
									title={f.title}
									className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${feedbackBadgeColor(f.status)}`}
								>
									{i + 1}
								</span>
							))}
							{feedback.length > 3 && (
								<span className="ml-0.5 text-xs font-mono text-stone-500">
									+{feedback.length - 3}
								</span>
							)}
						</span>
					)}
					<span
						className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${statusPillClass(deriveUnitStatus(fm))}`}
					>
						{deriveUnitStatus(fm)}
					</span>
					<svg
						className="w-4 h-4 text-stone-500"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<title>open</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</div>
			</div>
		</button>
	)
}

function CondensedUnitRow({
	index,
	unit,
	feedback,
	state,
	onClick,
}: {
	index: number
	unit: ParsedUnit
	feedback: FeedbackItemData[]
	state: SeenState
	onClick?: () => void
}) {
	const fm = unit.frontmatter
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-800/50 border ${seenBorderClass(state)} hover:border-teal-400 dark:hover:border-teal-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`}
		>
			<span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 text-xs font-bold font-mono">
				{String(index + 1).padStart(2, "0")}
			</span>
			<span className="flex-1 min-w-0 text-xs font-mono text-stone-700 dark:text-stone-300 truncate">
				{unit.slug}
			</span>
			<StateBadge state={state} />
			{feedback.length > 0 && (
				<span
					className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${feedbackBadgeColor(feedback[0].status)}`}
				>
					{feedback.length}
				</span>
			)}
			<span
				className={`shrink-0 px-1.5 py-0.5 rounded-full text-xs font-semibold ${statusPillClass(deriveUnitStatus(fm))}`}
			>
				{deriveUnitStatus(fm)}
			</span>
		</button>
	)
}

/**
 * StepperBar — top-of-detail-view nav: Back button, Prev/Next arrows,
 * and a position counter ("3 of 48"). Index/total span the unified
 * walkthrough (units + knowledge + outputs), so Next on the last unit
 * advances into the first knowledge item and so on.
 */
function StepperBar({
	backLabel,
	currentIndex,
	total,
	onBack,
	onPrev,
	onNext,
	hasPrev,
	hasNext,
}: {
	backLabel: string
	currentIndex: number
	total: number
	onBack: () => void
	onPrev: () => void
	onNext: () => void
	hasPrev: boolean
	hasNext: boolean
}) {
	return (
		<div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
			<button
				type="button"
				onClick={onBack}
				className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:text-teal-600 dark:hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 rounded px-1.5 py-1"
			>
				<svg
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<title>back</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				{backLabel}
			</button>
			<div className="flex items-center gap-2 flex-wrap">
				<span className="text-xs font-mono text-stone-600 dark:text-stone-300 tabular-nums">
					{total > 0 ? `${currentIndex + 1} of ${total}` : "0 of 0"}
				</span>
				<button
					type="button"
					onClick={onPrev}
					disabled={!hasPrev}
					aria-label="Previous item"
					className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:cursor-not-allowed disabled:text-stone-400 dark:disabled:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<title>prev</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M15 19l-7-7 7-7"
						/>
					</svg>
				</button>
				<button
					type="button"
					onClick={onNext}
					disabled={!hasNext}
					aria-label="Next item"
					className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:cursor-not-allowed disabled:text-stone-400 dark:disabled:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<title>next</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</button>
			</div>
		</div>
	)
}

/**
 * UnitDetailView — focused single-unit view. Prev/next step through the
 * parent's unified walkthrough list (units → knowledge → outputs), so
 * Next on the last unit lands on the first knowledge artifact.
 */
function UnitDetailView({
	units,
	currentName,
	seen,
	stageId,
	sessionId,
	intentSlug,
	artifactIndex,
	feedbackByUnit,
	walkIndex,
	walkTotal,
	onWalkPrev,
	onWalkNext,
	hasWalkPrev,
	hasWalkNext,
	onBack,
	onInlineCommentsChange,
	onSaveInline,
	flashAnchor,
	onFlashCommentConsumed,
}: {
	units: ParsedUnit[]
	currentName: string
	seen: ReturnType<typeof useSeenTracker>
	stageId: string
	sessionId: string
	intentSlug: string | null
	artifactIndex?: ArtifactIndex
	feedbackByUnit: Map<string, FeedbackItemData[]>
	walkIndex: number
	walkTotal: number
	onWalkPrev: () => void
	onWalkNext: () => void
	hasWalkPrev: boolean
	hasWalkNext: boolean
	onBack: () => void
	onInlineCommentsChange?: (comments: InlineCommentEntry[]) => void
	onSaveInline?: (entry: {
		selectedText: string
		comment: string
		paragraph: number
		location: string
		filePath?: string
		commentId: string
		contentSha?: string
	}) => Promise<void>
	flashAnchor?: {
		commentId?: string
		selectedText: string
		paragraph?: number
	} | null
	onFlashCommentConsumed?: () => void
}) {
	const current = units.find((u) => u.slug === currentName)

	// Mark seen when entering detail and when the current name changes.
	useEffect(() => {
		if (current) seen.markSeen("unit", stageId, current.slug, shaOf(current))
	}, [current, seen, stageId])

	if (!current) {
		return (
			<div className="text-sm text-stone-500 dark:text-stone-400">
				<button
					type="button"
					onClick={onBack}
					className="text-teal-600 dark:text-teal-400 hover:underline"
				>
					← Back to Stage
				</button>
				<p className="mt-2">Unit not found.</p>
			</div>
		)
	}

	const fm = current.frontmatter as typeof current.frontmatter & {
		type?: string
		description?: string
		model?: string
		inputs?: string[]
		outputs?: string[]
		depends_on?: string[]
		hat?: string
		bolt?: number
	}
	const type = fm.type ?? fm.discipline ?? ""
	const typeCls = type
		? (TYPE_BADGE[type.toLowerCase()] ??
			"bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700")
		: ""
	const cardFeedback = feedbackByUnit.get(current.slug) ?? []
	// Slugs are typically already CSS-id-safe, but normalise defensively in
	// case a future authoring tool relaxes the constraint.
	const headingId = `unit-detail-heading-${current.slug.replace(/[^A-Za-z0-9_-]/g, "-")}`

	return (
		<>
			<StepperBar
				backLabel="Back to Stage"
				currentIndex={walkIndex}
				total={walkTotal}
				onBack={onBack}
				onPrev={onWalkPrev}
				onNext={onWalkNext}
				hasPrev={hasWalkPrev}
				hasNext={hasWalkNext}
			/>
			<article
				aria-labelledby={headingId}
				className="bg-white dark:bg-stone-900 rounded-lg border-2 border-stone-200 dark:border-stone-700 overflow-hidden"
			>
				<div className="flex items-start gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-700">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 flex-wrap">
							<h2
								id={headingId}
								className="text-base font-bold text-stone-900 dark:text-stone-100 leading-tight break-words"
							>
								{current.title || current.slug}
							</h2>
							{type && (
								<span
									className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${typeCls}`}
								>
									{type}
								</span>
							)}
							<ModelBadge model={fm.model} />
							<span
								className={`shrink-0 px-1.5 py-0.5 rounded-full text-xs font-semibold ${statusPillClass(deriveUnitStatus(fm))}`}
							>
								{deriveUnitStatus(fm)}
							</span>
						</div>
						<p className="text-xs font-mono text-stone-500 dark:text-stone-500 mt-1">
							{current.slug}
						</p>
					</div>
					{cardFeedback.length > 0 && (
						<span className="shrink-0 inline-flex items-center gap-0.5">
							{cardFeedback.slice(0, 3).map((f, i) => (
								<span
									key={f.feedback_id}
									title={f.title}
									className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${feedbackBadgeColor(f.status)}`}
								>
									{i + 1}
								</span>
							))}
							{cardFeedback.length > 3 && (
								<span className="text-xs font-mono text-stone-500 ml-0.5">
									+{cardFeedback.length - 3}
								</span>
							)}
						</span>
					)}
				</div>
				<div className="px-4 py-3">
					<UnitMetaPanel
						inputs={fm.inputs as string[] | undefined}
						outputs={fm.outputs as string[] | undefined}
						dependsOn={fm.depends_on as string[] | undefined}
						hat={fm.hat}
						bolt={fm.bolt}
						sessionId={sessionId}
						currentStage={stageId}
						artifactIndex={artifactIndex}
					/>
					{current.rawContent &&
						(() => {
							const body = stripFrontmatter(current.rawContent)
							if (!body.trim()) return null
							return onInlineCommentsChange ? (
								<InlineComments
									htmlContent={markdownToSimpleHtml(body)}
									rawContent={body}
									location={`Unit: ${current.title || current.slug}`}
									filePath={
										intentSlug
											? `.haiku/intents/${intentSlug}/stages/${stageId}/units/${current.slug}.md`
											: undefined
									}
									existingAnchors={deriveExistingAnchorsForUnit(
										current.slug,
										cardFeedback,
									)}
									onCommentsChange={onInlineCommentsChange}
									onSaveInline={onSaveInline}
									flashAnchor={flashAnchor ?? null}
									onFlashCommentConsumed={onFlashCommentConsumed}
								/>
							) : (
								<MarkdownViewer id={`unit-${current.slug}`}>
									{body}
								</MarkdownViewer>
							)
						})()}
				</div>
			</article>
		</>
	)
}

/**
 * ArtifactDetailView — focused single-artifact view. Prev/next step
 * through the parent's unified walkthrough list; the stepper does not
 * filter by kind, so Next on the last knowledge artifact lands on the
 * first output.
 */
function ArtifactDetailView({
	kind,
	artifacts,
	currentName,
	seen,
	stageId,
	intentSlug,
	feedbackByName,
	walkIndex,
	walkTotal,
	onWalkPrev,
	onWalkNext,
	hasWalkPrev,
	hasWalkNext,
	onBack,
	onInlineCommentsChange,
	onSaveInline,
	flashAnchor,
	onFlashCommentConsumed,
	onSubmitAnnotation,
	outputDeclaredBy,
	onDeclaringUnitClick,
}: {
	kind: "knowledge" | "output"
	artifacts: ArtifactViewModel[]
	currentName: string
	seen: ReturnType<typeof useSeenTracker>
	stageId: string
	intentSlug: string | null
	feedbackByName: Map<string, FeedbackItemData[]>
	walkIndex: number
	walkTotal: number
	onWalkPrev: () => void
	onWalkNext: () => void
	hasWalkPrev: boolean
	hasWalkNext: boolean
	onBack: () => void
	onSaveInline?: (entry: {
		selectedText: string
		comment: string
		paragraph: number
		location: string
		filePath?: string
		commentId: string
		contentSha?: string
	}) => Promise<void>
	flashAnchor?: {
		commentId?: string
		selectedText: string
		paragraph?: number
	} | null
	onFlashCommentConsumed?: () => void
	onInlineCommentsChange?: (comments: InlineCommentEntry[]) => void
	onSubmitAnnotation?: (
		artifactName: string,
		comment: string,
		screenshotDataUrl: string,
	) => Promise<void>
	/** Map from intent-relative output path → declaring unit slugs.
	 *  Renders the "Declared by" banner above the artifact body when
	 *  kind is "output" and the current artifact's path appears in
	 *  the map. */
	outputDeclaredBy?: Record<string, string[]>
	/** Handler for clicks on a declaring-unit badge. Parent decides
	 *  what "open this unit" means. */
	onDeclaringUnitClick?: (unitSlug: string) => void
}) {
	const current = artifacts.find((a) => a.name === currentName)

	useEffect(() => {
		if (current) seen.markSeen(kind, stageId, current.name, shaOf(current))
	}, [current, seen, stageId, kind])

	const iconCls = kind === "knowledge" ? "text-sky-500" : "text-violet-500"
	const icon = kind === "knowledge" ? "\u{1F9E0}" : "\u{1F4E6}"

	if (!current) {
		return (
			<div className="text-sm text-stone-500 dark:text-stone-400">
				<button
					type="button"
					onClick={onBack}
					className="text-teal-600 dark:text-teal-400 hover:underline"
				>
					← Back to Stage
				</button>
				<p className="mt-2">Artifact not found.</p>
			</div>
		)
	}

	const kindCls =
		KIND_BADGE[current.kind.toLowerCase()] ??
		"bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700"
	const artifactFeedback = feedbackByName.get(current.name) ?? []
	// HTML IDs cannot contain whitespace; artifact names may. Normalise to a
	// safe slug — chars outside [A-Za-z0-9_-] become "-".
	const headingId = `artifact-detail-heading-${current.name.replace(/[^A-Za-z0-9_-]/g, "-")}`

	return (
		<>
			<StepperBar
				backLabel="Back to Stage"
				currentIndex={walkIndex}
				total={walkTotal}
				onBack={onBack}
				onPrev={onWalkPrev}
				onNext={onWalkNext}
				hasPrev={hasWalkPrev}
				hasNext={hasWalkNext}
			/>
			<article
				aria-labelledby={headingId}
				className="bg-white dark:bg-stone-900 rounded-lg border-2 border-stone-200 dark:border-stone-700 overflow-hidden"
			>
				<div className="flex items-start gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-700">
					<span
						className={`shrink-0 ${iconCls} text-lg leading-none mt-0.5`}
						aria-hidden="true"
					>
						{icon}
					</span>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 flex-wrap">
							<h2
								id={headingId}
								className="text-base font-bold text-stone-900 dark:text-stone-100 font-mono break-all"
							>
								{current.name}
							</h2>
							<span
								className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${kindCls}`}
							>
								{current.kind}
							</span>
						</div>
						{current.summary && (
							<p className="text-xs text-stone-600 dark:text-stone-300 leading-snug mt-1 break-words">
								{current.summary}
							</p>
						)}
					</div>
					{artifactFeedback.length > 0 && (
						<span className="shrink-0 inline-flex items-center gap-0.5">
							{artifactFeedback.slice(0, 3).map((f, i) => (
								<span
									key={f.feedback_id}
									title={f.title}
									className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${feedbackBadgeColor(f.status)}`}
								>
									{i + 1}
								</span>
							))}
						</span>
					)}
				</div>
				<div className="px-4 py-3">
					{kind === "output" && (
						<DeclaringUnitsBanner
							intentRelativePath={current.intentRelativePath}
							declaredBy={outputDeclaredBy}
							onUnitClick={onDeclaringUnitClick}
						/>
					)}
					<ArtifactBody
						kind={kind}
						artifact={current}
						intentSlug={intentSlug}
						stageId={stageId}
						existingAnchors={deriveExistingAnchors(artifactFeedback)}
						onInlineCommentsChange={onInlineCommentsChange}
						onSaveInline={onSaveInline}
						flashAnchor={flashAnchor ?? null}
						onFlashCommentConsumed={onFlashCommentConsumed}
						onSubmitAnnotation={onSubmitAnnotation}
					/>
				</div>
			</article>
		</>
	)
}

function ArtifactsTab({
	kind,
	artifacts,
	feedbackByName,
	seen,
	stageId,
	highlightRequestId,
	onHighlightConsumed,
	feedback,
	onOpenDetail,
	onReplaceOutput,
	driftPendingByName,
}: {
	kind: ArtifactKind & ("knowledge" | "output")
	artifacts: ArtifactViewModel[]
	feedbackByName: Map<string, FeedbackItemData[]>
	seen: ReturnType<typeof useSeenTracker>
	stageId: string
	highlightRequestId: string | null
	onHighlightConsumed?: () => void
	feedback: FeedbackItemData[]
	onOpenDetail: (name: string) => void
	/** Output-only — opens the ReplaceOutputDialog for this artifact. */
	onReplaceOutput?: (artifactName: string) => void
	/** Output-only — names of outputs in the post-upload pre-classification window. */
	driftPendingByName?: Set<string>
}) {
	useEffect(() => {
		if (!highlightRequestId) return
		const target = feedback.find((f) => f.feedback_id === highlightRequestId)
		const targetKind = (target as unknown as { target?: { kind?: string } })
			?.target?.kind
		if (targetKind !== kind) return
		const name = (
			target as unknown as {
				target?: { knowledgeName?: string; outputName?: string }
			}
		)?.target?.[kind === "knowledge" ? "knowledgeName" : "outputName"]
		if (!name) return
		onOpenDetail(name)
		onHighlightConsumed?.()
	}, [highlightRequestId, feedback, kind, onHighlightConsumed, onOpenDetail])

	const seenCount = artifacts.filter(
		(a) => seen.state(kind, stageId, a.name, shaOf(a)) === "seen",
	).length

	const handleNextUnseen = (): void => {
		const next = artifacts.find(
			(a) => seen.state(kind, stageId, a.name, shaOf(a)) !== "seen",
		)
		if (!next) return
		onOpenDetail(next.name)
	}

	const label = kind === "knowledge" ? "Knowledge" : "Outputs"

	return (
		<>
			<SeenCounter
				label={label}
				total={artifacts.length}
				seenCount={seenCount}
				onNextUnseen={handleNextUnseen}
			/>
			<div className="space-y-3">
				{artifacts.map((a) => (
					<ArtifactCard
						key={a.name}
						kind={kind}
						artifact={a}
						feedback={feedbackByName.get(a.name) ?? []}
						state={seen.state(kind, stageId, a.name, shaOf(a))}
						onOpen={() => onOpenDetail(a.name)}
						onReplaceOutput={
							kind === "output" && onReplaceOutput
								? () => onReplaceOutput(a.name)
								: undefined
						}
						driftPending={kind === "output" && driftPendingByName?.has(a.name)}
					/>
				))}
			</div>
		</>
	)
}

function ArtifactCard({
	kind,
	artifact,
	feedback,
	state,
	onOpen,
	onReplaceOutput,
	driftPending,
}: {
	kind: "knowledge" | "output"
	artifact: ArtifactViewModel
	feedback: FeedbackItemData[]
	state: SeenState
	onOpen: () => void
	/** Output-only — when supplied, the card renders the per-card OutputCardMenu
	 *  affordance and surfaces the "Replace this output" action. */
	onReplaceOutput?: () => void
	/** Output-only — when true the card paints the manual-change-pending
	 *  amber stripe + footer chip per DESIGN-BRIEF Screen 2 happy-path. */
	driftPending?: boolean
}) {
	const iconCls = kind === "knowledge" ? "text-sky-500" : "text-violet-500"
	const icon = kind === "knowledge" ? "\u{1F9E0}" : "\u{1F4E6}"
	const kindCls =
		KIND_BADGE[artifact.kind.toLowerCase()] ??
		"bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700"
	const isVisualPreview = artifact.mime === "html" || artifact.mime === "svg"
	const showMenu = kind === "output" && !!onReplaceOutput
	const driftClass = driftPending ? " border-l-4 border-l-amber-400" : ""

	return (
		<div
			data-artifact-card={artifact.name}
			data-drift-pending={driftPending || undefined}
			className={`group relative w-full text-left bg-white dark:bg-stone-900 rounded-lg border-2 ${seenBorderClass(state)}${driftClass} overflow-hidden transition-colors hover:border-teal-400 dark:hover:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-stone-900`}
		>
			<button
				type="button"
				onClick={onOpen}
				aria-label={`Open ${artifact.name}`}
				data-testid={`artifact-card-open-${artifact.name}`}
				className="block w-full text-left focus-visible:outline-none"
			>
				<div className="flex items-start gap-3 px-4 py-3">
					{isVisualPreview ? (
						<ArtifactThumbnail artifact={artifact} />
					) : (
						<span
							className={`shrink-0 ${iconCls} text-lg leading-none mt-0.5`}
							aria-hidden="true"
						>
							{icon}
						</span>
					)}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 flex-wrap">
							<span className="text-sm font-semibold text-stone-900 dark:text-stone-100 font-mono truncate">
								{artifact.name}
							</span>
							<StateBadge state={state} />
							<span
								className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${kindCls}`}
							>
								{artifact.kind}
							</span>
						</div>
						{artifact.summary && (
							<p className="text-xs text-stone-600 dark:text-stone-300 leading-snug mt-1 line-clamp-1 break-words">
								{artifact.summary}
							</p>
						)}
					</div>
					<div
						className={`shrink-0 flex items-center gap-2 mt-0.5${showMenu ? " pr-9" : ""}`}
					>
						{feedback.length > 0 && (
							<span className="inline-flex items-center gap-0.5">
								{feedback.slice(0, 3).map((f, i) => (
									<span
										key={f.feedback_id}
										title={f.title}
										className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${feedbackBadgeColor(f.status)}`}
									>
										{i + 1}
									</span>
								))}
							</span>
						)}
						<svg
							className="w-4 h-4 text-stone-500"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<title>open</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</div>
			</button>
			{showMenu ? (
				<div
					className="absolute right-3 top-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:[&:has([aria-expanded='true'])]:opacity-100 transition-opacity"
					data-testid={`artifact-card-menu-slot-${artifact.name}`}
				>
					<OutputCardMenu
						artifactName={artifact.name}
						onReplace={onReplaceOutput ?? (() => {})}
					/>
				</div>
			) : null}
			{driftPending ? (
				<div
					data-testid={`artifact-card-drift-chip-${artifact.name}`}
					className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
				>
					<span aria-hidden="true" className="mr-1">
						⚠
					</span>
					manual change pending
				</div>
			) : null}
		</div>
	)
}

/**
 * ArtifactBody — the rendered preview of an artifact's content. For
 * markdown/text with `onInlineCommentsChange` wired: renders via
 * `<InlineComments>` so reviewers can select a span and attach a
 * comment. For HTML wireframes + raster images with `onSubmitAnnotation`
 * wired: wraps the preview in `<ArtifactAnnotator>` so reviewers can
 * draw on the artifact and post a feedback entry with the annotated
 * screenshot as a sidecar attachment.
 *
 * Shared between list cards and the detail view; the detail view is
 * the only current caller that supplies the annotation callbacks.
 */
function ArtifactBody({
	kind,
	artifact,
	intentSlug,
	stageId,
	existingAnchors,
	onInlineCommentsChange,
	onSaveInline,
	flashAnchor,
	onFlashCommentConsumed,
	onSubmitAnnotation,
}: {
	kind: "knowledge" | "output"
	artifact: ArtifactViewModel
	intentSlug: string | null
	stageId: string
	existingAnchors?: Array<{
		commentId?: string
		selectedText: string
		paragraph?: number
		contentSha?: string
	}>
	onInlineCommentsChange?: (comments: InlineCommentEntry[]) => void
	onSaveInline?: (entry: {
		selectedText: string
		comment: string
		paragraph: number
		location: string
		filePath?: string
		commentId: string
		contentSha?: string
	}) => Promise<void>
	flashAnchor?: {
		commentId?: string
		selectedText: string
		paragraph?: number
	} | null
	onFlashCommentConsumed?: () => void
	onSubmitAnnotation?: (
		artifactName: string,
		comment: string,
		screenshotDataUrl: string,
	) => Promise<void>
}): React.ReactElement {
	// Build the artifact's on-disk path. Stage-scoped knowledge lives
	// under `stages/<stage>/artifacts/`, but when the same UI surface
	// also renders intent-level knowledge we can't tell which is which
	// from just the artifact name — leave intent-level knowledge's
	// file_path unresolved (undefined) and let the agent fall back to
	// `selected_text` grep if necessary.
	const filePath = intentSlug
		? kind === "knowledge"
			? `.haiku/intents/${intentSlug}/stages/${stageId}/artifacts/${artifact.name}`
			: `.haiku/intents/${intentSlug}/stages/${stageId}/outputs/${artifact.name}`
		: undefined
	if (artifact.mime === "markdown" || artifact.mime === "text") {
		if (onInlineCommentsChange) {
			return (
				<InlineComments
					htmlContent={markdownToSimpleHtml(artifact.body)}
					rawContent={artifact.body}
					location={`${kind}: ${artifact.name}`}
					filePath={filePath}
					existingAnchors={existingAnchors}
					onCommentsChange={onInlineCommentsChange}
					onSaveInline={onSaveInline}
					flashAnchor={flashAnchor}
					onFlashCommentConsumed={onFlashCommentConsumed}
				/>
			)
		}
		return (
			<MarkdownViewer id={`${kind}-${artifact.name}`}>
				{artifact.body}
			</MarkdownViewer>
		)
	}
	if (artifact.mime === "html") {
		// `allow-same-origin` on a `srcDoc` iframe gives html-to-image
		// access to the inner DOM so annotation screenshots capture the
		// mockup content instead of a blank rectangle. A `srcDoc` document
		// has NO artifact base URL — relative `<link href>` / `<img src>`
		// resolve against the SPA origin, not the artifact's dir on disk.
		// To keep wireframes styled, `parseOutputArtifacts` (server side)
		// inlines adjacent `<link rel="stylesheet">` files (and their
		// relative `@import`s) into `artifact.body` at parse time, so the
		// body is self-contained here. Tailwind-CDN / inline-style
		// wireframes were always fine; adjacent-CSS wireframes now are too.
		// `resolveEmbeddedAssetUrls` then rewrites relative `<img src>` /
		// `srcset` / CSS `url(…)` refs to authed tunnel URLs so raster
		// images load inside the srcDoc. Residual: `.js`/`.svg`/font
		// sub-resources stay octet-stream-blocked (FB-21), so scripts don't
		// execute and SVG-as-img / custom fonts degrade to fallbacks.
		const iframe = (
			<iframe
				srcDoc={resolveEmbeddedAssetUrls(artifact.body, artifact.assetUrl)}
				sandbox="allow-scripts allow-same-origin"
				title={artifact.name}
				className="w-full h-[60vh] border-0 bg-white"
			/>
		)
		if (onSubmitAnnotation) {
			return (
				<ArtifactAnnotator
					artifactName={artifact.name}
					onSubmit={(comment, dataUrl) =>
						onSubmitAnnotation(artifact.name, comment, dataUrl)
					}
				>
					{iframe}
				</ArtifactAnnotator>
			)
		}
		return iframe
	}
	if (artifact.mime === "svg") {
		return <SvgPreview body={artifact.body} />
	}
	if (artifact.mime === "image") {
		// Images use the tunnel URL the server prepared (carried on the
		// VM as `assetUrl`), NOT `body` — the server inlines content
		// for text/html only, so `body` is empty for binary outputs.
		// Fall back to `body` when assetUrl is missing (covers the case
		// where the artifact was constructed via the legacy inline-data
		// path, e.g. ad-hoc previews). Reported 2026-05-13.
		const src = artifact.assetUrl
			? authedAssetUrl(artifact.assetUrl)
			: artifact.body
		if (!src) {
			return (
				<p className="text-xs italic text-stone-500">
					No preview available for {artifact.name}.
				</p>
			)
		}
		const img = (
			<img src={src} alt={artifact.name} className="w-full h-auto bg-white" />
		)
		if (onSubmitAnnotation) {
			return (
				<ArtifactAnnotator
					artifactName={artifact.name}
					onSubmit={(comment, dataUrl) =>
						onSubmitAnnotation(artifact.name, comment, dataUrl)
					}
				>
					{img}
				</ArtifactAnnotator>
			)
		}
		return img
	}
	if (artifact.mime === "video") {
		// Binary media — play from the tunnel URL the server prepared.
		const src = artifact.assetUrl
			? authedAssetUrl(artifact.assetUrl)
			: artifact.body
		if (!src) {
			return (
				<p className="text-xs italic text-stone-500">
					No preview available for {artifact.name}.
				</p>
			)
		}
		return (
			<video
				src={src}
				controls
				className="w-full max-h-[70vh] rounded-md bg-black"
			>
				<track kind="captions" />
			</video>
		)
	}
	if (artifact.mime === "code") {
		// Syntax-highlighted + escaped. Wrapped in InlineComments so a
		// reviewer can select a span of code and attach a comment — same
		// annotation contract as markdown.
		const html = highlightCodeToHtml(artifact.body, artifact.language)
		if (onInlineCommentsChange) {
			return (
				<InlineComments
					htmlContent={html}
					rawContent={artifact.body}
					location={`${kind}: ${artifact.name}`}
					filePath={filePath}
					existingAnchors={existingAnchors}
					onCommentsChange={onInlineCommentsChange}
					onSaveInline={onSaveInline}
					flashAnchor={flashAnchor}
					onFlashCommentConsumed={onFlashCommentConsumed}
				/>
			)
		}
		return (
			<div
				// biome-ignore lint/security/noDangerouslySetInnerHtml: highlight.js output, DOMPurify-sanitized in highlightCodeToHtml // audit-allow: sanitized highlight.js code render
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		)
	}
	// Unknown / plain text — escaped <pre> ASCII floor (never an empty box).
	return (
		<pre className="text-xs font-mono text-stone-700 dark:text-stone-300 whitespace-pre-wrap bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md p-3 max-h-[60vh] overflow-auto">
			{artifact.body}
		</pre>
	)
}

/**
 * ArtifactThumbnail — compact static preview used in list rows for
 * visual artifacts (html wireframes + svg diagrams). The goal is to
 * give reviewers a glance at shape/layout without opening detail.
 *
 * HTML renders into a sandboxed iframe scaled to a fixed 96×60 tile; we
 * set `pointer-events: none` so the tile acts like an image (the parent
 * button's click still opens the detail view).
 */
function ArtifactThumbnail({
	artifact,
}: {
	artifact: ArtifactViewModel
}): React.ReactElement {
	if (artifact.mime === "svg") {
		const safe = DOMPurify.sanitize(artifact.body, {
			USE_PROFILES: { svg: true, svgFilters: true },
		})
		return (
			<div
				aria-hidden="true"
				className="shrink-0 w-24 h-16 rounded border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 overflow-hidden flex items-center justify-center p-1 [&>svg]:max-w-full [&>svg]:max-h-full"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify svg profile — same contract as SvgPreview / detail view // audit-allow: DOMPurify-sanitized SVG render path
				dangerouslySetInnerHTML={{ __html: safe }}
			/>
		)
	}
	// html — render via sandboxed iframe scaled down. Sandbox flags
	// match the detail-view iframe (see `ArtifactDetailBody`) so style
	// resolution + html-to-image capture behave the same at both
	// scales. pointer-events:none keeps the tile passive so the parent
	// <button>'s click-to-open still fires.
	return (
		<div
			aria-hidden="true"
			className="shrink-0 w-32 h-20 rounded border border-stone-200 dark:border-stone-700 bg-white overflow-hidden relative pointer-events-none"
		>
			<iframe
				srcDoc={resolveEmbeddedAssetUrls(artifact.body, artifact.assetUrl)}
				sandbox="allow-scripts allow-same-origin"
				title={`Preview of ${artifact.name || "artifact"}`}
				tabIndex={-1}
				className="absolute top-0 left-0 border-0"
				style={{
					width: "1280px",
					height: "800px",
					transform: "scale(0.1)",
					transformOrigin: "top left",
				}}
			/>
		</div>
	)
}

function SvgPreview({ body }: { body: string }) {
	const safe = useMemo(
		() =>
			DOMPurify.sanitize(body, {
				USE_PROFILES: { svg: true, svgFilters: true },
			}),
		[body],
	)
	return (
		<div
			className="relative bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md p-4 overflow-auto max-h-96"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via DOMPurify svg profile — same contract as shared/section-helpers.ts::markdownToSimpleHtml // audit-allow: DOMPurify-sanitized SVG render path
			dangerouslySetInnerHTML={{ __html: safe }}
		/>
	)
}

function CondensedArtifactRow({
	name,
	kind,
	feedback,
	iconKind,
	state,
	onClick,
}: {
	name: string
	kind: string
	feedback: FeedbackItemData[]
	iconKind: "knowledge" | "output"
	state: SeenState
	onClick?: () => void
}) {
	const iconCls = iconKind === "knowledge" ? "text-sky-500" : "text-violet-500"
	const icon = iconKind === "knowledge" ? "\u{1F9E0}" : "\u{1F4E6}"
	const kindCls =
		KIND_BADGE[kind.toLowerCase()] ??
		"bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 border-stone-200 dark:border-stone-700"
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-800/50 border ${seenBorderClass(state)} hover:border-teal-400 dark:hover:border-teal-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`}
		>
			<span className={`shrink-0 ${iconCls}`} aria-hidden="true">
				{icon}
			</span>
			<span className="flex-1 min-w-0 text-xs font-mono text-stone-700 dark:text-stone-300 truncate">
				{name}
			</span>
			<StateBadge state={state} />
			<span
				className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${kindCls}`}
			>
				{kind}
			</span>
			{feedback.length > 0 && (
				<span
					className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${feedback[0].status === "pending" ? "bg-amber-500 text-white" : feedback[0].status === "addressed" ? "bg-blue-500 text-white" : "bg-stone-400 text-white"}`}
				>
					{feedback.length}
				</span>
			)}
		</button>
	)
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveStageSummary(
	session: ReviewPageSessionData,
	stageName: string,
): string | null {
	const summaries = session.stage_summaries
	if (summaries && typeof summaries[stageName] === "string") {
		return summaries[stageName]
	}
	return null
}

/** The per-stage user-facing BRIEF (markdown) — the plain-language summary
 *  the briefer wrote before the gate. Shown first in the Overview tab. */
function resolveStageBrief(
	session: ReviewPageSessionData,
	stageName: string,
): string | null {
	const briefs = session.stage_briefs
	if (briefs && typeof briefs[stageName] === "string" && briefs[stageName]) {
		return briefs[stageName]
	}
	return null
}

/** The per-stage agent OBSERVATIONS (markdown) — the free-form reflection
 *  the agent wrote at stage close (mandate ambiguity, engine friction,
 *  surprises). Shown in the Overview tab beneath the brief. */
function resolveStageObservations(
	session: ReviewPageSessionData,
	stageName: string,
): string | null {
	const obs = session.stage_observations
	if (obs && typeof obs[stageName] === "string" && obs[stageName]) {
		return obs[stageName]
	}
	return null
}

/** The per-stage ELABORATION (markdown) — the decompose-phase narrative.
 *  Rendered in its own Elaboration tab. */
function resolveStageElaboration(
	session: ReviewPageSessionData,
	stageName: string,
): string | null {
	const elabs = session.stage_elaborations
	if (elabs && typeof elabs[stageName] === "string" && elabs[stageName]) {
		return elabs[stageName]
	}
	return null
}

function inferKind(filename: string): string {
	const lower = filename.toLowerCase()
	// Kind is derived from the file's directory prefix first (the
	// wire payload's `name` retains paths relative to stages/<stage>/
	// or stages/<stage>/artifacts/, so `discovery/X` / `knowledge/X` /
	// `wireframes/X` are the real signal), then by extension only as
	// a fallback. Pre-2026-05-12 this function defaulted to
	// `"discovery"` for every unrecognized extension — mislabeling
	// .md outputs like ACCEPTANCE-CRITERIA.md as discovery in the
	// review pane and confusing reviewers.
	if (lower.startsWith("knowledge/")) return "knowledge"
	if (lower.startsWith("discovery/")) return "discovery"
	if (lower.startsWith("wireframes/") || lower.startsWith("wireframe/"))
		return "wireframe"
	if (lower.endsWith(".svg")) return "diagram"
	if (
		lower.endsWith(".png") ||
		lower.endsWith(".jpg") ||
		lower.endsWith(".jpeg")
	)
		return "image"
	if (lower.endsWith(".html")) return "wireframe"
	if (lower.endsWith(".pdf")) return "artifact"
	return "artifact"
}

function inferOutputKind(a: { name: string; type: string }): string {
	if (a.type === "image") return "image"
	if (a.type === "html") return "wireframe"
	return inferKind(a.name)
}

function inferMime(filename: string): string {
	const lower = filename.toLowerCase()
	if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown"
	if (lower.endsWith(".svg")) return "svg"
	if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html"
	if (
		lower.endsWith(".png") ||
		lower.endsWith(".jpg") ||
		lower.endsWith(".jpeg")
	)
		return "image"
	if (lower.endsWith(".pdf")) return "pdf"
	// ASCII text formats the reviewer should be able to READ in-pane,
	// not just download. Gherkin .feature files for Cucumber were
	// landing as "text" mime and falling through to the file-download
	// path; reviewers reported they couldn't see the spec they were
	// supposed to be reviewing. Treat text-shaped files as text so the
	// renderer's text path picks them up.
	if (
		lower.endsWith(".feature") ||
		lower.endsWith(".gherkin") ||
		lower.endsWith(".txt") ||
		lower.endsWith(".yaml") ||
		lower.endsWith(".yml") ||
		lower.endsWith(".json") ||
		lower.endsWith(".toml") ||
		lower.endsWith(".ini") ||
		lower.endsWith(".env") ||
		lower.endsWith(".log") ||
		lower.endsWith(".sql") ||
		lower.endsWith(".graphql") ||
		lower.endsWith(".gql") ||
		lower.endsWith(".sh") ||
		lower.endsWith(".bash") ||
		lower.endsWith(".zsh") ||
		lower.endsWith(".ts") ||
		lower.endsWith(".tsx") ||
		lower.endsWith(".js") ||
		lower.endsWith(".jsx") ||
		lower.endsWith(".py") ||
		lower.endsWith(".rb") ||
		lower.endsWith(".go") ||
		lower.endsWith(".rs") ||
		lower.endsWith(".java") ||
		lower.endsWith(".kt") ||
		lower.endsWith(".swift") ||
		lower.endsWith(".c") ||
		lower.endsWith(".h") ||
		lower.endsWith(".cpp") ||
		lower.endsWith(".cs") ||
		lower.endsWith(".css") ||
		lower.endsWith(".scss") ||
		lower.endsWith(".dockerfile") ||
		lower.endsWith("makefile") ||
		lower.endsWith(".cue") ||
		lower.endsWith(".tf") ||
		lower.endsWith(".hcl")
	) {
		return "text"
	}
	return "binary"
}

function firstLine(content: string): string {
	const trimmed = content.trim()
	if (!trimmed) return ""
	const line =
		trimmed.split("\n").find((l) => {
			const t = l.trim()
			return t && !t.startsWith("---")
		}) ?? ""
	return line
		.replace(/^#+\s*/, "")
		.trim()
		.slice(0, 200)
}

/**
 * Produce a reader-friendly one-line summary for an artifact. For most
 * formats this is the first non-empty, non-frontmatter line. For HTML
 * (wireframes, mockups) we never want to show the literal `<!DOCTYPE>`
 * line — extract the `<title>` tag or the first visible text instead.
 */
function summaryFor(
	filename: string,
	content: string,
	explicitType?: string,
): string {
	const lower = filename.toLowerCase()
	const isHtml = explicitType === "html" || lower.endsWith(".html")
	if (isHtml) return htmlSummary(content)
	return firstLine(content)
}

function htmlSummary(content: string): string {
	if (!content) return ""
	const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
	if (titleMatch) {
		const title = titleMatch[1].replace(/\s+/g, " ").trim()
		if (title) return title.slice(0, 200)
	}
	// Fallback: strip <head> + tags, grab first chunk of visible text.
	const withoutHead = content.replace(/<head[\s\S]*?<\/head>/i, "")
	const visible = withoutHead
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
	return visible.slice(0, 200)
}
