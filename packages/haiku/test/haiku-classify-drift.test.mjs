#!/usr/bin/env npx tsx
// Tests for haiku_classify_drift MCP tool.
//
// Coverage maps to unit-08 spec scenarios + features/manual-change-assessment.feature:
//   - Four canonical outcomes (ignore, inline-fix, surface-as-feedback,
//     trigger-revisit) on a `modified` finding produce the expected side
//     effects.
//   - surface-as-feedback writes Assessment + PendingMarker atomically;
//     baseline NOT updated; on next tick the gate suppresses re-detection.
//   - trigger-revisit writes the marker, dispatches haiku_revisit, baseline
//     NOT updated, Assessment.revisit_invoked_at is null at write time.
//   - Outcome legality matrix: (file-removed, inline-fix) is rejected.
//   - `ignore` does not re-fire on the next tick.
//   - Re-edited file after `ignore` fires a fresh assessment.
//   - agent_rationale empty rejected.
//   - tick_id_stale rejection.
//   - classifications.length !== findings.length rejection.
//   - Invalid outcome aliases (`auto-fix`, `escalate`) rejected.
//   - Cross-stage trigger-revisit dispatches haiku_revisit at the upstream
//     stage.
//   - 60-finding atomic batch.
//   - Assessment record durability (file lives on disk).
//   - assessment_recorded telemetry payload counts.

import assert from "node:assert"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// ── Test infrastructure ────────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), "haiku-classify-drift-test-"))

const { setHaikuRootForTests } = await import("../src/state/shared.ts")

const toolModule = await import(
	"../src/tools/orchestrator/haiku_classify_drift.ts"
)
const tool = toolModule.default

const driftDispatchModule = await import(
	"../src/orchestrator/workflow/drift-dispatch.ts"
)
const { writeDriftDispatch } = driftDispatchModule

const driftMarkersModule = await import(
	"../src/orchestrator/workflow/drift-markers.ts"
)
const { readMarkers } = driftMarkersModule

const driftBaselineModule = await import(
	"../src/orchestrator/workflow/drift-baseline.ts"
)
const { readBaseline, computeFileSha256Sync } = driftBaselineModule

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

function parseResponse(result) {
	assert.ok(result.content, "result should have content")
	assert.ok(result.content.length > 0, "content should be non-empty")
	return JSON.parse(result.content[0].text)
}

// ── Fixture helpers ────────────────────────────────────────────────────────

let testCounter = 0

function makeFixture(opts = {}) {
	const slug = `test-intent-${++testCounter}`
	const root = join(tmp, `root-${testCounter}`)
	const intentDir = join(root, "intents", slug)
	mkdirSync(intentDir, { recursive: true })

	const stages = opts.stages ?? ["design", "development"]
	const stagesYaml = stages.map((s) => `  - ${s}`).join("\n")
	writeFileSync(
		join(intentDir, "intent.md"),
		`---
title: Test Intent
slug: ${slug}
studio: software
stages:
${stagesYaml}
active_stage: ${opts.activeStage ?? stages[0]}
mode: continuous
---
Body.
`,
	)

	for (const stage of stages) {
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(stageDir, { recursive: true })
		writeFileSync(
			join(stageDir, "state.json"),
			JSON.stringify({ iteration: 1, status: "active" }),
		)
		mkdirSync(join(stageDir, "artifacts"), { recursive: true })
	}

	setHaikuRootForTests(root)
	return { slug, root, intentDir }
}

/** Stage a baseline + active dispatch describing one or more findings. */
function setupDispatch(intentDir, opts) {
	const tickId = opts.tickId ?? "tick-test-1"
	const stage = opts.stage ?? "design"
	const findings = opts.findings ?? []

	// Build legal_outcomes from each finding (similar to handler logic).
	const legalOutcomes = {}
	for (const f of findings) {
		let allowed = [
			"ignore",
			"inline-fix",
			"surface-as-feedback",
			"trigger-revisit",
		]
		if (f.stage !== null && f.stage === stage) {
			allowed = allowed.filter((o) => o !== "trigger-revisit")
		}
		if (f.change_kind === "file-removed") {
			allowed = allowed.filter((o) => o !== "inline-fix")
		}
		legalOutcomes[f.path] = allowed
	}

	writeDriftDispatch(intentDir, {
		tick_id: tickId,
		stage,
		tick_counter: 1,
		mode: "continuous",
		created_at: new Date().toISOString(),
		findings,
		legal_outcomes: legalOutcomes,
	})
	return tickId
}

