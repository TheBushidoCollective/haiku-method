#!/usr/bin/env npx tsx
// Tests for drift-detection-gate.ts — pre-tick drift-detection gate.
//
// Coverage (24 scenarios from silent-filesystem-drop-detection.feature):
//  1.  Designer replaces a stage output — modified finding emitted.
//  2.  PO edits a deliverable — modified finding, correct SHAs, diff_unified non-null.
//  3.  New file dropped on disk — silently auto-baselined (no finding); fires only on next-tick change.
//  4.  outputs/ alias: canonical pathRel is artifacts/, absPath points to outputs/ on disk.
//  5.  Multiple files changed in one tick — one action, multiple findings (or OOM synthetic).
//  6.  Zero changes since last baseline — no action emitted.
//  7.  Mid-bolt isolation — change detected on NEXT tick, not during in-flight bolt.
//  8.  First tick: baseline absent → establish mode, zero findings, state.json stamped.
//  9.  Kill-switch off (drift_detection: false) — gate is a complete no-op.
//  9a. Kill-switch I/O isolation — corrupt baseline is invisible when kill-switch active (AC-G1-KS).
// 10.  Kill-switch re-enabled — prior baseline reused unchanged; no auto-re-establish.
// 11.  Editor temp files (.swp, ~, .#) do not produce false findings.
// 12.  Tracked file deleted — file-removed finding, after_sha256 null, diff null.
// 13.  Binary file replaced — is_binary true, diff_unified null.
// 14.  Marker suppresses re-detection (SHA matches marker's baseline_sha_at_creation).
// 15.  Stale marker (double-edit, SHA changed again) → marker removed, fresh finding emitted.
// 16.  Marker with terminal-state cleared — marker absent, gate detects normally.
// 17.  Baseline corrupt JSON → error: 'baseline_corrupt' returned, no dispatch.
// 18.  Files outside tracked surface are not detected (README.md at intent root).
// 19.  files inside units/ are ignored (not in tracked surface).
// 20.  Full runWorkflowTick → drift-detection gate → manual_change_assessment short-circuit.
// 21.  Intent-scope knowledge sidecar written at intent level; diff works after simulated stage transition.
// 22.  Diff correctness: N→M line replacement keeps "c" as context, not as deleted+inserted.
// 23.  Diff correctness: change followed by >CONTEXT unchanged lines — trim removes from END.

import assert from "node:assert"
import { createHash } from "node:crypto"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const tmp = mkdtempSync(join(tmpdir(), "haiku-drift-gate-test-"))

const { runDriftDetectionGate, isDriftDetectionDisabled } = await import(
	"../src/orchestrator/workflow/drift-detection-gate.ts"
)

const { writeBaseline, readBaseline } = await import(
	"../src/orchestrator/workflow/drift-baseline.ts"
)

const { appendMarker } = await import(
	"../src/orchestrator/workflow/drift-markers.ts"
)

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
					if (process.env.VERBOSE) console.error(e)
				},
			)
		}
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (process.env.VERBOSE) console.error(e)
	}
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sha256(content) {
	return createHash("sha256").update(content).digest("hex")
}

function makeIntentDir(name, opts = {}) {
	const intentDir = join(tmp, name)
	const stage = opts.stage || "design"
	const stageDir = join(intentDir, "stages", stage)
	const artifactsDir = join(stageDir, "artifacts")
	mkdirSync(artifactsDir, { recursive: true })
	return { intentDir, stage, stageDir, artifactsDir }
}

function makeHaikuRoot(name, opts = {}) {
	const haikuRoot = join(tmp, `${name}-haikuroot`)
	mkdirSync(haikuRoot, { recursive: true })
	if (opts.driftDetectionOff) {
		writeFileSync(join(haikuRoot, "settings.yml"), "drift_detection: false\n")
	}
	return haikuRoot
}

function makeBaselineEntry(path, content, overrides = {}) {
	const sha256val = sha256(content)
	return {
		path,
		sha256: sha256val,
		bytes: Buffer.byteLength(content),
		mtime_ns: Date.now() * 1_000_000,
		is_binary: false,
		author_class: "agent",
		acknowledged_at: new Date().toISOString(),
		acknowledged_via: "agent-write",
		stage: "design",
		tracking_class: "stage-output",
		...overrides,
	}
}

function makeCtx(intentDir, haikuRoot, stage = "design") {
	return {
		intentDir,
		intentSlug: "demo-intent",
		activeStage: stage,
		haikuRoot,
		tickCounter: 1,
	}
}

// Write baseline using the proper writeBaseline function.
async function writeBaselineForStage(intentDir, stage, entries) {
	const baseline = { entries: new Map(Object.entries(entries)) }
	await writeBaseline(intentDir, stage, baseline)
}

// Add an anchor file to baseline and disk to prevent OOM heuristic from
// triggering in single-file test scenarios.
// When 1 file out of 2 changes, that's 50% which is NOT > 50%, so no OOM.
function addAnchorFile(_intentDir, stage, artifactsDir) {
	const anchorContent = "<!-- anchor file — stable across test -->"
	const anchorName = "anchor-stable.html"
	const anchorPath = join(artifactsDir, anchorName)
	writeFileSync(anchorPath, anchorContent)
	const relPath = `stages/${stage}/artifacts/${anchorName}`
	return { relPath, content: anchorContent }
}

// Make a valid PendingMarker for use in tests.
function makeMarker(path, sha, overrides = {}) {
	return {
		path,
		created_at: new Date().toISOString(),
		created_by_assessment_id: "assess-test-001",
		outcome: "surface-as-feedback",
		linked_feedback_id: "FB-05",
		linked_revisit_target_stage: null,
		cleared_at: null,
		resolved_sha: null,
		baseline_sha_at_creation: sha,
		...overrides,
	}
}

// ── Tests ──────────────────────────────────────────────────────────────────

console.log("\n=== Scenario 1: Designer replaces a stage output ===")

