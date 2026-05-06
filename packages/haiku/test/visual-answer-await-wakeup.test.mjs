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
// 3. bindSessionCancellation tore down the session on abort. Repro:
//    pass a real AbortController.signal into the handler, abort
//    mid-wait, and assert (a) the abort propagates as a rejection,
//    (b) the session survives the abort, (c) a follow-up await on
//    the same session still resolves once an answer arrives.
//
// We exercise the actual MCP handleToolCall dispatch (not just
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

function callAwait(sessionId, signal) {
	// Direct dispatch — same path the MCP server uses. Optionally
	// passes a real AbortSignal so tests can exercise the
	// cancellation behavior end-to-end (the previous bug was that
	// bindSessionCancellation tore down the session on any abort).
	return handleToolCall(
		{
			params: {
				name: "haiku_await_visual_answer",
				arguments: { session_id: sessionId },
			},
		},
		signal,
	)
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

await test("session survives signal abort (cancellation does not tear down)", async () => {
	// Pre-fix, bindSessionCancellation killed the SPA's WebSocket on
	// any abort (Ctrl-C, MCP host timeout, retry), so the next await
	// got "session not found". This test passes a REAL AbortSignal,
	// aborts mid-wait, and confirms (a) the abort propagates to the
	// caller, (b) the session itself survives, (c) a fresh await on
	// the same session still resolves once an answer arrives.
	const s = makeQuestionSession()
	try {
		const controller = new AbortController()
		const cancelled = callAwait(s.session_id, controller.signal)
		// Mark the promise as expected-to-throw so an unhandled
		// rejection doesn't blow up the test runner.
		const cancelledHandle = cancelled.catch((e) => ({ aborted: true, err: e }))

		// Give the await a tick to register its waitForSession listener.
		await delay(50)
		controller.abort()

		// The aborted call should reject (signal abort propagates) —
		// pre-fix it would have returned a "timeout" response or torn
		// down the session.
		const outcome = await cancelledHandle
		assert.ok(
			outcome && typeof outcome === "object" && "aborted" in outcome,
			`aborted await should reject, got: ${JSON.stringify(outcome).slice(0, 200)}`,
		)

		// Session must still exist after abort.
		const live = getSession(s.session_id)
		assert.ok(live, "session must survive a signal-aborted await")
		assert.strictEqual(
			live.session_type,
			"question",
			"session type must still be 'question'",
		)
		assert.strictEqual(
			live.status,
			"pending",
			"session must still be in pending status — abort must not flip it to answered/timeout",
		)

		// A fresh await on the same session still works — drain logic
		// catches the answer that lands after the first await aborted.
		updateQuestionSession(s.session_id, {
			status: "answered",
			answers: [{ question: "Pick one", answer: "A" }],
		})
		const result = await callAwait(s.session_id)
		assert.ok(result.content?.length > 0, "follow-up await should resolve")
		const body = result.content[0].text
		assert.ok(
			body.includes('"status": "answered"'),
			"follow-up await should see the answer that landed after the first one was aborted",
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