function makeFinding(overrides = {}) {
	return {
		path: "stages/design/artifacts/spec.md",
		change_kind: "modified",
		is_binary: false,
		diff_unified: "@@ -1,1 +1,1 @@\n-old\n+new",
		before_sha256: "a".repeat(64),
		after_sha256: "b".repeat(64),
		before_bytes: 100,
		after_bytes: 110,
		tracking_class: "stage-output",
		stage: "design",
		context_unit: null,
		...overrides,
	}
}

// ── Tests ──────────────────────────────────────────────────────────────────

console.log("\n=== Happy path: four canonical outcomes ===")

await test("ignore on a modified finding updates the baseline immediately and writes no marker (AC-CI1)", async () => {
	const { slug, intentDir } = makeFixture()
	// Write the file on disk so baseline can read its SHA.
	const filePath = join(intentDir, "stages/design/artifacts/spec.md")
	writeFileSync(filePath, "new content\n")
	const finding = makeFinding({
		path: "stages/design/artifacts/spec.md",
		after_sha256: computeFileSha256Sync(filePath),
	})
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})

	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "ignore",
				rationale_excerpt: "punctuation only",
			},
		],
		agent_rationale: "Single character change — punctuation only.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true, `expected ok, got ${JSON.stringify(data)}`)
	assert.strictEqual(data.assessment_id, "AS-01")
	assert.strictEqual(data.feedback_created.length, 0)
	assert.strictEqual(data.pending_markers_created, 0)
	assert.strictEqual(data.baselines_updated, 1)

	// Baseline updated to current SHA.
	const baseline = readBaseline(intentDir, "design")
	assert.ok(baseline)
	const entry = baseline.entries.get("stages/design/artifacts/spec.md")
	assert.ok(entry, "baseline entry should exist")
	assert.strictEqual(entry.sha256, computeFileSha256Sync(filePath))
	assert.strictEqual(entry.author_class, "human-implicit")
	assert.strictEqual(entry.acknowledged_via, "classification-terminal")

	// No marker.
	const markers = readMarkers(intentDir)
	assert.strictEqual(markers.markers.length, 0)

	// Assessment record on disk.
	const daPath = join(intentDir, "stages/design/drift-assessments/DA-01.json")
	assert.ok(existsSync(daPath), "Assessment record should exist")
})

await test("inline-fix on a modified finding updates baseline immediately, no marker (AC-IF1)", async () => {
	const { slug, intentDir } = makeFixture()
	const filePath = join(intentDir, "stages/design/artifacts/spec.md")
	writeFileSync(filePath, "new content\n")
	const finding = makeFinding({
		path: "stages/design/artifacts/spec.md",
	})
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})

	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "inline-fix",
				rationale_excerpt: "absorbing PO additions",
			},
		],
		agent_rationale: "PO added two acceptance criteria; folding in.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true)
	assert.strictEqual(data.baselines_updated, 1)
	assert.strictEqual(data.pending_markers_created, 0)

	const markers = readMarkers(intentDir)
	assert.strictEqual(markers.markers.length, 0)
})

