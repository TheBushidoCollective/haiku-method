#!/usr/bin/env npx tsx
// Test suite for the WebSocket liveness heartbeat.
//
// The SPA sends `{ type: "heartbeat" }` over the long-lived socket
// every 30s. The server must:
//   1. Record presence against the socket's session (so the presence
//      watch doesn't trip a refresh as an abandoned gate).
//   2. Reply with `heartbeat_ack` so the client knows the engine saw
//      it — receipt of the ack, not the send, is the liveness proof.
//   3. Treat the heartbeat as connection-level — it works for ANY
//      session_type, not just review sessions.
//
// Regression target (2026-05-26 CRITICAL): a page refresh dropped the
// socket and the engine "froze" / re-popped because nothing on the
// live connection kept presence fresh across the reconnect gap.

import assert from "node:assert"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

const { handleWebSocketMessage, wsConnections } = await import(
	"../src/http/ws.ts"
)
const {
	createSession,
	createQuestionSession,
	deleteSession,
	beginPresenceWatch,
	hasPresenceLost,
	clearHeartbeat,
	_runPresenceSweepForTests,
} = await import("../src/sessions.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (e.stack) console.log(e.stack)
	}
}

// Minimal fake of the `ws` WebSocket the upgrade handler registers.
// Captures every server-sent frame so we can assert on the ack.
function fakeSocket() {
	const sent = []
	return {
		OPEN: 1,
		readyState: 1,
		sent,
		send(data) {
			sent.push(JSON.parse(data))
		},
		close() {
			this.readyState = 3
		},
	}
}

console.log("\n=== WS heartbeat ===")

test("heartbeat records presence and replies heartbeat_ack", () => {
	const s = createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "hb-intent",
		target: "test",
	})
	const sock = fakeSocket()
	wsConnections.set(s.session_id, sock)
	try {
		// Arm the presence watch as if a browser attached, then let it
		// go stale enough that without a beat it would be flagged.
		beginPresenceWatch(s.session_id)
		clearHeartbeat(s.session_id)

		handleWebSocketMessage(
			s.session_id,
			JSON.stringify({ type: "heartbeat", t: 12345 }),
		)

		const ack = sock.sent.find((m) => m.type === "heartbeat_ack")
		assert.ok(ack, "server must reply with a heartbeat_ack frame")
		assert.equal(ack.t, 12345, "ack echoes the client send timestamp")

		// Presence was recorded — a sweep right after the beat must NOT
		// flag the session as lost.
		_runPresenceSweepForTests()
		assert.equal(
			hasPresenceLost(s.session_id),
			false,
			"a just-recorded heartbeat keeps presence alive through a sweep",
		)
	} finally {
		wsConnections.delete(s.session_id)
		deleteSession(s.session_id)
	}
})

test("heartbeat works for a non-review (question) session too", () => {
	const s = createQuestionSession({
		title: "pick one",
		questions: [],
		context: "",
	})
	const sock = fakeSocket()
	wsConnections.set(s.session_id, sock)
	try {
		handleWebSocketMessage(s.session_id, JSON.stringify({ type: "heartbeat" }))
		const ack = sock.sent.find((m) => m.type === "heartbeat_ack")
		assert.ok(ack, "heartbeat is connection-level, not review-only")
		assert.equal(ack.t, undefined, "no echoed timestamp when none was sent")
	} finally {
		wsConnections.delete(s.session_id)
		deleteSession(s.session_id)
	}
})

test("heartbeat for an unknown session is a no-op (no throw, no ack)", () => {
	const sock = fakeSocket()
	wsConnections.set("ghost-session", sock)
	try {
		handleWebSocketMessage(
			"ghost-session",
			JSON.stringify({ type: "heartbeat" }),
		)
		assert.equal(
			sock.sent.length,
			0,
			"unknown session → handler returns before recording or acking",
		)
	} finally {
		wsConnections.delete("ghost-session")
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
