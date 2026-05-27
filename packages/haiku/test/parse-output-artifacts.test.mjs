#!/usr/bin/env npx tsx
// Test suite for parseOutputArtifacts — verifies recursive walk and full
// type coverage. Regression for FB-021: nested artifacts (e.g.
// `artifacts/wireframes/foo.html`) were dropped by the old non-recursive
// readdir, hiding wireframes from the review screen even though they were
// committed and visible to the review-agent scope filter.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
	parseIntentRootFiles,
	parseOutputArtifacts,
	parseStageFiles,
} from "../src/parser.ts"

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
		names.includes("wireframes/knowledge-upload.html"),
		`Expected nested wireframe to surface; got ${JSON.stringify(names)}`,
	)
	assert.ok(
		names.includes("wireframes/drift-indicator.html"),
		"Second wireframe should surface too",
	)
	assert.ok(
		names.includes("exports/v1/icon.svg"),
		"Deeply nested image should surface",
	)
})

await test("preserves directory hierarchy in artifact name", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const wireframe = artifacts.find(
		(a) => a.name === "wireframes/knowledge-upload.html",
	)
	assert.ok(wireframe, "wireframe should be findable by hierarchical name")
	assert.strictEqual(wireframe.type, "html")
	assert.ok(wireframe.content?.includes("upload"), "html content inlined")
})

await test("text-shaped outputs surface as type:code with content + language (renderer syntax-highlights them)", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const tokens = artifacts.find((a) => a.name === "tokens.json")
	assert.ok(tokens, "tokens.json should surface")
	// Contract change 2026-05-27: text-shaped outputs (.json, .yaml,
	// .feature, source code, etc.) are inlined as type:"code" (with a
	// highlight.js `language` id) so reviewers READ them syntax-highlighted
	// in the review pane. The PRIOR behavior typed them "markdown" and fed
	// them through remark, which parsed embedded JSX/HTML as inline HTML and
	// DOMPurify stripped it — code outputs rendered as an empty box. The
	// behavior BEFORE that (type:"file" for everything non-{md,html,image})
	// made them unreviewable. See OUTPUT_TEXT_EXTS / EXT_TO_HLJS_LANG in
	// packages/haiku/src/parser.ts.
	assert.strictEqual(tokens.type, "code")
	assert.strictEqual(tokens.language, "json", ".json → json grammar")
	assert.ok(
		typeof tokens.content === "string" && tokens.content.length > 0,
		"text-shaped output must inline its content for the renderer",
	)
	// relativePath stays populated so the artifact's URL still works
	// for download / link-out use cases — only the rendering path
	// changed.
	assert.strictEqual(tokens.relativePath, "stages/design/artifacts/tokens.json")
})

await test("relativePath for nested files preserves the hierarchy", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const wireframe = artifacts.find(
		(a) => a.name === "wireframes/knowledge-upload.html",
	)
	assert.strictEqual(
		wireframe.relativePath,
		"stages/design/artifacts/wireframes/knowledge-upload.html",
	)
})

await test("top-level files still surface", async () => {
	const intentDir = setupIntent()
	const artifacts = await parseOutputArtifacts(intentDir)
	const arch = artifacts.find((a) => a.name === "ARCHITECTURE.md")
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
		names.includes("product/ACCEPTANCE-CRITERIA.md"),
		`Expected unit-declared markdown output to surface; got ${JSON.stringify(names)}`,
	)
	assert.ok(
		names.includes("features/drift-detection.feature"),
		`Expected unit-declared feature file to surface; got ${JSON.stringify(names)}`,
	)
})

await test("unit outputs are attributed to their unit's stage", async () => {
	const intentDir = setupIntentWithUnitOutputs()
	const artifacts = await parseOutputArtifacts(intentDir)
	const ac = artifacts.find((a) => a.name === "product/ACCEPTANCE-CRITERIA.md")
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
	const ac = artifacts.find((a) => a.name === "product/ACCEPTANCE-CRITERIA.md")
	const feat = artifacts.find(
		(a) => a.name === "features/drift-detection.feature",
	)
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
	const ac = artifacts.find((a) => a.name === "product/ACCEPTANCE-CRITERIA.md")
	assert.strictEqual(ac.type, "markdown")
	assert.ok(ac.content?.includes("AC body"), "markdown body inlined")
	assert.ok(!ac.content?.includes("title: Acceptance"), "frontmatter stripped")
})