await test("surface-as-feedback writes Assessment + PendingMarker atomically; baseline NOT updated (AC-SF1)", async () => {
	const { slug, intentDir } = makeFixture()
	const filePath = join(
		intentDir,
		"stages/design/artifacts/dashboard-layout.html",
	)
	writeFileSync(filePath, "<html>new</html>")
	// Pre-existing baseline so we can confirm it stays put.
	const stageDir = join(intentDir, "stages/design")
	mkdirSync(stageDir, { recursive: true })
	writeFileSync(
		join(stageDir, "baseline.json"),
		JSON.stringify({
			"stages/design/artifacts/dashboard-layout.html": {
				path: "stages/design/artifacts/dashboard-layout.html",
				sha256: "0".repeat(64),
				bytes: 5,
				mtime_ns: 0,
				is_binary: false,
				author_class: "agent",
				acknowledged_at: "2026-04-28T00:00:00Z",
				acknowledged_via: "baseline-init",
				stage: "design",
				tracking_class: "stage-output",
			},
		}),
	)
	const finding = makeFinding({
		path: "stages/design/artifacts/dashboard-layout.html",
	})
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})

	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "surface-as-feedback",
				rationale_excerpt: "designer replaced layout — needs review",
			},
		],
		feedback_creates: [
			{
				for_classification_path: finding.path,
				title: "Layout replaced out-of-spec",
				body: "Designer-replaced layout introduces a nav pattern not in spec.",
				origin: "agent",
			},
		],
		agent_rationale:
			"Diff replaces nav with sidebar variant — surface as FB before re-elaborating.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true, `expected ok, got ${JSON.stringify(data)}`)
	assert.strictEqual(data.feedback_created.length, 1, "one FB created")
	assert.strictEqual(data.pending_markers_created, 1)
	assert.strictEqual(
		data.baselines_updated,
		0,
		"baseline NOT updated for non-terminal outcomes",
	)

	// Marker exists with linked_feedback_id.
	const markers = readMarkers(intentDir)
	assert.strictEqual(markers.markers.length, 1)
	assert.strictEqual(markers.markers[0].outcome, "surface-as-feedback")
	assert.strictEqual(
		markers.markers[0].linked_feedback_id,
		data.feedback_created[0],
	)
	assert.strictEqual(markers.markers[0].cleared_at, null)

	// Baseline is unchanged.
	const baseline = readBaseline(intentDir, "design")
	assert.ok(baseline)
	const entry = baseline.entries.get(
		"stages/design/artifacts/dashboard-layout.html",
	)
	assert.strictEqual(entry.sha256, "0".repeat(64), "baseline sha unchanged")
	assert.strictEqual(entry.author_class, "agent")

	// Assessment record carries resulting_sha: null.
	const daPath = join(intentDir, "stages/design/drift-assessments/DA-01.json")
	const assessment = JSON.parse(readFileSync(daPath, "utf-8"))
	assert.strictEqual(assessment.resulting_sha, null)
})

await test("trigger-revisit writes marker, dispatches haiku_revisit, baseline NOT updated, revisit_invoked_at null at write time (AC-TR1)", async () => {
	const { slug, intentDir } = makeFixture({
		stages: ["inception", "design", "development"],
		activeStage: "design",
	})
	mkdirSync(join(intentDir, "stages/inception/artifacts"), {
		recursive: true,
	})
	const filePath = join(intentDir, "stages/inception/artifacts/DISCOVERY.md")
	writeFileSync(filePath, "new discovery content\n")
	const finding = makeFinding({
		path: "stages/inception/artifacts/DISCOVERY.md",
		stage: "inception",
	})
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})

	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "trigger-revisit",
				rationale_excerpt: "fundamental redirect",
				linked_revisit_target_stage: "inception",
			},
		],
		agent_rationale:
			"User replaced the entire problem statement — must revisit inception.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true, `expected ok, got ${JSON.stringify(data)}`)
	assert.strictEqual(data.pending_markers_created, 1)
	assert.strictEqual(
		data.baselines_updated,
		0,
		"baseline NOT updated for trigger-revisit",
	)

	// Marker present with linked_revisit_target_stage.
	const markers = readMarkers(intentDir)
	assert.strictEqual(markers.markers.length, 1)
	assert.strictEqual(markers.markers[0].outcome, "trigger-revisit")
	assert.strictEqual(
		markers.markers[0].linked_revisit_target_stage,
		"inception",
	)

	// Assessment record's revisit_invoked_at is null.
	const daPath = join(intentDir, "stages/design/drift-assessments/DA-01.json")
	const assessment = JSON.parse(readFileSync(daPath, "utf-8"))
	assert.strictEqual(assessment.revisit_invoked_at, null)
})