await test("modified finding emitted when on-disk SHA differs from baseline", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s01")
	const haikuRoot = makeHaikuRoot("s01")
	const relPath = `stages/${stage}/artifacts/dashboard-layout.html`
	const originalContent = "<html>original</html>"
	const newContent = "<html>replaced by designer</html>"

	writeFileSync(join(artifactsDir, "dashboard-layout.html"), originalContent)

	// Add anchor to prevent OOM (1 change / 2 files = 50%, not > 50%).
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, originalContent),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Designer replaces the file.
	writeFileSync(join(artifactsDir, "dashboard-layout.html"), newContent)

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(
		result.action,
		"manual_change_assessment",
		"action should be manual_change_assessment",
	)
	// Should have an individual finding (not OOM synthetic).
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, `finding for ${relPath} should be present`)
	assert.strictEqual(finding.change_kind, "modified")
	assert.strictEqual(finding.after_sha256, sha256(newContent))
	assert.strictEqual(finding.before_sha256, sha256(originalContent))
})

console.log("\n=== Scenario 2: PO edits a deliverable — diff included ===")

await test("modified finding includes correct SHAs for text files", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s02")
	const haikuRoot = makeHaikuRoot("s02")
	const relPath = `stages/${stage}/artifacts/spec.md`
	const originalContent = "# Spec\n\nOriginal content.\n"
	const newContent = "# Spec\n\nEdited by PO.\n"

	writeFileSync(join(artifactsDir, "spec.md"), originalContent)

	// Add anchor to prevent OOM.
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, originalContent),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	writeFileSync(join(artifactsDir, "spec.md"), newContent)

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, `finding for ${relPath} should be present`)
	assert.strictEqual(finding.change_kind, "modified")
	assert.strictEqual(finding.before_sha256, sha256(originalContent))
	assert.strictEqual(finding.after_sha256, sha256(newContent))
	assert.strictEqual(finding.is_binary, false)
	// diff_unified must be non-null and contain the edited text (AC-T1).
	// The sidecar written by writeBaseline enables diff generation without git.
	assert.ok(
		finding.diff_unified !== null,
		`diff_unified must be non-null for a text file modification (AC-T1). ` +
			`A null here means the content sidecar was not written or not read correctly.`,
	)
	assert.ok(
		typeof finding.diff_unified === "string" &&
			finding.diff_unified.includes("---"),
		`diff_unified should contain unified diff header '---'`,
	)
	assert.ok(
		finding.diff_unified.includes("Edited by PO"),
		`diff_unified should include the new content 'Edited by PO'`,
	)
})

console.log("\n=== Scenario 3: New file dropped — silently auto-baselined ===")

// SCENARIO A: migration-safety — a file present on disk but absent from
// baseline (i.e. a null/unrecorded SHA) MUST silently establish a baseline
// entry and emit zero findings. The contract is "only previously-recorded
// SHAs that change become findings". A null SHA = silent establish, no fire.
await test("file present on disk but absent from baseline is silently auto-added (no finding, no action)", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s03")
	const haikuRoot = makeHaikuRoot("s03")
	const knowledgeDir = join(intentDir, "knowledge")
	mkdirSync(knowledgeDir, { recursive: true })

	// Add anchor so the surface isn't single-file (avoids edge-case ratios).
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	// Establish a baseline with just the anchor.
	await writeBaselineForStage(intentDir, stage, {
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Drop a "PDF" (binary with null bytes) — not in baseline. With the
	// post-2026-05-01 gate contract, an unrecorded path means sha was null;
	// the gate silently establishes a baseline entry instead of firing.
	const pdfContent = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x00, 0x00])
	writeFileSync(join(knowledgeDir, "market-research.pdf"), pdfContent)

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(
		result.action,
		null,
		"no dispatch for previously-unseen file",
	)
	assert.strictEqual(
		result.findings.length,
		0,
		"no findings for previously-unseen file",
	)

	// Baseline now contains the file — next-tick changes WILL fire.
	const baseline = await readBaseline(intentDir, stage)
	const entry = baseline.entries.get("knowledge/market-research.pdf")
	assert.ok(entry, "PDF should now be tracked in baseline")
	assert.strictEqual(entry.is_binary, true)
	assert.strictEqual(entry.tracking_class, "knowledge")
})

// SCENARIO B: migration-safety — once an entry has been silently established
// (so its SHA is now previously-recorded), the NEXT tick where the on-disk
// content differs MUST emit a `modified` finding. This is the round-trip
// proof that establish + change-detect compose correctly: the silent
// establish is not a permanent "ignore me" pass — it is a one-time migration
// step, after which the standard SHA-changed contract takes over.
await test("auto-added file fires a modified finding on the NEXT tick when it actually changes", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s03b")
	const haikuRoot = makeHaikuRoot("s03b")
	const newPath = `stages/${stage}/artifacts/late-deliverable.html`
	const initial = "<html>v1</html>"
	const updated = "<html>v2 — replaced</html>"

	// Anchor + baseline that does NOT include the new file.
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)
	await writeBaselineForStage(intentDir, stage, {
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Tick 1: file appears on disk → silently established, no fire.
	writeFileSync(join(intentDir, newPath), initial)
	const t1 = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))
	assert.strictEqual(t1.action, null)
	assert.strictEqual(t1.findings.length, 0)

	// Tick 2: contents change → modified finding (sha was set, now differs).
	writeFileSync(join(intentDir, newPath), updated)
	const t2 = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))
	assert.strictEqual(t2.action, "manual_change_assessment")
	const finding = t2.findings.find((f) => f.path === newPath)
	assert.ok(finding, "should fire on second-tick change")
	assert.strictEqual(finding.change_kind, "modified")
	assert.strictEqual(finding.before_sha256, sha256(initial))
	assert.strictEqual(finding.after_sha256, sha256(updated))
})

console.log(
	"\n=== Scenario 4: outputs/ alias — canonical key is artifacts/ ===",
)

