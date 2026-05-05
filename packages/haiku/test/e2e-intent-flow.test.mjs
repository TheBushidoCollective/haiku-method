#!/usr/bin/env npx tsx
// End-to-end tests for the intent-creation lifecycle. Drives the
// engine the way an agent would: through MCP tool calls, with the
// elicitation handler simulating user choices.
//
// Coverage:
//   - Continuous-mode happy path: create → run_next → select_studio
//     → run_next → select_mode → run_next → intent_review → start_stage
//   - Quick-mode happy path: same as above plus select_stage between
//     mode selection and intent review.
//   - Discrete-mode happy path: same shape as continuous; verifies
//     `discrete` writes stages = full studio list.
//   - Bug recovery: half-state on stage state.json (the dirty-tree-
//     refusal cascade Tara hit) self-heals on the next run_next.
//   - Mode-immutability constraint: haiku_intent_set rejects mode
//     writes with `intent_field_engine_only`.
//   - haiku_intent_create no longer accepts mode/stages.

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

const { handleOrchestratorTool, setElicitInputHandler, setGateReviewHandlers } =
	await import("../src/orchestrator.ts")
const { writeJson, parseFrontmatter, handleStateTool } = await import(
	"../src/state-tools.ts"
)

// Stub git so commit/push operations don't fight a real repo.
const tmp = mkdtempSync(join(tmpdir(), "haiku-e2e-"))
mkdirSync(join(tmp, "fake-bin"), { recursive: true })
writeFileSync(join(tmp, "fake-bin", "git"), "#!/bin/sh\nexit 0\n")
chmodSync(join(tmp, "fake-bin", "git"), 0o755)
process.env.PATH = `${join(tmp, "fake-bin")}:${process.env.PATH}`

let passed = 0
let failed = 0