await test("unit-declared .feature file surfaces as type:code so it renders in the review pane", async () => {
	const intentDir = setupIntentWithUnitOutputs()
	const artifacts = await parseOutputArtifacts(intentDir)
	const feat = artifacts.find(
		(a) => a.name === "features/drift-detection.feature",
	)
	// .feature files are Gherkin (text-shaped). They surface as type:"code"
	// with language "gherkin" so the renderer inlines + highlights them
	// (falling back to a plain escaped <pre> if the SPA's highlight.js build
	// lacks the gherkin grammar). Earlier history: type:"file" (download
	// link, unreviewable) → type:"markdown" (remark ate embedded markup).
	assert.strictEqual(feat.type, "code")
	assert.strictEqual(feat.language, "gherkin")
	assert.ok(
		typeof feat.content === "string" && feat.content.length > 0,
		"text-shaped output must inline its content",
	)
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
		join(stageUnits, "unit-01-foo.md"),
		`---\ntitle: Unit\noutputs:\n  - stages/design/artifacts/DUPLICATE.md\n---\n# unit`,
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	const duplicates = artifacts.filter((a) => a.name.endsWith("DUPLICATE.md"))
	assert.strictEqual(
		duplicates.length,
		1,
		`Expected single dedupe entry; got ${duplicates.length}: ${JSON.stringify(artifacts.map((a) => a.name))}`,
	)
	// artifacts/ entry wins — its name is artifacts-dir-relative (no
	// `stages/design/artifacts/` prefix in the display name).
	assert.strictEqual(duplicates[0].name, "DUPLICATE.md")
})

await test("unit with no outputs frontmatter is silently skipped", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-no-outputs-"))
	const stageUnits = join(intentDir, "stages", "design", "units")
	mkdirSync(stageUnits, { recursive: true })
	writeFileSync(
		join(stageUnits, "unit-01-foo.md"),
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
		join(stageUnits, "unit-01-foo.md"),
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
		join(stageUnits, "unit-01-foo.md"),
		"---\ntitle: Missing\noutputs:\n  - product/never-written.md\n---\n# body",
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	// Markdown read failure is silent; no entry surfaces.
	assert.deepStrictEqual(artifacts, [])
})

// ── Catch-all walk: any file in stages/<stage>/ that no other view claims ──
//
// Reviewers should see EVERYTHING the stage produced. Files that aren't in
// artifacts/ and aren't declared by a unit's outputs: should still surface
// (e.g. stages/<stage>/outputs/, ad-hoc README, supplementary docs). The
// only files that get hidden are workflow-internals: STAGE.md, state.json,
// units/, feedback/.

await test("catch-all: stages/<stage>/outputs/ files surface even when no unit declares them", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-catchall-outputs-"))
	const stageOutputs = join(intentDir, "stages", "design", "outputs")
	mkdirSync(stageOutputs, { recursive: true })
	writeFileSync(
		join(stageOutputs, "supplementary.md"),
		"---\ntitle: Supp\n---\n# supp body",
	)
	writeFileSync(join(stageOutputs, "tokens.json"), '{"x": 1}')
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.ok(
		names.includes("outputs/supplementary.md"),
		`expected outputs/supplementary; got ${JSON.stringify(names)}`,
	)
	assert.ok(
		names.includes("outputs/tokens.json"),
		`expected outputs/tokens; got ${JSON.stringify(names)}`,
	)
})

