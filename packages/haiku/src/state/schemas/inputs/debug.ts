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
	"set_unit_iterations",
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
				description:
					"Feedback ID to mutate (mutate_feedback). For batch mutations, use feedback_ids instead.",
			}),
		),
		feedback_ids: Type.Optional(
			Type.Array(Type.String(), {
				description:
					"Batch form of feedback_id — array of FB IDs to mutate in a single call (mutate_feedback). The same `patch` is applied to every FB in the list. Use this instead of firing the picker confirmation per-FB.",
			}),
		),
		patch: Type.Optional(
			Type.Object(
				{},
				{
					additionalProperties: true,
					description:
						"FB FM keys to set (mutate_feedback). Example: { closed_at: '2026-...', closed_by: 'manual_review' }.",
				},
			),
		),
		fields: Type.Optional(
			Type.Object(
				{},
				{
					additionalProperties: true,
					description:
						"Batch form of field/value — object of intent.md FM keys to set in a single call (set_intent_field). Example: { mode: 'autopilot', archived: false }.",
				},
			),
		),
		close_open_feedback: Type.Optional(
			Type.Boolean({
				description:
					'force_stage_complete only. When true, also stamps `closed_at` + `closed_by: "force_complete"` on every open FB on the targeted stages (and on intent scope when the final stage is the target). Open FBs otherwise continue blocking the cursor even after every approval is signed.',
			}),
		),
		unit: Type.Optional(
			Type.String({
				description:
					"Unit slug or filename stem (set_unit_iterations). Example: 'unit-03-my-thing' or 'unit-03'.",
			}),
		),
		iterations: Type.Optional(
			Type.Array(
				Type.Object(
					{
						hat: Type.String({ minLength: 1 }),
						result: Type.String({ enum: ["advance", "reject"] }),
						at: Type.Optional(Type.String()),
					},
					{ additionalProperties: true },
				),
				{
					description:
						"Explicit iterations[] array to write (set_unit_iterations). Omit to auto-synthesize one `advance` entry per hat in the stage's `hats:` sequence — the typical recovery shape when a legacy unit has no iterations but its outputs landed.",
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