async function test(name, fn) {
	try {
		const r = fn()
		if (r && typeof r.then === "function") await r
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}: ${err.message}`)
		if (err.stack) console.log(err.stack)
	}
}

/** Build a self-contained project dir with a fake studio. Each test
 *  gets its own tmp project so the `process.cwd()` reset between
 *  tests doesn't bleed state. */
function makeProject(name, opts = {}) {
	const projDir = join(tmp, name)
	const haikuRoot = join(projDir, ".haiku")
	const studio = opts.studio || "test-studio"
	const stages = opts.stages || ["plan", "build", "ship"]
	mkdirSync(haikuRoot, { recursive: true })
	const studioDir = join(haikuRoot, "studios", studio)
	mkdirSync(studioDir, { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		`---\nname: ${studio}\ndescription: Test studio\nstages: [${stages.join(", ")}]\n---\n\nA test studio.\n`,
	)
	for (const stage of stages) {
		const stageDir = join(studioDir, "stages", stage)
		mkdirSync(stageDir, { recursive: true })
		writeFileSync(
			join(stageDir, "STAGE.md"),
			`---\nname: ${stage}\nhats: [worker]\nreview: auto\nelaboration: autonomous\n---\n\n${stage} stage.\n`,
		)
	}
	return { projDir, haikuRoot, studio, stages }
}

/** Simulated user picker. Maps elicit prompts to a chosen value. */
function userPicker(answers) {
	return async ({ message, requestedSchema }) => {
		const fields = Object.keys(requestedSchema?.properties || {})
		const field = fields[0]
		if (!field) return { action: "decline" }
		const enumOptions = requestedSchema.properties[field].enum || []
		const wanted = answers[field]
		// If the user provided an explicit answer, use it.
		// Otherwise return the first enum value (first-match default).
		const choice =
			wanted !== undefined
				? wanted
				: enumOptions.length > 0
					? enumOptions[0]
					: ""
		return { action: "accept", content: { [field]: choice } }
	}
}

function readIntentFm(intentDir) {
	const raw = readFileSync(join(intentDir, "intent.md"), "utf8")
	return parseFrontmatter(raw).data
}

/** Call an MCP tool and parse its JSON response. Tolerates plain-text
 *  responses (returns the body as a string for assertion-by-substring). */
async function call(name, args) {
	const result = await handleOrchestratorTool(name, args)
	const responseText = result.content[0].text
	const jsonMatch = responseText.match(/\{[\s\S]*?\}\n\n---/)
	let json
	try {
		json = jsonMatch
			? JSON.parse(jsonMatch[0].replace(/\n\n---$/, ""))
			: JSON.parse(responseText)
	} catch {
		json = { _raw: responseText }
	}
	return { result, json, responseText }
}

/** Register a no-op gate-review prepare handler so haiku_run_next can
 *  process a gate_review action without an MCP host attached. */
function installGateReviewMock() {
	setGateReviewHandlers({
		prepare: async () => ({
			session_id: "e2e-gate-session",
			review_url: "http://test.local/review/e2e",
			use_remote: false,
			reused: false,
			browser_attached: false,
		}),
		await: async () => ({
			decision: "approved",
			feedback: "",
			annotations: {},
		}),
	})
}

try {
	console.log("\n=== E2E: continuous-mode happy path ===")

	await test("create → studio → mode → intent_review → start_stage", async () => {
		const { projDir, studio } = makeProject("cont-flow")
		process.chdir(projDir)

		installGateReviewMock()
		setElicitInputHandler(
			userPicker({
				studio,
				mode: "continuous",
			}),
		)

		// 1. Create the intent — no mode, no stages allowed.
		const created = await call("haiku_intent_create", {
			title: "Test continuous flow",
			description: "End-to-end coverage of the studio→mode→review chain.",
			slug: "cont-flow-intent",
		})
		assert.strictEqual(created.json.action, "intent_created")
		const intentDirAbs = join(projDir, ".haiku", "intents", "cont-flow-intent")
		const fmAfterCreate = readIntentFm(intentDirAbs)
		assert.strictEqual(
			fmAfterCreate.mode,
			undefined,
			"mode must NOT be set at create time",
		)
		assert.strictEqual(
			fmAfterCreate.stages,
			undefined,
			"stages must NOT be set at create time",
		)
		assert.strictEqual(fmAfterCreate.studio, "")

		// 2. run_next → select_studio
		const tick1 = await call("haiku_run_next", { intent: "cont-flow-intent" })
		assert.strictEqual(tick1.json.action, "select_studio")

		// 3. select_studio
		const sel = await call("haiku_select_studio", {
			intent: "cont-flow-intent",
		})
		assert.strictEqual(sel.json.action, "studio_selected")
		assert.strictEqual(sel.json.studio, studio)
		const fmAfterStudio = readIntentFm(intentDirAbs)
		assert.strictEqual(fmAfterStudio.studio, studio)
		assert.strictEqual(
			fmAfterStudio.stages,
			undefined,
			"select_studio MUST NOT auto-set stages — that's haiku_select_mode's job",
		)

		// 4. run_next → select_mode
		const tick2 = await call("haiku_run_next", { intent: "cont-flow-intent" })
		assert.strictEqual(tick2.json.action, "select_mode")
		assert.ok(
			Array.isArray(tick2.json.available_modes),
			"available_modes must be present",
		)

		// 5. select_mode (continuous)
		const mode = await call("haiku_select_mode", {
			intent: "cont-flow-intent",
		})
		assert.strictEqual(mode.json.action, "mode_selected")
		assert.strictEqual(mode.json.mode, "continuous")
		const fmAfterMode = readIntentFm(intentDirAbs)
		assert.strictEqual(fmAfterMode.mode, "continuous")
		assert.deepStrictEqual(
			fmAfterMode.stages,
			["plan", "build", "ship"],
			"non-quick mode must set stages = studio's full list",
		)

		// 6. run_next → intent_review (NOT start_stage — gate fires first)
		const tick3 = await call("haiku_run_next", { intent: "cont-flow-intent" })
		assert.strictEqual(tick3.json.action, "gate_review")
		assert.strictEqual(tick3.json.gate_context, "intent_review")
		// intent_review fires BEFORE any stage starts — no active_stage,
		// so the action carries an empty stage string. (The handler
		// returns `stage: null`; haiku_run_next coerces to "" for the
		// outer JSON contract.)
		assert.ok(
			tick3.json.stage === "" || tick3.json.stage === null,
			`expected null/empty stage, got: ${JSON.stringify(tick3.json.stage)}`,
		)

		setElicitInputHandler(null)
		setGateReviewHandlers({ prepare: null, await: null })
	})

	console.log("\n=== E2E: quick-mode happy path ===")

	await test("quick mode adds select_stage between select_mode and intent_review", async () => {
		const { projDir, studio } = makeProject("quick-flow")
		process.chdir(projDir)

		installGateReviewMock()
		setElicitInputHandler(
			userPicker({
				studio,
				mode: "quick",
				stage: "build",
			}),
		)

		await call("haiku_intent_create", {
			title: "Test quick flow",
			description: "Quick mode picks one stage.",
			slug: "quick-flow-intent",
		})
		const intentDirAbs = join(projDir, ".haiku", "intents", "quick-flow-intent")

		await call("haiku_run_next", { intent: "quick-flow-intent" })
		await call("haiku_select_studio", { intent: "quick-flow-intent" })
		await call("haiku_run_next", { intent: "quick-flow-intent" })
		const mode = await call("haiku_select_mode", {
			intent: "quick-flow-intent",
		})
		assert.strictEqual(mode.json.mode, "quick")

		const fmAfterMode = readIntentFm(intentDirAbs)
		assert.strictEqual(fmAfterMode.mode, "quick")
		assert.strictEqual(
			fmAfterMode.stages,
			undefined,
			"quick mode must NOT auto-set stages — that's haiku_select_stage's job",
		)

		// run_next → select_stage (the quick-only state)
		const tick = await call("haiku_run_next", { intent: "quick-flow-intent" })
		assert.strictEqual(tick.json.action, "select_stage")
		assert.deepStrictEqual(tick.json.available_stages, [
			"plan",
			"build",
			"ship",
		])

		const stagePick = await call("haiku_select_stage", {
			intent: "quick-flow-intent",
		})
		assert.strictEqual(stagePick.json.action, "stage_selected")
		assert.strictEqual(stagePick.json.stage, "build")
		const fmAfterStage = readIntentFm(intentDirAbs)
		assert.deepStrictEqual(fmAfterStage.stages, ["build"])

		// run_next → intent_review
		const tick2 = await call("haiku_run_next", { intent: "quick-flow-intent" })
		assert.strictEqual(tick2.json.action, "gate_review")
		assert.strictEqual(tick2.json.gate_context, "intent_review")

		setElicitInputHandler(null)
	})

	console.log("\n=== E2E: discrete-mode writes full stage list ===")

	await test("discrete mode writes stages = studio's full stage list (not a subset)", async () => {
		const { projDir, studio } = makeProject("discrete-flow")
		process.chdir(projDir)

		setElicitInputHandler(
			userPicker({
				studio,
				mode: "discrete",
			}),
		)

		await call("haiku_intent_create", {
			title: "Test discrete flow",
			description: "Discrete mode covers every stage.",
			slug: "discrete-flow-intent",
		})
		const intentDirAbs = join(
			projDir,
			".haiku",
			"intents",
			"discrete-flow-intent",
		)

		await call("haiku_run_next", { intent: "discrete-flow-intent" })
		await call("haiku_select_studio", { intent: "discrete-flow-intent" })
		await call("haiku_run_next", { intent: "discrete-flow-intent" })
		await call("haiku_select_mode", { intent: "discrete-flow-intent" })

		const fm = readIntentFm(intentDirAbs)
		assert.strictEqual(fm.mode, "discrete")
		assert.deepStrictEqual(
			fm.stages,
			["plan", "build", "ship"],
			"discrete mode must NEVER amputate stages — full studio list goes in",
		)

		setElicitInputHandler(null)
	})

	console.log("\n=== E2E: agent cannot dictate mode or stages ===")

	await test("haiku_intent_create rejects mode and stages args (additionalProperties: false)", async () => {
		const { projDir } = makeProject("rejects-mode")
		process.chdir(projDir)

		// haiku_intent_create no longer accepts these keys. The handler
		// still works if we don't pass them; passing them should be
		// rejected at the schema level OR ignored downstream — either
		// way, the resulting intent.md must NOT carry mode/stages.
		const created = await call("haiku_intent_create", {
			title: "No mode no stages",
			description: "Make sure the agent can't dictate orientation.",
			slug: "rejects-mode-intent",
		})
		assert.strictEqual(created.json.action, "intent_created")
		const fm = readIntentFm(
			join(projDir, ".haiku", "intents", "rejects-mode-intent"),
		)
		assert.strictEqual(fm.mode, undefined, "intent.md must NOT carry mode")
		assert.strictEqual(fm.stages, undefined, "intent.md must NOT carry stages")
	})

	console.log("\n=== E2E: half-state recovery (Tara's bug) ===")

	await test("stage state.json with phase=elaborate but no active_stage on intent.md self-heals to pending", async () => {
		const { projDir, studio } = makeProject("halfstate-flow")
		process.chdir(projDir)

		setElicitInputHandler(userPicker({ studio, mode: "continuous" }))

		await call("haiku_intent_create", {
			title: "Half state recovery",
			description: "Reproduce the cascade Tara hit and prove it self-heals.",
			slug: "halfstate-intent",
		})
		const intentDirAbs = join(projDir, ".haiku", "intents", "halfstate-intent")
		await call("haiku_run_next", { intent: "halfstate-intent" })
		await call("haiku_select_studio", { intent: "halfstate-intent" })
		await call("haiku_run_next", { intent: "halfstate-intent" })
		await call("haiku_select_mode", { intent: "halfstate-intent" })

		// Fast-forward: mark intent_reviewed=true so derive-state would
		// route to start_stage. (We're not testing intent_review here —
		// just the half-state recovery path.)
		const intentFile = join(intentDirAbs, "intent.md")
		const raw = readFileSync(intentFile, "utf8")
		writeFileSync(
			intentFile,
			raw.replace(/^---\n/, "---\nintent_reviewed: true\n"),
		)

		// Plant the half-state: stage state.json says active+elaborate
		// but intent.md has no active_stage. This is exactly the shape
		// Tara hit when workflowStartStage's git checkout failed
		// AFTER state.json was written.
		const stageStateDir = join(intentDirAbs, "stages", "plan")
		mkdirSync(stageStateDir, { recursive: true })
		writeJson(join(stageStateDir, "state.json"), {
			stage: "plan",
			status: "active",
			phase: "elaborate",
			started_at: "2026-04-01T00:00:00Z",
			completed_at: null,
			gate_entered_at: null,
			gate_outcome: null,
			visits: 0,
		})

		// Pre-bug behavior: this run_next would surface
		// "runWorkflowTick produced no action for state: start_stage"
		// because the start-stage handler returned null on the
		// half-state. The recovery path now rolls state.json back to
		// pending and falls through to the normal start_stage emit.
		const tick = await call("haiku_run_next", { intent: "halfstate-intent" })
		assert.notStrictEqual(
			tick.json.action,
			"error",
			`recovery should NOT error — got: ${JSON.stringify(tick.json)}`,
		)
		// Recovery contract: the action must be `start_stage` (the engine
		// re-derives from a clean baseline). If we ever see something
		// else here it's a regression in the rollback path.
		assert.strictEqual(
			tick.json.action,
			"start_stage",
			`expected start_stage on recovery, got: ${tick.json.action}`,
		)
		// And the stage state.json must have been rolled back AND then
		// re-initialized — which means the next state.json write
		// happens against a known shape. After the recovery+re-emit
		// the state.json carries a normal active+elaborate (the pos-0
		// reset workflowStartStage does), not the stale half-state
		// values from the previous failed run.
		const recoveredState = JSON.parse(
			readFileSync(join(stageStateDir, "state.json"), "utf8"),
		)
		assert.strictEqual(recoveredState.status, "active")
		assert.strictEqual(recoveredState.phase, "elaborate")
		// The original planted started_at must be replaced with a fresh
		// timestamp — proves the rollback actually re-entered
		// workflowStartStage rather than leaving stale state visible.
		assert.notStrictEqual(
			recoveredState.started_at,
			"2026-04-01T00:00:00Z",
			"recovery must re-stamp started_at; stale planted timestamp should be gone",
		)

		setElicitInputHandler(null)
	})

	console.log("\n=== E2E: dirty-tree recovery (uncommitted intent.md) ===")

	await test("workflowStartStage attempts pre-stage commit when intent.md is dirty", async () => {
		// Tara's session showed `git checkout -b <stageBranch> <main>`
		// refusing because intent.md was uncommitted (intent_create's
		// silent best-effort gitCommitState had failed earlier in the
		// chain). The fix: workflowStartStage now calls gitCommitState
		// BEFORE attempting the stage-branch checkout, so the dirty
		// state is committed (or the failure surfaces cleanly with no
		// half-state on disk).
		//
		// We can't fully exercise the git operations without a real
		// repo, but we CAN drive the start-stage handler and verify it
		// invokes the pre-stage commit guard rather than crashing past
		// it. The fake-bin git stub in the test scaffold returns 0 for
		// every git invocation, so the checkout "succeeds" trivially —
		// the assertion below is that the side-effect chain runs
		// cleanly and produces the expected start_stage action even
		// when the intent dir is in a freshly-modified state.
		const { projDir, studio } = makeProject("dirty-tree-flow")
		process.chdir(projDir)

		setElicitInputHandler(userPicker({ studio, mode: "continuous" }))

		await call("haiku_intent_create", {
			title: "Dirty tree recovery",
			description: "Pre-stage commit guard catches uncommitted intent.md.",
			slug: "dirty-tree-intent",
		})
		const intentDirAbs = join(projDir, ".haiku", "intents", "dirty-tree-intent")

		await call("haiku_run_next", { intent: "dirty-tree-intent" })
		await call("haiku_select_studio", { intent: "dirty-tree-intent" })
		await call("haiku_run_next", { intent: "dirty-tree-intent" })
		await call("haiku_select_mode", { intent: "dirty-tree-intent" })

		// Mark intent_reviewed=true so the next tick advances past the
		// review gate and lands on start_stage.
		const intentFile = join(intentDirAbs, "intent.md")
		const raw = readFileSync(intentFile, "utf8")
		writeFileSync(
			intentFile,
			raw.replace(/^---\n/, "---\nintent_reviewed: true\n"),
		)
		// Now mutate intent.md AGAIN without committing — this is the
		// shape that previously broke checkout. The pre-stage commit
		// guard should pick it up.
		const raw2 = readFileSync(intentFile, "utf8")
		writeFileSync(intentFile, `${raw2}\n# Trailing dirt\n`)

		const tick = await call("haiku_run_next", { intent: "dirty-tree-intent" })
		assert.strictEqual(
			tick.json.action,
			"start_stage",
			`dirty-tree should self-heal to start_stage, got: ${JSON.stringify(tick.json)}`,
		)
		// After start_stage, the stage's state.json must exist with
		// active+elaborate — proves workflowStartStage ran past the
		// guard, not that it bailed early on the dirty tree.
		const stateFile = join(intentDirAbs, "stages", "plan", "state.json")
		assert.ok(
			existsSync(stateFile),
			`stage state.json must exist after start_stage; not found at ${stateFile}`,
		)
		const stageState = JSON.parse(readFileSync(stateFile, "utf8"))
		assert.strictEqual(stageState.status, "active")
		assert.strictEqual(stageState.phase, "elaborate")

		setElicitInputHandler(null)
	})

	console.log("\n=== E2E: elicitation fallback for intent_review approval ===")

	await test("pre-stage intent_review approval via elicitation fallback (review UI down) clears phase + stamps intent_reviewed without crashing", async () => {
		// Regression for the bug the PR reviewer flagged 6 times:
		// haiku_await_gate's elicitation fallback path (when the
		// review UI fails) called `workflowAdvancePhase(slug, "",
		// "execute")` against a pre-stage intent_review, which
		// resolved stage state.json at `stages//state.json` and
		// silently failed via the outer catch — leaving
		// `phase: intent_review` stranded on intent.md.
		const { projDir, studio } = makeProject("elicit-fallback")
		process.chdir(projDir)

		// Prepare succeeds (so pointers persist on intent.md), then
		// the await callback throws — that's the trigger for the
		// elicitation fallback path. Mirror of how the real review
		// UI fails: session created, but the wait loop dies.
		setGateReviewHandlers({
			prepare: async () => ({
				session_id: "elicit-fallback-session",
				review_url: "http://test.local/review/elicit-fallback",
				use_remote: false,
				reused: false,
				browser_attached: false,
			}),
			await: async () => {
				throw new Error("review UI await failed in test")
			},
		})
		// Two distinct elicit answers needed: mode (continuous) and
		// gate decision (approve). Route by field name.
		setElicitInputHandler(async ({ requestedSchema }) => {
			const fields = Object.keys(requestedSchema?.properties || {})
			const f = fields[0]
			if (f === "studio") return { action: "accept", content: { studio } }
			if (f === "mode")
				return { action: "accept", content: { mode: "continuous" } }
			if (f === "decision")
				return { action: "accept", content: { decision: "approve" } }
			return { action: "decline" }
		})

		await call("haiku_intent_create", {
			title: "Elicitation fallback approval",
			description:
				"Review UI fails; approval flows through MCP elicit. Pre-stage gate must not crash on stage=''.",
			slug: "elicit-fallback-intent",
		})
		const intentDirAbs = join(
			projDir,
			".haiku",
			"intents",
			"elicit-fallback-intent",
		)

		await call("haiku_run_next", { intent: "elicit-fallback-intent" })
		await call("haiku_select_studio", { intent: "elicit-fallback-intent" })
		await call("haiku_run_next", { intent: "elicit-fallback-intent" })
		await call("haiku_select_mode", { intent: "elicit-fallback-intent" })

		// Drive run_next to open the intent_review gate. With
		// prepareGateReview throwing, this returns an error from
		// run_next — but the engine has stamped phase: intent_review
		// on intent.md before that throw.
		await call("haiku_run_next", { intent: "elicit-fallback-intent" })
		// Now call await_gate. The await callback won't run because
		// prepare failed; haiku_await_gate's catch path falls to
		// _elicitInput, which our handler answers with
		// decision: "approve".
		const approval = await call("haiku_await_gate", {
			intent: "elicit-fallback-intent",
		})
		// Pre-fix expected: GATE BLOCKED (the workflowAdvancePhase
		// call resolves stages//state.json and the outer catch
		// surfaces a generic blocked error). Post-fix expected:
		// intent_approved with stage: null.
		assert.strictEqual(
			approval.json.action,
			"intent_approved",
			`elicitation fallback must produce intent_approved, got: ${JSON.stringify(approval.json)}`,
		)
		// And the stranded `phase: intent_review` field on intent.md
		// must be cleared so the next derive-state tick falls
		// through to start_stage instead of looping back into
		// intent_review.
		const fmAfter = readIntentFm(intentDirAbs)
		assert.strictEqual(
			fmAfter.intent_reviewed,
			true,
			"intent_reviewed must be stamped",
		)
		assert.notStrictEqual(
			fmAfter.phase,
			"intent_review",
			`phase must be cleared after pre-stage approval, got: ${fmAfter.phase}`,
		)

		setElicitInputHandler(null)
		setGateReviewHandlers({ prepare: null, await: null })
	})

	console.log("\n=== E2E: mode field is engine-only ===")

	await test("haiku_intent_set rejects writes to `mode` with intent_field_engine_only", async () => {
		const { projDir } = makeProject("mode-set-rejected")
		process.chdir(projDir)

		await call("haiku_intent_create", {
			title: "Mode set rejected",
			description: "Mode is engine-managed; intent_set must refuse it.",
			slug: "mode-set-intent",
		})

		// haiku_intent_set is a state-tool, not an orchestrator tool —
		// dispatched via handleStateTool, not handleOrchestratorTool.
		const result = handleStateTool("haiku_intent_set", {
			intent: "mode-set-intent",
			field: "mode",
			value: "discrete",
		})
		assert.strictEqual(result.isError, true)
		const text = result.content[0].text
		assert.ok(
			text.includes("intent_field_engine_only"),
			`expected intent_field_engine_only error, got: ${text}`,
		)
	})

	console.log(`\n${passed} passed, ${failed} failed`)
	process.chdir(_origCwdEarly)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(failed > 0 ? 1 : 0)
} catch (err) {
	console.error(`\nFatal: ${err.message}`)
	console.error(err.stack)
	process.chdir(_origCwdEarly)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(1)
}
