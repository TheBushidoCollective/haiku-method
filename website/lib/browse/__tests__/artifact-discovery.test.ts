// __tests__/artifact-discovery.test.ts — Pure-function tests for the
// stage/intent artifact discovery helpers in intent-parsing.ts. Run via:
//
//   cd website && npx tsx lib/browse/__tests__/artifact-discovery.test.ts
//
// Mirrors v4-derivation.test.ts's bespoke micro-runner (the website package
// ships no Vitest config and node:test fights the bare-extension imports).

import assert from "node:assert"
import {
	artifactNeedsUrl,
	classifyArtifact,
	isBookkeepingArtifact,
	isCollectibleIntentAsset,
	isCollectibleStageFile,
} from "../intent-parsing"

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		const msg = e instanceof Error ? e.message : String(e)
		console.log(`  ✗ ${name}: ${msg}`)
	}
}

console.log("\n── isCollectibleStageFile ─────────────────────────────────")

test("proof/ screenshots ARE collected (the worker-new-badge gap)", () => {
	assert.strictEqual(isCollectibleStageFile("proof/unit-001-mobile.png"), true)
	assert.strictEqual(
		isCollectibleStageFile("proof/design-parity-home-desktop-build.png"),
		true,
	)
})

test("artifacts/ files ARE collected", () => {
	assert.strictEqual(isCollectibleStageFile("artifacts/mockup.html"), true)
	assert.strictEqual(isCollectibleStageFile("artifacts/screen-spec.md"), true)
})

test("stray stage-root working files ARE collected", () => {
	assert.strictEqual(isCollectibleStageFile("scratch.txt"), true)
})

test("structured entries are NOT collected (parsed elsewhere)", () => {
	assert.strictEqual(isCollectibleStageFile("units/unit-001.md"), false)
	assert.strictEqual(isCollectibleStageFile("feedback/FB-001.md"), false)
	assert.strictEqual(isCollectibleStageFile("state.json"), false)
	assert.strictEqual(isCollectibleStageFile("elaboration.md"), false)
	assert.strictEqual(isCollectibleStageFile("BRIEF.md"), false)
	assert.strictEqual(isCollectibleStageFile("observations.md"), false)
})

test("bookkeeping is NOT collected", () => {
	assert.strictEqual(isCollectibleStageFile("decisions.jsonl"), false)
	assert.strictEqual(isCollectibleStageFile(".gitignore"), false)
	assert.strictEqual(isCollectibleStageFile("fs-manifest.json"), false)
})

console.log("\n── isCollectibleIntentAsset ───────────────────────────────")

test("intent-level proof/ IS collected", () => {
	assert.strictEqual(isCollectibleIntentAsset("proof/journey-step-1.png"), true)
})

test("intent structured dirs/files are NOT collected", () => {
	assert.strictEqual(
		isCollectibleIntentAsset("stages/development/units/unit-001.md"),
		false,
	)
	assert.strictEqual(isCollectibleIntentAsset("knowledge/ARCHITECTURE.md"), false)
	assert.strictEqual(isCollectibleIntentAsset("operations/RUNBOOK.md"), false)
	assert.strictEqual(isCollectibleIntentAsset("feedback/FB-001.md"), false)
	assert.strictEqual(isCollectibleIntentAsset("intent.md"), false)
	assert.strictEqual(isCollectibleIntentAsset("reflection.md"), false)
})

test("intent-level bookkeeping is NOT collected", () => {
	assert.strictEqual(isCollectibleIntentAsset("coverage-decisions.json"), false)
	assert.strictEqual(isCollectibleIntentAsset(".deadlock-history.json"), false)
})

console.log("\n── isBookkeepingArtifact ──────────────────────────────────")

test("dotfiles, jsonl logs, manifests, coverage acks are bookkeeping", () => {
	assert.strictEqual(isBookkeepingArtifact(".gitignore"), true)
	assert.strictEqual(isBookkeepingArtifact("stages/dev/decisions.jsonl"), true)
	assert.strictEqual(isBookkeepingArtifact("coverage-decisions.json"), true)
	assert.strictEqual(isBookkeepingArtifact("proof/.fs-manifest"), true)
})

test("ordinary assets are NOT bookkeeping", () => {
	assert.strictEqual(isBookkeepingArtifact("proof/shot.png"), false)
	assert.strictEqual(isBookkeepingArtifact("artifacts/mockup.html"), false)
})

console.log("\n── classifyArtifact / artifactNeedsUrl ────────────────────")

test("classifyArtifact keys off extension", () => {
	assert.strictEqual(classifyArtifact("proof/x.png"), "image")
	assert.strictEqual(classifyArtifact("a.md"), "markdown")
	assert.strictEqual(classifyArtifact("a.html"), "html")
	assert.strictEqual(classifyArtifact("a.kicad_pcb"), "other")
})

test("artifactNeedsUrl: images + engineering binaries need a URL, text inlines", () => {
	assert.strictEqual(artifactNeedsUrl("proof/x.png"), true)
	assert.strictEqual(artifactNeedsUrl("board.kicad_pcb"), true)
	assert.strictEqual(artifactNeedsUrl("model.glb"), true)
	assert.strictEqual(artifactNeedsUrl("doc.pdf"), true)
	assert.strictEqual(artifactNeedsUrl("spec.md"), false)
	assert.strictEqual(artifactNeedsUrl("page.html"), false)
})

console.log(`\n── Result: ${passed} passed, ${failed} failed ──────────────`)
process.exit(failed > 0 ? 1 : 0)