await test("catch-all: ad-hoc top-level files inside the stage dir surface", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-catchall-toplevel-"))
	const stageDir = join(intentDir, "stages", "design")
	mkdirSync(stageDir, { recursive: true })
	writeFileSync(
		join(stageDir, "README.md"),
		"---\ntitle: Readme\n---\n# stage readme body",
	)
	writeFileSync(join(stageDir, "notes.txt"), "loose notes")
	const artifacts = await parseOutputArtifacts(intentDir)
	const readme = artifacts.find((a) => a.name === "README.md")
	const notes = artifacts.find((a) => a.name === "notes.txt")
	assert.ok(
		readme,
		`expected README to surface; got ${JSON.stringify(artifacts.map((a) => a.name))}`,
	)
	assert.strictEqual(readme.type, "markdown")
	assert.ok(readme.content?.includes("stage readme body"))
	assert.ok(notes, "expected notes.txt to surface")
	// .txt is text-shaped → type:code (renderable). No EXT_TO_HLJS_LANG
	// mapping for .txt, so `language` is undefined → the renderer shows a
	// plain escaped <pre> (the ASCII floor) rather than tokenized colors.
	assert.strictEqual(notes.type, "code")
	assert.strictEqual(notes.language, undefined)
	assert.ok(
		typeof notes.content === "string" && notes.content.length > 0,
		"text-shaped output must inline its content",
	)
	assert.strictEqual(notes.relativePath, "stages/design/notes.txt")
})

await test("catch-all: workflow-internal entries are excluded (STAGE.md, state.json, units/, feedback/)", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-catchall-internal-"))
	const stageDir = join(intentDir, "stages", "design")
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	writeFileSync(join(stageDir, "STAGE.md"), "# stage def — workflow internal")
	writeFileSync(join(stageDir, "state.json"), "{}")
	writeFileSync(
		join(stageDir, "units", "unit-01-foo.md"),
		"---\ntitle: Unit\n---\n# unit body",
	)
	writeFileSync(
		join(stageDir, "feedback", "01-finding.md"),
		"---\ntitle: FB\n---\n# fb body",
	)
	// One real artifact for sanity
	writeFileSync(join(stageDir, "REAL.md"), "---\ntitle: Real\n---\n# real body")
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.deepStrictEqual(
		names,
		["REAL.md"],
		`workflow-internal entries should be hidden; got ${JSON.stringify(names)}`,
	)
})

await test("catch-all: stages/<stage>/knowledge/ and stages/<stage>/discovery/ are NOT surfaced as outputs (rendered by Knowledge tab instead)", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-knowledge-dedupe-"))
	const stageDir = join(intentDir, "stages", "design")
	mkdirSync(join(stageDir, "knowledge"), { recursive: true })
	mkdirSync(join(stageDir, "discovery"), { recursive: true })
	writeFileSync(
		join(stageDir, "knowledge", "UPLOAD-FLOW.md"),
		"---\ntitle: Upload Flow\n---\n# upload",
	)
	writeFileSync(
		join(stageDir, "discovery", "ARCHITECTURE.md"),
		"---\ntitle: Architecture\n---\n# arch",
	)
	// One real output for sanity.
	writeFileSync(
		join(stageDir, "DELIVERABLE.md"),
		"---\ntitle: Deliverable\n---\n# real output",
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.deepStrictEqual(
		names,
		["DELIVERABLE.md"],
		`stage-level knowledge/discovery should not bleed into Outputs; got ${JSON.stringify(names)}`,
	)
})

