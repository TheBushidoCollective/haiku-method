// tools/orchestrator/haiku_auth_status.ts — report which providers the engine
// is authenticated to (for the engine-driven MR/PR + proof-upload ops).
//
// Reads the GLOBAL token store (~/.haiku/settings.json) and returns each
// connected provider's SAFE metadata — account, scopes, host, expiry, and a
// derived `expired` flag — and NEVER the access/refresh token values. Optional
// `provider` narrows to one. Phase 1 of provider OAuth; pairs with
// haiku_auth_logout. The broker handshake (haiku_auth_login) is Phase 3.

import { listConnectedProviders } from "../../global-settings.js"
import {
	HAIKU_AUTH_STATUS_INPUT_SCHEMA,
	type HaikuAuthStatusInput,
	validateHaikuAuthStatusInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_auth_status",
	description:
		"Show which Git providers (github / gitlab) the engine is authenticated to for MR/PR operations and proof upload. Returns each connected provider's account, scopes, host, expiry, and whether the token is expired — never the token value itself. Optional `provider` narrows to one.",
	inputSchema: jsonSchemaOf(HAIKU_AUTH_STATUS_INPUT_SCHEMA),
	async handle(args) {
		const inputErr = validateToolInput(
			args,
			validateHaikuAuthStatusInputSchema,
			"haiku_auth_status",
		)
		if (inputErr) return inputErr
		const { provider } = args as HaikuAuthStatusInput

		const all = listConnectedProviders()
		const providers = provider
			? all.filter((p) => p.provider === provider)
			: all

		return text(
			JSON.stringify({
				ok: true,
				connected: providers.length > 0,
				providers,
			}),
		)
	},
})
