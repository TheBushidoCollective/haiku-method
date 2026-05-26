#!/usr/bin/env npx tsx
// tool-call-inline-dispatch.test.mjs
//
// Regression for the 2026-05-26 `haiku_view` bug (intent
// `automated-starlink-rental-platform`): `haiku_view` (and its twin
// `haiku_view_close`) were advertised in the tool manifest and had
// dedicated inline handlers in `server/tool-call.ts`, but those
// handlers sat BELOW the `haiku_*` → `handleStateTool` catch-all and
// were NOT in its exclusion list. So every call was swallowed by the
// state-tool router, which has no case for them, and returned the hard
// error `Unknown tool: haiku_view`. The runtime-verifier role — which
// MUST boot the app via `haiku_view` — became structurally impossible
// to pass and filed a blocker that nothing could fix.
//
// The fix replaced the ad-hoc `name !== "..."` exclusion chain with an
// explicit `INLINE_HANDLED_HAIKU_TOOLS` set. This test pins the
// contract that set exists to enforce:
//
//   1. Every name in the set is genuinely UNKNOWN to handleStateTool —
//      so the exclusion is load-bearing (catches both a stale entry and
//      the inverse mistake of excluding a real state tool, which would
//      wrongly bypass the router).
//   2. handleToolCall routes an inline-handled tool to its handler, NOT
//      to the "Unknown tool" fallback. `haiku_view_close` is the safe,
//      idempotent probe (closing an unknown session is a documented
//      no-op success — no spawn, no server, no blocking).
//   3. The two tools the bug hit are advertised in the manifest AND in
//      the exclusion set — advertised-but-unreachable is exactly the
//      failure mode.

import assert from "node:assert"
import { dirname, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { handleToolCall, INLINE_HANDLED_HAIKU_TOOLS } = await import(
	"../src/server/tool-call.ts"
)
const { handleStateTool, stateToolDefs } = await import("../src/state-tools.ts")

function bodyText(res) {
	return (res?.content ?? [])
		.map((c) => (c.type === "text" ? c.text : ""))
		.join("\n")
}

test("the set names exactly the inline-handled haiku_* tools", () => {
	// Pins membership so a future edit that drops a name (re-introducing
	// the bug) fails here. New inline handler below the catch-all → add
	// it to the set AND to this list in the same change.
	assert.deepStrictEqual([...INLINE_HANDLED_HAIKU_TOOLS].sort(), [
		"haiku_await_design_direction",
		"haiku_await_visual_answer",
		"haiku_view",
		"haiku_view_close",
	])
})

test("every excluded tool is genuinely unknown to handleStateTool (exclusion is load-bearing)", () => {
	// If handleStateTool COULD handle one of these, excluding it from the
	// router would be a different bug (a real state tool silently bypassed).
	// The whole point of the exclusion is that the state router can't serve
	// these — so each must hit handleStateTool's "Unknown tool" default.
	for (const name of INLINE_HANDLED_HAIKU_TOOLS) {
		const res = handleStateTool(name, {})
		assert.match(
			bodyText(res),
			new RegExp(`Unknown tool: ${name}`),
			`handleStateTool unexpectedly recognizes '${name}' — it must NOT, or the catch-all exclusion is wrong`,
		)
	}
})

test("haiku_view_close dispatches to its inline handler, not 'Unknown tool' (the bug)", async () => {
	// End-to-end through the real dispatcher. Idempotent + safe: closing
	// an unknown session is a documented no-op success — no spawn, no
	// server, no block. Pre-fix this returned "Unknown tool: haiku_view_close".
	const res = await handleToolCall({
		params: {
			name: "haiku_view_close",
			arguments: { session_id: "nonexistent-test-session" },
		},
	})
	const text = bodyText(res)
	assert.doesNotMatch(
		text,
		/Unknown tool/,
		`haiku_view_close must reach its inline handler; got: ${text}`,
	)
	// The handler's real shape — proves we landed in it, not somewhere else.
	const parsed = JSON.parse(text)
	assert.strictEqual(parsed.session_id, "nonexistent-test-session")
	assert.strictEqual(parsed.closed, false)
})

test("haiku_view routes past the catch-all instead of into handleStateTool", () => {
	// haiku_view itself can spawn a dev server / open a tunnel, so we
	// don't fully invoke it here — we assert the routing DECISION that
	// caused the bug. The catch-all sends a name to handleStateTool iff
	// it's haiku_* and NOT excluded; haiku_view must be excluded.
	const routedToStateTool =
		"haiku_view".startsWith("haiku_") &&
		!INLINE_HANDLED_HAIKU_TOOLS.has("haiku_view")
	assert.strictEqual(
		routedToStateTool,
		false,
		"haiku_view must skip the handleStateTool catch-all and reach its inline handler",
	)
})

test("the bug's two tools are advertised in the manifest (advertised ⇒ must be reachable)", () => {
	const advertised = new Set(stateToolDefs.map((d) => d.name))
	for (const name of ["haiku_view", "haiku_view_close"]) {
		assert.ok(advertised.has(name), `${name} is advertised in stateToolDefs`)
		assert.ok(
			INLINE_HANDLED_HAIKU_TOOLS.has(name),
			`${name} is advertised, so it must be reachable — i.e. excluded from the state-tool catch-all`,
		)
	}
})
