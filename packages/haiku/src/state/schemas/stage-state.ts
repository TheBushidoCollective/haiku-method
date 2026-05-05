// state/schemas/stage-state.ts — JSONSchema source-of-truth for
// per-stage state.json shapes. Mirrors plugin/schemas/stage.schema.json.
// Stage state is entirely engine-managed — there are no
// agent-authorable fields. The schema exists so haiku_stage_set can
// reject every call with a clear `stage_field_engine_only` code
// instead of silently accepting writes that bypass workflow lifecycle
// invariants.

export const STAGE_STATE_SCHEMA = {
	type: "object",
	properties: {
		stage: { type: "string" },
		status: {
			type: "string",
			enum: ["pending", "active", "completed", "blocked"],
		},
		phase: {
			type: "string",
			enum: ["", "elaborate", "execute", "review", "gate"],
		},
		started_at: { type: ["string", "null"] },
		completed_at: { type: ["string", "null"] },
		gate_entered_at: { type: ["string", "null"] },
		gate_outcome: { type: ["string", "null"] },
		visits: { type: "integer", minimum: 0 },
		iterations: { type: "array" },
		elaboration_turns: { type: "integer", minimum: 0 },
		decision_log: { type: "array" },
	},
	additionalProperties: true,
}

export const STAGE_STATE_FIELDS = Object.keys(
	STAGE_STATE_SCHEMA.properties,
) as ReadonlyArray<string>
