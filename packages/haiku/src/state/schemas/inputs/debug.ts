// state/schemas/inputs/debug.ts — TypeBox input schema for haiku_debug.
//
// Single source of truth for the MCP advertisement (`tool-defs.ts`) and
// the handler dispatch (`tools/orchestrator/haiku_debug.ts`). Earlier
// versions duplicated the schema verbatim in both files; the schema-sync
// contract test still asserts handler/def parity, but having one source
// removes the manual-sync foot-gun.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"

export const HAIKU_DEBUG_SUPPORTED_OPS = [
	"force_stage_complete",
	"set_intent_field",
	"reset_drift",
	"mutate_feedback",
	"preview_cursor",
] as const

export const HAIKU_DEBUG_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1, description: "Intent slug" }),
		op: Type.String({
			enum: [...HAIKU_DEBUG_SUPPORTED_OPS],
			description:
				"Which admin op to run: force_stage_complete, set_intent_field, reset_drift, mutate_feedback, preview_cursor.",
		}),
		stage: Type.Optional(
			Type.String({
				description: "Target stage (force_stage_complete, mutate_feedback).",
			}),
		),
		field: Type.Optional(
			Type.String({
				description: "intent.md FM key (set_intent_field).",
			}),
		),
		// Multi-type value field for set_intent_field. `Type.Unsafe` lets us
		// emit the JSONSchema `type: [...]` array form (which the per-property
		// "must have a type" assertion in server-tools.test.mjs requires) while
		// keeping `Static<>` flowing.
		value: Type.Optional(
			Type.Unsafe<unknown>({
				type: ["string", "array", "number", "boolean", "null", "object"],
				description: "intent.md FM value (set_intent_field).",
			}),
		),
		feedback_id: Type.Optional(
			Type.String({
				description: "Feedback ID to mutate (mutate_feedback).",
			}),
		),
		patch: Type.Optional(
			Type.Object(
				{},
				{
					additionalProperties: true,
					description:
						"FB FM keys to set (mutate_feedback). Example: { status: 'closed', closed_at: '2026-...' }.",
				},
			),
		),
	},
	{ additionalProperties: false },
)
export type HaikuDebugInput = Static<typeof HAIKU_DEBUG_INPUT_SCHEMA>
export const validateHaikuDebugInputSchema = stateAjv.compile(
	HAIKU_DEBUG_INPUT_SCHEMA,
)
