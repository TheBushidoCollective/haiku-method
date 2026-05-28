#!/usr/bin/env npx tsx
// Test suite for the haiku_review_open SPA wire round-trip.
//
// Coverage:
//   1. Open round-trip (Done) — handleToolCall("haiku_review_open") creates an
//      ad-hoc session and returns IMMEDIATELY (non-blocking) with a
//      pane-open / "non-blocking, keep working" message carrying the review
//      URL. A subsequent /decide POST (the SPA's Done) reaps the session
//      server-side, since nothing is awaiting it.
//   2. Request-changes round-trip — same non-blocking open; the return points
//      the agent at `haiku_run_next` (durable feedback flows into the fix loop
//      on the next tick), and a `changes_requested` /decide POST likewise reaps
//      the ad-hoc session.
//   3. Schema rejection — bad args return the stable named code
//      `haiku_review_open_input_invalid`.
//
// Non-blocking contract (2026-05-22): /haiku:haiku-show is a browse surface,
// not a gate. `haiku_review_open` no longer blocks on `waitForSession` — it
// returns the moment the pane is open so the agent keeps working. Only an
// ACTUAL gate blocks (via `gate_kind` + `haiku_await_gate`). The decide route
// reaps ad-hoc sessions on Done / Request Changes instead of resolving a
// blocked handler.
//
// Run: npx tsx test/spa-wire-round-trip.test.mjs

import assert from "node:assert"
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

// ─── Fixture: tmpdir with a single active intent ──────────────────────────

const tmp = mkdtempSync(join(tmpdir(), "haiku-spa-wire-test-"))
const projDir = join(tmp, "project")
const haikuRoot = join(projDir, ".haiku")
const intentSlug = "spa-wire-test"
const intentDirPath = join(haikuRoot, "intents", intentSlug)
const stageName = "development"

mkdirSync(join(intentDirPath, "stages", stageName, "units"), {
	recursive: true,
})

writeFileSync(
	join(intentDirPath, "intent.md"),
	`---
title: SPA Wire Round-Trip Fixture
studio: software
mode: continuous
active_stage: ${stageName}
status: active
stages:
  - ${stageName}
started_at: 2026-05-07T00:00:00Z
completed_at: null
---

# SPA Wire Round-Trip Fixture

A minimal intent so haiku_review_open can resolve the active intent and
build a review URL.
`,
)

writeFileSync(
	join(intentDirPath, "stages", stageName, "state.json"),
	JSON.stringify(
		{
			stage: stageName,
			status: "active",
			phase: "execute",
			visits: 0,
		},
		null,
		2,
	),
)

// PATH-stub `open` (macOS), `xdg-open` (linux), and `git` so the
// best-effort browser launch doesn't actually pop a tab on the test
// host and any incidental git rev-parse during state-tool import
// returns a clean exit. The handler treats failures as best-effort,
// so a no-op stub keeps things quiet.
const fakeBin = join(tmp, "fake-bin")
mkdirSync(fakeBin, { recursive: true })
for (const bin of ["open", "xdg-open", "git"]) {
	const path = join(fakeBin, bin)
	writeFileSync(path, "#!/bin/sh\nexit 0\n")
	chmodSync(path, 0o755)
}
process.env.PATH = `${fakeBin}:${process.env.PATH}`

// ─── Wire the engine to the fixture ──────────────────────────────────────

const { setHaikuRootForTests, setIsGitRepoForTests } = await import(
	"../src/state/shared.ts"
)
setHaikuRootForTests(haikuRoot)
// Force non-git mode — the handler's branch-detection (intentFromCurrentBranch)
// needs to short-circuit so we exercise the listVisibleIntents fallback
// (single active intent → auto-resolve slug).
setIsGitRepoForTests(false)

const { handleToolCall } = await import("../src/server/tool-call.ts")
const { stopHttpServer, getActualPort } = await import("../src/http.ts")
const {
	deleteSession,
	getSession,
	updateSession: _updateSession,
} = await import("../src/sessions.ts")

// ─── Test runner ──────────────────────────────────────────────────────────

let passed = 0
let failed = 0

async function test(name, fn) {
	try {
		await fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (process.env.VERBOSE) console.error(e)
	}
}

// Helper: dispatch haiku_review_open with no slug; the handler
// auto-resolves the sole active intent from the fixture.
function callReviewOpen(args = {}, signal) {
	return handleToolCall(
		{
			params: {
				name: "haiku_review_open",
				arguments: args,
			},
		},
		signal,
	)
}

// Approach: scrape the session id off `console.error` output. The
// handler always calls launchBrowserBestEffort which logs
//   [haiku] Ad-hoc review ready → http://127.0.0.1:PORT/review/SESSION_ID
// before blocking on waitForSession. ES module exports are immutable
// bindings, so monkey-patching createSession isn't possible.
const _origConsoleError = console.error
let _capturedSessionId = null
const _consoleErrorBuffer = []
console.error = function captured(...args) {
	const line = args
		.map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
		.join(" ")
	_consoleErrorBuffer.push(line)
	const m = line.match(/\/review\/([A-Za-z0-9_-]+)/)
	if (m) _capturedSessionId = m[1]
	if (process.env.VERBOSE) _origConsoleError.apply(this, args)
}
function _resetCapture() {
	_capturedSessionId = null
	_consoleErrorBuffer.length = 0
}

