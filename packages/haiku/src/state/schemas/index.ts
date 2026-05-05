// state/schemas/index.ts — Barrel for the per-shape schema files.
//
// One file per schema (unit, intent, stage-state, feedback) plus
// shared MCP outputSchema fragments. The barrel re-exports every
// public symbol so callers can `import { UNIT_FRONTMATTER_SCHEMA }
// from "./state/schemas"` without caring which file owns it.
//
// Why per-schema files instead of one combined file: each schema is
// the single source of truth for one frontmatter shape. Putting them
// together obscured ownership and made the file a magnet for
// schema-adjacent helpers (validators, error-translators) that
// belong with their schema, not in a generic blob.
//
// ── Schema-runtime boundary ───────────────────────────────────────
//
// **TypeBox + AJV** is the rule for the MCP tool surface (this
// directory + every state-tool inputSchema). Each schema is a
// TypeBox builder expression that yields BOTH a JSONSchema-shaped
// object the MCP runtime + AJV consume AND a TypeScript type via
// `Static<typeof Schema>`. Single source of truth — the runtime
// check and the TS type can never drift.
//
// **Zod** is the rule for the SPA wire contract (`packages/haiku-api/`).
// Different consumer (the React SPA), different needs (TS type
// inference is the win there too, but the SPA never needs the
// JSONSchema shape).
//
// If you are adding a new schema, ask: is it for an MCP tool input
// /output, a feedback / unit / intent frontmatter, or any state
// shape the agent touches? → TypeBox here. Is it for the SPA's
// wire payload (session.ts in haiku-api)? → Zod there. Don't
// introduce a third runtime.

export type {
	HaikuFeedbackInput,
	HaikuFeedbackUpdateInput,
} from "./feedback.js"
export {
	CREATE_TIME_FB_FIELDS,
	FSM_DRIVEN_FB_FIELDS,
	HAIKU_FEEDBACK_INPUT_SCHEMA,
	HAIKU_FEEDBACK_UPDATE_INPUT_SCHEMA,
	validateHaikuFeedbackInputSchema,
	validateHaikuFeedbackUpdateInputSchema,
} from "./feedback.js"
export type {
	HaikuUnitAdvanceHatInput,
	HaikuUnitDeleteInput,
	HaikuUnitIncrementBoltInput,
	HaikuUnitListInput,
	HaikuUnitReadInput,
	HaikuUnitRejectHatInput,
	HaikuUnitSetInput,
	HaikuUnitStartInput,
	HaikuUnitWriteInput,
} from "./inputs/units.js"
export {
	HAIKU_UNIT_ADVANCE_HAT_INPUT_SCHEMA,
	HAIKU_UNIT_DELETE_INPUT_SCHEMA,
	HAIKU_UNIT_INCREMENT_BOLT_INPUT_SCHEMA,
	HAIKU_UNIT_LIST_INPUT_SCHEMA,
	HAIKU_UNIT_READ_INPUT_SCHEMA,
	HAIKU_UNIT_REJECT_HAT_INPUT_SCHEMA,
	HAIKU_UNIT_SET_INPUT_SCHEMA,
	HAIKU_UNIT_START_INPUT_SCHEMA,
	HAIKU_UNIT_WRITE_INPUT_SCHEMA,
	validateHaikuUnitAdvanceHatInputSchema,
	validateHaikuUnitDeleteInputSchema,
	validateHaikuUnitIncrementBoltInputSchema,
	validateHaikuUnitListInputSchema,
	validateHaikuUnitReadInputSchema,
	validateHaikuUnitRejectHatInputSchema,
	validateHaikuUnitSetInputSchema,
	validateHaikuUnitStartInputSchema,
	validateHaikuUnitWriteInputSchema,
} from "./inputs/units.js"
export type { IntentFrontmatter } from "./intent.js"
export {
	AGENT_AUTHORABLE_INTENT_FIELDS,
	FSM_DRIVEN_INTENT_FIELDS,
	INTENT_FRONTMATTER_SCHEMA,
	INTENT_IMMUTABLE_FIELDS,
	validateIntentFrontmatterSchema,
} from "./intent.js"
export type { ErrorOutput, OkOutput } from "./output-envelope.js"
export { ERROR_OUTPUT_SCHEMA, OK_OUTPUT_SCHEMA } from "./output-envelope.js"
export type { StageState } from "./stage-state.js"
export { STAGE_STATE_FIELDS, STAGE_STATE_SCHEMA } from "./stage-state.js"
export type { UnitFrontmatter } from "./unit.js"
export {
	AGENT_AUTHORABLE_UNIT_FIELDS,
	FSM_DRIVEN_UNIT_FIELDS,
	UNIT_FRONTMATTER_SCHEMA,
	validateUnitFrontmatterSchema,
} from "./unit.js"