await test("outputs/ alias file gets pathRel canonicalised to artifacts/", async () => {
	const { intentDir, stage, stageDir, artifactsDir } = makeIntentDir("s04")
	const haikuRoot = makeHaikuRoot("s04")
	const outputsDir = join(stageDir, "outputs")
	mkdirSync(outputsDir, { recursive: true })

	const canonicalRelPath = `stages/${stage}/artifacts/hero.html`
	const originalContent = "<html>hero</html>"
	const newContent = "<html>hero v2</html>"

	// Add anchor to prevent OOM.
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	// Put file in outputs/ (alias). Baseline records under canonical artifacts/ key.
	writeFileSync(join(outputsDir, "hero.html"), originalContent)
	await writeBaselineForStage(intentDir, stage, {
		[canonicalRelPath]: makeBaselineEntry(canonicalRelPath, originalContent),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Designer replaces via outputs/ path.
	writeFileSync(join(outputsDir, "hero.html"), newContent)

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === canonicalRelPath)
	assert.ok(finding, `finding should use canonical key ${canonicalRelPath}`)
	assert.strictEqual(finding.change_kind, "modified")
})

console.log("\n=== Scenario 5: Multiple files changed in one tick ===")

await test("one action emitted when multiple files change; individual findings or OOM synthetic", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s05")
	const haikuRoot = makeHaikuRoot("s05")

	const files = ["a.html", "b.html", "c.html"]
	const originalContent = "<html>original</html>"
	const newContent = "<html>changed</html>"

	const entries = {}
	for (const f of files) {
		const relPath = `stages/${stage}/artifacts/${f}`
		writeFileSync(join(artifactsDir, f), originalContent)
		entries[relPath] = makeBaselineEntry(relPath, originalContent)
	}
	await writeBaselineForStage(intentDir, stage, entries)

	// Replace all three files.
	for (const f of files) {
		writeFileSync(join(artifactsDir, f), newContent)
	}

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// With 3 files changed out of 3, that's 100% — triggers the OOM heuristic.
	// The spec says one action + multiple findings OR OOM synthetic. Both are valid.
	assert.strictEqual(result.action, "manual_change_assessment")
	assert.ok(result.findings.length > 0, "should have at least one finding")
})

console.log("\n=== Scenario 6: Zero changes since last baseline ===")

await test("no action emitted when no files have changed", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s06")
	const haikuRoot = makeHaikuRoot("s06")
	const content = "<html>stable</html>"
	const relPath = `stages/${stage}/artifacts/stable.html`

	writeFileSync(join(artifactsDir, "stable.html"), content)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, content),
	})

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, null, "no action when nothing changed")
	assert.strictEqual(result.findings.length, 0)
})

console.log("\n=== Scenario 7: Mid-bolt isolation ===")

await test("change detected on next tick, not during in-flight bolt", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s07")
	const haikuRoot = makeHaikuRoot("s07")
	const content = "<html>layout</html>"
	const relPath = `stages/${stage}/artifacts/layout.html`
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	writeFileSync(join(artifactsDir, "layout.html"), content)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, content),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Simulate: during a bolt, file is replaced on disk but gate not called.
	const midBoltContent = "<html>replaced during bolt</html>"
	writeFileSync(join(artifactsDir, "layout.html"), midBoltContent)

	// The gate is only called AFTER the bolt completes (next haiku_run_next call).
	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// Now the gate fires and detects the change.
	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, "should find the modified file")
	assert.strictEqual(finding.change_kind, "modified")
})

console.log("\n=== Scenario 8: First tick — baseline establishment ===")

// SCENARIO C: migration-safety — when baseline.json is absent entirely, the
// first tick MUST establish from current disk state with zero findings and
// stamp `state.json.drift_baseline_established_at`. This is the
// migration-from-zero path: an intent that pre-dates the gate landing on
// the codebase has no baseline, and the gate must onboard it silently
// rather than firing a flood of "everything changed" findings.
await test("baseline absent → establish mode: zero findings, state.json stamped, baseline written", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s08")
	const haikuRoot = makeHaikuRoot("s08")
	const stageDir = join(intentDir, "stages", stage)

	writeFileSync(join(artifactsDir, "hero.html"), "<html>hero</html>")
	writeFileSync(join(stageDir, "state.json"), JSON.stringify({ tick: 1 }))

	// No baseline.json — gate runs in establish mode.
	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(
		result.baselineEstablished,
		true,
		"baselineEstablished should be true",
	)
	assert.strictEqual(result.action, null, "no action on first tick")
	assert.strictEqual(result.findings.length, 0)

	// Verify state.json was stamped.
	const stateRaw = readFileSync(join(stageDir, "state.json"), "utf-8")
	const state = JSON.parse(stateRaw)
	assert.ok(
		state.drift_baseline_established_at,
		"state.json should have drift_baseline_established_at",
	)

	// Verify baseline.json was written.
	const baseline = readBaseline(intentDir, stage)
	assert.ok(baseline !== null, "baseline.json should exist after establish")
	assert.ok(
		baseline.entries.has(`stages/${stage}/artifacts/hero.html`),
		"hero.html entry in baseline",
	)
})

console.log("\n=== Scenario 9: Kill-switch off ===")

test("isDriftDetectionDisabled returns true when drift_detection: false in settings.yml", () => {
	const haikuRoot = makeHaikuRoot("s09-kill-check", { driftDetectionOff: true })
	assert.strictEqual(isDriftDetectionDisabled(haikuRoot), true)
})

test("isDriftDetectionDisabled returns false when settings.yml absent", () => {
	const haikuRoot = makeHaikuRoot("s09-kill-absent")
	assert.strictEqual(isDriftDetectionDisabled(haikuRoot), false)
})

await test("drift_detection: false → gate is a complete no-op", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s09")
	const haikuRoot = makeHaikuRoot("s09", { driftDetectionOff: true })
	const relPath = `stages/${stage}/artifacts/dashboard-layout.html`
	const originalContent = "<html>original</html>"

	writeFileSync(join(artifactsDir, "dashboard-layout.html"), originalContent)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, originalContent),
	})

	// Replace file.
	writeFileSync(join(artifactsDir, "dashboard-layout.html"), "<html>new</html>")

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, null, "kill-switch: no action")
	assert.strictEqual(result.findings.length, 0, "kill-switch: no findings")
	assert.strictEqual(
		result.baselineEstablished,
		false,
		"kill-switch: no establish either",
	)
})

console.log(
	"\n=== Scenario 9a: Kill-switch I/O isolation (behavioral proxy) ===",
)