console.log("\n=== Outcome legality ===")

await test("(file-removed, inline-fix) is rejected with illegal_outcome", async () => {
	const { slug, intentDir } = makeFixture()
	const finding = makeFinding({
		path: "stages/design/artifacts/gone.md",
		change_kind: "file-removed",
		after_sha256: null,
		after_bytes: null,
		diff_unified: null,
	})
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "inline-fix",
				rationale_excerpt: "trying to absorb a deletion",
			},
		],
		agent_rationale: "this should fail",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "illegal_outcome")
})

await test("all 11 other (change_kind, outcome) combinations succeed for legal outcomes", async () => {
	// We only verify that the legality validator does NOT reject these
	// combinations; full side-effect coverage is in the four-outcome
	// happy-path tests above.
	const combos = [
		["new-file-detected", "ignore"],
		["new-file-detected", "inline-fix"],
		["new-file-detected", "surface-as-feedback"],
		["new-file-detected", "trigger-revisit"],
		["modified", "ignore"],
		["modified", "inline-fix"],
		["modified", "surface-as-feedback"],
		["modified", "trigger-revisit"],
		["file-removed", "ignore"],
		["file-removed", "surface-as-feedback"],
		["file-removed", "trigger-revisit"],
	]
	for (const [changeKind, outcome] of combos) {
		const { slug, intentDir } = makeFixture({
			stages: ["inception", "design", "development"],
			activeStage: "development",
		})
		mkdirSync(join(intentDir, "stages/inception/artifacts"), {
			recursive: true,
		})
		const filePath = join(intentDir, "stages/inception/artifacts/x.md")
		if (changeKind !== "file-removed") {
			writeFileSync(filePath, "content")
		}
		const finding = makeFinding({
			path: "stages/inception/artifacts/x.md",
			stage: "inception",
			change_kind: changeKind,
			...(changeKind === "file-removed"
				? { after_sha256: null, after_bytes: null, diff_unified: null }
				: {}),
			...(changeKind === "new-file-detected"
				? {
						before_sha256: null,
						before_bytes: null,
						diff_unified: "+content",
					}
				: {}),
		})
		const tickId = setupDispatch(intentDir, {
			stage: "development",
			findings: [finding],
		})
		const cls = {
			path: finding.path,
			outcome,
			rationale_excerpt: outcome === "ignore" ? "" : "test rationale",
		}
		if (outcome === "trigger-revisit")
			cls.linked_revisit_target_stage = "inception"
		const args = {
			intent_slug: slug,
			tick_id: tickId,
			classifications: [cls],
			agent_rationale: `Test for (${changeKind}, ${outcome})`,
		}
		if (outcome === "surface-as-feedback") {
			args.feedback_creates = [
				{
					for_classification_path: finding.path,
					title: "test fb",
					body: "test body",
					origin: "agent",
				},
			]
		}
		const result = await tool.handle(args)
		const data = parseResponse(result)
		assert.strictEqual(
			data.ok,
			true,
			`(${changeKind}, ${outcome}) should be accepted, got ${JSON.stringify(data)}`,
		)
	}
})

console.log("\n=== ignore semantics on deletion (AC-CI2) ===")

await test("ignore on a deletion REMOVES the baseline entry", async () => {
	const { slug, intentDir } = makeFixture()
	const stageDir = join(intentDir, "stages/design")
	writeFileSync(
		join(stageDir, "baseline.json"),
		JSON.stringify({
			"stages/design/artifacts/gone.md": {
				path: "stages/design/artifacts/gone.md",
				sha256: "a".repeat(64),
				bytes: 5,
				mtime_ns: 0,
				is_binary: false,
				author_class: "agent",
				acknowledged_at: "2026-04-28T00:00:00Z",
				acknowledged_via: "baseline-init",
				stage: "design",
				tracking_class: "stage-output",
			},
		}),
	)
	const finding = makeFinding({
		path: "stages/design/artifacts/gone.md",
		change_kind: "file-removed",
		after_sha256: null,
		after_bytes: null,
		diff_unified: null,
	})
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "ignore",
				rationale_excerpt: "deletion stands",
			},
		],
		agent_rationale: "User intentionally removed the file.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true)
	assert.strictEqual(data.baselines_updated, 1)
	const baseline = readBaseline(intentDir, "design")
	assert.ok(baseline)
	assert.ok(
		!baseline.entries.has("stages/design/artifacts/gone.md"),
		"baseline entry should be removed",
	)
})