console.log("\n=== haiku_review_open: SPA wire round-trip ===")

await test("open round-trip (Done) — non-blocking return + /decide reaps the ad-hoc session", async () => {
	_resetCapture()
	// Non-blocking: the call resolves immediately — no decide POST needed
	// first, and no spin-wait for the session to be minted.
	const result = await callReviewOpen({ intent: intentSlug, stage: stageName })
	assert.ok(result.content?.length > 0, "result must have content")
	assert.ok(!result.isError, "ad-hoc open must not be flagged isError")
	const body = result.content[0].text
	assert.ok(
		/non-blocking/i.test(body),
		`return must signal the pane is non-blocking; got: ${body.slice(0, 300)}`,
	)
	// The review URL (carrying the session id) is in the return.
	const m = body.match(/\/review\/([A-Za-z0-9_-]+)/)
	assert.ok(m, `return must include the review URL; got: ${body.slice(0, 300)}`)
	const sessionId = m[1]

	// Session is registered as ad_hoc + pending while the pane is open.
	const initial = getSession(sessionId)
	assert.ok(initial, "session must exist in registry after open")
	assert.strictEqual(initial.session_type, "review")
	assert.strictEqual(initial.ad_hoc, true)
	assert.strictEqual(initial.status, "pending")

	// Done → real SPA wire POST /review/:id/decide (approved). Nothing is
	// awaiting it (non-blocking open already returned); the decide route
	// reaps the ad-hoc session server-side.
	const port = getActualPort()
	assert.ok(port, "http server must be listening")
	const wireRes = await fetch(
		`http://127.0.0.1:${port}/review/${sessionId}/decide`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ decision: "approved", feedback: "" }),
		},
	)
	assert.strictEqual(
		wireRes.status,
		200,
		`expected 200 from /decide, got ${wireRes.status}`,
	)
	const wireBody = await wireRes.json()
	assert.strictEqual(wireBody.ok, true)
	assert.strictEqual(wireBody.decision, "approved")
	assert.strictEqual(
		getSession(sessionId),
		undefined,
		"ad-hoc session must be reaped after Done",
	)
})

await test("request-changes round-trip — non-blocking return points at haiku_run_next; /decide reaps", async () => {
	_resetCapture()
	const result = await callReviewOpen({ intent: intentSlug, stage: stageName })
	assert.ok(result.content?.length > 0)
	assert.ok(!result.isError, "request-changes open must not be flagged isError")
	const body = result.content[0].text
	// The pane is open before any decision is made, so the return can't name
	// the outcome — instead it points the agent at haiku_run_next, which is
	// what routes any feedback the user leaves into the fix loop.
	assert.ok(
		/haiku_run_next/.test(body),
		`return must point at haiku_run_next so feedback flows into the fix-loop; got: ${body.slice(0, 300)}`,
	)
	const sessionId = body.match(/\/review\/([A-Za-z0-9_-]+)/)?.[1]
	assert.ok(sessionId, `return must include the review URL; got: ${body.slice(0, 300)}`)

	const port = getActualPort()
	const wireRes = await fetch(
		`http://127.0.0.1:${port}/review/${sessionId}/decide`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				decision: "changes_requested",
				feedback: "Please revise the units",
			}),
		},
	)
	assert.strictEqual(wireRes.status, 200)
	const wireBody = await wireRes.json()
	assert.strictEqual(wireBody.decision, "changes_requested")
	assert.strictEqual(
		getSession(sessionId),
		undefined,
		"ad-hoc session must be reaped after Request Changes",
	)
})

await test("schema rejection — malformed args returns haiku_review_open_input_invalid", async () => {
	// `additionalProperties: false` on the input schema rejects any
	// stray field. `intent` is typed as string — passing a number
	// also fails the gate.
	const result = await handleToolCall({
		params: {
			name: "haiku_review_open",
			arguments: { intent: 123, bogus_extra_field: "nope" },
		},
	})
	assert.ok(result.isError === true, "schema-invalid input must flag isError")
	const body = result.content[0].text
	const parsed = JSON.parse(body)
	assert.strictEqual(
		parsed.error,
		"haiku_review_open_input_invalid",
		`expected stable error code, got: ${parsed.error}`,
	)
	assert.strictEqual(parsed.tool, "haiku_review_open")
	assert.ok(
		Array.isArray(parsed.errors) && parsed.errors.length > 0,
		"schema rejection must include errors[]",
	)
	// Confirm structuredContent matches the named-code contract.
	assert.strictEqual(
		result.structuredContent?.error,
		"haiku_review_open_input_invalid",
	)
})

// ─── Cleanup ──────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`)

try {
	// Drop any sessions the spy captured but the handler may not have
	// torn down (best-effort; the handler's finally already runs).
	if (_capturedSessionId) deleteSession(_capturedSessionId)
} catch {
	/* ignore */
}

try {
	await stopHttpServer()
} catch {
	/* ignore */
}

// Restore console.error.
console.error = _origConsoleError

// Restore overrides.
setHaikuRootForTests(null)
setIsGitRepoForTests(null)

process.chdir(_origCwd)

try {
	rmSync(tmp, { recursive: true })
} catch {
	/* ignore */
}

process.exit(failed > 0 ? 1 : 0)
