/**
 * Shared parsing helpers consumed by both `gitlab-provider.ts` and
 * `github-provider.ts`. Each VCS provider exposes its own API surface
 * for fetching content, but once content is in hand the parsing rules
 * are identical — single source of truth lives here so the two
 * providers can't drift on what an "intent" or "stage" looks like.
 */

import {
	type DerivedUnitView,
	deriveStageStatePure,
} from "@haiku/shared/derived-stage-state"
import type {
	HaikuArtifact,
	HaikuFeedback,
	HaikuIntent,
	HaikuKnowledgeFile,
} from "./types"
import { normalizeIntentStatus, parseFrontmatter } from "./types"

/** Map a filename to the artifact-type the SPA renders. */
export function classifyArtifact(name: string): HaikuArtifact["type"] {
	const lower = name.toLowerCase()
	if (lower.endsWith(".md")) return "markdown"
	if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html"
	if (/\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/.test(lower)) return "image"
	return "other"
}

/** Parsed `state.json` slice the providers attach to each stage. */
export interface StageStateJson {
	phase: string
	startedAt: string | null
	completedAt: string | null
	gateOutcome: string | null
	/** Raw `status` field from state.json — authoritative source for stage
	 *  status when present (written by the orchestrator on the stage branch).
	 *  Providers prefer this over the `active_stage` field in intent.md,
	 *  which may lag for the first stage or when the intent branch hasn't
	 *  been updated yet. */
	stateStatus: "active" | "completed" | null
}

export const EMPTY_STAGE_STATE: StageStateJson = {
	phase: "",
	startedAt: null,
	completedAt: null,
	gateOutcome: null,
	stateStatus: null,
}

/** Decode a stage's `state.json` text. Returns the empty default when
 *  the JSON is missing or malformed — the caller still renders the
 *  stage, just without status detail. */
export function parseStageStateJson(
	rawJson: string | null | undefined,
): StageStateJson {
	if (!rawJson) return EMPTY_STAGE_STATE
	try {
		const s = JSON.parse(rawJson) as Record<string, unknown>
		const rawStatus = typeof s.status === "string" ? s.status : null
		const stateStatus: "active" | "completed" | null =
			rawStatus === "active"
				? "active"
				: rawStatus === "completed"
					? "completed"
					: null
		return {
			phase: typeof s.phase === "string" ? s.phase : "",
			startedAt: typeof s.started_at === "string" ? s.started_at : null,
			completedAt: typeof s.completed_at === "string" ? s.completed_at : null,
			gateOutcome: typeof s.gate_outcome === "string" ? s.gate_outcome : null,
			stateStatus,
		}
	} catch {
		return EMPTY_STAGE_STATE
	}
}

/** Merge knowledge files — overlay wins on filename collision, new
 *  files are added. Used to layer per-branch knowledge on top of
 *  default-branch knowledge. */
export function mergeKnowledge(
	base: HaikuKnowledgeFile[],
	overlay: HaikuKnowledgeFile[],
): HaikuKnowledgeFile[] {
	const byName = new Map<string, HaikuKnowledgeFile>()
	for (const f of base) byName.set(f.name, f)
	for (const f of overlay) byName.set(f.name, f)
	return Array.from(byName.values())
}

/** Optional branch / PR metadata attached when an intent was loaded
 *  from a haiku/<slug>/main branch (or a PR/MR linked to it). */
export interface IntentRefMeta {
	branch?: string
	prUrl?: string | null
	prStatus?: string | null
	prNumber?: number | null
}

/**
 * Detect whether the intent was written under the v4 schema.
 *
 * v4 stamps `plugin_version: "4.x.y"` on intent.md. Pre-v4 (the
 * "v3" schema in the migrator's terminology) has no plugin_version
 * field. The detection is used to swap parsing strategy without
 * breaking pre-migration data: v3 reads `active_stage` / `status` /
 * `phase` directly, v4 derives the same logical values from
 * `sealed_at` and (eventually) per-unit iterations[].
 */
function isV4Intent(data: Record<string, unknown>): boolean {
	const ver = data.plugin_version
	if (typeof ver !== "string") return false
	const major = Number.parseInt(ver.split(".")[0] ?? "", 10)
	return Number.isFinite(major) && major >= 4
}

/** Parse raw `intent.md` text into a `HaikuIntent`. Identical between
 *  GitLab + GitHub; the only provider-specific input is the string
 *  passed to `parseFrontmatter`'s `provider` arg (used for telemetry
 *  on malformed-frontmatter recovery). Malformed frontmatter recovers
 *  to empty data so a broken intent still appears in the list (title
 *  falls back to slug) instead of silently disappearing. */
