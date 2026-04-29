#!/usr/bin/env npx tsx
// Test suite for parseOutputArtifacts — verifies recursive walk and full
// type coverage. Regression for FB-21: nested artifacts (e.g.
// `artifacts/wireframes/foo.html`) were dropped by the old non-recursive
// readdir, hiding wireframes from the review screen even though they were
// committed and visible to the review-agent scope filter.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parseOutputArtifacts } from "../src/parser.ts"

const tmp = mkdtempSync(join(tmpdir(), "haiku-parse-output-"))
let passed = 0
let failed = 0

function test(name, fn) {
	try {
		const r = fn()
		if (r && typeof r.then === "function") {
			return r.then(
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
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
	}
}

function setupIntent() {
	const intentDir = mkdtempSync(join(tmp, "intent-"))
	const designArtifacts = join(intentDir, "stages", "design", "artifacts")
	mkdirSync(designArtifacts, { recursive: true })
	mkdirSync(join(designArtifacts, "wireframes"), { recursive: true })
	mkdirSync(join(designArtifacts, "exports", "v1"), { recursive: true })
	writeFileSync(
		join(designArtifacts, "ARCHITECTURE.md"),
		"---\ntitle: Architecture\n---\n# Body",
	)
	writeFileSync(
		join(designArtifacts, "wireframes", "knowledge-upload.html"),
		"<!doctype html><html><body>upload</body></html>",
	)
	writeFileSync(
		join(designArtifacts, "wireframes", "drift-indicator.html"),
		"<!doctype html><html><body>drift</body></html>",
	)
	writeFileSync(join(designArtifacts, "exports", "v1", "icon.svg"), "<svg/>")
	writeFileSync(join(designArtifacts, "tokens.json"), '{"foo": "bar"}')
	return intentDir
}

await test("recurses into subdirectories (regression: wireframes/*.html surface)", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.ok(
		names.includes("wireframes/knowledge-upload"),
		`Expected nested wireframe to surface; got ${JSON.stringify(names)}`,
	)
	assert.ok(
		names.includes("wireframes/drift-indicator"),
		"Second wireframe should surface too",
	)
	assert.ok(
		names.includes("exports/v1/icon"),
		"Deeply nested image should surface",
	)
})

await test("preserves directory hierarchy in artifact name", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const wireframe = artifacts.find(
		(a) => a.name === "wireframes/knowledge-upload",
	)
	assert.ok(wireframe, "wireframe should be findable by hierarchical name")
	assert.strictEqual(wireframe.type, "html")
	assert.ok(wireframe.content?.includes("upload"), "html content inlined")
})

await test("unknown extensions surface as type:file with relativePath", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const tokens = artifacts.find((a) => a.name === "tokens")
	assert.ok(tokens, "tokens.json (unknown ext) should surface")
	assert.strictEqual(tokens.type, "file")
	assert.strictEqual(tokens.relativePath, "design/artifacts/tokens.json")
	assert.strictEqual(
		tokens.content,
		undefined,
		"file type does not inline content",
	)
})

await test("relativePath for nested files preserves the hierarchy", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const wireframe = artifacts.find(
		(a) => a.name === "wireframes/knowledge-upload",
	)
	assert.strictEqual(
		wireframe.relativePath,
		"design/artifacts/wireframes/knowledge-upload.html",
	)
})

await test("top-level files still surface", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const arch = artifacts.find((a) => a.name === "ARCHITECTURE")
	assert.ok(arch, "top-level ARCHITECTURE.md should surface")
	assert.strictEqual(arch.type, "markdown")
})

await test("missing artifacts dir yields empty array (no throw)", async () => {
	const intentDir = mkdtempSync(join(tmp, "empty-"))
	const artifacts = await parseOutputArtifacts(intentDir)
	assert.deepStrictEqual(artifacts, [])
})

console.log(`\n${passed} passed, ${failed} failed`)
rmSync(tmp, { recursive: true, force: true })
process.exit(failed > 0 ? 1 : 0)
