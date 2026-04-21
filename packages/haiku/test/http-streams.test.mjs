#!/usr/bin/env npx tsx
// Test suite for H·AI·K·U HTTP stream-handler path-traversal rejection.
// Covers /files, /mockups, /wireframe, /stage-artifacts — every one MUST
// return 403 with {error:"forbidden_path_traversal"} when the requested
// path escapes the session-scoped artifact root.
// Run: npx tsx test/http-streams.test.mjs

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
import { startHttpServer } from "../src/http.ts"
import { createSession } from "../src/sessions.ts"

// ── Setup ──────────────────────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), "haiku-http-streams-test-"))
const origCwd = process.cwd()

const projDir = join(tmp, "project")
const haikuRoot = join(projDir, ".haiku")
const intentSlug = "test-http-streams"
const intentDirPath = join(haikuRoot, "intents", intentSlug)
const stageName = "development"

mkdirSync(join(intentDirPath, "stages", stageName, "units"), {
	recursive: true,
})
mkdirSync(join(intentDirPath, "mockups"), { recursive: true })
mkdirSync(join(haikuRoot, "knowledge"), { recursive: true })

// Seed a legitimate artifact under each allowed root so the happy-path
// verification has something to return.
writeFileSync(join(intentDirPath, "mockups", "hello.txt"), "hello-mockup")
writeFileSync(join(intentDirPath, "inside.txt"), "hello-inside")
writeFileSync(join(haikuRoot, "knowledge", "note.md"), "# knowledge")

writeFileSync(
	join(intentDirPath, "intent.md"),
	`---
title: Test HTTP Streams Intent
studio: software
mode: continuous
active_stage: ${stageName}
status: active
stages:
  - ${stageName}
started_at: 2026-04-20T00:00:00Z
completed_at: null
---

Stream handler path-traversal rejection fixtures.
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

// Stub git so any downstream state commit doesn't choke on a missing repo.
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

let baseUrl
let reviewSessionId

// ── Start server + seed a review session ───────────────────────────────────

async function run() {
	const port = await startHttpServer()
	baseUrl = `http://127.0.0.1:${port}`

	const session = createSession({
		intent_slug: intentSlug,
		intent_dir: intentDirPath,
		review_type: "intent",
		target: "review",
	})
	reviewSessionId = session.session_id

	// ── /files — traversal must be 403 (spec: "returns 403 (not 200, not 400)") ──

	console.log("\n=== /files/:sessionId/*path path-traversal ===")

	await test("GET /files traversal returns 403 with typed error", async () => {
		const res = await fetch(
			`${baseUrl}/files/${reviewSessionId}/..%2F..%2Fetc%2Fpasswd`,
		)
		assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`)
		const data = await res.json()
		assert.strictEqual(data.error, "forbidden_path_traversal")
	})

	await test("GET /files on a legitimate file inside intent_dir returns 200", async () => {
		const res = await fetch(`${baseUrl}/files/${reviewSessionId}/inside.txt`)
		assert.strictEqual(res.status, 200)
		const body = await res.text()
		assert.strictEqual(body, "hello-inside")
	})

	// ── /mockups — traversal must be 403 with typed error ────────────────────

	console.log("\n=== /mockups/:sessionId/:path path-traversal ===")

	await test("GET /mockups traversal returns 403 with typed error", async () => {
		const res = await fetch(
			`${baseUrl}/mockups/${reviewSessionId}/..%2F..%2Fetc%2Fpasswd`,
		)
		assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`)
		const data = await res.json()
		assert.strictEqual(data.error, "forbidden_path_traversal")
	})

	await test("GET /mockups on a legitimate mockup file returns 200", async () => {
		const res = await fetch(`${baseUrl}/mockups/${reviewSessionId}/hello.txt`)
		assert.strictEqual(res.status, 200)
		const body = await res.text()
		assert.strictEqual(body, "hello-mockup")
	})

	// ── /wireframe — traversal must be 403 with typed error ──────────────────

	console.log("\n=== /wireframe/:sessionId/:path path-traversal ===")

	await test("GET /wireframe traversal returns 403 with typed error", async () => {
		const res = await fetch(
			`${baseUrl}/wireframe/${reviewSessionId}/..%2F..%2Fetc%2Fpasswd`,
		)
		assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`)
		const data = await res.json()
		assert.strictEqual(data.error, "forbidden_path_traversal")
	})

	// ── /stage-artifacts — traversal must be 403 with typed error ────────────

	console.log("\n=== /stage-artifacts/:sessionId/:path path-traversal ===")

	await test("GET /stage-artifacts traversal returns 403 with typed error", async () => {
		const res = await fetch(
			`${baseUrl}/stage-artifacts/${reviewSessionId}/..%2F..%2Fetc%2Fpasswd`,
		)
		assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`)
		const data = await res.json()
		assert.strictEqual(data.error, "forbidden_path_traversal")
	})

	// Encoded absolute-path probe — `/etc/passwd` resolves outside the root
	// and MUST still be rejected with 403 (defence-in-depth: not relying on
	// the `..` token alone).
	await test("GET /mockups with absolute path fixture returns 403", async () => {
		const res = await fetch(
			`${baseUrl}/mockups/${reviewSessionId}/%2Fetc%2Fpasswd`,
		)
		// `/etc/passwd` resolves outside the mockups root → 403 traversal reject.
		assert.strictEqual(res.status, 403, `expected 403, got ${res.status}`)
	})

	console.log(`\n${passed} passed, ${failed} failed\n`)
}

try {
	await run()
} finally {
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true })
	process.exit(failed > 0 ? 1 : 0)
}
