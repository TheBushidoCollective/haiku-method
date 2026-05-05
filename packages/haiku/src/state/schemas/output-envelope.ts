// state/schemas/output-envelope.ts — Standard MCP outputSchema
// fragments reused across the state-tool defs.
//
// Per MCP spec 2025-06-18 §Tool Result, when a tool declares an
// outputSchema, the server MUST emit `structuredContent` matching
// it. Tools either compose these fragments or define their own
// shape; the `reply()` helper inside handleStateTool wraps payloads
// as both stringified text content (back-compat) and
// structuredContent.

/** Standard error envelope. Returned (with isError: true) when a
 *  handler rejects the call for a structured reason. The `error`
 *  field is a stable named code (e.g. `frontmatter_validation_failed`,
 *  `feedback_not_found`, `lifecycle_violation`); `message` is a
 *  human-readable remediation hint. */
export const ERROR_OUTPUT_SCHEMA = {
	type: "object",
	properties: {
		error: { type: "string", description: "Stable named error code." },
		message: {
			type: "string",
			description: "Human-readable remediation guidance.",
		},
	},
	required: ["error", "message"],
	additionalProperties: true,
}

/** Standard ok envelope for confirmation-style writes. Tools that
 *  mutate state and return only a confirmation message use this. */
export const OK_OUTPUT_SCHEMA = {
	type: "object",
	properties: {
		ok: { type: "boolean", const: true },
		message: { type: "string" },
	},
	required: ["ok", "message"],
	additionalProperties: true,
}
