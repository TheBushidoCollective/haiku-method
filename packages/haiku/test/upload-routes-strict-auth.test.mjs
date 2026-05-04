#!/usr/bin/env npx tsx
// Strict-mode upload-routes mutation auth test (R-01 regression guard).
//
// When HAIKU_REMOTE_REVIEW=1 the public tunnel is live and the upload
// routes MUST bind the JWT's `sid` claim to the URL's intent slug —
// not just verify the JWT signature. Pre-fix the routes called
// requireTunnelAuth(req, reply, null) which validates signature/expiry
// only; a tunnel-mode reviewer holding a valid JWT for review session
// S1 (bound to intent A) could POST uploads to intent B and have them
// attributed there. This test pins the cross-session bypass so a future
// rewrite can't silently regress it.
//
// Mirrors http-feedback-strict-auth.test.mjs which guards the same
// invariant on the feedback API surface.

import assert from "node:assert"
import { spawnSync } from "node:child_process"
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

// If we weren't invoked with the feature flag on, re-exec ourselves so
// features.remoteReview is `true` when config.ts loads.
if (process.env.HAIKU_REMOTE_REVIEW !== "1") {
	const __filename = fileURLToPath(import.meta.url)
	const result = spawnSync("npx", ["tsx", __filename], {
		encoding: "utf8",
		stdio: "inherit",
		env: { ...process.env, HAIKU_REMOTE_REVIEW: "1" },
		timeout: 60000,
	})
	process.exit(result.status ?? 0)
}

const { startHttpServer } = await import("../src/http.ts")
const { createSession } = await import("../src/sessions.ts")
const { __setActiveTunnelForTesting, signJWT } = await import(
	"../src/tunnel.ts"
)

const STUB_TUNNEL_URL = "https://stub-upload-strict-auth.loca.lt"
__setActiveTunnelForTesting(STUB_TUNNEL_URL)

function mintJWT(sid) {
	const now = Math.floor(Date.now() / 1000)
	return signJWT({
		tun: STUB_TUNNEL_URL,
		sid,
		typ: "review",
		key: "dGVzdA",
		iat: now,
		exp: now + 3600,
	})
}

const tmp = mkdtempSync(join(tmpdir(), "haiku-upload-strict-auth-"))
const origCwd = process.cwd()

const projDir = join(tmp, "project")
const haikuRoot = join(projDir, ".haiku")
const stageName = "design"

// ── Two distinct intents (A and B), each with the same active stage ────────
function seedIntent(slug) {
	const intentDirPath = join(haikuRoot, "intents", slug)
	mkdirSync(join(intentDirPath, "stages", stageName, "units"), {
		recursive: true,
	})
	mkdirSync(join(intentDirPath, "stages", stageName, "artifacts"), {
		recursive: true,
	})
	mkdirSync(join(intentDirPath, "knowledge"), { recursive: true })
	writeFileSync(
		join(intentDirPath, "intent.md"),
		`---
title: ${slug}
studio: software
mode: continuous
active_stage: ${stageName}
status: active
stages:
  - ${stageName}
started_at: 2026-04-29T18:00:00Z
completed_at: null
---

Cross-session bypass regression intent.
`,
	)
	writeFileSync(
		join(intentDirPath, "stages", stageName, "state.json"),
		JSON.stringify(
			{
				stage: stageName,
				status: "active",
				phase: "execute",
				started_at: "2026-04-29T18:05:00Z",
				completed_at: null,
				gate_entered_at: null,
				gate_outcome: null,
				visits: 0,
				iteration: 1,
			},
			null,
			2,
		),
	)
	return intentDirPath
}

const intentASlug = "upload-strict-auth-intent-a"
const intentBSlug = "upload-strict-auth-intent-b"
const intentADirPath = seedIntent(intentASlug)
const intentBDirPath = seedIntent(intentBSlug)

// Stub git so any helper that shells out doesn't blow up.
process.env.PATH = `${join(tmp, "fake-bin")}:${process.env.PATH}`
mkdirSync(join(tmp, "fake-bin"), { recursive: true })
writeFileSync(join(tmp, "fake-bin", "git"), "#!/bin/sh\nexit 0\n")
chmodSync(join(tmp, "fake-bin", "git"), 0o755)

