// state/schemas/feedback.ts — v4 feedback frontmatter + tool input
// schemas.
//
// In v4 a feedback is a counter-signal against one or more approvals
// (or intent-scope when no unit is targeted). Closure invalidates the
// targeted approvals. Feedback lifecycle position is fully derived
// from `iterations[]` (running through the stage's `fix_hats:`) and
// `closed_at`. There is no `status` field. There is no `bolt` field.
// There is no `triaged_at`, no `closed_by`, no `resolution`, no
// `iteration`, no `visit`, no `replies`, no `integrator_attempts`.
//
// Engine-driven fields the agent must NEVER write directly:
//   - iterations  : append-only log of fix-hat dispatches
//   - closed_at   : stamped by terminal feedback-assessor advance
//
// Create-time fields (set once at haiku_feedback creation):
//   - title, body
//   - origin, author, author_type, created_at
//   - source_ref, inline_anchor, attachment
//   - targets.unit          : which unit this counter-signals
//                             (null/empty = intent-scope)
//   - targets.invalidates[] : which approval roles get cleared
//                             on closure (e.g. ["user", "code-reviewer"])
//
// `targets.unit` is set at create time and never changes. If the FB
// belongs to a different unit (the original placement was wrong),
// reject the FB and create a new one — don't move it. Slug-as-identity
// applies here too.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "./_ajv.js"

// ── Source-of-truth enum constants ───────────────────────────────────

const FEEDBACK_ORIGINS = [
	"adversarial-review",
	"studio-review",
	"engine-review",
	"drift",
	"discovery",
	"external-pr",
	"external-mr",
	"user-visual",
	"user-chat",
	"user-question",
	"user-revisit",
	"agent",
] as const

export type FeedbackOrigin = (typeof FEEDBACK_ORIGINS)[number]

// ── Severity ──────────────────────────────────────────────────────────
//
// Every finding carries a severity so the fix-loop can dispatch the
// findings that matter most first. Ordered most-to-least urgent:
//   blocker — stops the gate; must be fixed before the stage advances
//   high    — fix before delivery
//   medium  — should fix
//   low     — nice-to-have / nit
//
// Required on the agent-facing `haiku_feedback` create tool (review
// agents classify as they file). User-authored feedback (SPA / human
// path) lands WITHOUT severity — the classifier fix-hat backfills it via
// `haiku_feedback_set_severity`, the same way it backfills `targets`.

const FEEDBACK_SEVERITIES = ["blocker", "high", "medium", "low"] as const

export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number]

// Ordering rank — lower number = higher urgency, dispatched first.
// An unset/unknown severity (a freshly-filed user FB not yet classified)
// ranks alongside `medium` so it neither jumps ahead of real blockers nor
// gets starved behind every low.
export function feedbackSeverityRank(severity: unknown): number {
	switch (severity) {
		case "blocker":
			return 0
		case "high":
			return 1
		case "medium":
			return 2
		case "low":
			return 3
		default:
			return 2
	}
}

// ── Fix-loop activation threshold ─────────────────────────────────────
//
// A finding is "blocking" — it TRIGGERS a fix wave and HOLDS the stage
// gate — when its severity is at or above this threshold. Findings below
// it never trigger a wave on their own and never block the gate; they
// ride along (get swept) only when a blocking finding already forced a
// wave open. Override with HAIKU_FIX_SEVERITY_THRESHOLD
// (`blocker` | `high` | `medium` | `low`); default `high` (blocker + high
// block; medium + low ride along). Read at call time so tests + operators
// can flip it without a rebuild.
export function fixSeverityThresholdRank(): number {
	const raw = (process.env.HAIKU_FIX_SEVERITY_THRESHOLD || "high")
		.trim()
		.toLowerCase()
	return (FEEDBACK_SEVERITIES as readonly string[]).includes(raw)
		? feedbackSeverityRank(raw)
		: feedbackSeverityRank("high")
}

// Whether a finding triggers a fix wave / holds the gate. Unclassified
// findings (no severity yet — a user/SPA finding the classifier hasn't
// ranked) ALWAYS block: the classifier fix-hat has to run to assign a
// severity, and we can't know it's sub-threshold until it does. Agent-
// filed findings carry a severity from creation, so a reviewer's stream
// of `low`s is correctly non-blocking from the first tick.
export function isFixBlockingSeverity(severity: unknown): boolean {
	if (typeof severity !== "string" || severity.length === 0) return true
	return feedbackSeverityRank(severity) <= fixSeverityThresholdRank()
}

// FB-NN identifier shape — `FB-` followed by one or more digits, OR
// just digits (the handler accepts either).
export const FB_ID_PATTERN = "^(?:FB-)?\\d+$"

// ── Frontmatter shape (read-side, on-disk validation) ────────────────
//
// Reused by readFeedbackFiles to validate file frontmatter on read.
// Engine-driven fields are deny-listed via propertyNames; the create
// + close paths set them directly via setFrontmatterField, bypassing
// the schema's `additionalProperties` filter.

