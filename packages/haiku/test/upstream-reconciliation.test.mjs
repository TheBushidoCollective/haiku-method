#!/usr/bin/env npx tsx
// Test suite for the pre-elaboration upstream reconciliation gate.
//
// Three checks:
//   1. The detector functions correctly identify cross-document
//      contradictions (tool names, HTTP statuses, field names).
//   2. The pre-tick gate fires only on the first elaboration of a
//      stage that has ≥1 completed prior stage, emitting
//      `upstream_reconciliation_required` with findings + a
//      `prompt_file` pointer.
//   3. `haiku_reconciliation_acknowledge` records the decision in
//      the stage's decision_log and unblocks the next tick.

import assert from "node:assert"
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const _origCwdEarly = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = join(_origCwdEarly, "..", "..", "plugin")

const { runNext } = await import("../src/orchestrator.ts")
const { writeJson, handleStateTool } = await import("../src/state-tools.ts")
const { checkUpstreamReconciliation } = await import(
	"../src/orchestrator/workflow/upstream-reconciliation.ts"
)

const tmp = mkdtempSync(join(tmpdir(), "haiku-recon-test-"))
const origCwd = _origCwdEarly

mkdirSync(join(tmp, "fake-bin"), { recursive: true })
writeFileSync(join(tmp, "fake-bin", "git"), "#!/bin/sh\nexit 0\n")
chmodSync(join(tmp, "fake-bin", "git"), 0o755)
process.env.PATH = `${join(tmp, "fake-bin")}:${process.env.PATH}`

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