await test("kill-switch: gate returns null action even when corrupt baseline exists (AC-G1-KS)", async () => {
	// Behavioral proxy for "zero reads": if the kill-switch truly bypasses all
	// baseline I/O, a corrupt baseline.json on disk must NOT change the result.
	// If the gate reads the file, it would return { error: "baseline_corrupt" }.
	// If the kill-switch works, it returns { action: null } regardless.
	const { intentDir, stage, artifactsDir, stageDir } = makeIntentDir("s09a")
	const haikuRoot = makeHaikuRoot("s09a", { driftDetectionOff: true })

	// Write a syntactically corrupt baseline.json in the stage directory.
	mkdirSync(stageDir, { recursive: true })
	writeFileSync(join(stageDir, "baseline.json"), "THIS IS NOT VALID JSON { [")

	// Also put a file on disk (to ensure there would be something to scan).
	writeFileSync(join(artifactsDir, "page.html"), "<html>content</html>")

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// Kill-switch must prevent baseline read entirely — corrupt JSON is invisible.
	assert.strictEqual(
		result.action,
		null,
		"kill-switch: no action despite corrupt baseline",
	)
	assert.strictEqual(
		result.findings.length,
		0,
		"kill-switch: no findings despite corrupt baseline",
	)
	assert.ok(
		result.error === undefined,
		`kill-switch: no error field — gate must not read baseline at all (AC-G1-KS). Got error: ${result.error}`,
	)
})

console.log(
	"\n=== Scenario 10: Kill-switch re-enabled — no auto-re-establish ===",
)

await test("gate reuses existing baseline after kill-switch re-enable; does not re-establish", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s10")
	const haikuRoot = makeHaikuRoot("s10") // kill-switch now OFF (re-enabled)
	const relPath = `stages/${stage}/artifacts/dashboard-layout.html`
	const agentSha = sha256("<html>original</html>")
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	// File was changed while kill-switch was off. Baseline still has the agent SHA.
	writeFileSync(
		join(artifactsDir, "dashboard-layout.html"),
		"<html>changed while off</html>",
	)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: {
			path: relPath,
			sha256: agentSha,
			bytes: Buffer.byteLength("<html>original</html>"),
			mtime_ns: Date.now() * 1_000_000,
			is_binary: false,
			author_class: "agent",
			acknowledged_at: new Date().toISOString(),
			acknowledged_via: "agent-write",
			stage,
			tracking_class: "stage-output",
		},
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Kill-switch re-enabled — gate now runs normally. The prior drift is detected.
	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// The gate reuses the existing baseline and detects the drift that happened while off.
	// It does NOT auto-re-establish (which would silently swallow the change).
	assert.strictEqual(
		result.baselineEstablished,
		false,
		"should not re-establish",
	)
	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, "should find the drifted file")
	assert.strictEqual(finding.change_kind, "modified")
})

console.log("\n=== Scenario 11: Editor temp files ===")

await test("editor temp files (.swp, .swo, ~, .#, 4913) do not produce findings", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s11")
	const haikuRoot = makeHaikuRoot("s11")
	const realContent = "# spec"
	const realRelPath = `stages/${stage}/artifacts/spec.md`

	writeFileSync(join(artifactsDir, "spec.md"), realContent)
	await writeBaselineForStage(intentDir, stage, {
		[realRelPath]: makeBaselineEntry(realRelPath, realContent),
	})

	// Create editor temp files.
	writeFileSync(join(artifactsDir, ".spec.md.swp"), "vim swap")
	writeFileSync(join(artifactsDir, "spec.md~"), "backup")
	writeFileSync(join(artifactsDir, ".#spec.md"), "emacs lock")
	writeFileSync(join(artifactsDir, "4913"), "vim test file")

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// No temp file findings.
	const tempFindings = result.findings.filter(
		(f) =>
			f.path.endsWith(".swp") ||
			f.path.endsWith("~") ||
			f.path.includes(".#") ||
			f.path.endsWith("4913"),
	)
	assert.strictEqual(tempFindings.length, 0, "no temp file findings")
	// spec.md unchanged → no action.
	assert.strictEqual(result.action, null)
})

console.log("\n=== Scenario 12: Tracked file deleted ===")

await test("file-removed finding with after_sha256=null and diff_unified=null", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s12")
	const haikuRoot = makeHaikuRoot("s12")
	const content = "<html>old mock</html>"
	const relPath = `stages/${stage}/artifacts/old-mock.html`
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	writeFileSync(join(artifactsDir, "old-mock.html"), content)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, content),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Delete the file.
	rmSync(join(artifactsDir, "old-mock.html"))

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, `finding for ${relPath}`)
	assert.strictEqual(finding.change_kind, "file-removed")
	assert.strictEqual(finding.after_sha256, null)
	assert.strictEqual(finding.before_sha256, sha256(content))
	assert.strictEqual(finding.diff_unified, null)
	assert.strictEqual(finding.after_bytes, null)
})

console.log("\n=== Scenario 13: Binary file replaced ===")

await test("binary replacement: is_binary=true, diff_unified=null", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s13")
	const haikuRoot = makeHaikuRoot("s13")
	const relPath = `stages/${stage}/artifacts/mockup.png`
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	// Original binary content.
	const origBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00])
	writeFileSync(join(artifactsDir, "mockup.png"), origBuf)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: {
			path: relPath,
			sha256: sha256(origBuf),
			bytes: origBuf.length,
			mtime_ns: Date.now() * 1_000_000,
			is_binary: true,
			author_class: "agent",
			acknowledged_at: new Date().toISOString(),
			acknowledged_via: "agent-write",
			stage,
			tracking_class: "stage-output",
		},
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Replace with different binary content.
	const newBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03, 0x00])
	writeFileSync(join(artifactsDir, "mockup.png"), newBuf)

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, `finding for ${relPath}`)
	assert.strictEqual(finding.is_binary, true)
	assert.strictEqual(finding.diff_unified, null)
	assert.strictEqual(finding.change_kind, "modified")
	assert.strictEqual(finding.before_sha256, sha256(origBuf))
	assert.strictEqual(finding.after_sha256, sha256(newBuf))
})

console.log("\n=== Scenario 14: Marker suppresses re-detection ===")

await test("open marker with matching SHA suppresses finding", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s14")
	const haikuRoot = makeHaikuRoot("s14")
	const originalContent = "<html>old</html>"
	const humanContent = "<html>human edit</html>"
	const relPath = `stages/${stage}/artifacts/layout.html`
	const humanSha = sha256(humanContent)
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	writeFileSync(join(artifactsDir, "layout.html"), humanContent)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, originalContent),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Create an open marker whose baseline_sha_at_creation matches the current disk SHA.
	await appendMarker(intentDir, makeMarker(relPath, humanSha))

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// Marker suppresses — no finding for this path.
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(!finding, "finding should be suppressed by marker")
	assert.strictEqual(result.action, null)
})

