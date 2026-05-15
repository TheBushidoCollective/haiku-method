// state/schemas/inputs/stages.ts — TypeBox input schemas for the
// haiku_stage_* tool family.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"

const stateFile = Type.Optional(Type.String())

// ── haiku_stage_elaboration_record ──────────────────────────────────
//
// Captures the per-stage human-conversation outcome on disk at
// `stages/<stage>/elaboration.md`. Called by the agent when the
// conversation reaches alignment. Overwrites any existing file —
// re-runs after a verifier rejection clear the prior `verified_at`
// stamp by replacing the artifact wholesale.

export const HAIKU_STAGE_ELABORATION_RECORD_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1, description: "Intent slug" }),
		stage: Type.String({ minLength: 1, description: "Stage name" }),
		body: Type.String({
			minLength: 1,
			description:
				"Markdown body of the captured conversation. Should summarize what the agent proposed, what the user clarified, and the final agreement. Anchored on specific intent content.",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuStageElaborationRecordInput = Static<
	typeof HAIKU_STAGE_ELABORATION_RECORD_INPUT_SCHEMA
>
export const validateHaikuStageElaborationRecordInputSchema = stateAjv.compile(
	HAIKU_STAGE_ELABORATION_RECORD_INPUT_SCHEMA,
)

// ── haiku_stage_elaboration_seal ────────────────────────────────────
//
// Verifier-only. Stamps `verified_at: <ISO timestamp>` on the
// elaboration artifact's frontmatter, signaling to the cursor that
// the conversation passed substance review.
//
// Enforcement: the seal tool requires a `nonce` minted by the cursor
// when it emitted the `elaborate_review` action that dispatched the
// verifier. The nonce lives in `.haiku/intents/<slug>/.verifier-nonces.json`
// and is consumed (deleted) on a successful seal. A confused or
// adversarial agent that calls this tool without the nonce — or with
// the wrong nonce — gets `verifier_nonce_invalid` back. The nonce is
// tied to the elaboration artifact's `recorded_at`, so re-recording
// invalidates an in-flight verifier's stale nonce.

export const HAIKU_STAGE_ELABORATION_SEAL_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1, description: "Intent slug" }),
		stage: Type.String({ minLength: 1, description: "Stage name" }),
		nonce: Type.String({
			minLength: 1,
			description:
				"Verifier nonce minted by the cursor when emitting the `elaborate_review` action. Surfaced on the action payload as `verifier_nonce`. Single-use: consumed by the seal tool on success.",
		}),
		notes: Type.Optional(
			Type.String({
				description:
					"Optional verifier notes recorded as the seal's rationale. Stored on FM as `verified_notes`.",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuStageElaborationSealInput = Static<
	typeof HAIKU_STAGE_ELABORATION_SEAL_INPUT_SCHEMA
>
export const validateHaikuStageElaborationSealInputSchema = stateAjv.compile(
	HAIKU_STAGE_ELABORATION_SEAL_INPUT_SCHEMA,
)

// ── haiku_stage_decompose_seal ──────────────────────────────────────
//
// Verifier-only stamp for the 4th elaborate-loop completion signal
// (per GOALS.md). Mirrors haiku_stage_elaboration_seal but writes
// `decompose_verified_at` on the elaboration artifact, signaling that
// the drafted units cover the captured conversation transcript.
//
// Same nonce contract as haiku_stage_elaboration_seal — the cursor
// mints a fresh nonce when it emits `decompose_review` and the seal
// refuses without it.

export const HAIKU_STAGE_DECOMPOSE_SEAL_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1, description: "Intent slug" }),
		stage: Type.String({ minLength: 1, description: "Stage name" }),
		nonce: Type.String({
			minLength: 1,
			description:
				"Verifier nonce minted by the cursor when emitting the `decompose_review` action. Surfaced on the action payload as `verifier_nonce`. Single-use: consumed by the seal tool on success.",
		}),
		notes: Type.Optional(
			Type.String({
				description:
					"Optional verifier notes recorded as the seal's rationale. Stored on FM as `decompose_verified_notes`.",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuStageDecomposeSealInput = Static<
	typeof HAIKU_STAGE_DECOMPOSE_SEAL_INPUT_SCHEMA
>
export const validateHaikuStageDecomposeSealInputSchema = stateAjv.compile(
	HAIKU_STAGE_DECOMPOSE_SEAL_INPUT_SCHEMA,
)

// ── haiku_stage_get ───────────────────────────────────────────────

export const HAIKU_STAGE_GET_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		stage: Type.String({ minLength: 1 }),
		field: Type.String({ minLength: 1 }),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuStageGetInput = Static<typeof HAIKU_STAGE_GET_INPUT_SCHEMA>
export const validateHaikuStageGetInputSchema = stateAjv.compile(
	HAIKU_STAGE_GET_INPUT_SCHEMA,
)

// ── haiku_stage_set ───────────────────────────────────────────────
//
// Engine-internal — every stage state field is workflow-managed.
// Agent calls are rejected with `stage_field_engine_only` after
// the schema gate passes; the schema only enforces the call's
// argument shape, not the field-level deny-list.

export const HAIKU_STAGE_SET_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1 }),
		stage: Type.String({ minLength: 1 }),
		field: Type.String({ minLength: 1 }),
		value: Type.Unsafe<unknown>({
			type: ["string", "array", "number", "boolean", "null", "object"],
			description: "New value. Must match the field's declared type.",
		}),
		state_file: stateFile,
	},
	{ additionalProperties: false },
)
export type HaikuStageSetInput = Static<typeof HAIKU_STAGE_SET_INPUT_SCHEMA>
export const validateHaikuStageSetInputSchema = stateAjv.compile(
	HAIKU_STAGE_SET_INPUT_SCHEMA,
)

// ── haiku_intent_seal ───────────────────────────────────────────────
//
// Verifier-only. Stamps `verified_at: <ISO>` on intent.md frontmatter
// after the pre-intent elaboration substance check passes. Fired by
// the verifier subagent dispatched via the pre-intent
// `elaborate_review` cursor action (no `stage` field).
//
// Same nonce contract as the per-stage seal tools.

export const HAIKU_INTENT_SEAL_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({ minLength: 1, description: "Intent slug" }),
		nonce: Type.String({
			minLength: 1,
			description:
				"Verifier nonce minted by the cursor when emitting the pre-intent `elaborate_review` action. Surfaced on the action payload as `verifier_nonce`. Single-use: consumed by the seal tool on success.",
		}),
		notes: Type.Optional(
			Type.String({
				description:
					"Optional verifier notes recorded on intent FM as `verified_notes`.",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuIntentSealInput = Static<typeof HAIKU_INTENT_SEAL_INPUT_SCHEMA>
export const validateHaikuIntentSealInputSchema = stateAjv.compile(
	HAIKU_INTENT_SEAL_INPUT_SCHEMA,
)
