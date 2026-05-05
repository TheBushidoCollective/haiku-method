// state/schemas/intent.ts — TypeBox-defined schema for intent
// frontmatter shapes. Mirrors plugin/schemas/intent.schema.json.
// AJV-validated when an agent calls haiku_intent_set; the
// `propertyNames.not.enum` list rejects engine-only fields the
// workflow engine owns (status, active_stage, phase,
// completion_review_*, completed_at, etc).
//
// Parallel to UNIT_FRONTMATTER_SCHEMA — same SSOT pattern.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "./_ajv.js"

const FSM_DRIVEN_INTENT_FIELDS_LIST = [
	// Engine-managed lifecycle fields
	"status",
	"active_stage",
	"phase",
	"started_at",
	"completed_at",
	"created_at",
	// Mode is engine-managed: set via haiku_select_mode (with elicitation),
	// never via haiku_intent_create or haiku_intent_set. /haiku:change-mode
	// drives mid-flight changes through the same tool.
	"mode",
	// Completion-review state machine
	"completion_review_dispatched",
	"completion_review_skipped",
	"completion_review_entered_at",
	"completion_review_dispatched_at",
	// Engine-derived collections. `stages` is set by haiku_select_mode for
	// non-quick modes (full studio list) or haiku_select_stage for quick
	// (single-element allow-list). Never agent-set.
	"stages",
	"composite",
	"intent_reviewed",
	// Intent-scope gate session pointers (intent_review, intent_completion).
	// Stage-scope gates persist these on the stage's state.json instead.
	"gate_review_session_id",
	"gate_review_url",
	"gate_review_context",
	"gate_review_next_stage",
	"gate_review_next_phase",
	// Archive lifecycle (toggle via haiku_intent_archive / _unarchive)
	"archived",
	"archived_at",
	// Parent-link (creation-time only)
	"follows",
	// Legacy alias for mode
	"autopilot",
] as const

export const INTENT_MODES = [
	"continuous",
	"discrete",
	"autopilot",
	"discrete-hybrid",
	// `quick` operates like continuous but is single-stage (the agent
	// elicits which stage). Promotes the prior /haiku:quick skill into
	// a real mode value so validation + transitions are uniform.
	"quick",
] as const

export type IntentMode = (typeof INTENT_MODES)[number]

export const INTENT_FRONTMATTER_SCHEMA = Type.Object(
	{
		title: Type.Optional(Type.String({ minLength: 1 })),
		// `mode` is now engine-managed (in FSM_DRIVEN list) but stays
		// accepted by the AJV schema so test fixtures and on-disk reads
		// still validate. Direct agent writes are rejected by the
		// haiku_intent_set handler with `intent_field_engine_only`.
		mode: Type.Optional(Type.String({ enum: [...INTENT_MODES] })),
		skip_stages: Type.Optional(Type.Array(Type.String())),
		intent_completion_review: Type.Optional(Type.Boolean()),
		// `studio` is set on creation by haiku_select_studio and is
		// immutable thereafter — accepted by AJV (so tests building
		// fixtures don't fail) but rejected by the haiku_intent_set
		// handler with a dedicated `intent_field_immutable` code.
		studio: Type.Optional(Type.String()),
	},
	{
		propertyNames: { not: { enum: [...FSM_DRIVEN_INTENT_FIELDS_LIST] } },
		additionalProperties: true,
	},
)

export type IntentFrontmatter = Static<typeof INTENT_FRONTMATTER_SCHEMA>

export const validateIntentFrontmatterSchema = stateAjv.compile(
	INTENT_FRONTMATTER_SCHEMA,
)

export const AGENT_AUTHORABLE_INTENT_FIELDS = Object.keys(
	INTENT_FRONTMATTER_SCHEMA.properties ?? {},
) as ReadonlyArray<string>

export const FSM_DRIVEN_INTENT_FIELDS = FSM_DRIVEN_INTENT_FIELDS_LIST

/** Fields immutable after intent creation (handler-rejected, not
 *  schema-rejected — AJV accepts them so test fixtures still build). */
export const INTENT_IMMUTABLE_FIELDS: ReadonlyArray<string> = ["studio"]