function createProject(name, opts = {}) {
	const projDir = join(tmp, name)
	const slug = opts.slug || "test-intent"
	const studio = opts.studio || "test-studio"
	const stages = opts.stages || ["plan", "build"]
	const haikuRoot = join(projDir, ".haiku")
	const intentDirPath = join(haikuRoot, "intents", slug)
	mkdirSync(intentDirPath, { recursive: true })

	writeFileSync(
		join(intentDirPath, "intent.md"),
		`---
title: Test
studio: ${studio}
mode: continuous
active_stage: ${opts.active_stage || stages[0]}
status: active
intent_reviewed: true
started_at: 2026-04-29T00:00:00Z
completed_at: null
---

Test.
`,
	)

	const studioDir = join(haikuRoot, "studios", studio)
	mkdirSync(studioDir, { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		`---
name: ${studio}
description: Test
stages: [${stages.join(", ")}]
---

Test.
`,
	)
	for (const s of stages) {
		const stageDir = join(studioDir, "stages", s)
		mkdirSync(stageDir, { recursive: true })
		writeFileSync(
			join(stageDir, "STAGE.md"),
			`---
name: ${s}
description: ${s}
hats: [coder]
review: auto
elaboration: autonomous
---

${s} body.
`,
		)
		mkdirSync(join(stageDir, "hats"), { recursive: true })
		writeFileSync(
			join(stageDir, "hats", "coder.md"),
			`---
name: coder
---

Coder mandate.
`,
		)
	}

	for (const s of stages) {
		mkdirSync(join(intentDirPath, "stages", s, "units"), { recursive: true })
		mkdirSync(join(intentDirPath, "stages", s, "feedback"), { recursive: true })
		mkdirSync(join(intentDirPath, "stages", s, "artifacts"), {
			recursive: true,
		})
	}

	return { projDir, intentDirPath, slug, studio, stages }
}

function setStageState(intentDirPath, stage, state) {
	const stageDir = join(intentDirPath, "stages", stage)
	mkdirSync(stageDir, { recursive: true })
	writeJson(join(stageDir, "state.json"), {
		stage,
		status: "active",
		phase: "elaborate",
		started_at: "2026-04-29T00:00:00Z",
		completed_at: null,
		gate_entered_at: null,
		gate_outcome: null,
		visits: 0,
		iterations: [
			{
				index: 1,
				started_at: "2026-04-29T00:00:00Z",
				completed_at: null,
				trigger: "initial",
				result: null,
			},
		],
		...state,
	})
}

try {
	console.log("\n=== checkUpstreamReconciliation ===")

	await test("detects tool-name divergence between two artifacts", () => {
		const { projDir, intentDirPath, slug, stages } =
			createProject("recon-tool-name")
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API Spec

## Tool: haiku_feedback_write
Writes feedback body.
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage Spec

## Tool: haiku_feedback_create
Creates a feedback record.
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		process.chdir(projDir)
		const result = checkUpstreamReconciliation(slug, [stages[0]])
		assert.ok(result, "reconciliation should produce a result")
		assert.ok(
			result.findings.length >= 1,
			`expected ≥1 finding, got ${result.findings.length}`,
		)
		const tool = result.findings.find((f) => f.kind === "tool_name")
		assert.ok(tool, "should detect tool_name finding")
		assert.ok(
			tool.occurrences.some((o) => o.name === "haiku_feedback_write"),
			"should reference haiku_feedback_write",
		)
		assert.ok(
			tool.occurrences.some((o) => o.name === "haiku_feedback_create"),
			"should reference haiku_feedback_create",
		)
	})

	await test("does NOT flag haiku_feedback_write vs haiku_feedback_read (different synonym classes)", () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-write-vs-read",
		)
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "WRITE.md"),
			`# Write API

## Tool: haiku_feedback_write
Writes feedback body.
`,
		)
		writeFileSync(
			join(planArtifacts, "READ.md"),
			`# Read API

## Tool: haiku_feedback_read
Reads feedback body.
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		process.chdir(projDir)
		const result = checkUpstreamReconciliation(slug, [stages[0]])
		// Write vs read are different synonym classes — should NOT flag.
		const toolFindings = result
			? result.findings.filter((f) => f.kind === "tool_name")
			: []
		assert.strictEqual(
			toolFindings.length,
			0,
			"write vs read in different synonym classes should NOT be flagged",
		)
	})

	await test("flags haiku_feedback_write vs haiku_feedback_create (same write-class)", () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-write-vs-create",
		)
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API

## Tool: haiku_feedback_write
Writes feedback.
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage

## Tool: haiku_feedback_create
Creates feedback record.
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		process.chdir(projDir)
		const result = checkUpstreamReconciliation(slug, [stages[0]])
		assert.ok(result, "should produce a result")
		const toolFinding = result.findings.find((f) => f.kind === "tool_name")
		assert.ok(
			toolFinding,
			"write vs create in same synonym class SHOULD be flagged",
		)
		assert.ok(
			toolFinding.occurrences.some((o) => o.name === "haiku_feedback_write"),
			"should include haiku_feedback_write",
		)
		assert.ok(
			toolFinding.occurrences.some((o) => o.name === "haiku_feedback_create"),
			"should include haiku_feedback_create",
		)
	})

	await test("detects HTTP status divergence between two artifacts", () => {
		const { projDir, intentDirPath, slug, stages } =
			createProject("recon-http-status")
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "ERRORS.md"),
			`# Errors
intent_locked → 423
path_outside_tracked_surface → 403
`,
		)
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API
intent_locked → 409
path_outside_tracked_surface → 403
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		process.chdir(projDir)
		const result = checkUpstreamReconciliation(slug, [stages[0]])
		assert.ok(result, "reconciliation should produce a result")
		const status = result.findings.find((f) => f.kind === "http_status")
		assert.ok(status, "should detect http_status finding")
		assert.strictEqual(status.concept, "intent_locked")
		assert.ok(
			status.occurrences.some((o) => o.name.includes("423")),
			"should reference 423",
		)
		assert.ok(
			status.occurrences.some((o) => o.name.includes("409")),
			"should reference 409",
		)
	})

	await test("detects field-name divergence between two artifacts", () => {
		const { projDir, intentDirPath, slug, stages } =
			createProject("recon-field-name")
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "FEEDBACK_SCHEMA_A.md"),
			`# Feedback schema (storage)
| Field | Type |
| acknowledged_by | string |
| body | string |
`,
		)
		writeFileSync(
			join(planArtifacts, "FEEDBACK_SCHEMA_B.md"),
			`# Feedback schema (API)
| Field | Type |
| author_class | string |
| body | string |
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		process.chdir(projDir)
		const result = checkUpstreamReconciliation(slug, [stages[0]])
		assert.ok(result, "reconciliation should produce a result")
		const field = result.findings.find((f) => f.kind === "field_name")
		assert.ok(field, "should detect field_name finding")
		assert.ok(
			field.occurrences.some((o) => o.name === "acknowledged_by"),
			"should reference acknowledged_by",
		)
		assert.ok(
			field.occurrences.some((o) => o.name === "author_class"),
			"should reference author_class",
		)
	})

	await test("returns null when artifacts are consistent", () => {
		const { projDir, intentDirPath, slug, stages } =
			createProject("recon-consistent")
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API
## Tool: haiku_feedback_write
Writes feedback body.
intent_locked → 423
| Field | Type |
| acknowledged_by | string |
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage
## Tool: haiku_feedback_write
Writes feedback body.
intent_locked → 423
| Field | Type |
| acknowledged_by | string |
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		process.chdir(projDir)
		const result = checkUpstreamReconciliation(slug, [stages[0]])
		assert.strictEqual(
			result,
			null,
			"consistent artifacts should produce no findings",
		)
	})

	await test("rootDir parameter resolves corpus when process.cwd() differs", () => {
		const { projDir, intentDirPath, slug, stages } =
			createProject("recon-root-param")
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API
## Tool: haiku_feedback_write
Writes feedback.
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage
## Tool: haiku_feedback_create
Creates a feedback record.
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		// Deliberately stay in the original cwd — do NOT chdir into projDir.
		// Pass root explicitly so the corpus is resolved without relying on
		// process.cwd().
		const haikuRoot = join(projDir, ".haiku")
		const result = checkUpstreamReconciliation(slug, [stages[0]], haikuRoot)
		assert.ok(
			result,
			"should detect divergence when rootDir is passed explicitly",
		)
		const toolFinding = result.findings.find((f) => f.kind === "tool_name")
		assert.ok(
			toolFinding,
			"should find tool_name divergence via explicit rootDir",
		)
	})

	console.log("\n=== pre-tick gate ===")

	// SCENARIO D: migration-safety — the first elaboration of a stage with
	// ≥1 completed prior MUST silently establish the corpus fingerprint
	// (no fire) and stamp `state.json.upstream_reconciliation_fingerprint`.
	// A null fingerprint is a migration sentinel: it means "we have not
	// fingerprinted this corpus yet" and MUST onboard silently rather than
	// firing on stale priors that the operator never agreed to flag.
	await test("first elaboration with priors silently establishes fingerprint (no fire) and stamps state.json", async () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-gate-establish",
			{ active_stage: "build" },
		)
		// Plant a divergence in plan artifacts.
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API
## Tool: haiku_feedback_write
intent_locked → 423
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage
## Tool: haiku_feedback_create
intent_locked → 409
`,
		)
		// plan stage completed, build is active in elaborate phase, iter 1, no prior fingerprint.
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		setStageState(intentDirPath, stages[1], { phase: "elaborate" })
		process.chdir(projDir)
		const result = runNext(slug)
		assert.notStrictEqual(
			result.action,
			"upstream_reconciliation_required",
			"first tick with null fingerprint must silently establish, not fire",
		)
		const buildStateRaw = readFileSync(
			join(intentDirPath, "stages", stages[1], "state.json"),
			"utf8",
		)
		const buildState = JSON.parse(buildStateRaw)
		assert.strictEqual(
			typeof buildState.upstream_reconciliation_fingerprint,
			"string",
			"fingerprint should be stamped onto stage state.json after first tick",
		)
		assert.match(
			buildState.upstream_reconciliation_fingerprint,
			/^[0-9a-f]{64}$/,
			"fingerprint should be a SHA256 hex digest",
		)
	})

	// SCENARIO F: migration-safety — once a fingerprint has been stamped
	// (i.e. the migration has run), a subsequent first-elaborate where the
	// CURRENT corpus differs from the stored fingerprint MUST fire
	// `upstream_reconciliation_required`. This is the round-trip proof that
	// silent establish (D) plus drift detection compose correctly: silent
	// establish is not "ignore me forever", it is a one-time migration
	// step, after which corpus drift relative to the stored fingerprint
	// is the firing condition.
	await test("emits upstream_reconciliation_required when stored fingerprint differs from current corpus", async () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-gate-fires-on-drift",
			{ active_stage: "build" },
		)
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API
## Tool: haiku_feedback_write
intent_locked → 423
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage
## Tool: haiku_feedback_create
intent_locked → 409
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		// Pre-stamp a STALE fingerprint that does not match the current corpus,
		// simulating a subsequent first-elaborate where corpus has drifted
		// since the fingerprint was last established or acknowledged.
		setStageState(intentDirPath, stages[1], {
			phase: "elaborate",
			upstream_reconciliation_fingerprint:
				"0000000000000000000000000000000000000000000000000000000000000000",
		})
		process.chdir(projDir)
		const result = runNext(slug)
		assert.strictEqual(result.action, "upstream_reconciliation_required")
		assert.ok(
			Array.isArray(result.findings) && result.findings.length > 0,
			"action should carry findings list",
		)
		assert.ok(result.prompt_file, "action should be file-backed")
		assert.ok(
			existsSync(result.prompt_file),
			`prompt_file should exist: ${result.prompt_file}`,
		)
		const body = readFileSync(result.prompt_file, "utf8")
		assert.ok(
			body.includes("Upstream Reconciliation Required"),
			"prompt body should contain reconciliation header",
		)
	})

	// SCENARIO E: migration-safety — when the stored fingerprint matches
	// the current corpus, the gate MUST fall through even when the
	// detector functions WOULD find divergence. The fingerprint is the
	// migration acknowledgment; a matching fingerprint means "the operator
	// (or the silent establish) has already accepted this corpus shape",
	// so the gate stays quiet. This is the steady-state path that prevents
	// re-firing on every tick post-migration.
	await test("does not fire when stored fingerprint matches current corpus (clean steady state)", async () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-gate-fingerprint-match",
			{ active_stage: "build" },
		)
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API
## Tool: haiku_feedback_write
intent_locked → 423
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage
## Tool: haiku_feedback_create
intent_locked → 409
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		setStageState(intentDirPath, stages[1], { phase: "elaborate" })
		process.chdir(projDir)
		// First tick: silently establishes the fingerprint.
		const r1 = runNext(slug)
		assert.notStrictEqual(r1.action, "upstream_reconciliation_required")
		// Reset stage state to iteration 1 so the gate's first-elaborate guard
		// remains satisfied for a re-run with the established fingerprint.
		const buildStateFile = join(
			intentDirPath,
			"stages",
			stages[1],
			"state.json",
		)
		const buildStateAfterFirst = JSON.parse(
			readFileSync(buildStateFile, "utf8"),
		)
		const establishedFp =
			buildStateAfterFirst.upstream_reconciliation_fingerprint
		assert.strictEqual(typeof establishedFp, "string")
		// Re-stamp same fingerprint, leave iter at 1.
		setStageState(intentDirPath, stages[1], {
			phase: "elaborate",
			upstream_reconciliation_fingerprint: establishedFp,
		})
		// Second tick: fingerprint matches → gate must skip even though
		// detectors WOULD find divergence. This is the steady-state path.
		const r2 = runNext(slug)
		assert.notStrictEqual(
			r2.action,
			"upstream_reconciliation_required",
			"matching fingerprint must short-circuit the gate",
		)
	})

	await test("does not fire when there are no priors (first stage)", async () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-no-priors",
			{ active_stage: "plan" },
		)
		setStageState(intentDirPath, stages[0], { phase: "elaborate" })
		process.chdir(projDir)
		const result = runNext(slug)
		assert.notStrictEqual(
			result.action,
			"upstream_reconciliation_required",
			"first stage should not trigger reconciliation",
		)
	})

	await test("does not fire on second elaboration (iteration 2)", async () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-iter-2",
			{ active_stage: "build" },
		)
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API
## Tool: haiku_feedback_write
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage
## Tool: haiku_feedback_create
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		// Two iterations recorded — i.e. revisit, not first elaborate.
		setStageState(intentDirPath, stages[1], {
			phase: "elaborate",
			iterations: [
				{
					index: 1,
					started_at: "2026-04-29T00:00:00Z",
					completed_at: "2026-04-29T01:00:00Z",
					trigger: "initial",
					result: "feedback-revisit",
				},
				{
					index: 2,
					started_at: "2026-04-29T02:00:00Z",
					completed_at: null,
					trigger: "feedback",
					result: null,
				},
			],
		})
		process.chdir(projDir)
		const result = runNext(slug)
		assert.notStrictEqual(
			result.action,
			"upstream_reconciliation_required",
			"second-iteration elaborate should not re-trigger reconciliation",
		)
	})

	// SCENARIO G: migration-safety — `haiku_reconciliation_acknowledge`
	// records the operator's decision in `state.json.decision_log` and
	// re-stamps the fingerprint so the next tick falls through. This is
	// the manual rollback path: when the gate fires on real corpus drift,
	// the operator can acknowledge with a rationale and the gate accepts
	// the new corpus shape as the new baseline going forward.
	await test("haiku_reconciliation_acknowledge records decision and unblocks next tick", async () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-ack",
			{ active_stage: "build" },
		)
		const planArtifacts = join(intentDirPath, "stages", stages[0], "artifacts")
		mkdirSync(planArtifacts, { recursive: true })
		writeFileSync(
			join(planArtifacts, "API.md"),
			`# API
