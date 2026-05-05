#!/usr/bin/env npx tsx
// End-to-end test for the workflow-engine tick. Verifies the full
// loop: disk fixture → deriveCurrentState → pre-tick consistency
// repair → tamper detection → registered handler → tick result.
//
// Every derive-state output has a registered handler; a "fallback"
// driver value in WorkflowTickResult would indicate a registry gap
// (currently unreachable).

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { runWorkflowTick, WORKFLOW_STATES, dispatchHandler } = await import(
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
	}
}

function fixture(slug, frontmatter, stages = {}) {
	const root = mkdtempSync(join(tmpdir(), "haiku-fsm-tick-"))
	const haikuRoot = join(root, ".haiku")
	const iDir = join(haikuRoot, "intents", slug)
	mkdirSync(iDir, { recursive: true })

	const fmLines = ["---"]
	for (const [k, v] of Object.entries(frontmatter)) {
		if (v == null) continue
		if (typeof v === "boolean") fmLines.push(`${k}: ${v}`)
		else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
			fmLines.push(`${k}: [${v.map((x) => `"${x}"`).join(", ")}]`)
		else if (Array.isArray(v) || (typeof v === "object" && v !== null))
			fmLines.push(`${k}: ${JSON.stringify(v)}`)
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

console.log("=== Driver routing ===")

test("missing intent returns null", () => {
	const result = runWorkflowTick("nonexistent", "/tmp/does-not-exist")
	assert.strictEqual(result, null)
})

test("composite intents route through xstate to composite_run_stage", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		composite: [{ studio: "software", stages: ["design"] }],
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	assert.ok(result)
	assert.strictEqual(result.state, "composite_run_stage")
	assert.ok(result.action)
})

test("complete state emits action", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		status: "completed",
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	assert.ok(result)
	assert.strictEqual(result.state, "complete")
	assert.ok(result.action, "should emit an action")
	assert.strictEqual(result.action.action, "complete")
	assert.strictEqual(
		result.action.message,
		`Intent 'test' is already completed`,
	)
})

test("archived (flag) emits an error action with unarchive instructions", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		archived: true,
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	assert.ok(result)
	assert.strictEqual(result.state, "error")
	assert.strictEqual(result.action.action, "error")
	assert.ok(
		result.action.message.includes("haiku_intent_unarchive"),
		"error message should reference haiku_intent_unarchive",
	)
})

test("status=archived (legacy) emits an error action with repair instructions", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		status: "archived",
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	assert.ok(result)
	assert.strictEqual(result.state, "error")
	assert.strictEqual(result.action.action, "error")
	assert.ok(
		result.action.message.includes("/haiku:repair"),
		"error message should reference /haiku:repair",
	)
})

test("complete-without-studio still emits action", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		status: "completed",
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	assert.ok(result)
	assert.strictEqual(result.state, "complete")
	// dispatchHandler is studio-independent for `complete`; the
	// action is emitted regardless of whether studio is set.
	assert.strictEqual(result.action.action, "complete")
})

console.log("\n=== Workflow handler registry ===")

test("registry contains the migrated states", () => {
	for (const name of ["complete", "select_studio", "error"]) {
		assert.ok(WORKFLOW_STATES.has(name), `registry should include '${name}'`)
	}
})

test("registry does NOT contain terminal-emit-only states", () => {
	// `escalate` and `blocked` are emission shapes returned by other
	// state handlers — they're not derive-state outputs themselves
	// and have no per-state file in handlers/.
	for (const name of ["escalate", "blocked"]) {
		assert.ok(
			!WORKFLOW_STATES.has(name),
			`registry should NOT include emission-only '${name}'`,
		)
	}
})

console.log("\n=== Tick result shape ===")

test("workflow tick result has no snapshot field", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		status: "completed",
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	// xstate was ripped out; the snapshot field no longer exists.
	assert.strictEqual("snapshot" in result, false)
})

test("context flows through to result", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		composite: [{ studio: "software", stages: ["design"] }],
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	assert.strictEqual(result.context.currentStage, "")
})

console.log("\n=== Parity vs runNext (complete state) ===")

