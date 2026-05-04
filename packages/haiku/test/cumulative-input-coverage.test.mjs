#!/usr/bin/env npx tsx
// Test suite for validateCumulativeInputCoverage — every prior-stage
// output MUST be referenced by some current-stage unit's `inputs:` OR
// explicitly acknowledged in `stages/<current>/coverage-decisions.json`.
//
// Catches the "silent skip" class of failure: development stage drops
// design's SPA spec, ships components no one wires up, no engine gate
// notices.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const { validateCumulativeInputCoverage } = await import(
	"../src/orchestrator/validators.ts"
)

const tmp = mkdtempSync(join(tmpdir(), "haiku-coverage-test-"))

let passed = 0
let failed = 0

async function test(name, fn) {
	try {
		const result = fn()
		if (result && typeof result.then === "function") await result
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (e.stack) console.log(e.stack)
	}
}

function createIntent(name, slug = "test-intent") {
	const intentDir = join(tmp, name, "intents", slug)
	mkdirSync(intentDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		"---\ntitle: test\nstudio: test\n---\nbody\n",
	)
	return intentDir
}

function writePriorArtifact(intentDir, stage, relPath, content = "x") {
	const dir = join(intentDir, "stages", stage, "artifacts")
	mkdirSync(dir, { recursive: true })
	const fullPath = relPath.includes("/")
		? join(dir, relPath)
		: join(dir, relPath)
	mkdirSync(fullPath.replace(/\/[^/]+$/, ""), { recursive: true })
	writeFileSync(fullPath, content)
}

function writeUnit(intentDir, stage, name, frontmatter) {
	const dir = join(intentDir, "stages", stage, "units")
	mkdirSync(dir, { recursive: true })
	const fmYaml = Object.entries(frontmatter)
		.map(([k, v]) => {
			if (Array.isArray(v))
				return `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}`
			return `${k}: ${JSON.stringify(v)}`
		})
		.join("\n")
	writeFileSync(join(dir, `${name}.md`), `---\n${fmYaml}\n---\nbody\n`)
}

function writeCoverageDecisions(intentDir, stage, decisions) {
	const dir = join(intentDir, "stages", stage)
	mkdirSync(dir, { recursive: true })
	writeFileSync(
		join(dir, "coverage-decisions.json"),
		JSON.stringify({ stage, decisions }, null, 2),
	)
}

console.log("\n=== validateCumulativeInputCoverage ===")

await test("returns null when no prior stages", () => {
	const intentDir = createIntent("no-prior")
	const result = validateCumulativeInputCoverage(intentDir, "design", [])
	assert.strictEqual(result, null)
})

await test("returns null when current stage's units cover every prior artifact", () => {
	const intentDir = createIntent("covered")
	writePriorArtifact(intentDir, "design", "ARCHITECTURE.md")
	writePriorArtifact(intentDir, "design", "SPA-UI-SPECS.md")
	writeUnit(intentDir, "development", "unit-01-impl", {
		title: "test",
		inputs: [
			"stages/design/artifacts/ARCHITECTURE.md",
			"stages/design/artifacts/SPA-UI-SPECS.md",
		],
	})
	const result = validateCumulativeInputCoverage(intentDir, "development", [
		"design",
	])
	assert.strictEqual(result, null)
})

await test("returns coverage_review_required when an artifact is unreferenced", () => {
	const intentDir = createIntent("unreferenced")
	writePriorArtifact(intentDir, "design", "ARCHITECTURE.md")
	writePriorArtifact(intentDir, "design", "SPA-UI-SPECS.md")
	writeUnit(intentDir, "development", "unit-01-impl", {
		title: "test",
		inputs: ["stages/design/artifacts/ARCHITECTURE.md"],
		// SPA-UI-SPECS.md NOT referenced
	})
	const result = validateCumulativeInputCoverage(intentDir, "development", [
		"design",
	])
	assert.ok(result, "expected non-null result")
	assert.strictEqual(result.action, "coverage_review_required")
	assert.strictEqual(result.unreferenced.length, 1)
	assert.strictEqual(
		result.unreferenced[0].path,
		"stages/design/artifacts/SPA-UI-SPECS.md",
	)
	assert.strictEqual(result.unreferenced[0].from_stage, "design")
})