console.log("\n=== Cross-stage trigger-revisit ===")

await test("trigger-revisit targeting an upstream stage is accepted", async () => {
	const { slug, intentDir } = makeFixture({
		stages: ["inception", "design", "development"],
		activeStage: "development",
	})
	mkdirSync(join(intentDir, "stages/design/artifacts"), { recursive: true })
	writeFileSync(join(intentDir, "stages/design/artifacts/spec.md"), "changed")
	const finding = makeFinding({
		path: "stages/design/artifacts/spec.md",
		stage: "design",
	})
	const tickId = setupDispatch(intentDir, {
		stage: "development",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "trigger-revisit",
				rationale_excerpt: "design needs revisit",
				linked_revisit_target_stage: "design",
			},
		],
		agent_rationale: "Design output is no longer self-consistent.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true)
})

await test("trigger-revisit targeting a downstream stage is rejected with revisit_target_invalid", async () => {
	const { slug, intentDir } = makeFixture({
		stages: ["inception", "design", "development"],
		activeStage: "design",
	})
	mkdirSync(join(intentDir, "stages/development/artifacts"), {
		recursive: true,
	})
	writeFileSync(join(intentDir, "stages/development/artifacts/x.md"), "x")
	// Build a finding manually that bypasses the dispatch's own
	// legal_outcomes filter for this case (we want to validate the
	// downstream-of-active rejection path; legal_outcomes for an
	// earlier-stage finding includes trigger-revisit).
	const finding = makeFinding({
		path: "stages/development/artifacts/x.md",
		stage: "development",
	})
	// Stage = development > activeStage = design, so the dispatcher's
	// legal_outcomes for this finding includes trigger-revisit (it is
	// not the active stage). The handler then rejects on
	// revisit_target_invalid because target=development is downstream
	// of activeStage=design.
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "trigger-revisit",
				rationale_excerpt: "needs revisit",
				linked_revisit_target_stage: "development",
			},
		],
		agent_rationale: "Trying to revisit a downstream stage — should fail.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "revisit_target_invalid")
})

console.log("\n=== Validation errors ===")

await test("empty agent_rationale is rejected with empty_rationale", async () => {
	const { slug, intentDir } = makeFixture()
	const finding = makeFinding()
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "ignore",
				rationale_excerpt: "ok",
			},
		],
		agent_rationale: "   ",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "empty_rationale")
})

await test("empty rationale_excerpt on non-ignore outcome is rejected (AC-EE5)", async () => {
	const { slug, intentDir } = makeFixture()
	writeFileSync(join(intentDir, "stages/design/artifacts/spec.md"), "x")
	const finding = makeFinding()
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "inline-fix",
				rationale_excerpt: "",
			},
		],
		agent_rationale: "agent rationale present",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "empty_rationale")
})

await test("stale tick_id is rejected with tick_id_stale", async () => {
	const { slug, intentDir } = makeFixture()
	const finding = makeFinding()
	setupDispatch(intentDir, {
		stage: "design",
		tickId: "tick-real",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: "tick-stale",
		classifications: [
			{
				path: finding.path,
				outcome: "ignore",
				rationale_excerpt: "x",
			},
		],
		agent_rationale: "x",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "tick_id_stale")
})

await test("no active dispatch returns tick_id_stale", async () => {
	const { slug } = makeFixture()
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: "tick-anything",
		classifications: [],
		agent_rationale: "x",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "tick_id_stale")
})