console.log("\n=== Scenario 15: Stale marker (double-edit) ===")

await test("stale marker (SHA changed again) is removed and fresh finding emitted", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s15")
	const haikuRoot = makeHaikuRoot("s15")
	const originalContent = "<html>old</html>"
	const firstEditContent = "<html>first edit</html>"
	const secondEditContent = "<html>second edit</html>"
	const relPath = `stages/${stage}/artifacts/layout.html`
	const firstEditSha = sha256(firstEditContent)
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	// Current disk has the second edit.
	writeFileSync(join(artifactsDir, "layout.html"), secondEditContent)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, originalContent),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// Marker's baseline_sha_at_creation matches the FIRST edit, not the current one.
	await appendMarker(
		intentDir,
		makeMarker(relPath, firstEditSha, {
			linked_feedback_id: "FB-06",
		}),
	)

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// Stale marker detected → marker will be removed asynchronously.
	// A fresh finding should be emitted for the second edit.
	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, "fresh finding should be emitted for double-edit")
	assert.strictEqual(finding.change_kind, "modified")
	assert.strictEqual(finding.after_sha256, sha256(secondEditContent))
})

console.log(
	"\n=== Scenario 16: Terminal-state marker cleared → gate detects normally ===",
)

await test("when no marker exists (cleared), gate detects the drift normally", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s16")
	const haikuRoot = makeHaikuRoot("s16")
	const originalContent = "<html>old</html>"
	const newContent = "<html>new after clearing</html>"
	const relPath = `stages/${stage}/artifacts/layout.html`
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	writeFileSync(join(artifactsDir, "layout.html"), newContent)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, originalContent),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// No marker at all (was cleared when feedback reached terminal state).
	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, "gate detects normally without marker")
	assert.strictEqual(finding.change_kind, "modified")
})

console.log("\n=== Scenario 17: Baseline corrupt ===")

await test("corrupt baseline JSON → error: baseline_corrupt returned", async () => {
	const { intentDir, stage, stageDir } = makeIntentDir("s17")
	const haikuRoot = makeHaikuRoot("s17")

	// Write invalid JSON as baseline.
	writeFileSync(join(stageDir, "baseline.json"), "{ this is not json }")

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(
		result.error,
		"baseline_corrupt",
		"error should be baseline_corrupt",
	)
	assert.ok(
		result.errorMessage?.includes("corrupt"),
		"errorMessage should mention corrupt",
	)
	assert.strictEqual(result.action, null, "no action on corrupt baseline")
	assert.strictEqual(result.findings.length, 0)
})

console.log("\n=== Scenario 18: Files outside tracked surface ===")

await test("README.md at intent root is not detected", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s18")
	const haikuRoot = makeHaikuRoot("s18")
	const trackedContent = "<html>tracked</html>"
	const trackedRelPath = `stages/${stage}/artifacts/tracked.html`

	writeFileSync(join(artifactsDir, "tracked.html"), trackedContent)
	await writeBaselineForStage(intentDir, stage, {
		[trackedRelPath]: makeBaselineEntry(trackedRelPath, trackedContent),
	})

	// Write a README at the intent root (outside tracked surface).
	writeFileSync(join(intentDir, "README.md"), "# read me")

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	const readmeFinding = result.findings.find((f) =>
		f.path.includes("README.md"),
	)
	assert.ok(!readmeFinding, "README.md should not produce a finding")
	// No change to tracked files → no action.
	assert.strictEqual(result.action, null)
})

console.log("\n=== Scenario 19: Files inside units/ are ignored ===")

await test("files in units/ directory are not in the tracked surface", async () => {
	const { intentDir, stage, stageDir, artifactsDir } = makeIntentDir("s19")
	const haikuRoot = makeHaikuRoot("s19")
	const trackedContent = "<html>tracked</html>"
	const trackedRelPath = `stages/${stage}/artifacts/tracked.html`

	writeFileSync(join(artifactsDir, "tracked.html"), trackedContent)
	await writeBaselineForStage(intentDir, stage, {
		[trackedRelPath]: makeBaselineEntry(trackedRelPath, trackedContent),
	})

	// Write a unit file (should be excluded from tracked surface).
	const unitsDir = join(stageDir, "units")
	mkdirSync(unitsDir, { recursive: true })
	writeFileSync(
		join(unitsDir, "unit-01-foo.md"),
		"---\nstatus: pending\n---\n# Foo",
	)

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	const unitFinding = result.findings.find((f) => f.path.includes("units/"))
	assert.ok(!unitFinding, "units/ files should not produce findings")
	// No tracked files changed.
	assert.strictEqual(result.action, null)
})

console.log(
	"\n=== Scenario 20: runWorkflowTick → drift → manual_change_assessment ===",
)