test("dispatchHandler('complete') matches runNext's shape byte-for-byte", () => {
	// runNext emits this exact shape at orchestrator.ts:2200 when
	// it sees status=completed. The workflow handler must
	// match byte-for-byte or the migration is a regression.
	const slug = "test-completion"
	const action = dispatchHandler("complete", {
		slug,
		studio: "software",
		intentDirPath: `/dummy/${slug}`,
		intent: { studio: "software", status: "completed" },
		currentStage: "",
		currentPhase: "",
		stageState: {},
	})
	assert.deepStrictEqual(action, {
		action: "complete",
		message: `Intent '${slug}' is already completed`,
	})
})

test("dispatchHandler returns null for unmigrated states", () => {
	for (const name of ["blocked", "escalate", "elaborate"]) {
		const action = dispatchHandler(name, {
			slug: "x",
			studio: "software",
			intentDirPath: "/dummy",
			intent: {},
			currentStage: "",
			currentPhase: "",
			stageState: {},
		})
		assert.strictEqual(
			action,
			null,
			`'${name}' should not have a native emission yet`,
		)
	}
})

test("dispatchHandler('error') without recognized variant falls back to runNext (returns null)", () => {
	// 'error' is in the registry, but without intent.archived or
	// status=archived the emitter doesn't know which variant to
	// emit — so it returns null and the wrapper falls back to
	// runNext. This guards against silently emitting wrong errors.
	const action = dispatchHandler("error", {
		slug: "x",
		studio: "software",
		intentDirPath: "/dummy",
		intent: {},
		currentStage: "",
		currentPhase: "",
		stageState: {},
	})
	assert.strictEqual(action, null)
})

test("dispatchHandler('error') for archived flag emits unarchive message", () => {
	const action = dispatchHandler("error", {
		slug: "test-archived",
		studio: "software",
		intentDirPath: "/dummy",
		intent: { archived: true },
		currentStage: "",
		currentPhase: "",
		stageState: {},
	})
	assert.ok(action)
	assert.strictEqual(action.action, "error")
	assert.ok(action.message.includes("haiku_intent_unarchive"))
})

test("dispatchHandler('select_studio') produces studio list + correct message", () => {
	const slug = "test-no-studio"
	const action = dispatchHandler("select_studio", {
		slug,
		studio: "",
		intentDirPath: `/dummy/${slug}`,
		intent: {},
		currentStage: "",
		currentPhase: "",
		stageState: {},
	})
	assert.ok(action, "should emit an action")
	assert.strictEqual(action.action, "select_studio")
	assert.strictEqual(action.intent, slug)
	assert.ok(
		Array.isArray(action.available_studios),
		"available_studios should be an array",
	)
	assert.ok(
		action.available_studios.length > 0,
		"plugin ships at least one studio",
	)
	assert.strictEqual(
		action.message,
		`Intent '${slug}' has no studio selected. Call haiku_select_studio { intent: "${slug}" } to choose a lifecycle studio.`,
	)
	// Verify studio entries have the expected shape — same fields
	// runNext returns at orchestrator.ts:2164.
	const first = action.available_studios[0]
	assert.ok("name" in first)
	assert.ok("slug" in first)
	assert.ok("aliases" in first)
	assert.ok("description" in first)
	assert.ok("category" in first)
})

test("runWorkflowTick routes a no-studio intent through xstate to select_studio", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		title: "No studio yet",
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	assert.ok(result)
	assert.strictEqual(result.state, "select_studio")
	assert.ok(result.action, "should emit an action")
	assert.strictEqual(result.action.action, "select_studio")
})

console.log("\n=== start_stage handlers ===")

test("composite intents bypass start_stage and route to composite_run_stage", () => {
	const { haikuRoot, cleanup } = fixture("test", {
		studio: "software",
		composite: [{ studio: "software", stages: ["design"] }],
	})
	const result = runWorkflowTick("test", haikuRoot)
	cleanup()
	assert.ok(result)
	assert.strictEqual(result.state, "composite_run_stage")
})

console.log("\n=== Test isolation against side-effecting handlers ===")

// Two pollution incidents during the runNext → workflow-handlers
// migration this session: tests with active_stage="design" or
// phase="gate" triggered start-stage / gate handlers, which called
// workflowStartStage / workflowGateAsk, which created
// haiku/test/* branches and .haiku/intents/test/ artifacts in
// the parent repo. setHaikuRootForTests + setIsGitRepoForTests
// together pin the handler to the tmpdir + tell it git is unavailable,
// so every git op short-circuits but the state.json writes still
// land in the tmpdir.
const { setHaikuRootForTests, setIsGitRepoForTests } = await import(
	"../src/state/shared.ts"
)
const { existsSync, readFileSync } = await import("node:fs")
const { execSync } = await import("node:child_process")

