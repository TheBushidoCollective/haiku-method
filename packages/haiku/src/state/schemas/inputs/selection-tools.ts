// state/schemas/inputs/selection-tools.ts — TypeBox input schemas
// for the engine-controlled elicitation tools that drive the
// pre-stage chain: studio → mode → (quick? stage). All three follow
// the same shape (`intent` slug + optional `options[]` to narrow or
// auto-select), and per the schema-definitions rule each MCP tool
// input gets a real runtime-checked schema with the stable named
// error code `<toolName>_input_invalid` on miss.
//
// Pattern matches `units.ts` and `feedback-variants.ts` —
// `additionalProperties: false`, three exports per tool (schema,
// `Static<>` type, compiled validator).

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"

// ── haiku_select_studio ────────────────────────────────────────────
//
// First step in the pre-stage chain. Elicits which studio's lifecycle
// the intent will follow. `options` may narrow the picker; if the
// supplied options are a strict subset of available studios, the
// picker shows them plus a "Show all studios..." escape hatch.

export const HAIKU_SELECT_STUDIO_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({
			minLength: 1,
			description: "Intent slug. Required.",
		}),
		options: Type.Optional(
			Type.Array(Type.String(), {
				description:
					"Studio names to present in the picker. Empty/omitted = every available studio. Single element = auto-select without prompting.",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuSelectStudioInput = Static<
	typeof HAIKU_SELECT_STUDIO_INPUT_SCHEMA
>
export const validateHaikuSelectStudioInputSchema = stateAjv.compile(
	HAIKU_SELECT_STUDIO_INPUT_SCHEMA,
)

// ── haiku_select_mode ──────────────────────────────────────────────
//
// Second step in the pre-stage chain. Elicits the execution mode.
// Options are filtered by the tool against the intent's current
// state — `quick` is hidden once the intent has started a stage, and
// once an intent IS in `quick` and has started, no other mode is
// reachable (see `no_modes_available` error code in the handler).
// /haiku:change-mode drives mid-flight transitions through this
// same tool.

export const HAIKU_SELECT_MODE_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({
			minLength: 1,
			description: "Intent slug. Required.",
		}),
		options: Type.Optional(
			Type.Array(Type.String(), {
				description:
					"Mode names to present in the picker (continuous, discrete, autopilot, quick). Empty/omitted = every mode valid for the intent's current state. Single element = auto-select without prompting.",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuSelectModeInput = Static<typeof HAIKU_SELECT_MODE_INPUT_SCHEMA>
export const validateHaikuSelectModeInputSchema = stateAjv.compile(
	HAIKU_SELECT_MODE_INPUT_SCHEMA,
)

// ── haiku_select_stage ─────────────────────────────────────────────
//
// Third step in the pre-stage chain — fires only for `quick` mode,
// which is single-stage by definition. Refuses if mode is not quick
// (`mode_not_quick`), if a stage is already set (`stage_already_set`),
// or if more than one option is provided (`single_stage_required`).

export const HAIKU_SELECT_STAGE_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({
			minLength: 1,
			description: "Intent slug. Required.",
		}),
		options: Type.Optional(
			Type.Array(Type.String(), {
				description:
					"Stage name to auto-select (zero or one element — quick mode is single-stage by definition).",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuSelectStageInput = Static<
	typeof HAIKU_SELECT_STAGE_INPUT_SCHEMA
>
export const validateHaikuSelectStageInputSchema = stateAjv.compile(
	HAIKU_SELECT_STAGE_INPUT_SCHEMA,
)