await test("runWorkflowTick emits manual_change_assessment action when drift detected (AC-G13)", async () => {
	// Build a minimal .haiku fixture that runWorkflowTick can drive:
	//   <haikuRoot>/
	//     intents/
	//       s20-drift-tick/
	//         intent.md          (studio: software, active_stage: development)
	//         stages/
	//           inception/state.json   (status: completed)
	//           design/state.json      (status: completed)
	//           product/state.json     (status: completed)
	//           development/
	//             state.json           (phase: execute, status: active)
	//             artifacts/
	//               spec.md            (drifted on disk, baseline has original)
	const haikuRoot = join(tmp, "s20-haiku")
	const slug = "s20-drift-tick"
	const iDir = join(haikuRoot, "intents", slug)
	const activeStageName = "development"
	const stageDir = join(iDir, "stages", activeStageName)
	const artifactsDir = join(stageDir, "artifacts")

	mkdirSync(artifactsDir, { recursive: true })

	// intent.md frontmatter
	const intentFm = [
		"---",
		`title: "Scenario 20 drift integration test"`,
		`studio: software`,
		`status: active`,
		`active_stage: ${activeStageName}`,
		"---",
		"",
		"Integration test intent for drift gate short-circuit.",
	].join("\n")
	writeFileSync(join(iDir, "intent.md"), intentFm)

	// Mark all prior stages as completed so preTickConsistency is satisfied.
	// Software studio stage order: inception, design, product, development, ...
	for (const s of ["inception", "design", "product"]) {
		const sd = join(iDir, "stages", s)
		mkdirSync(sd, { recursive: true })
		writeFileSync(
			join(sd, "state.json"),
			JSON.stringify({ phase: "gate", status: "completed" }, null, 2),
		)
	}

	// Active stage state.json — execute phase, active status.
	writeFileSync(
		join(stageDir, "state.json"),
		JSON.stringify(
			{ phase: "execute", status: "active", iteration: 1 },
			null,
			2,
		),
	)

	// Write the original file and establish a baseline.
	const originalContent = "# API Spec\n\nOriginal design.\n"
	const relPath = `stages/${activeStageName}/artifacts/spec.md`

	// Add anchor to prevent OOM heuristic (1/2 = 50%, not > 50%).
	const anchorContent = "<!-- anchor -->"
	writeFileSync(join(artifactsDir, "anchor.md"), anchorContent)
	const anchorRelPath = `stages/${activeStageName}/artifacts/anchor.md`

	writeFileSync(join(artifactsDir, "spec.md"), originalContent)
	await writeBaselineForStage(iDir, activeStageName, {
		[relPath]: makeBaselineEntry(relPath, originalContent, {
			stage: activeStageName,
		}),
		[anchorRelPath]: makeBaselineEntry(anchorRelPath, anchorContent, {
			stage: activeStageName,
		}),
	})

	// Now simulate a human modifying spec.md out-of-band.
	const modifiedContent =
		"# API Spec\n\nHuman edited this without going through MCP.\n"
	writeFileSync(join(artifactsDir, "spec.md"), modifiedContent)

	// Run one full workflow tick via runWorkflowTick.
	const { runWorkflowTick } = await import(
		"../src/orchestrator/workflow/run-tick.ts"
	)
	const result = runWorkflowTick(slug, haikuRoot)

	assert.ok(
		result !== null,
		"runWorkflowTick must return a result for a valid intent",
	)
	assert.strictEqual(
		result.action?.action,
		"manual_change_assessment",
		`Expected manual_change_assessment action but got '${result.action?.action}'. ` +
			`State was: '${result.state}'.`,
	)
	assert.ok(Array.isArray(result.action.findings), "findings must be an array")
	assert.ok(result.action.findings.length > 0, "findings must be non-empty")
	const specFinding = result.action.findings.find((f) => f.path === relPath)
	assert.ok(specFinding, `finding for ${relPath} should be present`)
	assert.strictEqual(specFinding.change_kind, "modified")
})

console.log(
	"\n=== Scenario 21: Intent-scope knowledge sidecar survives stage transition (Finding 3) ===",
)

await test("intent-scope knowledge sidecar written at intent level; diff works after simulated stage transition", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("s21")
	const haikuRoot = makeHaikuRoot("s21")

	// Create intent-scope knowledge directory and file.
	const knowledgeDir = join(intentDir, "knowledge")
	mkdirSync(knowledgeDir, { recursive: true })
	const knowledgePath = join(knowledgeDir, "market-research.md")
	const originalContent = "# Market Research\n\nOriginal findings.\n"
	const newContent = "# Market Research\n\nHuman updated findings.\n"
	writeFileSync(knowledgePath, originalContent)

	// Add a stable anchor to prevent the OOM heuristic.
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	// Establish a baseline that includes the intent-scope knowledge file.
	// stageOwner = null for intent-scope entries.
	const relPath = "knowledge/market-research.md"
	const _stageRelPath = `stages/${stage}/artifacts/${anchor.relPath.split("/").pop()}`
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: {
			path: relPath,
			sha256: sha256(originalContent),
			bytes: Buffer.byteLength(originalContent),
			mtime_ns: Date.now() * 1_000_000,
			is_binary: false,
			author_class: "agent",
			acknowledged_at: new Date().toISOString(),
			acknowledged_via: "baseline-init",
			stage: null,
			tracking_class: "knowledge",
		},
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// First gate pass — should write sidecar at intent level (not stage level).
	const result1 = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))
	assert.strictEqual(result1.action, null, "no action on unchanged content")

	// Verify the sidecar is at the intent level.
	const { baselineIntentContentPath } = await import(
		"../src/orchestrator/workflow/drift-baseline.ts"
	)
	const intentSidecarPath = baselineIntentContentPath(
		intentDir,
		sha256(originalContent),
	)
	assert.ok(
		existsSync(intentSidecarPath),
		"sidecar should be written at intent level",
	)

	// Simulate stage transition: the baseline only tracks the intent-scope
	// knowledge file. If the sidecar were stored under the old stage, it
	// would not be found after transition. We verify that the next gate pass
	// (on a different stage name) can still produce a diff.
	const newStage = "development"
	const newStageDir = join(intentDir, "stages", newStage)
	const newArtifactsDir = join(newStageDir, "artifacts")
	mkdirSync(newArtifactsDir, { recursive: true })
	writeFileSync(
		join(newStageDir, "state.json"),
		JSON.stringify({ iteration: 2, status: "active" }),
	)

	// Add an anchor file to the new stage so the OOM heuristic doesn't fire
	// (1 changed / 2 total = 50%, not > 50%).
	const newAnchor = addAnchorFile(intentDir, newStage, newArtifactsDir)

	// Re-use the same knowledge entry in the new stage's baseline.
	await writeBaselineForStage(intentDir, newStage, {
		[relPath]: {
			path: relPath,
			sha256: sha256(originalContent),
			bytes: Buffer.byteLength(originalContent),
			mtime_ns: Date.now() * 1_000_000,
			is_binary: false,
			author_class: "agent",
			acknowledged_at: new Date().toISOString(),
			acknowledged_via: "baseline-init",
			stage: null,
			tracking_class: "knowledge",
		},
		[newAnchor.relPath]: makeBaselineEntry(
			newAnchor.relPath,
			newAnchor.content,
			{ stage: newStage },
		),
	})

	// Human modifies the knowledge file.
	writeFileSync(knowledgePath, newContent)

	// Gate on the NEW stage should still find the sidecar and produce a diff.
	const result2 = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, newStage))
	assert.strictEqual(
		result2.action,
		"manual_change_assessment",
		"drift should be detected on new stage",
	)
	const finding = result2.findings.find((f) => f.path === relPath)
	assert.ok(finding, "finding for knowledge file should be present")
	assert.strictEqual(finding.change_kind, "modified")
	// diff_unified should be non-null because the sidecar is at intent level.
	assert.ok(
		finding.diff_unified !== null,
		"diff_unified should be non-null — intent-level sidecar must survive stage transition",
	)
})

