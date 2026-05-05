#!/usr/bin/env npx tsx
// Test suite for `shouldLaunchReviewBrowser` — the predicate that
// gates the local-browser launch inside `awaitGateReviewSession`.
//
// The bug we're guarding against: the previous implementation
// launched the browser whenever `autoOpen && reviewUrl`, with no
// regard for whether a SPA tab was already attached. The agent was
// told to pass `auto_open: false` when `browser_attached: true`, but
// agents miss the detection and end up popping a duplicate tab —
// or, worse, pass `auto_open: false` defensively when the browser
// ISN'T attached and the user never gets a tab opened at all.
//
// Fix: the await tool decides server-side based on the live-websocket
// heartbeat. The agent's `auto_open` flag is preserved as a hard
// override (default true) for headless containers where the launch
// would fail anyway, but it no longer has to drive the duplicate-tab
// avoidance.

import assert from "node:assert"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

const { shouldLaunchReviewBrowser } = await import("../src/server/tool-call.ts")
const { createSession, deleteSession, recordHeartbeat } = await import(
	"../src/sessions.ts"
)

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

function makeReviewSession() {
	return createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "test-intent",
		target: "test",
	})
}

console.log("\n=== shouldLaunchReviewBrowser ===")

test("autoOpen=false → never launch (hard override)", () => {
	const s = makeReviewSession()
	try {
		assert.strictEqual(
			shouldLaunchReviewBrowser(false, "https://example.test", s.session_id),
			false,
			"autoOpen=false must override everything",
		)
		// Even with a fresh heartbeat (a browser IS attached now),
		// autoOpen=false still wins. Belt-and-suspenders against a
		// future refactor that flips the guard order so the
		// browser-attached check fires before the autoOpen short-circuit
		// — autoOpen=false is the caller's hard override and must win
		// regardless of websocket state.
		recordHeartbeat(s.session_id)
		assert.strictEqual(
			shouldLaunchReviewBrowser(false, "https://example.test", s.session_id),
			false,
			"autoOpen=false must override even when a browser IS attached",
		)
	} finally {
		deleteSession(s.session_id)
	}
})

test("missing reviewUrl → never launch", () => {
	const s = makeReviewSession()
	try {
		assert.strictEqual(
			shouldLaunchReviewBrowser(true, undefined, s.session_id),
			false,
			"undefined URL must short-circuit",
		)
		assert.strictEqual(
			shouldLaunchReviewBrowser(true, "", s.session_id),
			false,
			"empty URL must short-circuit",
		)
	} finally {
		deleteSession(s.session_id)
	}
})

test("autoOpen=true, URL present, no heartbeat → launch", () => {
	// No heartbeat recorded for this session — isBrowserAttached
	// returns false (no live websocket). Agent default behavior on a
	// fresh gate where the user hasn't opened the SPA yet.
	const s = makeReviewSession()
	try {
		assert.strictEqual(
			shouldLaunchReviewBrowser(true, "https://example.test", s.session_id),
			true,
			"fresh session with no heartbeat should launch the browser",
		)
	} finally {
		deleteSession(s.session_id)
	}
})

test("autoOpen=true, URL present, fresh heartbeat → DO NOT launch", () => {
	// The exact bug we're guarding against: the user is already on the
	// SPA tab (heartbeat fresh), so launching `open <url>` again would
	// pop a duplicate tab. The agent's autoOpen flag is irrelevant
	// here — server makes the call based on live websocket state.
	const s = makeReviewSession()
	try {
		recordHeartbeat(s.session_id)
		assert.strictEqual(
			shouldLaunchReviewBrowser(true, "https://example.test", s.session_id),
			false,
			"attached browser must suppress the launch even with autoOpen=true",
		)
	} finally {
		deleteSession(s.session_id)
	}
})

test("autoOpen=true on unknown session → launch (nothing to suppress)", () => {
	// Defensive: an unknown sessionId means there's no live SPA tab
	// associated with it. isBrowserAttached returns false for unknown
	// sessions (sessions.has check), so the predicate says "launch".
	// That's the right call — the URL is presumably a brand-new
	// session the caller is about to surface — but the test pins the
	// current behavior so a future change is intentional.
	const result = shouldLaunchReviewBrowser(
		true,
		"https://example.test",
		"sess-does-not-exist",
	)
	assert.strictEqual(
		result,
		true,
		"unknown session: predicate currently returns true (no attached browser to suppress)",
	)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
