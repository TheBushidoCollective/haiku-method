// state/schemas/inputs/auth-tools.ts — TypeBox input schemas for the
// provider-auth MCP tools (haiku_auth_status, haiku_auth_logout). Phase 1 of
// the OAuth provider-auth work: the read/clear surface over the global token
// store (~/.haiku/settings.json). Phase 3 adds haiku_auth_login (the broker
// handshake) — its schema lands here too when built.
//
// Per the schema-definitions rule: three exports per tool (schema, Static<>
// type, compiled validator), additionalProperties:false, stable named error
// code `<tool>_input_invalid` produced by validateToolInput on miss.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"
import { PROVIDER_NAMES } from "../global-settings.js"

// ── haiku_auth_status ──────────────────────────────────────────────
//
// Report connected providers (account / scopes / host / expiry / expired).
// `provider` optionally narrows to one; omitted = all. Never returns token
// values. Empty object is valid (status of everything).
export const HAIKU_AUTH_STATUS_INPUT_SCHEMA = Type.Object(
	{
		provider: Type.Optional(
			Type.String({
				enum: [...PROVIDER_NAMES],
				description:
					"Narrow the status to one provider (github | gitlab). Omit for all.",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuAuthStatusInput = Static<typeof HAIKU_AUTH_STATUS_INPUT_SCHEMA>
export const validateHaikuAuthStatusInputSchema = stateAjv.compile(
	HAIKU_AUTH_STATUS_INPUT_SCHEMA,
)

// ── haiku_auth_logout ──────────────────────────────────────────────
//
// Clear one provider's stored token. `provider` is required (logging out of
// "everything" should be an explicit per-provider call, not an accident).
export const HAIKU_AUTH_LOGOUT_INPUT_SCHEMA = Type.Object(
	{
		provider: Type.String({
			enum: [...PROVIDER_NAMES],
			description: "Provider to disconnect (github | gitlab). Required.",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuAuthLogoutInput = Static<typeof HAIKU_AUTH_LOGOUT_INPUT_SCHEMA>
export const validateHaikuAuthLogoutInputSchema = stateAjv.compile(
	HAIKU_AUTH_LOGOUT_INPUT_SCHEMA,
)

// ── haiku_auth_login ───────────────────────────────────────────────
//
// Run the haikumethod.ai broker handshake to capture a provider OAuth token
// into the global store. `provider` is OPTIONAL: when omitted, the tool infers
// it from the repo's `origin` host (github.com → github, gitlab host → gitlab).
// No token is ever echoed back; the tool returns only ok / provider / account.
export const HAIKU_AUTH_LOGIN_INPUT_SCHEMA = Type.Object(
	{
		provider: Type.Optional(
			Type.String({
				enum: [...PROVIDER_NAMES],
				description:
					"Provider to authenticate (github | gitlab). Omit to infer from the repo's origin remote host.",
			}),
		),
	},
	{ additionalProperties: false },
)
export type HaikuAuthLoginInput = Static<typeof HAIKU_AUTH_LOGIN_INPUT_SCHEMA>
export const validateHaikuAuthLoginInputSchema = stateAjv.compile(
	HAIKU_AUTH_LOGIN_INPUT_SCHEMA,
)

// ── haiku_upload_proof ─────────────────────────────────────────────
//
// Upload a runtime-verification proof file to the intent's / stage's change
// request (GitHub release asset; GitLab project-uploads API + MR reference).
// Provider is detected from the origin host. `path` is required (the proof file
// on disk); `pr_url` optionally targets a specific PR/MR; `stage` scopes the
// proof to a stage's delivery PR when present.
export const HAIKU_UPLOAD_PROOF_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({
			minLength: 1,
			description: "Intent slug the proof belongs to.",
		}),
		stage: Type.Optional(
			Type.String({
				minLength: 1,
				description:
					"Stage whose delivery PR the proof attaches to. Omit for the intent-main PR.",
			}),
		),
		pr_url: Type.Optional(
			Type.String({
				minLength: 1,
				description:
					"Explicit PR/MR URL to upload against. Omit to use the intent/stage default.",
			}),
		),
		path: Type.String({
			minLength: 1,
			description: "Filesystem path to the proof file to upload.",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuUploadProofInput = Static<
	typeof HAIKU_UPLOAD_PROOF_INPUT_SCHEMA
>
export const validateHaikuUploadProofInputSchema = stateAjv.compile(
	HAIKU_UPLOAD_PROOF_INPUT_SCHEMA,
)