// ── Scenario 22: diff correctness — N→M line change does not pull unchanged trailing lines ──

console.log(
	"\n=== Scenario 22: diff correctness — N→M replacement stays within hunk boundary ===",
)

await test("diff for N→M line change does not include trailing unchanged lines in the hunk", async () => {
	// before = ["a", "b", "c"]  →  after = ["a", "x", "y", "z", "c"]
	// Correct: hunk deletes "b", inserts "x","y","z"; "a" and "c" are context.
	// Buggy old algo: bLines=["b","c"], aLines=["x","y","z","c"] — "c" pulled in.
	const { intentDir, stage, artifactsDir } = makeIntentDir("s22")
	const haikuRoot = makeHaikuRoot("s22")
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	const originalContent = "a\nb\nc"
	const newContent = "a\nx\ny\nz\nc"
	const relPath = `stages/${stage}/artifacts/spec.md`
	const absPath = join(artifactsDir, "spec.md")

	writeFileSync(absPath, originalContent)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, originalContent),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	writeFileSync(absPath, newContent)
	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, "finding should be present")
	assert.ok(finding.diff_unified !== null, "diff_unified must be non-null")

	const diffLines = finding.diff_unified.split("\n")
	// The deleted line should be exactly "b" (not "b" and "c").
	const deletedLines = diffLines
		.filter((l) => l.startsWith("-") && !l.startsWith("---"))
		.map((l) => l.slice(1))
	assert.deepStrictEqual(
		deletedLines,
		["b"],
		`deleted lines should be ["b"] only — old algo pulled in "c" as well`,
	)
	// The trailing context line "c" must appear as a context line (space prefix).
	const contextLines = diffLines
		.filter((l) => l.startsWith(" "))
		.map((l) => l.slice(1))
	assert.ok(
		contextLines.includes("c"),
		`"c" must appear as a context line, not as a deleted/inserted line`,
	)
})

// ── Scenario 23: diff correctness — trailingEqual > CONTEXT does not drop change ops ──

console.log(
	"\n=== Scenario 23: diff correctness — trailing-equal trim removes from END, not front ===",
)

await test("diff for change followed by >CONTEXT unchanged lines preserves the change ops", async () => {
	// before = ["a","b","c","d","e","f"]  →  after = ["a","X","c","d","e","f"]
	// trailingEqual = 4 ("c","d","e","f") — that's > CONTEXT (3).
	// The old splicing bug: splice(0, length - excess) removes from FRONT,
	// dropping delete("b") and insert("X") along with leading equal ops.
	// The fix: splice(length - excess) removes from END (excess trailing equals).
	const { intentDir, stage, artifactsDir } = makeIntentDir("s23")
	const haikuRoot = makeHaikuRoot("s23")
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	const originalContent = "a\nb\nc\nd\ne\nf"
	const newContent = "a\nX\nc\nd\ne\nf"
	const relPath = `stages/${stage}/artifacts/spec.md`
	const absPath = join(artifactsDir, "spec.md")

	writeFileSync(absPath, originalContent)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, originalContent),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	writeFileSync(absPath, newContent)
	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	assert.strictEqual(result.action, "manual_change_assessment")
	const finding = result.findings.find((f) => f.path === relPath)
	assert.ok(finding, "finding should be present")
	assert.ok(finding.diff_unified !== null, "diff_unified must be non-null")

	const diffLines = finding.diff_unified.split("\n")
	const deletedLines = diffLines
		.filter((l) => l.startsWith("-") && !l.startsWith("---"))
		.map((l) => l.slice(1))
	const insertedLines = diffLines
		.filter((l) => l.startsWith("+") && !l.startsWith("+++"))
		.map((l) => l.slice(1))

	assert.deepStrictEqual(
		deletedLines,
		["b"],
		`deleted lines should be ["b"] — bug drops change when trailingEqual > CONTEXT`,
	)
	assert.deepStrictEqual(
		insertedLines,
		["X"],
		`inserted lines should be ["X"] — bug drops change when trailingEqual > CONTEXT`,
	)
})

// ── Scenario H: kill-switch end-to-end (universal rollback) ────────────────

console.log(
	"\n=== Scenario H: kill-switch end-to-end over divergent corpus ===",
)

// SCENARIO H: migration-safety — when `drift_detection: false` is written to
// `.haiku/settings.yml`, the gate is the universal rollback escape hatch the
// runbook (unit-01 scenario 2) promises. Even with a tracked file whose SHA
// has demonstrably drifted from its baseline entry, the kill-switch path
// MUST return the no-op result shape — no findings, no
// `manual_change_assessment` action, no baseline establish — so an operator
// confronting a flood of false positives can flip the bit and stop the
// gate cold without rolling back code.
await test("Scenario H — kill-switch silences the gate over a divergent corpus (universal rollback)", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("sH")
	// Kill-switch ON via .haiku/settings.yml.
	const haikuRoot = makeHaikuRoot("sH", { driftDetectionOff: true })

	const relPath = `stages/${stage}/artifacts/dashboard-layout.html`
	const baselineContent = "<html>baseline content</html>"
	const driftedContent = "<html>human edited out-of-band</html>"

	// Establish a baseline that records a SHA different from what the disk
	// will contain — so a no-kill-switch gate WOULD fire `modified`.
	writeFileSync(join(artifactsDir, "dashboard-layout.html"), baselineContent)
	await writeBaselineForStage(intentDir, stage, {
		[relPath]: makeBaselineEntry(relPath, baselineContent),
	})

	// Drift the on-disk file.
	writeFileSync(join(artifactsDir, "dashboard-layout.html"), driftedContent)

	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// Kill-switch returns the no-op shape regardless of corpus state.
	assert.strictEqual(
		result.action,
		null,
		"kill-switch: action MUST be null even with divergent corpus",
	)
	assert.strictEqual(
		result.findings.length,
		0,
		"kill-switch: zero findings even with divergent corpus",
	)
	assert.strictEqual(
		result.baselineEstablished,
		false,
		"kill-switch: gate MUST NOT establish either",
	)
	assert.ok(
		result.error === undefined,
		`kill-switch: no error field — gate is a complete no-op (got error: ${result.error})`,
	)
})

