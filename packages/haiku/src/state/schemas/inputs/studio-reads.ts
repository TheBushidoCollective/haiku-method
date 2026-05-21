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

// ── haiku_read_intent ───────────────────────────────────────────────
// NOT a studio asset — the live intent body (`.haiku/intents/<slug>/
// intent.md`), which the workflow hook guards against generic Read.
// Grouped here with the other FM-stripping reads the prompts call.

export const HAIKU_READ_INTENT_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1, description: "Intent slug" }),
	},
	{ additionalProperties: false },
)
export type HaikuReadIntentInput = Static<typeof HAIKU_READ_INTENT_INPUT_SCHEMA>
export const validateHaikuReadIntentInputSchema = stateAjv.compile(
	HAIKU_READ_INTENT_INPUT_SCHEMA,
)

// ── haiku_read_review_agent ─────────────────────────────────────────

export const HAIKU_READ_REVIEW_AGENT_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.String({ minLength: 1, description: "Studio name" }),
		stage: Type.Optional(
			Type.String({
				minLength: 1,
				description:
					"Stage name for a stage-scope review/approval agent. OMIT for an intent-completion review agent (resolved from the studio's intent-review-agents/).",
			}),
		),
		role: Type.String({ minLength: 1, description: "Review-agent role name" }),
	},
	{ additionalProperties: false },
)
export type HaikuReadReviewAgentInput = Static<
	typeof HAIKU_READ_REVIEW_AGENT_INPUT_SCHEMA
>
export const validateHaikuReadReviewAgentInputSchema = stateAjv.compile(
	HAIKU_READ_REVIEW_AGENT_INPUT_SCHEMA,
)

// ── haiku_read_discovery ────────────────────────────────────────────

export const HAIKU_READ_DISCOVERY_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.String({ minLength: 1, description: "Studio name" }),
		stage: Type.String({ minLength: 1, description: "Stage name" }),
		template: Type.String({
			minLength: 1,
			description: "Discovery template name (no .md extension)",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuReadDiscoveryInput = Static<
	typeof HAIKU_READ_DISCOVERY_INPUT_SCHEMA
>
export const validateHaikuReadDiscoveryInputSchema = stateAjv.compile(
	HAIKU_READ_DISCOVERY_INPUT_SCHEMA,
)

// ── haiku_read_phase ────────────────────────────────────────────────

export const HAIKU_READ_PHASE_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.String({ minLength: 1, description: "Studio name" }),
		stage: Type.String({ minLength: 1, description: "Stage name" }),
		phase: Type.String({
			minLength: 1,
			description:
				"Phase name (e.g. ELABORATION, EXECUTION). Case-insensitive — resolved as phases/<PHASE>.md.",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuReadPhaseInput = Static<typeof HAIKU_READ_PHASE_INPUT_SCHEMA>
export const validateHaikuReadPhaseInputSchema = stateAjv.compile(
	HAIKU_READ_PHASE_INPUT_SCHEMA,
)

// ── haiku_read_output ───────────────────────────────────────────────

export const HAIKU_READ_OUTPUT_INPUT_SCHEMA = Type.Object(
	{
		studio: Type.String({ minLength: 1, description: "Studio name" }),
		stage: Type.String({ minLength: 1, description: "Stage name" }),
		name: Type.String({
			minLength: 1,
			description: "Output template name (no .md extension)",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuReadOutputInput = Static<typeof HAIKU_READ_OUTPUT_INPUT_SCHEMA>
export const validateHaikuReadOutputInputSchema = stateAjv.compile(
	HAIKU_READ_OUTPUT_INPUT_SCHEMA,
)
