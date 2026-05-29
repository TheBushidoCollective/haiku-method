// tools/orchestrator/haiku_auth_logout.ts — disconnect one Git provider by
// clearing its token from the GLOBAL store (~/.haiku/settings.json).
//
// Phase 1 of provider OAuth; pairs with haiku_auth_status. Idempotent: clearing
// an already-absent provider returns ok with was_connected:false (not an error).

import { clearProviderToken } from "../../global-settings.js"
import {
	HAIKU_AUTH_LOGOUT_INPUT_SCHEMA,
	type HaikuAuthLogoutInput,
	validateHaikuAuthLogoutInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

export default defineTool({
	name: "haiku_auth_logout",
	description:
		"Disconnect a Git provider (github | gitlab) by clearing its stored auth token from ~/.haiku/settings.json. Idempotent — clearing an unconnected provider returns ok with was_connected:false.",
	inputSchema: jsonSchemaOf(HAIKU_AUTH_LOGOUT_INPUT_SCHEMA),
	async handle(args) {
		const inputErr = validateToolInput(
			args,
			validateHaikuAuthLogoutInputSchema,
			"haiku_auth_logout",
		)
		if (inputErr) return inputErr
		const { provider } = args as HaikuAuthLogoutInput

		const wasConnected = clearProviderToken(provider as "github" | "gitlab")
		return text(
			JSON.stringify({
				ok: true,
				provider,
				was_connected: wasConnected,
			}),
		)
	},
})