export function parseIntentFromRaw(
	provider: "gitlab" | "github" | "local",
	slug: string,
	rawText: string,
	meta?: IntentRefMeta,
): HaikuIntent {
	const { data, content } = parseFrontmatter(rawText, {
		provider,
		path: `.haiku/intents/${slug}/intent.md`,
		slug,
		branch: meta?.branch,
	})
	const studio = (data.studio as string) || "ideation"
	const stages = (data.stages as string[]) || []

	// v4 dual-path:
	//   - active_stage was removed → without per-unit iterations[]
	//     visibility from the intent-list call, default to the first
	//     declared stage. Per-stage status drilldown still happens via
	//     deriveStageStatusFromUnits() during the detail load.
	//   - intent status: sealed_at → completed; else active.
	//   - completed_at proxy: sealed_at when present.
	//   - composite: removed entirely under v4 (intents are flat).
	const v4 = isV4Intent(data)
	const activeStage = v4
		? // v4: no stored active_stage; the detail loader will refine
			// the cursor position per-stage. List view defaults to first
			// declared stage so the chrome doesn't render blank.
			(stages[0] as string) || ""
		: (data.active_stage as string) || ""
	const sealedAt = v4 ? (data.sealed_at as string) || null : null
	const v3Status = (data.status as string) || ""
	const computedStatus = v4
		? sealedAt
			? "completed"
			: "active"
		: v3Status || "active"
	const completedAtForStatus = v4
		? sealedAt
		: (data.completed_at as string) || null
	const composite = v4
		? null
		: (data.composite as Array<{ studio: string; stages: string[] }>) || null

	return {
		slug,
		title: (data.title as string) || slug,
		studio,
		activeStage,
		mode: (data.mode as string) || "continuous",
		createdAt: (data.created_at as string) || (data.created as string) || null,
		startedAt: (data.started_at as string) || null,
		completedAt: completedAtForStatus,
		studioStages: (data.stages as string[]) || [],
		composite,
		...normalizeIntentStatus(
			computedStatus,
			completedAtForStatus,
			stages.length > 0 ? stages.indexOf(activeStage) : 0,
			stages.length,
		),
		stagesTotal: stages.length,
		archived: data.archived === true,
		follows: (data.follows as string) || null,
		content,
		raw: data,
		branch: meta?.branch,
		prUrl: meta?.prUrl ?? null,
		prStatus: meta?.prStatus ?? null,
		prNumber: meta?.prNumber ?? null,
	}
}

/**
 * Refine the v4 active stage by walking stages in declaration order
 * and returning the first stage whose unit set isn't fully complete.
 * If all stages are complete, returns the last declared stage (the
 * intent is awaiting seal). Falls back to stages[0] when no per-stage
 * derivation is possible.
 *
 * Mirrors the SPA's `resolveActiveStage` derivation. The list view
 * (which doesn't load units) can't call this; the detail view does.
 */
export function deriveV4ActiveStage(
	stages: ReadonlyArray<string>,
	stageStatusByName: Record<string, "pending" | "active" | "complete">,
): string {
	if (stages.length === 0) return ""
	for (const s of stages) {
		const status = stageStatusByName[s]
		if (status !== "complete") return s
	}
	// Every stage is "complete" — the cursor will seal next. Surface
	// the last declared stage so the chrome doesn't render blank.
	return stages[stages.length - 1] ?? ""
}

/**
 * Derive a stage's "v3-style" status from its unit list. Delegates to
 * `deriveStageStatePure` — the same function the MCP engine calls so
 * the cursor walk and the browse UI cannot drift on what "completed"
 * means. The pure function returns the v4 shape (`completed`); we map
 * to the website's existing wire vocabulary (`complete`).
 *
 * Inputs the website doesn't have here:
 *   - `hats` is unknown at provider load time (the SPA doesn't fetch
 *     STAGE.md). Pass empty array — the terminal-hat check is
 *     skipped, matching the website's previous "any terminal advance"
 *     behavior.
 *   - `approvalRoles: ["user"]` mirrors the website's previous
 *     "user-approval signed = complete" semantic without having to
 *     load review-agent metadata over the API.
 *   - `stageMergedIntoMain` is unknown at this layer; pass null so
 *     the function falls back to per-unit completion derivation.
 *   - `elaborationVerified` defaults to null (grandfathered).
 *
 * The "completed" → "complete" remapping mirrors the v3 wire shape
 * the SPA components were built against.
 */
