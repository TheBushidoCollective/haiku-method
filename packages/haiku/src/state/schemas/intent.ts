// state/schemas/intent.ts — JSONSchema source-of-truth for intent
// frontmatter shapes. Mirrors plugin/schemas/intent.schema.json.
// AJV-validated when an agent calls haiku_intent_set; the
// `propertyNames.not.enum` list rejects engine-only fields the
// workflow engine owns (status, active_stage, phase,
// completion_review_*, completed_at, etc).
//
// Parallel to UNIT_FRONTMATTER_SCHEMA — same SSOT pattern.

import { stateAjv } from "./_ajv.js"

export const INTENT_FRONTMATTER_SCHEMA = {
	type: "object",
	properties: {
		title: { type: "string", minLength: 1 },
		mode: {
			type: "string",
			enum: ["continuous", "discrete", "autopilot", "discrete-hybrid"],
		},
		skip_stages: { type: "array", items: { type: "string" } },
		intent_completion_review: { type: "boolean" },
		// `studio` is set on creation by haiku_select_studio and is
		// immutable thereafter — accepted by AJV (so tests building
		// fixtures don't fail) but rejected by the haiku_intent_set
		// handler with a dedicated `intent_field_immutable` code.
		studio: { type: "string" },
	},
	propertyNames: {
		not: {
			enum: [
				// Engine-managed lifecycle fields
				"status",
				"active_stage",
				"phase",
				"started_at",
				"completed_at",
				"created_at",
				// Completion-review state machine
				"completion_review_dispatched",
				"completion_review_skipped",
				"completion_review_entered_at",
				"completion_review_dispatched_at",
				// Engine-derived collections
				"stages",
				"composite",
				"intent_reviewed",
				// Archive lifecycle (toggle via haiku_intent_archive / _unarchive)
				"archived",
				"archived_at",
				// Parent-link (creation-time only)
				"follows",
				// Legacy alias for mode
				"autopilot",
			],
		},
	},
	additionalProperties: true,
}

export const validateIntentFrontmatterSchema = stateAjv.compile(
	INTENT_FRONTMATTER_SCHEMA,
)

export const AGENT_AUTHORABLE_INTENT_FIELDS = Object.keys(
	INTENT_FRONTMATTER_SCHEMA.properties,
) as ReadonlyArray<string>

export const FSM_DRIVEN_INTENT_FIELDS = INTENT_FRONTMATTER_SCHEMA.propertyNames
	.not.enum as ReadonlyArray<string>

/** Fields immutable after intent creation (handler-rejected, not
 *  schema-rejected — AJV accepts them so test fixtures still build). */
export const INTENT_IMMUTABLE_FIELDS: ReadonlyArray<string> = ["studio"]