process.chdir(projDir)

let passed = 0
let failed = 0
function test(name, fn) {
	return fn().then(
		() => {
			passed++
			console.log(`  ✓ ${name}`)
		},
		(e) => {
			failed++
			console.log(`  ✗ ${name}: ${e.message}`)
		},
	)
}

// ── Multipart helper (same shape as upload-routes.test.mjs builds) ─────────
function buildMultipart(boundary, fields) {
	const chunks = []
	for (const [name, value] of Object.entries(fields)) {
		if (
			value &&
			typeof value === "object" &&
			"filename" in value &&
			"content" in value
		) {
			chunks.push(`--${boundary}\r\n`)
			chunks.push(
				`Content-Disposition: form-data; name="${name}"; filename="${value.filename}"\r\n`,
			)
			chunks.push(
				`Content-Type: ${value.contentType ?? "application/octet-stream"}\r\n\r\n`,
			)
			chunks.push(value.content)
			chunks.push("\r\n")
		} else {
			chunks.push(`--${boundary}\r\n`)
			chunks.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`)
			chunks.push(`${value}\r\n`)
		}
	}
	chunks.push(`--${boundary}--\r\n`)
	return Buffer.concat(
		chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c, "utf-8"))),
	)
}

async function postUpload(baseUrl, intentSlug, route, fields, headers) {
	const boundary = `----R01TestBoundary${Date.now()}${Math.random().toString(36).slice(2)}`
	const body = buildMultipart(boundary, fields)
	// V-08 CSRF Layer 2 (origin allowlist) — `csrf.ts:readAllowedOrigins`
	// defaults to `['http://localhost:*']` (matches any loopback port).
	// Pass that as the Origin so the request reaches the route handler
	// instead of being short-circuited with `403 forbidden / origin_missing`.
	// This test exercises auth (R-01), not CSRF — see csrf.test.mjs for
	// CSRF-specific coverage.
	const url = new URL(baseUrl)
	const loopbackOrigin = `http://localhost:${url.port}`
	return fetch(`${baseUrl}/api/intents/${intentSlug}/uploads/${route}`, {
		method: "POST",
		headers: {
			"Content-Type": `multipart/form-data; boundary=${boundary}`,
			Origin: loopbackOrigin,
			...headers,
		},
		body,
	})
}

async function run() {
	const port = await startHttpServer()
	const baseUrl = `http://127.0.0.1:${port}`

	// Bootstrap two review sessions: one bound to intent A, one to intent B.
	const sessionA = createSession({
		intent_slug: intentASlug,
		intent_dir: intentADirPath,
		review_type: "intent",
		target: "review",
	})
	const sessionB = createSession({
		intent_slug: intentBSlug,
		intent_dir: intentBDirPath,
		review_type: "intent",
		target: "review",
	})
	const jwtA = mintJWT(sessionA.session_id)
	const jwtB = mintJWT(sessionB.session_id)

	console.log(
		"\n=== R-01 cross-session JWT bypass on upload routes (HAIKU_REMOTE_REVIEW=1) ===",
	)

	// ── R-01 baseline: own-intent JWT proceeds ────────────────────────────────
	await test("R-01 baseline: stage-output upload with own-intent JWT proceeds (200)", async () => {
		const res = await postUpload(
			baseUrl,
			intentASlug,
			"stage-output",
			{
				stage: stageName,
				target_path: "artifacts/r01-baseline-a.txt",
				mode: "create",
				attribute_to_user: "alice",
				file: {
					filename: "r01-baseline-a.txt",
					content: "baseline\n",
					contentType: "text/plain",
				},
			},
			{ Authorization: `Bearer ${jwtA}` },
		)
		assert.strictEqual(
			res.status,
			200,
			`expected 200 with own-intent JWT, got ${res.status}`,
		)
	})

	await test("R-01 baseline: knowledge upload with own-intent JWT proceeds (200)", async () => {
		const res = await postUpload(
			baseUrl,
			intentASlug,
			"knowledge",
			{
				target_filename: "r01-baseline-knowledge.md",
				attribute_to_user: "alice",
				file: {
					filename: "r01-baseline-knowledge.md",
					content: "# baseline\n",
					contentType: "text/markdown",
				},
			},
			{ Authorization: `Bearer ${jwtA}` },
		)
		assert.strictEqual(
			res.status,
			200,
			`expected 200 with own-intent JWT, got ${res.status}`,
		)
	})

	// ── R-01 cross-session bypass attempt — the load-bearing test ────────────
	await test("R-01: stage-output upload with JWT for DIFFERENT intent's session returns 403 forbidden_cross_session (no cross-intent attribution)", async () => {
		// Use intent A's JWT to POST to intent B's stage-output endpoint.
		// Pre-fix this would 200 and write into intent B with
		// attribute_to_user='alice' even though sessionA is bound to intent A.
		const res = await postUpload(
			baseUrl,
			intentBSlug,
			"stage-output",
			{
				stage: stageName,
				target_path: "artifacts/r01-cross-session.txt",
				mode: "create",
				attribute_to_user: "mallory",
				file: {
					filename: "r01-cross-session.txt",
					content: "cross-intent payload\n",
					contentType: "text/plain",
				},
			},
			{ Authorization: `Bearer ${jwtA}` },
		)
		assert.strictEqual(
			res.status,
			403,
			`expected 403 cross-session, got ${res.status} — R-01 bypass open`,
		)
		const data = await res.json()
		assert.strictEqual(data.error, "forbidden_cross_session")
		assert.strictEqual(data.reason, "intent_mismatch")
	})

	await test("R-01: knowledge upload with JWT for DIFFERENT intent's session returns 403 forbidden_cross_session", async () => {
		// Use intent B's JWT to POST to intent A's knowledge endpoint.
		const res = await postUpload(
			baseUrl,
			intentASlug,
			"knowledge",
			{
				target_filename: "r01-cross-session-knowledge.md",
				attribute_to_user: "mallory",
				file: {
					filename: "r01-cross-session-knowledge.md",
					content: "cross-intent knowledge\n",
					contentType: "text/markdown",
				},
			},
			{ Authorization: `Bearer ${jwtB}` },
		)
		assert.strictEqual(
			res.status,
			403,
			`expected 403 cross-session, got ${res.status} — R-01 bypass open`,
		)
		const data = await res.json()
		assert.strictEqual(data.error, "forbidden_cross_session")
		assert.strictEqual(data.reason, "intent_mismatch")
	})

	await test("R-01: stage-output upload with JWT for unknown session returns 403 forbidden_cross_session", async () => {
		const bogusJwt = mintJWT("sess-does-not-exist")
		const res = await postUpload(
			baseUrl,
			intentASlug,
			"stage-output",
			{
				stage: stageName,
				target_path: "artifacts/r01-bogus-session.txt",
				mode: "create",
				attribute_to_user: "mallory",
				file: {
					filename: "r01-bogus-session.txt",
					content: "bogus\n",
					contentType: "text/plain",
				},
			},
			{ Authorization: `Bearer ${bogusJwt}` },
		)
		assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`)
		const data = await res.json()
		assert.strictEqual(data.error, "forbidden_cross_session")
		assert.strictEqual(data.reason, "unknown_session")
	})

	await test("R-01: stage-output upload with no auth at all returns 401 (tunnel gate fires first)", async () => {
		const res = await postUpload(
			baseUrl,
			intentASlug,
			"stage-output",
			{
				stage: stageName,
				target_path: "artifacts/r01-no-auth.txt",
				mode: "create",
				attribute_to_user: "anon",
				file: {
					filename: "r01-no-auth.txt",
					content: "anon\n",
					contentType: "text/plain",
				},
			},
			{},
		)
		assert.strictEqual(res.status, 401)
		const data = await res.json()
		assert.strictEqual(data.error, "unauthorized")
		assert.strictEqual(data.reason, "missing_token")
	})

	console.log(`\n${passed} passed, ${failed} failed\n`)
}

let hardFailure = null
try {
	await run()
} catch (err) {
	hardFailure = err
	console.error(
		`\n✗ run() crashed before completing tests: ${err instanceof Error ? err.message : err}`,
	)
	if (err instanceof Error && err.stack) console.error(err.stack)
} finally {
	__setActiveTunnelForTesting(null)
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true })
	const exitCode = failed > 0 || hardFailure ? 1 : 0
	process.exit(exitCode)
}