/**
 * Parse a feedback `.md` file into a `HaikuFeedback`. Mirrors the v4 FB
 * frontmatter shape from `packages/haiku/src/state/schemas/feedback.ts`
 * but trimmed to the fields the browse UI surfaces. The body of the FB
 * file is the markdown content after the YAML fence.
 *
 * `id` is derived from the filename (e.g. "FB-03-bad-copy.md" →
 * "FB-03-bad-copy") so links and keys stay stable even when the FM is
 * sparse (early-state human FBs frequently land with just title+body).
 */
export function parseFeedback(
	provider: "gitlab" | "github" | "local",
	slug: string,
	stageName: string | null,
	fileName: string,
	raw: string,
	path: string,
): HaikuFeedback {
	const { data, content } = parseFrontmatter(raw, {
		provider,
		path,
		slug,
		branch: undefined,
	})
	const id = fileName.replace(/\.md$/, "")
	const targets = (data.targets as Record<string, unknown> | undefined) ?? {}
	const closureReplyRaw = data.closure_reply as
		| { text?: unknown; at?: unknown }
		| undefined
	const closureReply =
		closureReplyRaw &&
		typeof closureReplyRaw.text === "string" &&
		typeof closureReplyRaw.at === "string"
			? { text: closureReplyRaw.text, at: closureReplyRaw.at }
			: null
	const authorTypeRaw = data.author_type
	const authorType: "agent" | "human" | "system" | null =
		authorTypeRaw === "agent" ||
		authorTypeRaw === "human" ||
		authorTypeRaw === "system"
			? authorTypeRaw
			: null
	// Resolution drives the cursor's routing. Surfaced here so the SPA
	// can label each FB with how the engine will act on it next tick.
	const resolutionRaw = data.resolution
	const resolution:
		| "question"
		| "inline_fix"
		| "stage_revisit"
		| null =
		resolutionRaw === "question" ||
		resolutionRaw === "inline_fix" ||
		resolutionRaw === "stage_revisit"
			? resolutionRaw
			: null
	// stage scope unused here but kept in the signature so providers can
	// disambiguate intent vs stage scope when constructing the path —
	// the field is reserved for future per-scope rendering.
	void stageName
	return {
		id,
		title: typeof data.title === "string" ? data.title : null,
		origin: typeof data.origin === "string" ? data.origin : null,
		author: typeof data.author === "string" ? data.author : null,
		authorType,
		body: content,
		unit: typeof targets.unit === "string" ? targets.unit : null,
		invalidates: Array.isArray(targets.invalidates)
			? (targets.invalidates as unknown[]).filter(
					(x): x is string => typeof x === "string",
				)
			: [],
		closedAt: typeof data.closed_at === "string" ? data.closed_at : null,
		createdAt: typeof data.created_at === "string" ? data.created_at : null,
		closureReply,
		closureReplyUnread: data.closure_reply_unread === true,
		resolution,
		path,
		raw: data,
	}
}

/** Read intent-scope approval roles from `intent.md` frontmatter. The
 *  engine writes `approvals.<role>` slots when the corresponding
 *  intent-completion gate fires (see
 *  `packages/haiku/src/orchestrator/workflow/handlers/intent-completion.ts`).
 *  Role keys observed in production: `spec`, `continuity`, `user`,
 *  `intent_quality_gates`, plus any studio-defined intent-review
 *  agents. We surface the role list with a `signed: boolean` so the
 *  browse UI can render the "X of Y signed" line and mark
 *  `intent_quality_gates` as derived. */
export function parseIntentApprovals(
	raw: Record<string, unknown>,
): Array<{ role: string; signed: boolean; at: string | null }> {
	const approvals = raw.approvals
	if (!approvals || typeof approvals !== "object" || Array.isArray(approvals)) {
		return []
	}
	const out: Array<{ role: string; signed: boolean; at: string | null }> = []
	for (const [role, record] of Object.entries(
		approvals as Record<string, unknown>,
	)) {
		if (record && typeof record === "object" && !Array.isArray(record)) {
			const r = record as Record<string, unknown>
			const at = typeof r.at === "string" ? r.at : null
			out.push({ role, signed: at !== null, at })
		} else {
			out.push({ role, signed: false, at: null })
		}
	}
	return out
}