test("side-effecting handler against isolated fixture does not pollute parent repo", () => {
	// Snapshot parent-repo branch list to detect any haiku/* branch
	// created during the test.
	const branchesBefore = execSync("git branch", { encoding: "utf8" })
		.split("\n")
		.filter((b) => b.includes("haiku/"))
		.sort()

	const { haikuRoot, cleanup } = fixture("isolation-canary", {
		studio: "software",
		// active_stage empty → derive-state returns start_stage with
		// currentStage = first software stage. The handler runs through
		// to workflowStartStage, which does git ops. With
		// setIsGitRepoForTests(false), those ops short-circuit.
	})
	setHaikuRootForTests(haikuRoot)
	setIsGitRepoForTests(false)
	try {
		const result = runWorkflowTick("isolation-canary", haikuRoot)
		assert.ok(result, "handler should produce a tick")
		assert.strictEqual(result.state, "start_stage")
		assert.ok(result.action, "handler should emit an action")
		assert.strictEqual(result.action.action, "start_stage")
		// state.json should land in the tmpdir, NOT in the parent repo.
		const tmpStatePath = `${haikuRoot}/intents/isolation-canary/stages/inception/state.json`
		assert.ok(
			existsSync(tmpStatePath),
			`expected state.json in tmpdir at ${tmpStatePath}`,
		)
		const stateData = JSON.parse(readFileSync(tmpStatePath, "utf8"))
		assert.strictEqual(stateData.status, "active")
		assert.strictEqual(stateData.phase, "elaborate")
	} finally {
		setHaikuRootForTests(null)
		setIsGitRepoForTests(null)
		cleanup()
	}

	const branchesAfter = execSync("git branch", { encoding: "utf8" })
		.split("\n")
		.filter((b) => b.includes("haiku/"))
		.sort()

	assert.deepStrictEqual(
		branchesAfter,
		branchesBefore,
		"side-effecting handler must not create branches in the parent repo when isolated via setHaikuRootForTests + setIsGitRepoForTests",
	)
})

test("preTickConsistency repairs intent.md active_stage when stale (current stage's state.json is completed)", () => {
	const { haikuRoot, cleanup } = fixture(
		"stale-active-stage",
		{
			studio: "software",
			active_stage: "product", // stale: product is actually completed
		},
		{
			inception: { stage: "inception", status: "completed", phase: "gate" },
			design: { stage: "design", status: "completed", phase: "gate" },
			product: { stage: "product", status: "completed", phase: "gate" },
			development: {
				stage: "development",
				status: "active",
				phase: "elaborate",
			},
		},
	)
	// Isolation guards mirror the canary above (Round 23 carry): the
	// repaired stage currently routes to elaborate, so the git-touching
	// path is latent — but if a future change routes the repaired stage
	// through start_stage / gate / merge handlers, those would land
	// branch state in the parent repo without these guards. Pin haiku
	// root to the tmpdir + short-circuit isGitRepo so the invariant is
	// structural, not coincidental.
	setHaikuRootForTests(haikuRoot)
	setIsGitRepoForTests(false)
	try {
		const result = runWorkflowTick("stale-active-stage", haikuRoot)
		// Pre-tick rewrites intent.md active_stage from product → development.
		// derive-state then re-reads and routes development as the current
		// stage, returning whatever phase action that stage's state.json
		// implies (here: phase=elaborate → state=elaborate).
		assert.ok(result, "tick should not be null")
		const intentPath = `${haikuRoot}/intents/stale-active-stage/intent.md`
		const md = readFileSync(intentPath, "utf8")
		assert.match(
			md,
			/active_stage:\s*['"]?development['"]?/,
			"intent.md active_stage should be repaired to development",
		)
		// derive-state should now see development as current and emit a
		// development-stage action (not a product-stage action).
		assert.notStrictEqual(
			result.action.action,
			"complete",
			"intent shouldn't be complete — development is still active",
		)
	} finally {
		setHaikuRootForTests(null)
		setIsGitRepoForTests(null)
		cleanup()
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
