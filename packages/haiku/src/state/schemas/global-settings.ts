// state/schemas/global-settings.ts — TypeBox + AJV schema for the GLOBAL
// (user-level) `~/.haiku/settings.json` file. Per the schema-definitions rule,
// every shape that crosses a process boundary (here: on-disk global settings,
// read by the engine's MR/PR + proof-upload paths) gets a real runtime-checked
// TypeBox schema yielding both the JSONSchema validator AND the TS type.
//
// Shape:
//   { providers?: { github?: ProviderToken, gitlab?: ProviderToken } }
//
// ProviderToken is what the haikumethod.ai auth broker relays back: the OAuth
// access token (+ optional refresh token / expiry for the device-flow case),
// the granted scopes, the resolved account login, the provider host (so
// enterprise/self-managed hosts are matched by value, not assumed), and an
// obtained-at stamp.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "./_ajv.js"

/** The providers we broker auth for. The MCP picks one by the repo's origin
 *  host (github.com → github; gitlab.com / self-managed → gitlab). */
export const PROVIDER_NAMES = ["github", "gitlab"] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

export const PROVIDER_TOKEN_SCHEMA = Type.Object(
	{
		access_token: Type.String({
			minLength: 1,
			description: "OAuth access token used as the provider API bearer.",
		}),
		refresh_token: Type.Optional(
			Type.String({
				description:
					"Refresh token (device-flow only). Absent for a pasted PAT. Used by the MCP to re-run the broker /refresh exchange.",
			}),
		),
		expires_at: Type.Optional(
			Type.String({
				description:
					"ISO-8601 expiry of access_token. Absent = non-expiring (PAT-style). Drives the `expired` flag in haiku_auth_status.",
			}),
		),
		scopes: Type.Optional(
			Type.Array(Type.String(), {
				description: "Granted OAuth scopes (e.g. ['repo'] / ['api']).",
			}),
		),
		account: Type.Optional(
			Type.String({
				description: "Resolved provider account login the token belongs to.",
			}),
		),
		host: Type.String({
			minLength: 1,
			description:
				"Provider host (github.com, gitlab.com, or an enterprise/self-managed host). Matched against the repo origin host at use time.",
		}),
		obtained_at: Type.String({
			minLength: 1,
			description: "ISO-8601 timestamp the token was relayed + stored.",
		}),
	},
	{ additionalProperties: false },
)
export type ProviderToken = Static<typeof PROVIDER_TOKEN_SCHEMA>

export const GLOBAL_SETTINGS_SCHEMA = Type.Object(
	{
		providers: Type.Optional(
			Type.Object(
				{
					github: Type.Optional(PROVIDER_TOKEN_SCHEMA),
					gitlab: Type.Optional(PROVIDER_TOKEN_SCHEMA),
				},
				{ additionalProperties: false },
			),
		),
	},
	// Permissive at the TOP level only: a future unrelated global-settings key
	// (not under our control) must not invalidate the whole file and orphan the
	// tokens. The providers sub-objects stay strict (additionalProperties:false).
	{ additionalProperties: true },
)
export type GlobalSettings = Static<typeof GLOBAL_SETTINGS_SCHEMA>

export const validateProviderTokenSchema = stateAjv.compile(
	PROVIDER_TOKEN_SCHEMA,
)
export const validateGlobalSettingsSchema = stateAjv.compile(
	GLOBAL_SETTINGS_SCHEMA,
)