/**
 * Pick the active-stage candidate for v4 intents in the list view, where
 * per-unit FM isn't loaded. Walks the supplied `stages` (declaration
 * order) and returns the LAST one whose `stagesWithUnits` set has it —
 * i.e. the latest stage the agent has actually touched (created at least
 * one unit file in `units/`). When no stage has units yet, falls back to
 * `stages[0]` so the chrome doesn't render blank.
 *
 * Intentionally cheap: providers feed the set from a single tree-list
 * call, no per-file reads.
 */
export function deriveActiveStageFromStageTree(
	stages: ReadonlyArray<string>,
	stagesWithUnits: ReadonlySet<string>,
): string {
	if (stages.length === 0) return ""
	let last: string | null = null
	for (const s of stages) {
		if (stagesWithUnits.has(s)) last = s
	}
	return last ?? stages[0] ?? ""
}

/** Derive a stage's `{ status, phase }` pair from per-unit FM. Single
 *  call so callers can keep the engine's status + phase coherent (the
 *  pure derivation enforces "phase is null when status is completed",
 *  for example).
 *
 *  `intentMode` defaults to `"continuous"` only as a safety net for
 *  pre-2026-05-14 callers that hadn't started threading mode through
 *  yet — production callers should always pass the actual intent mode
 *  read from intent.md so autopilot intents derive the correct phase
 *  (autopilot bypasses elaborate-verifier signals).
 *
 *  `elaborationVerified` is the tri-state from
 *  `parseElaborationVerified` — pass `null` when the elaboration.md
 *  file wasn't fetched (the cursor's grandfather case applies and the
 *  derivation falls through to decompose / execute logic).
 *
 *  Status remap: the pure function returns the v4 vocabulary
 *  (`completed`); the website's wire shape uses `complete`. We map
 *  here so callers keep the existing string. */
export function deriveStageStateFromUnits(
	units: ReadonlyArray<{ raw: Record<string, unknown> }>,
	options: {
		stage?: string
		intentMode?: string
		elaborationVerified?: boolean | null
	} = {},
): {
	status: "pending" | "active" | "complete"
	phase: "elaborate" | "execute" | "review" | "approve" | "complete" | ""
} {
	const unitViews: DerivedUnitView[] = units.map((u, i) => ({
		name: `u${i}`,
		fm: u.raw,
	}))
	const derived = deriveStageStatePure({
		stage: options.stage ?? "",
		units: unitViews,
		intentMode: options.intentMode ?? "continuous",
		approvalRoles: ["user"],
		elaborationVerified: options.elaborationVerified ?? null,
	})
	const status: "pending" | "active" | "complete" =
		derived.status === "completed" ? "complete" : derived.status
	// Map the derivation's per-stage phase to the canonical 5-phase
	// model the engine emits (ARCHITECTURE.md §2.1). The pure function
	// still returns the legacy "gate" name for the post-review,
	// pre-merge slot; rename it to "approve" so the website matches the
	// SPA's canonical pill set. A `null` phase from `deriveStageStatePure`
	// means the stage is past every approval — that's `complete`.
	let phase: "elaborate" | "execute" | "review" | "approve" | "complete" | "" =
		""
	if (status === "complete") {
		phase = "complete"
	} else if (derived.phase === "gate") {
		phase = "approve"
	} else if (derived.phase) {
		phase = derived.phase
	}
	return { status, phase }
}

/** Back-compat wrapper for the historical signature — returns just the
 *  status. New callers should use `deriveStageStateFromUnits` so the
 *  phase is also surfaced. Kept for the test suite + any not-yet-
 *  migrated caller; remove once the migration is complete. */
export function deriveStageStatusFromUnits(
	units: ReadonlyArray<{ raw: Record<string, unknown> }>,
	stage = "",
): "pending" | "active" | "complete" {
	return deriveStageStateFromUnits(units, { stage }).status
}

/** Read `verified_at` off an `elaboration.md` raw text. Returns:
 *    - `true`  when the file exists AND `verified_at` is non-empty
 *    - `false` when the file exists but `verified_at` is missing/empty
 *    - `null`  when the file is missing entirely
 *
 *  The tri-state matches `deriveStageStatePure`'s `elaborationVerified`
 *  contract — the cursor uses the same shape to decide whether the
 *  elaborate gate fires. */
export function parseElaborationVerified(
	rawText: string | null | undefined,
): boolean | null {
	if (!rawText) return null
	try {
		const { data } = parseFrontmatter(rawText, {
			provider: "github",
			path: "elaboration.md",
			slug: "",
		})
		const verified = data.verified_at
		return typeof verified === "string" && verified.length > 0
	} catch {
		return null
	}
}
