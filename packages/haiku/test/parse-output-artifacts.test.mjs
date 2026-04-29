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

// ── Unit-declared outputs (out-of-band-human-file-modifications regression) ──
//
// Many stages produce outputs that live outside `stages/<stage>/artifacts/`
// — e.g. units writing to `<intent>/product/*.md` or `<intent>/features/*.feature`.
// Without scanning unit `outputs:` frontmatter, the review screen shows zero
// outputs even though the files exist on disk.

function setupIntentWithUnitOutputs() {
	const intentDir = mkdtempSync(join(tmp, "intent-units-"))
	// product stage with a unit declaring intent-relative + workspace-rel outputs
	const productUnits = join(intentDir, "stages", "product", "units")
	mkdirSync(productUnits, { recursive: true })
	mkdirSync(join(intentDir, "product"), { recursive: true })
	mkdirSync(join(intentDir, "features"), { recursive: true })
	writeFileSync(
		join(intentDir, "product", "ACCEPTANCE-CRITERIA.md"),
		"---\ntitle: Acceptance\n---\n# AC body",
	)
	writeFileSync(
		join(intentDir, "features", "drift-detection.feature"),
		"Feature: drift detection",
	)
	const intentName = intentDir.split("/").pop()
	writeFileSync(
		join(productUnits, "unit-01-acceptance.md"),
		`---\ntitle: Acceptance\noutputs:\n  - product/ACCEPTANCE-CRITERIA.md\n  - .haiku/intents/${intentName}/features/drift-detection.feature\n---\n# unit body`,
	)
	return intentDir
}

await test("unit outputs surface even when stages/<stage>/artifacts/ does not exist", async () => {
	const intentDir = setupIntentWithUnitOutputs()
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.ok(
		names.includes("product/ACCEPTANCE-CRITERIA"),
		`Expected unit-declared markdown output to surface; got ${JSON.stringify(names)}`,
	)
	assert.ok(
		names.includes("features/drift-detection"),
		`Expected unit-declared feature file to surface; got ${JSON.stringify(names)}`,
	)
})

await test("unit outputs are attributed to their unit's stage", async () => {
	const intentDir = setupIntentWithUnitOutputs()
	const artifacts = await parseOutputArtifacts(intentDir)
	const ac = artifacts.find((a) => a.name === "product/ACCEPTANCE-CRITERIA")
	assert.ok(ac, "AC should surface")
	assert.strictEqual(
		ac.stage,
		"product",
		"stage attribution comes from unit's parent stage dir",
	)
})

await test("unit outputs accept both intent-relative and workspace-relative paths", async () => {
	const intentDir = setupIntentWithUnitOutputs()
	const artifacts = await parseOutputArtifacts(intentDir)
	// `product/ACCEPTANCE-CRITERIA.md` was declared intent-relative
	// `.haiku/intents/<slug>/features/drift-detection.feature` was workspace-rel
	// Both should resolve and surface.
	const ac = artifacts.find((a) => a.name === "product/ACCEPTANCE-CRITERIA")
	const feat = artifacts.find((a) => a.name === "features/drift-detection")
	assert.ok(ac, "intent-relative path resolved")
	assert.ok(feat, "workspace-relative path resolved (prefix stripped)")
	assert.strictEqual(
		feat.relativePath,
		"features/drift-detection.feature",
		"relativePath is intent-dir-relative regardless of how the unit declared it",
	)
})

await test("unit-declared markdown is rendered with stripped frontmatter", async () => {
	const intentDir = setupIntentWithUnitOutputs()
	const artifacts = await parseOutputArtifacts(intentDir)
	const ac = artifacts.find((a) => a.name === "product/ACCEPTANCE-CRITERIA")
	assert.strictEqual(ac.type, "markdown")
	assert.ok(ac.content?.includes("AC body"), "markdown body inlined")
	assert.ok(!ac.content?.includes("title: Acceptance"), "frontmatter stripped")
})

await test("unit-declared unknown extension (.feature) surfaces as type:file", async () => {
	const intentDir = setupIntentWithUnitOutputs()
	const artifacts = await parseOutputArtifacts(intentDir)
	const feat = artifacts.find((a) => a.name === "features/drift-detection")
	assert.strictEqual(feat.type, "file")
	assert.strictEqual(feat.relativePath, "features/drift-detection.feature")
})

await test("file present in artifacts/ AND unit outputs is emitted once", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-dedupe-"))
	const stageArtifacts = join(intentDir, "stages", "design", "artifacts")
	const stageUnits = join(intentDir, "stages", "design", "units")
	mkdirSync(stageArtifacts, { recursive: true })
	mkdirSync(stageUnits, { recursive: true })
	writeFileSync(
		join(stageArtifacts, "DUPLICATE.md"),
		"---\ntitle: Dup\n---\n# from artifacts",
	)
	writeFileSync(
		join(stageUnits, "unit-01.md"),
		`---\ntitle: Unit\noutputs:\n  - stages/design/artifacts/DUPLICATE.md\n---\n# unit`,
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	const duplicates = artifacts.filter((a) => a.name.endsWith("DUPLICATE"))
	assert.strictEqual(
		duplicates.length,
		1,
		`Expected single dedupe entry; got ${duplicates.length}: ${JSON.stringify(artifacts.map((a) => a.name))}`,
	)
	// artifacts/ entry wins — its name is artifacts-dir-relative (no
	// `stages/design/artifacts/` prefix in the display name).
	assert.strictEqual(duplicates[0].name, "DUPLICATE")
})

await test("unit with no outputs frontmatter is silently skipped", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-no-outputs-"))
	const stageUnits = join(intentDir, "stages", "design", "units")
	mkdirSync(stageUnits, { recursive: true })
	writeFileSync(
		join(stageUnits, "unit-01.md"),
		"---\ntitle: No Outputs\n---\n# body",
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	assert.deepStrictEqual(artifacts, [])
})

await test("unit with non-array outputs frontmatter is silently skipped", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-bad-outputs-"))
	const stageUnits = join(intentDir, "stages", "design", "units")
	mkdirSync(stageUnits, { recursive: true })
	writeFileSync(
		join(stageUnits, "unit-01.md"),
		"---\ntitle: Bad\noutputs: not-an-array\n---\n# body",
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	assert.deepStrictEqual(artifacts, [])
})

await test("unit declares output that doesn't exist on disk — entry skipped, no throw", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-missing-output-"))
	const stageUnits = join(intentDir, "stages", "design", "units")
	mkdirSync(stageUnits, { recursive: true })
	writeFileSync(
		join(stageUnits, "unit-01.md"),
		"---\ntitle: Missing\noutputs:\n  - product/never-written.md\n---\n# body",
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	// Markdown read failure is silent; no entry surfaces.
	assert.deepStrictEqual(artifacts, [])
})

console.log(`\n${passed} passed, ${failed} failed`)
rmSync(tmp, { recursive: true, force: true })
process.exit(failed > 0 ? 1 : 0)