## Tool: haiku_feedback_write
`,
		)
		writeFileSync(
			join(planArtifacts, "STORAGE.md"),
			`# Storage
## Tool: haiku_feedback_create
`,
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		// Pre-stamp a stale fingerprint so the gate detects drift and fires
		// on the first tick (instead of silently establishing). Mirrors the
		// real-world case where the corpus drifts after the fingerprint was
		// last established or acknowledged.
		setStageState(intentDirPath, stages[1], {
			phase: "elaborate",
			upstream_reconciliation_fingerprint:
				"0000000000000000000000000000000000000000000000000000000000000000",
		})
		process.chdir(projDir)

		// First tick: gate fires.
		const first = runNext(slug)
		assert.strictEqual(first.action, "upstream_reconciliation_required")

		// Acknowledge the divergence.
		const ackResult = handleStateTool("haiku_reconciliation_acknowledge", {
			intent: slug,
			stage: stages[1],
			rationale:
				"These tools intentionally describe different surfaces — the storage path uses _create while the API uses _write because of a legacy compat shim that we're not unwinding right now.",
		})
		const ackJson = JSON.parse(ackResult.content[0].text)
		assert.strictEqual(ackJson.ok, true)
		assert.strictEqual(ackJson.stage, stages[1])

		// State.json should now carry the acknowledgment.
		const stateFile = join(intentDirPath, "stages", stages[1], "state.json")
		const stageState = JSON.parse(readFileSync(stateFile, "utf8"))
		assert.strictEqual(stageState.upstream_reconciliation_acknowledged, true)
		assert.ok(
			Array.isArray(stageState.decision_log) &&
				stageState.decision_log.length > 0,
			"decision_log should carry the acknowledgment",
		)
		assert.strictEqual(
			stageState.decision_log[0].kind,
			"upstream_reconciliation",
		)

		// Next tick: gate should fall through (no longer
		// upstream_reconciliation_required).
		const second = runNext(slug)
		assert.notStrictEqual(
			second.action,
			"upstream_reconciliation_required",
			"after acknowledge, gate should fall through",
		)
	})

	await test("haiku_reconciliation_acknowledge requires rationale ≥10 chars", async () => {
		const { projDir, intentDirPath, slug, stages } = createProject(
			"recon-ack-rationale",
			{ active_stage: "build" },
		)
		setStageState(intentDirPath, stages[0], {
			status: "completed",
			phase: "complete",
		})
		setStageState(intentDirPath, stages[1], { phase: "elaborate" })
		process.chdir(projDir)

		const r1 = handleStateTool("haiku_reconciliation_acknowledge", {
			intent: slug,
			stage: stages[1],
			rationale: "short",
		})
		const r1Json = JSON.parse(r1.content[0].text)
		assert.strictEqual(r1Json.error, "rationale_required")
	})

	console.log(`\n${passed} passed, ${failed} failed`)
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(failed > 0 ? 1 : 0)
} catch (e) {
	console.error(`\nFatal: ${e.message}`)
	console.error(e.stack)
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(1)
}
