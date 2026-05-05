#!/usr/bin/env npx tsx
// Regression test for the discrete-mode gate prompt bug.
//
// User-reported: a discrete-mode intent on the inception stage saw a
// gate prompt that said "Stage 'inception' is complete and ready for
// human review before advancing to 'design'." The user was confused
// — they're in discrete mode, the gate is a PR-submission checkpoint
// (the merge IS the approval signal), and they hadn't entered or
// cared about the design stage yet.
//
// Root cause: the gate handler at handlers/gate.ts:787-796 always
// passed `next_stage: nextStage` on the emitted gate_review action,
// regardless of intent mode. The gate_review prompt then renders
// "before advancing to '${nextStage}'" — continuous-mode language
// leaking into discrete-mode UX.
//
// Fix: in discrete mode the gate_review action carries `next_stage:
// null`. The gate prompt's existing conditional
// (`${nextStage ? ` before advancing to "${nextStage}"` : ""}`) drops
// the clause naturally. The merge-detection path in the same file
// computes its own next_stage from `studioStages[idx + 1]` AFTER the
// PR is merged, so the workflow still advances correctly — we just
// stop pre-announcing the destination at submission time.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { runWorkflowTick } = await import(
	"../src/orchestrator/workflow/run-tick.ts"
)

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}`)
		console.log(`    ${err.message}`)
		if (err.stack) console.log(err.stack)
	}
}

function fixture(slug, intentFm, stages = {}) {
	const root = mkdtempSync(join(tmpdir(), "haiku-discrete-gate-"))
	const haikuRoot = join(root, ".haiku")
	const iDir = join(haikuRoot, "intents", slug)
	mkdirSync(iDir, { recursive: true })

	const fmLines = ["---"]
	for (const [k, v] of Object.entries(intentFm)) {
		if (v == null) continue
		if (typeof v === "boolean") fmLines.push(`${k}: ${v}`)
		else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
			fmLines.push(`${k}: [${v.map((x) => `"${x}"`).join(", ")}]`)
		else fmLines.push(`${k}: "${v}"`)
	}
	fmLines.push("---", "", "# Intent body")
	writeFileSync(join(iDir, "intent.md"), fmLines.join("\n"))

	for (const [stageName, stageState] of Object.entries(stages)) {
		const sd = join(iDir, "stages", stageName)
		mkdirSync(sd, { recursive: true })
		writeFileSync(join(sd, "state.json"), JSON.stringify(stageState, null, 2))
	}

	return {
		haikuRoot,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	}
}

console.log(
	"\n=== gate handler: discrete mode drops next_stage from gate_review ===",
)

test("discrete mode: gate_review carries next_stage: null even when a next stage exists", () => {
	const slug = "test-discrete-gate"
	const { haikuRoot, cleanup } = fixture(
		slug,
		{
			studio: "software",
			mode: "discrete",
			// Multiple stages so studioStages.indexOf(active) + 1 yields a
			// real next stage. The bug specifically fires when nextStage
			// is computable — that's what made the prompt say "advancing
			// to 'design'" in the user's transcript.
			stages: ["inception", "design", "development"],
			active_stage: "inception",
		},
		{
			inception: {
				status: "active",
				phase: "gate",
				started_at: "2026-01-01T00:00:00Z",
				completed_at: null,
				gate_entered_at: "2026-01-01T01:00:00Z",
				gate_outcome: null,
				visits: 1,
				iterations: [{ index: 1, started_at: "2026-01-01T00:00:00Z" }],
			},
		},
	)
	const origCwd = process.cwd()
	let result
	try {
		process.chdir(join(haikuRoot, ".."))
		result = runWorkflowTick(slug, haikuRoot)
	} finally {
		process.chdir(origCwd)
		cleanup()
	}
	assert.ok(result, "tick must return a result")
	assert.ok(result.action, "result must have an action")
	assert.strictEqual(
		result.action.action,
		"gate_review",
		`discrete-mode gate should still emit gate_review (external); got: ${result.action.action} — message: ${result.action.message}`,
	)
	// The actual fix we're testing: in discrete mode, next_stage is
	// dropped because the gate is a PR-submission checkpoint, not an
	// auto-advance transition.
	assert.strictEqual(
		result.action.next_stage,
		null,
		`discrete-mode gate_review must carry next_stage: null (got: ${JSON.stringify(result.action.next_stage)}). The merge-detection path will compute next_stage AFTER the PR merges; pre-announcing it at submission time is wrong.`,
	)
})

test("continuous mode: gate_review still carries next_stage (regression guard)", () => {
	// Critical: the discrete-mode fix must NOT regress continuous /
	// autopilot. The next_stage field is load-bearing for the
	// post-approval haiku_await_gate path in those modes — it drives
	// workflowAdvanceStage. Drop only on discrete.
	const slug = "test-continuous-gate"
	const { haikuRoot, cleanup } = fixture(
		slug,
		{
			studio: "software",
			mode: "continuous",
			stages: ["inception", "design"],
			active_stage: "inception",
		},
		{
			inception: {
				status: "active",
				phase: "gate",
				started_at: "2026-01-01T00:00:00Z",
				completed_at: null,
				gate_entered_at: "2026-01-01T01:00:00Z",
				gate_outcome: null,
				visits: 1,
				iterations: [{ index: 1, started_at: "2026-01-01T00:00:00Z" }],
			},
		},
	)
	const origCwd = process.cwd()
	let result
	try {
		process.chdir(join(haikuRoot, ".."))
		result = runWorkflowTick(slug, haikuRoot)
	} finally {
		process.chdir(origCwd)
		cleanup()
	}
	assert.ok(result, "tick must return a result")
	if (result.action.action === "gate_review") {
		assert.strictEqual(
			result.action.next_stage,
			"design",
			`continuous-mode gate_review must still carry next_stage="design" (got: ${JSON.stringify(result.action.next_stage)}). Dropping next_stage on continuous mode would break post-approval advance.`,
		)
	} else {
		// Some studio configurations may auto-advance instead of
		// emitting gate_review (e.g. an `auto` review type). That's
		// fine — the regression guard only matters when gate_review
		// fires. But assert it's not silently wrong: must be one of
		// the documented continuous-mode advance paths.
		assert.ok(
			["advance_stage", "advance_phase"].includes(result.action.action),
			`unexpected action for continuous-mode gate phase: ${result.action.action}`,
		)
	}
})

test("discrete mode on final stage: next_stage already null (no regression)", () => {
	// Sanity: when the active stage is the LAST stage, nextStage is
	// already null in the handler. The fix shouldn't change anything
	// here — it just confirms the discrete branch doesn't introduce a
	// new behavior on the last-stage path.
	const slug = "test-discrete-final"
	const { haikuRoot, cleanup } = fixture(
		slug,
		{
			studio: "software",
			mode: "discrete",
			stages: ["inception"], // single-stage discrete
			active_stage: "inception",
		},
		{
			inception: {
				status: "active",
				phase: "gate",
				started_at: "2026-01-01T00:00:00Z",
				completed_at: null,
				gate_entered_at: "2026-01-01T01:00:00Z",
				gate_outcome: null,
				visits: 1,
				iterations: [{ index: 1, started_at: "2026-01-01T00:00:00Z" }],
			},
		},
	)
	const origCwd = process.cwd()
	let result
	try {
		process.chdir(join(haikuRoot, ".."))
		result = runWorkflowTick(slug, haikuRoot)
	} finally {
		process.chdir(origCwd)
		cleanup()
	}
	assert.ok(result, "tick must return a result")
	if (result.action.action === "gate_review") {
		assert.strictEqual(
			result.action.next_stage,
			null,
			"discrete-mode last-stage gate_review must have next_stage: null",
		)
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