await test("catch-all: drift-engine sidecars are excluded (baseline-content/, baseline.json, .baseline-ack, baseline-thrash.json, drift-assessments/)", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-catchall-drift-"))
	const stageDir = join(intentDir, "stages", "design")
	// Drift-engine sidecars — sha256-named snapshots, baseline manifest,
	// ack marker, thrash counter, and assessment records. None are user
	// outputs; all are written by the orchestrator.
	mkdirSync(join(stageDir, "baseline-content"), { recursive: true })
	mkdirSync(join(stageDir, "drift-assessments"), { recursive: true })
	const fakeSha = "a".repeat(64)
	writeFileSync(join(stageDir, "baseline-content", fakeSha), "snapshot bytes")
	writeFileSync(
		join(stageDir, "baseline-content", "b".repeat(64)),
		"another snapshot",
	)
	writeFileSync(
		join(stageDir, "baseline.json"),
		'{"some/file":{"sha256":"...","path":"some/file","stage":"design","is_binary":false,"mtime":1,"tracking_class":"stage-output"}}',
	)
	writeFileSync(join(stageDir, ".baseline-ack"), "")
	writeFileSync(join(stageDir, "baseline-thrash.json"), "{}")
	writeFileSync(
		join(stageDir, "drift-assessments", "DA-01.json"),
		'{"id":"DA-01"}',
	)
	// One real artifact for sanity
	writeFileSync(join(stageDir, "REAL.md"), "---\ntitle: Real\n---\n# real body")
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.deepStrictEqual(
		names,
		["REAL.md"],
		`drift-engine sidecars should be hidden; got ${JSON.stringify(names)}`,
	)
})

await test("catch-all: nested files under non-internal subdirs surface with full path in name", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-catchall-nested-"))
	const deep = join(intentDir, "stages", "design", "outputs", "v2", "exports")
	mkdirSync(deep, { recursive: true })
	writeFileSync(join(deep, "icon.svg"), "<svg/>")
	const artifacts = await parseOutputArtifacts(intentDir)
	const icon = artifacts.find((a) => a.name === "outputs/v2/exports/icon.svg")
	assert.ok(icon, "deeply nested catch-all file should surface")
	assert.strictEqual(icon.type, "image")
	assert.strictEqual(
		icon.relativePath,
		"stages/design/outputs/v2/exports/icon.svg",
	)
})

await test("catch-all: artifacts/ files keep their artifact-style name + path (not double-emitted)", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-catchall-artifacts-"))
	const stageArtifacts = join(intentDir, "stages", "design", "artifacts")
	mkdirSync(stageArtifacts, { recursive: true })
	writeFileSync(
		join(stageArtifacts, "ONLY-IN-ARTIFACTS.md"),
		"---\ntitle: Only\n---\n# from artifacts",
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	const matches = artifacts.filter((a) => a.name === "ONLY-IN-ARTIFACTS.md")
	assert.strictEqual(
		matches.length,
		1,
		`expected single entry; got ${matches.length}`,
	)
})

await test("catch-all: unit-declared output wins over catch-all entry for the same file", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-catchall-unit-priority-"))
	const stageDir = join(intentDir, "stages", "design")
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "outputs"), { recursive: true })
	writeFileSync(
		join(stageDir, "outputs", "DECLARED.md"),
		"---\ntitle: Declared\n---\n# declared body",
	)
	writeFileSync(
		join(stageDir, "units", "unit-01-foo.md"),
		"---\ntitle: Unit\noutputs:\n  - stages/design/outputs/DECLARED.md\n---\n# body",
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	const matches = artifacts.filter((a) => a.name.endsWith("DECLARED.md"))
	assert.strictEqual(matches.length, 1, "single dedupe entry")
	// Unit-declared name is intent-dir-relative
	// (`stages/design/outputs/DECLARED`); catch-all would have been
	// stage-dir-relative (`outputs/DECLARED`). Confirm the unit-declared
	// version won.
	assert.strictEqual(matches[0].name, "stages/design/outputs/DECLARED.md")
})

// ── Path-containment security guard on unit-declared `outputs:` ──
//
// Unit frontmatter is on disk and could be crafted by an adversarial
// agent. Without a containment check, a malicious unit declaring
// `outputs: ["../../.env"]` or `outputs: ["/etc/passwd"]` would cause
// the review session to read and inline arbitrary files outside the
// intent dir. The guard silently drops anything that resolves outside.

