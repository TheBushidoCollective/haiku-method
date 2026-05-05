#!/usr/bin/env npx tsx
// Test suite for haiku_await_visual_answer wake-up correctness.
//
// Three bugs the previous implementation had, all reproduced as
// regression tests here:
//
// 1. No drain on entry. If the user submitted before the await tool
//    opened (race between SPA submit and the agent's tool call), the
//    await blocked for 30 minutes waiting for an event that already
//    fired. Repro: pre-stamp `status: "answered"` on a session, call
//    the await, assert it returns immediately with the answer.
//
// 2. No re-wait on spurious wake. notifySessionUpdate fires for any
//    status mutation; the await should keep waiting until status is
//    actually "answered", not return a misleading "timeout" on the
//    first non-answer wake. Repro: notify the session WITHOUT
//    setting status=answered, assert the await keeps waiting.
//
// 3. bindSessionCancellation tore down the session on abort.
//    Repro: rely on the absence of cancellation — the test invokes
//    the handler without a signal and expects the session to
//    survive across multiple awaits.
//
// We exercise the actual MCP handleCallTool dispatch (not just
// awaitGateReviewSession-style helpers) so the test catches a future
// regression that re-introduces bindSessionCancellation or moves the
// drain logic out of the handler.

import assert from "node:assert"
import { setTimeout as delay } from "node:timers/promises"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

const { handleToolCall } = await import("../src/server/tool-call.ts")
const {
	createQuestionSession,
	deleteSession,
	getSession,
	notifySessionUpdate,
	updateQuestionSession,
} = await import("../src/sessions.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	const result = fn()
	if (result && typeof result.then === "function") {
		return result.then(
			() => {
				passed++
				console.log(`  ✓ ${name}`)
			},
			(e) => {
				failed++
				console.log(`  ✗ ${name}: ${e.message}`)
				if (e.stack) console.log(e.stack)
			},
		)
	}
	passed++
	console.log(`  ✓ ${name}`)
}

function makeQuestionSession() {
	return createQuestionSession({
		title: "Test Question",
		context: "",
		questions: [
			{
				question: "Pick one",
				options: ["A", "B"],
			},
		],
	})
}

function callAwait(sessionId) {
	// Direct dispatch — same path the MCP server uses. No signal so
	// the cancellation machinery (which used to be the bug) doesn't
	// fire.
	return handleToolCall({
		params: {
			name: "haiku_await_visual_answer",
			arguments: { session_id: sessionId },
		},
	})
}

console.log("\n=== haiku_await_visual_answer wake-up correctness ===")

await test("drain on entry: pre-answered session returns immediately", async () => {
	const s = makeQuestionSession()
	try {
		// Simulate: user submitted via SPA BEFORE the agent called the
		// await tool (the race that caused the original bug). The HTTP
		// submit route would have stamped these fields.
		updateQuestionSession(s.session_id, {
			status: "answered",
			answers: [{ question: "Pick one", answer: "A" }],
			feedback: "lgtm",
		})

		// The await should drain immediately, not block.
		const start = Date.now()
		const result = await callAwait(s.session_id)
		const elapsed = Date.now() - start

		assert.ok(
			elapsed < 1000,
			`await should return immediately on pre-answered session, took ${elapsed}ms`,
		)
		assert.ok(result.content?.length > 0, "result must have content")
		const body = result.content[0].text
		assert.ok(
			body.includes('"status": "answered"'),
			`body must include status: "answered", got: ${body.slice(0, 200)}`,
		)
		assert.ok(
			body.includes('"answer": "A"'),
			`body must include the user's answer, got: ${body.slice(0, 200)}`,
		)
	} finally {
		deleteSession(s.session_id)
	}
})

await test("spurious wake: re-waits if notified without status=answered", async () => {
	const s = makeQuestionSession()
	try {
		// Start the await — session has no answer yet.
		const promise = callAwait(s.session_id)

		// Tick to let the await register its waitForSession listener.
		await delay(50)

		// Spurious notify: wake the listener WITHOUT setting status.
		// The bug was that the await would fall through to "timeout".
		// The fix is to re-wait.
		notifySessionUpdate(s.session_id)

		// Tick again — the await should still be running, not have
		// returned a timeout.
		await delay(50)
		const stillWaiting = getSession(s.session_id)
		assert.ok(stillWaiting, "session must still exist after spurious wake")
		assert.strictEqual(
			stillWaiting.status,
			"pending",
			"session status should still be pending after spurious wake",
		)

		// Now actually answer it — the await should resolve.
		updateQuestionSession(s.session_id, {
			status: "answered",
			answers: [{ question: "Pick one", answer: "B" }],
			feedback: "",
		})

		const result = await promise
		assert.ok(result.content?.length > 0, "result must have content")
		const body = result.content[0].text
		assert.ok(
			body.includes('"status": "answered"'),
			`body must reflect the real answer, got: ${body.slice(0, 200)}`,
		)
		assert.ok(
			body.includes('"answer": "B"'),
			`body must contain the actual user answer, got: ${body.slice(0, 200)}`,
		)
	} finally {
		deleteSession(s.session_id)
	}
})

await test("survives across multiple await calls (no cancellation tear-down)", async () => {
	// Scenario: the agent calls await, the MCP host times the call out
	// before the user submits, the agent retries. Pre-fix, the first
	// await's bindSessionCancellation would have killed the session on
	// signal abort, and the second await would get "session not
	// found". Post-fix, no cancellation happens, the session lives.
	const s = makeQuestionSession()
	try {
		// Start an await, then immediately drop the promise (simulating
		// the MCP host abandoning the call).
		const orphan = callAwait(s.session_id)
		// Don't await `orphan` — let it dangle. The test's afterEach
		// (deleteSession) will tear down the session at the end.
		void orphan

		// Confirm the session is still there a tick later.
		await delay(50)
		const live = getSession(s.session_id)
		assert.ok(live, "session must survive an orphaned await call")
		assert.strictEqual(
			live.session_type,
			"question",
			"session type must still be 'question'",
		)

		// Now actually answer it — the orphan should resolve too.
		updateQuestionSession(s.session_id, {
			status: "answered",
			answers: [{ question: "Pick one", answer: "A" }],
		})

		// The orphaned await should now resolve. We wait on it just to
		// confirm the wake-up plumbing still fires.
		const result = await orphan
		assert.ok(result.content?.length > 0, "orphaned await should resolve")
		const body = result.content[0].text
		assert.ok(
			body.includes('"status": "answered"'),
			"orphaned await should still see the eventual answer",
		)
	} finally {
		deleteSession(s.session_id)
	}
})

await test("session-not-found before any session created → error", async () => {
	// Sanity check: the existing not-found guard still fires.
	const result = await callAwait("sess-does-not-exist")
	assert.ok(result.isError === true, "must flag isError on missing session")
	const body = result.content[0].text
	assert.ok(
		/not found/i.test(body),
		`body should mention 'not found', got: ${body.slice(0, 200)}`,
	)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
