// state/schemas/inputs/studio-reads.ts — TypeBox input schemas for the
// studio-definition read tools (haiku_read_hat / haiku_read_stage).
//
// These resolve a studio definition through the project→plugin override
// cascade and return the FM-stripped body, so a dispatch prompt can
// instruct the agent to read a hat mandate or stage scope with a
// straight tool call (FM stripped, project `.haiku/` overrides honored)
// rather than an inlined snapshot.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"

// ── haiku_read_hat ──────────────────────────────────────────────────

export const HAIKU_READ_HAT_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.String({ minLength: 1, description: "Studio name" }),
		stage: Type.String({ minLength: 1, description: "Stage name" }),
		hat: Type.String({ minLength: 1, description: "Hat name" }),
		fix: Type.Optional(
			Type.Boolean({
				description:
					"When true, resolve the fix-loop-scoped mandate (stages/<stage>/fix-hats/<hat>.md, falling back to the production hats/<hat>.md when absent). Use ONLY from fix-loop dispatches; omit for production hat work.",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuReadHatInput = Static<typeof HAIKU_READ_HAT_INPUT_SCHEMA>
export const validateHaikuReadHatInputSchema = stateAjv.compile(
	HAIKU_READ_HAT_INPUT_SCHEMA,
)

// ── haiku_read_stage ────────────────────────────────────────────────

export const HAIKU_READ_STAGE_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.String({ minLength: 1, description: "Studio name" }),
		stage: Type.String({ minLength: 1, description: "Stage name" }),
	},
	{ additionalProperties: false },
)
export type HaikuReadStageInput = Static<typeof HAIKU_READ_STAGE_INPUT_SCHEMA>
export const validateHaikuReadStageInputSchema = stateAjv.compile(
	HAIKU_READ_STAGE_INPUT_SCHEMA,
)