await test("security: unit outputs declaring traversal paths are silently dropped", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-traversal-"))
	const productUnits = join(intentDir, "stages", "product", "units")
	mkdirSync(productUnits, { recursive: true })
	// Real file outside the intent dir that the traversal would read.
	const outside = join(tmp, "secret.env")
	writeFileSync(outside, "SECRET=traversal")
	// And a legitimate output inside the intent dir.
	mkdirSync(join(intentDir, "product"), { recursive: true })
	writeFileSync(
		join(intentDir, "product", "OK.md"),
		"---\ntitle: OK\n---\n# ok body",
	)
	writeFileSync(
		join(productUnits, "unit-01-foo.md"),
		`---\ntitle: Adv\noutputs:\n  - ../../secret.env\n  - product/OK.md\n---\n# body`,
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.ok(
		!names.some((n) => n.includes("secret")),
		`traversal path should be dropped; got ${JSON.stringify(names)}`,
	)
	assert.ok(
		names.includes("product/OK.md"),
		`legitimate sibling output should still surface; got ${JSON.stringify(names)}`,
	)
})

await test("security: unit outputs with absolute path declarations are silently dropped", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-absolute-"))
	const productUnits = join(intentDir, "stages", "product", "units")
	mkdirSync(productUnits, { recursive: true })
	mkdirSync(join(intentDir, "product"), { recursive: true })
	writeFileSync(
		join(intentDir, "product", "OK.md"),
		"---\ntitle: OK\n---\n# ok",
	)
	writeFileSync(
		join(productUnits, "unit-01-foo.md"),
		`---\ntitle: Abs\noutputs:\n  - /etc/passwd\n  - product/OK.md\n---\n# body`,
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.ok(
		!names.some((n) => n.includes("passwd")),
		`absolute path should be dropped; got ${JSON.stringify(names)}`,
	)
	assert.ok(
		names.includes("product/OK.md"),
		"legitimate sibling output preserved",
	)
})

// ── Strict unit-filename filter ──
//
// Tighten to match `parseAllUnits`'s convention so scratch files
// inside `units/` (READMEs, drafts) don't have their `outputs:`
// frontmatter processed. Also reduces attack surface for the
// path-containment check.

await test("unit-filename filter: scratch files in units/ are ignored", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-strict-filter-"))
	const productUnits = join(intentDir, "stages", "product", "units")
	mkdirSync(productUnits, { recursive: true })
	mkdirSync(join(intentDir, "product"), { recursive: true })
	writeFileSync(
		join(intentDir, "product", "OK.md"),
		"---\ntitle: OK\n---\n# ok",
	)
	writeFileSync(
		join(intentDir, "product", "DRAFT-OUT.md"),
		"---\ntitle: Draft\n---\n# draft",
	)
	// Real unit — outputs surface.
	writeFileSync(
		join(productUnits, "unit-01-foo.md"),
		"---\ntitle: Real\noutputs:\n  - product/OK.md\n---\n# body",
	)
	// Scratch file with `outputs:` — should be IGNORED.
	writeFileSync(
		join(productUnits, "README.md"),
		"---\ntitle: Readme\noutputs:\n  - product/DRAFT-OUT.md\n---\n# scratch",
	)
	// Another non-conforming filename — should also be ignored.
	writeFileSync(
		join(productUnits, "draft.md"),
		"---\ntitle: Draft\noutputs:\n  - product/DRAFT-OUT.md\n---\n# draft",
	)
	const artifacts = await parseOutputArtifacts(intentDir)
	const names = artifacts.map((a) => a.name).sort()
	assert.ok(
		names.includes("product/OK.md"),
		`real unit's output should surface; got ${JSON.stringify(names)}`,
	)
	assert.ok(
		!names.includes("product/DRAFT-OUT.md"),
		`scratch-file outputs should NOT surface (strict filter dropped non-unit files); got ${JSON.stringify(names)}`,
	)
})

