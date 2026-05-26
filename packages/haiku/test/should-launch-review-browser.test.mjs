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
const {
	createSession,
	deleteSession,
	recordHeartbeat,
	beginPresenceWatch,
	hasPresenceLost,
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

// Intent-scoped dedupe (added 2026-05-13). Each haiku_run_next tick
// firing user_gate mints a new session_id. The per-session attach
// check (isBrowserAttached) misses the prior session's still-alive
// tab, so the launch fires a duplicate window. Pass the intent slug
// and the predicate suppresses launch when ANY live session for the
// intent exists — the SPA tab follows the intent, not the session id.
test("intent_slug arg: live session for SAME intent on different session id → DO NOT launch", () => {
	// A previously-attached session (heartbeat fresh) for intent
	// "shared-intent". Then a NEW session for the same intent comes
	// in. shouldLaunchReviewBrowser is asked about the new session id
	// — its own attach status is false (no heartbeat ever recorded),
	// but the older session for the same intent is still alive. With
	// the intentSlug arg, we suppress the launch.
	const older = createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "shared-intent",
		target: "test",
	})
	const newer = createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "shared-intent",
		target: "test",
	})
	try {
		recordHeartbeat(older.session_id) // older tab is live
		// Without intentSlug: the predicate doesn't know about the
		// other live session and would launch a duplicate tab.
		assert.strictEqual(
			shouldLaunchReviewBrowser(true, "https://example.test", newer.session_id),
			true,
			"without intent slug, no cross-session dedupe",
		)
		// With intentSlug: predicate finds the live older session for
		// the same intent → suppresses the launch.
		assert.strictEqual(
			shouldLaunchReviewBrowser(
				true,
				"https://example.test",
				newer.session_id,
				"shared-intent",
			),
			false,
			"intent slug dedupe: an existing live SPA tab on the same intent must suppress the launch",
		)
	} finally {
		deleteSession(older.session_id)
		deleteSession(newer.session_id)
	}
})

test("intent_slug arg: no live session for intent → launch", () => {
	// No sessions for the intent at all. The predicate should still
	// say "launch" — there's no tab to refresh.
	const result = shouldLaunchReviewBrowser(
		true,
		"https://example.test",
		"sess-does-not-exist",
		"orphan-intent",
	)
	assert.strictEqual(
		result,
		true,
		"intent slug present but no live session: launch as normal",
	)
})

// The reported bug (2026-05-26 CRITICAL): at a gate the SPA never opened,
// so the session never heartbeated. `shouldLaunchReviewBrowser` suppressed
// the launch on mere session EXISTENCE (findLiveReviewSessionForIntent),
// so the never-attached session record made the engine think "a tab's
// already open, just refresh it" — and NOTHING opened. The fix: suppress
// only when a browser is GENUINELY attached (fresh heartbeat). A stale /
// never-attached session must NOT suppress — the gate always (re)launches.
test("a never-attached session for the intent does NOT suppress the launch (the bug)", () => {
	// ONE stale never-attached session for the intent. A new gate fires; the
	// stale record must NOT block the launch, since no browser is attached.
	const stale = createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "never-attached-intent",
		target: "test",
	})
	try {
		// `stale` exists but never heartbeated → not genuinely attached.
		beginPresenceWatch(stale.session_id, { startedAt: Date.now() - 61_000 })
		assert.strictEqual(
			shouldLaunchReviewBrowser(
				true,
				"https://example.test",
				"new-gate-session",
				"never-attached-intent",
			),
			true,
			"a stale never-attached session must NOT suppress the launch — the gate opens",
		)
		// And the 60s never-attached sweep still marks it presence-lost (so
		// the await fails-fast with a recovery path rather than hanging).
		_runPresenceSweepForTests()
		assert.ok(
			hasPresenceLost(stale.session_id),
			"never-attached session is also marked presence-lost after 60s",
		)
	} finally {
		deleteSession(stale.session_id)
	}
})

test("an ATTACHED session for the intent DOES suppress a duplicate launch", () => {
	// The dedupe that must still hold: a genuinely-attached tab (fresh
	// heartbeat) for the intent means a second window would be a duplicate.
	const attached = createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "attached-dedupe-intent",
		target: "test",
	})
	try {
		recordHeartbeat(attached.session_id) // a live tab is attached now
		assert.strictEqual(
			shouldLaunchReviewBrowser(
				true,
				"https://example.test",
				"new-gate-session",
				"attached-dedupe-intent",
			),
			false,
			"an attached tab for the intent suppresses the duplicate launch",
		)
	} finally {
		deleteSession(attached.session_id)
	}
})

test("exempt (final intent gate) never-attached watch is NOT swept — holds for the human", () => {
	const s = createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "final-gate-intent",
		target: "test",
	})
	try {
		beginPresenceWatch(s.session_id, {
			startedAt: Date.now() - 120_000,
			exempt: true,
		})
		_runPresenceSweepForTests()
		assert.ok(
			!hasPresenceLost(s.session_id),
			"the exempt final intent gate holds for the human — never marked never-attached-lost",
		)
	} finally {
		deleteSession(s.session_id)
	}
})

test("a session that heartbeated once is NOT treated as never-attached", () => {
	const s = createSession({
		intent_dir: "/tmp/no-such-dir",
		intent_slug: "attached-intent",
		target: "test",
	})
	try {
		beginPresenceWatch(s.session_id, { startedAt: Date.now() - 120_000 })
		recordHeartbeat(s.session_id) // first heartbeat clears the never-attached watch
		_runPresenceSweepForTests()
		assert.ok(
			!hasPresenceLost(s.session_id),
			"an attached session isn't never-attached; the fresh heartbeat keeps it live",
		)
	} finally {
		deleteSession(s.session_id)
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