const FSM_DRIVEN_FB_FIELDS_LIST = ["iterations", "closed_at"] as const

const FB_TARGETS_SCHEMA = Type.Object(
	{
		unit: Type.Union([Type.String(), Type.Null()], {
			description:
				"Unit name this feedback targets (e.g. 'unit-03-business-context'). Null when the FB is intent-scope (no specific unit). Set at create time, immutable thereafter — to retarget, reject and create a new FB.",
		}),
		invalidates: Type.Array(Type.String(), {
			description:
				"Approval/review role keys to clear on the targeted unit when this FB closes. Examples: ['user'] (user re-review needed), ['code-reviewer', 'spec'] (those two reviewers re-sign), [] (no invalidation — closure is informational only). Default is the role of the FB's filer (e.g. user-chat → ['user'], adversarial-review → [<filer-agent-name>]).",
		}),
		reasoning: Type.Optional(
			Type.String({
				description:
					"Optional one-paragraph rationale for the classification choice. Set by the classifier fix-hat via haiku_feedback_set_targets when the FB lands without targets (typical of user-authored FBs). Surfaced in the SPA so reviewers can see why the classifier routed the way it did.",
			}),
		),
	},
	{ additionalProperties: false },
)

// closure_reply: { text, at } — set on the FB FM by the terminal
// fix-hat advance (haiku_feedback_advance_hat with isLast === true).
// The text is the agent's plain-language explanation of WHAT was done
// to address the FB. Surfaced in the SPA so the requester can see how
// their issue was handled, not just that it was. Paired with
// `closure_reply_unread` (boolean) so the SPA can filter for
// unacknowledged replies.
const FB_CLOSURE_REPLY_SCHEMA = Type.Object(
	{
		text: Type.String({ minLength: 1 }),
		at: Type.String(),
	},
	{ additionalProperties: false },
)

export const FEEDBACK_FRONTMATTER_SCHEMA = Type.Object(
	{
		title: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
		origin: Type.Optional(Type.String({ enum: [...FEEDBACK_ORIGINS] })),
		// Optional on the READ side: user-authored FBs land severity-less
		// until the classifier fix-hat backfills it. The agent-facing
		// create tool below requires it.
		severity: Type.Optional(Type.String({ enum: [...FEEDBACK_SEVERITIES] })),
		author: Type.Optional(Type.String()),
		author_type: Type.Optional(
			Type.String({ enum: ["agent", "human", "system"] }),
		),
		created_at: Type.Optional(Type.String()),
		source_ref: Type.Optional(Type.Union([Type.String(), Type.Null()])),
		attachment: Type.Optional(Type.String()),
		inline_anchor: Type.Optional(
			Type.Object({}, { additionalProperties: true }),
		),
		targets: Type.Optional(FB_TARGETS_SCHEMA),
		closure_reply: Type.Optional(FB_CLOSURE_REPLY_SCHEMA),
		closure_reply_unread: Type.Optional(Type.Boolean()),
	},
	{
		propertyNames: { not: { enum: [...FSM_DRIVEN_FB_FIELDS_LIST] } },
		additionalProperties: true,
	},
)

export type FeedbackFrontmatter = Static<typeof FEEDBACK_FRONTMATTER_SCHEMA>

// ── HAIKU_FEEDBACK_INPUT_SCHEMA — args for haiku_feedback (create) ───

// Inline-anchor shape — agents can attach a text excerpt to their
// feedback so the SPA flashes the underlying span when a reviewer
// clicks the card. Mirrors the FeedbackInlineAnchorSchema on the wire
// (haiku-api/src/schemas/feedback.ts) but uses the agent-facing
// camelCase that gets normalised to snake_case by writeFeedbackFile.
const HAIKU_FEEDBACK_INLINE_ANCHOR_SCHEMA = Type.Object(
	{
		selected_text: Type.String({
			minLength: 1,
			maxLength: 1000,
			description:
				"The literal text excerpt the feedback anchors to. The SPA greps the rendered artifact body for this string, so it must match the source verbatim (including whitespace inside the span).",
		}),
		paragraph: Type.Integer({
			minimum: 0,
			maximum: 10000,
			description:
				"Zero-based paragraph index in the rendered artifact body. Used as a tiebreaker when the same selected_text appears more than once.",
		}),
		location: Type.String({
			maxLength: 500,
			description:
				"Human-readable label rendered on the feedback card (e.g. 'Unit: Threat model and security hardening'). Display only — not used for routing.",
		}),
		comment_id: Type.Optional(
			Type.String({
				maxLength: 200,
				description:
					"Optional DOM id the SPA can scroll-to. Defaulted by the engine when omitted.",
			}),
		),
		file_path: Type.Optional(
			Type.String({
				maxLength: 1000,
				description:
					"Repo-relative path to the artifact file (e.g. .haiku/intents/<slug>/stages/<stage>/units/<name>.md). The SPA parses this to route to the right tab; agents can grep it for selected_text to land on the line.",
			}),
		),
		content_sha: Type.Optional(
			Type.String({
				maxLength: 64,
				description:
					"Optional sha of the artifact's raw body at the time of anchoring. The SPA uses it to paint stale highlights when the body has drifted since.",
			}),
		),
	},
	{ additionalProperties: false },
)