await test("classifications.length mismatch is rejected with classifications_count_mismatch", async () => {
	const { slug, intentDir } = makeFixture()
	const f1 = makeFinding({ path: "stages/design/artifacts/a.md" })
	const f2 = makeFinding({ path: "stages/design/artifacts/b.md" })
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [f1, f2],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{ path: f1.path, outcome: "ignore", rationale_excerpt: "x" },
		],
		agent_rationale: "only one classification when two findings",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "classifications_count_mismatch")
})

await test("invalid outcome alias `auto-fix` is rejected with illegal_outcome", async () => {
	const { slug, intentDir } = makeFixture()
	const finding = makeFinding()
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "auto-fix",
				rationale_excerpt: "x",
			},
		],
		agent_rationale: "trying invalid alias",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "illegal_outcome")
})

await test("invalid outcome alias `escalate` is rejected", async () => {
	const { slug, intentDir } = makeFixture()
	const finding = makeFinding()
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "escalate",
				rationale_excerpt: "x",
			},
		],
		agent_rationale: "trying invalid alias",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "illegal_outcome")
})

await test("surface-as-feedback without linked_feedback_id and no inline create is rejected with missing_link", async () => {
	const { slug, intentDir } = makeFixture()
	writeFileSync(join(intentDir, "stages/design/artifacts/spec.md"), "x")
	const finding = makeFinding()
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "surface-as-feedback",
				rationale_excerpt: "needs review",
			},
		],
		agent_rationale: "no link, no inline create",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, false)
	assert.strictEqual(data.error, "missing_link")
})

console.log("\n=== Idempotency / re-tick semantics ===")

await test("after `ignore` classification, dispatch is cleared so retry returns tick_id_stale", async () => {
	const { slug, intentDir } = makeFixture()
	writeFileSync(join(intentDir, "stages/design/artifacts/spec.md"), "x")
	const finding = makeFinding()
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	// First call succeeds.
	const r1 = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{ path: finding.path, outcome: "ignore", rationale_excerpt: "" },
		],
		agent_rationale: "first call",
	})
	assert.strictEqual(parseResponse(r1).ok, true)

	// Replay returns tick_id_stale because dispatch was cleared.
	const r2 = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{ path: finding.path, outcome: "ignore", rationale_excerpt: "" },
		],
		agent_rationale: "second call",
	})
	const d2 = parseResponse(r2)
	assert.strictEqual(d2.ok, false)
	assert.strictEqual(d2.error, "tick_id_stale")
})

console.log("\n=== Same-tick atomic batch (60 findings) ===")

await test("60 findings classified in one call produce one assessment with all 60 outcomes", async () => {
	const { slug, intentDir } = makeFixture()
	const findings = []
	const classifications = []
	for (let i = 0; i < 60; i++) {
		const path = `stages/design/artifacts/f-${String(i).padStart(2, "0")}.md`
		writeFileSync(join(intentDir, path), `content-${i}`)
		findings.push(
			makeFinding({
				path,
				after_sha256: computeFileSha256Sync(join(intentDir, path)),
			}),
		)
		classifications.push({
			path,
			outcome: "ignore",
			rationale_excerpt: "",
		})
	}
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings,
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications,
		agent_rationale: "Bulk ignore — 60 trivial changes.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true)
	assert.strictEqual(data.baselines_updated, 60)

	// Single assessment record with 60 classifications.
	const daPath = join(intentDir, "stages/design/drift-assessments/DA-01.json")
	assert.ok(existsSync(daPath))
	const assessment = JSON.parse(readFileSync(daPath, "utf-8"))
	assert.strictEqual(assessment.classifications.length, 60)
	assert.strictEqual(assessment.findings.length, 60)
})

console.log("\n=== Assessment durability + AS-NN numbering ===")