await test("parseStageFiles: BRIEF/elaboration/observations excluded from 'other'; subdir files tagged with directory", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-stagefiles-"))
	const stageDir = join(intentDir, "stages", "development")
	mkdirSync(join(stageDir, "proofs"), { recursive: true })
	// Stage-root narrative files — dedicated surfaces (Overview / Elaboration),
	// NOT the catch-all "other" bucket.
	writeFileSync(join(stageDir, "BRIEF.md"), "# brief")
	writeFileSync(join(stageDir, "elaboration.md"), "# elaboration")
	writeFileSync(join(stageDir, "observations.md"), "# observations")
	// A subdirectory of assets → its own per-directory tab.
	writeFileSync(join(stageDir, "proofs", "run-1.md"), "# proof one")
	// A stage-root loose file → the catch-all "Other" tab (no directory).
	writeFileSync(join(stageDir, "scratch.md"), "# scratch")

	const { other } = await parseStageFiles(intentDir)
	const names = other.map((a) => a.name)

	assert.ok(!names.includes("BRIEF.md"), "BRIEF.md must NOT be in 'other'")
	assert.ok(
		!names.includes("elaboration.md"),
		"elaboration.md must NOT be in 'other'",
	)
	assert.ok(
		!names.includes("observations.md"),
		"observations.md must NOT be in 'other'",
	)

	const proof = other.find((a) => a.name === "proofs/run-1.md")
	assert.ok(proof, "subdir file should surface in 'other'")
	assert.strictEqual(proof.directory, "proofs", "tagged with its top-level dir")

	const scratch = other.find((a) => a.name === "scratch.md")
	assert.ok(scratch, "loose root file should surface in 'other'")
	assert.strictEqual(
		scratch.directory,
		undefined,
		"stage-root loose file has no directory → catch-all Other tab",
	)
})

await test("parseIntentRootFiles: surfaces intent-root strays, HIDES system journals (action-log/write-audit) + known categories", async () => {
	const intentDir = mkdtempSync(join(tmp, "intent-root-other-"))
	mkdirSync(join(intentDir, "stages", "development"), { recursive: true })
	mkdirSync(join(intentDir, "knowledge"), { recursive: true })
	mkdirSync(join(intentDir, "feedback"), { recursive: true })
	mkdirSync(join(intentDir, "scratch"), { recursive: true })
	// Known / system entries — must NOT surface.
	writeFileSync(join(intentDir, "intent.md"), "# intent")
	writeFileSync(join(intentDir, "reflection.md"), "# reflection")
	writeFileSync(join(intentDir, "intent-tick.json"), "{}")
	writeFileSync(join(intentDir, "action-log.jsonl"), '{"x":1}\n')
	writeFileSync(join(intentDir, "write-audit.jsonl"), '{"y":2}\n')
	// Genuine intent-root strays — must surface.
	writeFileSync(join(intentDir, "NOTES.md"), "# loose notes")
	writeFileSync(join(intentDir, "scratch", "diagram.py"), "print('x')\n")

	const entries = await parseIntentRootFiles(intentDir)
	const names = entries.map((a) => a.name)

	// System journals are hidden from the SPA by design.
	assert.ok(
		!names.includes("action-log.jsonl"),
		`action-log.jsonl must NEVER surface; got ${JSON.stringify(names)}`,
	)
	assert.ok(!names.includes("write-audit.jsonl"), "write-audit.jsonl hidden")
	// Known categories + spec + bookkeeping excluded.
	for (const hidden of ["intent.md", "reflection.md", "intent-tick.json"]) {
		assert.ok(!names.includes(hidden), `${hidden} must not surface`)
	}
	// Strays surface, intent-scoped (stage ""), with directory tagging.
	const notes = entries.find((a) => a.name === "NOTES.md")
	assert.ok(notes, "stray NOTES.md should surface")
	assert.strictEqual(notes.stage, "", "intent-scope marker is empty stage")
	const diagram = entries.find((a) => a.name === "scratch/diagram.py")
	assert.ok(diagram, "stray subdir file should surface")
	assert.strictEqual(diagram.directory, "scratch", "tagged with top-level dir")
	assert.strictEqual(diagram.type, "code", ".py → code")
})

console.log(`\n${passed} passed, ${failed} failed`)
rmSync(tmp, { recursive: true, force: true })
process.exit(failed > 0 ? 1 : 0)
