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

export { CREATE_TIME_FB_FIELDS, FSM_DRIVEN_FB_FIELDS } from "./feedback.js"
export {
	AGENT_AUTHORABLE_INTENT_FIELDS,
	FSM_DRIVEN_INTENT_FIELDS,
	INTENT_FRONTMATTER_SCHEMA,
	INTENT_IMMUTABLE_FIELDS,
	validateIntentFrontmatterSchema,
} from "./intent.js"
export { ERROR_OUTPUT_SCHEMA, OK_OUTPUT_SCHEMA } from "./output-envelope.js"
export { STAGE_STATE_FIELDS, STAGE_STATE_SCHEMA } from "./stage-state.js"
export {
	AGENT_AUTHORABLE_UNIT_FIELDS,
	FSM_DRIVEN_UNIT_FIELDS,
	UNIT_FRONTMATTER_SCHEMA,
	validateUnitFrontmatterSchema,
} from "./unit.js"
