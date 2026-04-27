// tools/state/_text.ts — Shared `text(s)` and `reply(payload)` helpers
// used by every state-tool handler.
//
// `text(s)` wraps a string in the MCP text-content envelope.
// `reply(payload)` wraps a JSON-encodable object in BOTH the text
// envelope (JSON-stringified for backward-compatible clients) AND
// `structuredContent` (so MCP clients that surface typed responses
// see the parsed object). Handlers can't drift the two views apart
// because the helper computes both atomically.

import type { ToolResult } from "../types.js"

export function text(s: string): ToolResult {
	return { content: [{ type: "text" as const, text: s }] }
}

export function reply(
	payload: Record<string, unknown>,
	opts?: { isError?: boolean },
): ToolResult {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(payload, null, 2) },
		],
		structuredContent: payload,
		...(opts?.isError ? { isError: true } : {}),
	}
}