await test("out-of-scope acknowledgment in coverage-decisions.json suppresses the error", () => {
	const intentDir = createIntent("acknowledged")
	writePriorArtifact(intentDir, "design", "ARCHITECTURE.md")
	writePriorArtifact(intentDir, "design", "WIREFRAMES.md")
	writeUnit(intentDir, "development", "unit-01-impl", {
		title: "test",
		inputs: ["stages/design/artifacts/ARCHITECTURE.md"],
	})
	writeCoverageDecisions(intentDir, "development", [
		{
			path: "stages/design/artifacts/WIREFRAMES.md",
			decision: "out-of-scope",
			rationale: "informational only — no implementable spec",
			acknowledged_at: "2026-05-03T20:00:00Z",
		},
	])
	const result = validateCumulativeInputCoverage(intentDir, "development", [
		"design",
	])
	assert.strictEqual(result, null)
})

await test("walks unit `outputs:` from prior stage as deliverables", () => {
	const intentDir = createIntent("unit-outputs")
	writeUnit(intentDir, "design", "unit-01-arch", {
		title: "design",
		outputs: ["stages/design/artifacts/ARCHITECTURE.md"],
	})
	// Unit declares the output but the file isn't on disk; still
	// counts as a deliverable the next stage must reference.
	writeUnit(intentDir, "development", "unit-01-impl", {
		title: "dev",
		inputs: ["stages/design/artifacts/ARCHITECTURE.md"],
	})
	const result = validateCumulativeInputCoverage(intentDir, "development", [
		"design",
	])
	assert.strictEqual(result, null)
})

await test("unreferenced unit `outputs:` from prior stage triggers the error", () => {
	const intentDir = createIntent("unit-outputs-uncovered")
	writeUnit(intentDir, "design", "unit-01-arch", {
		title: "design",
		outputs: [
			"packages/haiku-ui/src/atoms/DriftBanner.tsx",
			"packages/haiku-ui/src/atoms/KnowledgeUploadPanel.tsx",
		],
	})
	writeUnit(intentDir, "development", "unit-01-impl", {
		title: "dev",
		inputs: ["packages/haiku-ui/src/atoms/DriftBanner.tsx"],
	})
	const result = validateCumulativeInputCoverage(intentDir, "development", [
		"design",
	])
	assert.ok(result)
	assert.strictEqual(result.action, "coverage_review_required")
	assert.deepStrictEqual(
		result.unreferenced.map((u) => u.path),
		["packages/haiku-ui/src/atoms/KnowledgeUploadPanel.tsx"],
	)
})

await test("walks multiple prior stages cumulatively", () => {
	const intentDir = createIntent("multi-prior")
	writePriorArtifact(intentDir, "inception", "DISCOVERY.md")
	writePriorArtifact(intentDir, "design", "ARCHITECTURE.md")
	writeUnit(intentDir, "development", "unit-01-impl", {
		title: "dev",
		inputs: ["stages/design/artifacts/ARCHITECTURE.md"],
		// inception artifact NOT referenced
	})
	const result = validateCumulativeInputCoverage(intentDir, "development", [
		"inception",
		"design",
	])
	assert.ok(result)
	assert.strictEqual(result.action, "coverage_review_required")
	assert.deepStrictEqual(
		result.unreferenced.map((u) => u.path),
		["stages/inception/artifacts/DISCOVERY.md"],
	)
})

await test("error message lists each unreferenced file", () => {
	const intentDir = createIntent("multi-unreferenced")
	writePriorArtifact(intentDir, "design", "A.md")
	writePriorArtifact(intentDir, "design", "B.md")
	writePriorArtifact(intentDir, "design", "C.md")
	writeUnit(intentDir, "development", "unit-01-impl", {
		title: "dev",
		inputs: ["stages/design/artifacts/A.md"],
	})
	const result = validateCumulativeInputCoverage(intentDir, "development", [
		"design",
	])
	assert.ok(result)
	assert.strictEqual(result.unreferenced.length, 2)
	assert.match(result.message, /B\.md/)
	assert.match(result.message, /C\.md/)
	assert.match(result.message, /haiku_unit_set/)
	assert.match(result.message, /haiku_coverage_acknowledge/)
})

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`)

try {
	rmSync(tmp, { recursive: true, force: true })
} catch {}

if (failed > 0) process.exit(1)
