// state/schemas/inputs/discovery.ts — TypeBox input schema for the
// `haiku_discovery_complete` MCP tool. A discovery subagent calls this
// when it has committed its artifact inside the isolation worktree, to
// hand the merge-back step over to the engine (which takes a per-stage
// lock and merges the discovery branch into the stage branch). See
// gigsmart/haiku-method#333.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"

export const HAIKU_DISCOVERY_COMPLETE_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({
			minLength: 1,
			description: "Intent slug. Required.",
		}),
		stage: Type.String({
			minLength: 1,
			description:
				"Stage the discovery belongs to (e.g. `inception`, `design`).",
		}),
		template: Type.String({
			minLength: 1,
			description:
				"Discovery template name (matches the `discovery/<name>.md` file under the studio's stage).",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuDiscoveryCompleteInput = Static<
	typeof HAIKU_DISCOVERY_COMPLETE_INPUT_SCHEMA
>
export const validateHaikuDiscoveryCompleteInputSchema = stateAjv.compile(
	HAIKU_DISCOVERY_COMPLETE_INPUT_SCHEMA,
)