export const HAIKU_FEEDBACK_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1, description: "Intent slug" }),
		stage: Type.Optional(
			Type.String({
				description:
					"Stage name. Omit (or pass empty) to log an intent-scope finding.",
			}),
		),
		title: Type.String({
			minLength: 1,
			maxLength: 120,
			description: "Short title for the feedback item (max 120 chars).",
		}),
		body: Type.String({
			minLength: 1,
			description: "Markdown body describing the finding.",
		}),
		severity: Type.String({
			enum: [...FEEDBACK_SEVERITIES],
			description: `How urgent the finding is. REQUIRED — classify as you file. One of: ${FEEDBACK_SEVERITIES.join(" | ")}. blocker = stops the gate, fix first; high = fix before delivery; medium = should fix; low = nice-to-have / nit. The fix-loop dispatches higher-severity findings first.`,
		}),
		origin: Type.Optional(
			Type.String({
				enum: [...FEEDBACK_ORIGINS],
				description: `Source of the feedback. One of: ${FEEDBACK_ORIGINS.join(" | ")} (default: agent).`,
			}),
		),
		source_ref: Type.Optional(
			Type.String({
				description:
					"Optional reference — review-agent name, annotation ID, etc.",
			}),
		),
		author: Type.Optional(
			Type.String({
				description: "Who created it (default: agent).",
			}),
		),
		// Inline-anchor — optional. When present, the SPA flashes the
		// excerpt span on click so reviewers see exactly what the agent
		// was reacting to. Adversarial / studio-review hats should attach
		// one whenever the finding points at a specific line of an
		// artifact; intent-scope process feedback can omit it.
		inline_anchor: Type.Optional(HAIKU_FEEDBACK_INLINE_ANCHOR_SCHEMA),
		// targets — set at create time, immutable thereafter.
		// Both keys are optional at create time (defaulted by handler):
		// - target_unit: defaults to the active unit being reviewed (if
		//   the call comes from a review-agent subagent dispatched
		//   against unit-N) or null (intent-scope).
		// - target_invalidates: defaults to the role implied by origin —
		//   user-* origins → ["user"], drift → ["user"] (drift always
		//   escalates to user attention), agent / adversarial-review /
		//   studio-review → [] (these drive the fix-hat chain without
		//   needing user re-approval; leaving the approval slot intact
		//   keeps the existing audit trail).
		target_unit: Type.Optional(
			Type.Unsafe<string | null>({
				type: ["string", "null"],
				description:
					"Unit this feedback targets. Null/omitted for intent-scope. Immutable post-create.",
			}),
		),
		target_invalidates: Type.Optional(
			Type.Array(Type.String(), {
				description:
					"Approval/review role keys to clear on the targeted unit when this FB closes. Defaulted by handler from origin if omitted.",
			}),
		),
		state_file: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
)

export type HaikuFeedbackInput = Static<typeof HAIKU_FEEDBACK_INPUT_SCHEMA>

export const validateHaikuFeedbackInputSchema = stateAjv.compile(
	HAIKU_FEEDBACK_INPUT_SCHEMA,
)

// ── HAIKU_FEEDBACK_REJECT_INPUT_SCHEMA — args for haiku_feedback_reject ─
//
// Rejection is "close without invalidating anything." Equivalent to
// closure with targets.invalidates = []. Provided as its own tool for
// readability and so the reason is captured prominently. The handler
// stamps closed_at and writes a final iteration entry with reason.

export const HAIKU_FEEDBACK_REJECT_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		stage: Type.Optional(Type.String()),
		feedback_id: Type.String({ pattern: FB_ID_PATTERN }),
		reason: Type.String({
			minLength: 1,
			description:
				"Why the FB is being rejected. Persisted in the closing iteration's reason field.",
		}),
		state_file: Type.Optional(Type.String()),
	},
	{ additionalProperties: false },
)

export type HaikuFeedbackRejectInput = Static<
	typeof HAIKU_FEEDBACK_REJECT_INPUT_SCHEMA
>

export const validateHaikuFeedbackRejectInputSchema = stateAjv.compile(
	HAIKU_FEEDBACK_REJECT_INPUT_SCHEMA,
)

// ── Field-name reference constants ────────────────────────────────────

export const FSM_DRIVEN_FB_FIELDS = FSM_DRIVEN_FB_FIELDS_LIST

export const CREATE_TIME_FB_FIELDS = [
	"title",
	"origin",
	"severity",
	"author",
	"author_type",
	"created_at",
	"source_ref",
	"attachment",
	"inline_anchor",
	"targets",
] as const

export { FEEDBACK_ORIGINS, FEEDBACK_SEVERITIES }