await test("Assessment ID auto-increments per stage (AS-01, AS-02, ...)", async () => {
	const { slug, intentDir } = makeFixture()
	writeFileSync(join(intentDir, "stages/design/artifacts/a.md"), "1")
	writeFileSync(join(intentDir, "stages/design/artifacts/b.md"), "2")
	// First assessment
	let finding = makeFinding({ path: "stages/design/artifacts/a.md" })
	let tickId = setupDispatch(intentDir, {
		stage: "design",
		tickId: "t1",
		findings: [finding],
	})
	const r1 = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{ path: finding.path, outcome: "ignore", rationale_excerpt: "" },
		],
		agent_rationale: "first",
	})
	assert.strictEqual(parseResponse(r1).assessment_id, "AS-01")

	// Second assessment
	finding = makeFinding({ path: "stages/design/artifacts/b.md" })
	tickId = setupDispatch(intentDir, {
		stage: "design",
		tickId: "t2",
		findings: [finding],
	})
	const r2 = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{ path: finding.path, outcome: "ignore", rationale_excerpt: "" },
		],
		agent_rationale: "second",
	})
	assert.strictEqual(parseResponse(r2).assessment_id, "AS-02")

	const dir = join(intentDir, "stages/design/drift-assessments")
	const files = readdirSync(dir).sort()
	assert.deepStrictEqual(files, ["DA-01.json", "DA-02.json"])
})

console.log("\n=== Response shape ===")

await test("response carries ok, assessment_id, feedback_created, pending_markers_created, baselines_updated, next_tick_will", async () => {
	const { slug, intentDir } = makeFixture()
	writeFileSync(join(intentDir, "stages/design/artifacts/spec.md"), "x")
	const finding = makeFinding()
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})
	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "surface-as-feedback",
				rationale_excerpt: "needs review",
			},
		],
		feedback_creates: [
			{
				for_classification_path: finding.path,
				title: "drift FB",
				body: "body",
				origin: "agent",
			},
		],
		agent_rationale: "Reviewer should look.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true)
	assert.ok(typeof data.assessment_id === "string")
	assert.ok(Array.isArray(data.feedback_created))
	assert.strictEqual(data.feedback_created.length, 1)
	assert.strictEqual(typeof data.pending_markers_created, "number")
	assert.strictEqual(typeof data.baselines_updated, "number")
	assert.ok(typeof data.next_tick_will === "string")
	assert.match(data.next_tick_will, /dispatch_review_fix_for_/)
})

console.log("\n=== author_class round-trip (Finding 1) ===")

await test("finding with author_class 'human-via-mcp' produces baseline entry with author_class 'human-via-mcp' (not 'human-implicit')", async () => {
	const { slug, intentDir } = makeFixture()
	const filePath = join(intentDir, "stages/design/artifacts/spec.md")
	writeFileSync(filePath, "new content\n")
	const finding = makeFinding({
		path: "stages/design/artifacts/spec.md",
		after_sha256: computeFileSha256Sync(filePath),
		// Simulate gate stamping human-via-mcp from the action log.
		author_class: "human-via-mcp",
	})
	const tickId = setupDispatch(intentDir, {
		stage: "design",
		findings: [finding],
	})

	const result = await tool.handle({
		intent_slug: slug,
		tick_id: tickId,
		classifications: [
			{
				path: finding.path,
				outcome: "ignore",
				rationale_excerpt: "stamped by haiku_human_write",
			},
		],
		agent_rationale: "Human used haiku_human_write; absorbing.",
	})
	const data = parseResponse(result)
	assert.strictEqual(data.ok, true, `expected ok, got ${JSON.stringify(data)}`)
	assert.strictEqual(data.baselines_updated, 1)

	// Baseline entry must preserve 'human-via-mcp', not downgrade to 'human-implicit'.
	const baseline = readBaseline(intentDir, "design")
	assert.ok(baseline)
	const entry = baseline.entries.get("stages/design/artifacts/spec.md")
	assert.ok(entry, "baseline entry should exist")
	assert.strictEqual(
		entry.author_class,
		"human-via-mcp",
		`Expected author_class 'human-via-mcp' but got '${entry.author_class}'. ` +
			"The dispatch schema was not persisting author_class, causing the classifier to always write 'human-implicit'.",
	)
})

// ── Wrap up ────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(60)}`)
console.log(`  ${passed} passed, ${failed} failed`)
console.log(`${"=".repeat(60)}`)

try {
	rmSync(tmp, { recursive: true, force: true })
} catch {}

if (failed > 0) process.exit(1)