// ── Scenario I: writeBaselineSync failure → no silent re-establish loop ────

console.log(
	"\n=== Scenario I: writeBaselineSync failure → graceful degradation ===",
)

// SCENARIO I: migration-safety — when the establish-mode persistence path
// fails (writeBaselineSync throws), the gate MUST NOT produce a flood of
// findings on the user-visible path: it returns the no-op shape (no
// `manual_change_assessment` action, no findings) so a transient I/O error
// during baseline migration cannot cause a cascade of false drift signals.
// On a second tick under the same failure conditions, behavior must remain
// identical — the gate degrades gracefully without producing different
// output across consecutive ticks. This is the contract behind the
// `haiku.drift.baseline.write_failed` emitter (unit-02): write failures
// surface as telemetry, not as user-facing findings.
await test("Scenario I — writeBaselineSync failure does not produce findings on tick 1 or tick 2", async () => {
	const { intentDir, stage, stageDir, artifactsDir } = makeIntentDir("sI")
	const haikuRoot = makeHaikuRoot("sI")

	// Surface non-empty: place a file on disk so establish has something to
	// process. baseline.json is absent → the gate enters establish mode.
	writeFileSync(join(artifactsDir, "page.html"), "<html>page v1</html>")

	// Force `writeBaselineSync` to throw on the establish write by occupying
	// the target baseline.json path with a directory. `writeFileSync` will
	// fail with EISDIR, which the gate's try/catch swallows by contract.
	// This is a behavioral substitute for runtime mocking the export.
	const baselineJsonAsDir = join(stageDir, "baseline.json")
	mkdirSync(baselineJsonAsDir, { recursive: true })

	// Tick 1.
	const t1 = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))
	assert.strictEqual(
		t1.action,
		null,
		"tick 1: action MUST be null on writeBaselineSync failure (no flood)",
	)
	assert.strictEqual(
		t1.findings.length,
		0,
		"tick 1: zero findings on writeBaselineSync failure",
	)

	// Tick 2 under the same failure conditions: behavior MUST be identical.
	// This proves the gate does not flip into a "re-establish silently every
	// tick" loop that produces different output across ticks — graceful
	// degradation, not silent thrash.
	const t2 = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))
	assert.strictEqual(
		t2.action,
		t1.action,
		"tick 2 action MUST match tick 1 (graceful degradation, no thrash)",
	)
	assert.strictEqual(
		t2.findings.length,
		t1.findings.length,
		"tick 2 finding count MUST match tick 1 (graceful degradation)",
	)
})

// ── V-05 consumer fix: drift gate unions per-stage and intent-scope action-log
//     entries when classifying tracked files. An SPA upload with `stage === null`
//     is stamped at the intent-scope tick (deterministic, monotonic at the
//     intent level); the drift gate's classifier MUST surface it as
//     `human-via-mcp` regardless of which per-stage tick the gate is firing
//     under. Pre-fix: per-tick filter dropped intent-scope entries because
//     their counter never matched a per-stage tick.

console.log(
	"\n=== V-05 consumer: drift gate unions per-stage and intent-scope action-log entries ===",
)

await test("V-05: SPA intent-scope upload (tick_scope='intent') is classified human-via-mcp on a stage tick", async () => {
	const { intentDir, stage, artifactsDir } = makeIntentDir("v05-consumer-union")
	const haikuRoot = makeHaikuRoot("v05-consumer-union")

	// 1) Disk: a tracked file has changed since baseline.
	const fileName = "design-spec.md"
	const fileRel = `stages/${stage}/artifacts/${fileName}`
	const beforeContent = "# Spec v1\nbefore content\n"
	const afterContent = "# Spec v2\nafter content\n"
	writeFileSync(join(artifactsDir, fileName), afterContent)
	const beforeSha = sha256(beforeContent)

	// Add an anchor so the OOM heuristic (>50% surface drift) doesn't fire.
	const anchor = addAnchorFile(intentDir, stage, artifactsDir)

	await writeBaselineForStage(intentDir, stage, {
		[fileRel]: makeBaselineEntry(fileRel, beforeContent, {
			sha256: beforeSha,
		}),
		[anchor.relPath]: makeBaselineEntry(anchor.relPath, anchor.content),
	})

	// 2) Action log: ONE intent-scope entry attributing the file change
	//    to a human-via-mcp upload — but at intent.tick=42, NOT the
	//    per-stage tick=1 that the gate will fire under. Pre-V-05 fix:
	//    the per-tick filter at tickCounter=1 drops this entry and the
	//    finding falls back to baselineEntry.author_class ("agent").
	const actionLog = join(intentDir, "action-log.jsonl")
	const intentScopeEntry = {
		entry_type: "human_write",
		path: fileRel,
		sha: sha256(afterContent),
		author_class: "human-via-mcp",
		timestamp: new Date().toISOString(),
		claimed_author_id: "alice@example.com",
		human_author_id: "alice@example.com",
		entry_id: "HWM-42-01",
		tick_counter: 42, // intent-scope tick — NOT the gate's stage tick
		tick_scope: "intent",
	}
	writeFileSync(actionLog, `${JSON.stringify(intentScopeEntry)}\n`)

	// 3) Run the gate under a per-stage tick (stage.iteration=1).
	const result = runDriftDetectionGate(makeCtx(intentDir, haikuRoot, stage))

	// 4) Expect a finding for the file, classified human-via-mcp via the
	//    intentScopeActionLog union.
	const finding = result.findings.find((f) => f.path === fileRel)
	assert.ok(finding, "drift gate should produce a finding for the changed file")
	assert.strictEqual(
		finding.author_class,
		"human-via-mcp",
		`pre-V-05 fix would fall back to baseline author_class; with the union the intent-scope entry MUST surface as human-via-mcp. Got: ${finding.author_class}`,
	)
})

// ── Cleanup + summary ──────────────────────────────────────────────────────

// Allow async tests (marker writes) to settle.
await new Promise((r) => setTimeout(r, 100))

try {
	rmSync(tmp, { recursive: true, force: true })
} catch {}

console.log("")
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`)
console.log("")

process.exit(failed > 0 ? 1 : 0)
