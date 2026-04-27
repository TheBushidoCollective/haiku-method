#!/usr/bin/env npx tsx
// Tests for haiku_feedback_move + the pre-tick triage gate
// (workflow/feedback-triage-gate.ts).
//
// Coverage:
//   1. moveFeedbackFile() — same-stage confirm sets triaged_at, no
//      file rename.
//   2. moveFeedbackFile() — cross-stage move renames to next free
//      FB-NN in the target dir, removes the source file, sets
//      triaged_at.
//   3. moveFeedbackFile() — null on missing FB.
//   4. Pre-tick gate — untriaged FB on the current stage emits
//      `feedback_triage`.
//   5. Pre-tick gate — triaged FB on an earlier stage emits a
//      revisit (`revisited` action) targeting that stage.
//   6. Pre-tick gate — triaged FB only on the current stage falls
//      through to the normal handler chain (returns null).
//   7. Pre-tick gate — multiple stages, picks the EARLIEST with open
//      feedback for revisit.
//   8. haiku_feedback_move via the MCP dispatch — closed FBs are
//      rejected (lifecycle violation).

import assert from "node:assert"
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-move-test-"))
const origCwd = process.cwd()

// Stub git so gitCommitState doesn't fail.
mkdirSync(join(tmp, "fake-bin"), { recursive: true })
writeFileSync(join(tmp, "fake-bin", "git"), "#!/bin/sh\nexit 0\n")
chmodSync(join(tmp, "fake-bin", "git"), 0o755)
process.env.PATH = `${join(tmp, "fake-bin")}:${process.env.PATH}`

const { handleStateTool, moveFeedbackFile, writeFeedbackFile } = await import(
	"../src/state-tools.ts"
)
const { preTickFeedbackGate } = await import(
	"../src/orchestrator/workflow/feedback-triage-gate.ts"
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

function makeProject(name, opts = {}) {
	const projDir = join(tmp, name)
	const haikuRoot = join(projDir, ".haiku")
	const slug = opts.slug || "test-intent"
	const intentDirPath = join(haikuRoot, "intents", slug)
	const studio = opts.studio || "test-studio"

	mkdirSync(join(intentDirPath, "stages"), { recursive: true })
	const stages = opts.stages || ["plan", "build", "review"]
	const fmLines = [
		"---",
		`title: "${opts.title || "Test"}"`,
		`studio: ${studio}`,
		`mode: ${opts.mode || "continuous"}`,
		`active_stage: ${opts.active_stage || ""}`,
		"status: active",
		`stages: [${stages.join(", ")}]`,
		"---",
		"",
		"Body",
	]
	writeFileSync(join(intentDirPath, "intent.md"), fmLines.join("\n"))

	const studioDir = join(haikuRoot, "studios", studio)
	mkdirSync(studioDir, { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		`---\nname: ${studio}\nstages: [${stages.join(", ")}]\n---\nA studio.\n`,
	)
	for (const stage of stages) {
		const sd = join(studioDir, "stages", stage)
		mkdirSync(sd, { recursive: true })
		writeFileSync(
			join(sd, "STAGE.md"),
			`---\nname: ${stage}\nhats: [worker]\nreview: auto\n---\n${stage}.\n`,
		)
	}

	for (const [stageName, stageState] of Object.entries(
		opts.stageStates ?? {},
	)) {
		const sd = join(intentDirPath, "stages", stageName)
		mkdirSync(sd, { recursive: true })
		writeFileSync(
			join(sd, "state.json"),
			JSON.stringify(
				{
					stage: stageName,
					phase: "elaborate",
					status: "active",
					...stageState,
				},
				null,
				2,
			),
		)
	}

	return { projDir, haikuRoot, intentDirPath, slug, studio, stages }
}

try {
	console.log("\n=== moveFeedbackFile (helper) ===")

	await test("same-stage confirm sets triaged_at, no file rename", () => {
		const { projDir, slug } = makeProject("same-stage-confirm")
		process.chdir(projDir)
		writeFeedbackFile(slug, "plan", {
			title: "Cosmetic",
			body: "Tiny issue.",
			origin: "user-chat",
			author: "user",
		})
		const result = moveFeedbackFile(slug, "plan", "FB-01", "plan")
		assert.ok(result)
		assert.strictEqual(result.moved, false)
		assert.strictEqual(result.feedback_id, "FB-01")
		assert.ok(result.triaged_at)
		// Source dir still has the file.
		const planDir = join(
			projDir,
			".haiku/intents",
			slug,
			"stages/plan/feedback",
		)
		const files = readdirSync(planDir).filter((f) => f.endsWith(".md"))
		assert.strictEqual(files.length, 1)
		// FM now carries triaged_at.
		const raw = readFileSync(join(planDir, files[0]), "utf8")
		assert.ok(raw.includes("triaged_at:"))
	})

	await test("cross-stage move renames to next FB-NN, deletes source", () => {
		const { projDir, slug } = makeProject("cross-stage-move")
		process.chdir(projDir)
		// Seed two FBs on plan.
		writeFeedbackFile(slug, "plan", {
			title: "Wrong stage",
			body: "Belongs on build.",
			origin: "user-chat",
			author: "user",
		})
		writeFeedbackFile(slug, "plan", {
			title: "Stays on plan",
			body: "Plan-related.",
			origin: "user-chat",
			author: "user",
		})
		// Seed one on build so the move renumbers around it.
		writeFeedbackFile(slug, "build", {
			title: "Existing build FB",
			body: "Already here.",
			origin: "user-chat",
			author: "user",
		})

		const result = moveFeedbackFile(slug, "plan", "FB-01", "build")
		assert.ok(result)
		assert.strictEqual(result.moved, true)
		assert.strictEqual(result.feedback_id, "FB-02")
		assert.ok(result.file.includes("/stages/build/feedback/"))

		const planDir = join(
			projDir,
			".haiku/intents",
			slug,
			"stages/plan/feedback",
		)
		const buildDir = join(
			projDir,
			".haiku/intents",
			slug,
			"stages/build/feedback",
		)
		// plan now has only FB-02 ("Stays on plan"); FB-01 was moved out.
		const planFiles = readdirSync(planDir).filter((f) => f.endsWith(".md"))
		assert.strictEqual(planFiles.length, 1)
		assert.ok(planFiles[0].startsWith("02-"))
		// build now has 2 files; the moved one is FB-02 (next after FB-01).
		const buildFiles = readdirSync(buildDir)
			.filter((f) => f.endsWith(".md"))
			.sort()
		assert.strictEqual(buildFiles.length, 2)
		assert.ok(buildFiles[1].startsWith("02-wrong-stage"))
	})

	await test("returns null when FB does not exist at source", () => {
		const { projDir, slug } = makeProject("missing-fb")
		process.chdir(projDir)
		const result = moveFeedbackFile(slug, "plan", "FB-99", "build")
		assert.strictEqual(result, null)
	})

	console.log("\n=== Pre-tick triage gate ===")

	await test("untriaged FB on current stage → feedback_triage action", () => {
		const { projDir, slug, intentDirPath, studio, stages } = makeProject(
			"triage-current",
			{
				active_stage: "plan",
				stageStates: { plan: { phase: "elaborate" } },
			},
		)
		process.chdir(projDir)
		// Human-authored → triaged_at: null by default.
		writeFeedbackFile(slug, "plan", {
			title: "Untriaged",
			body: "Body",
			origin: "user-chat",
			author: "user",
		})
		const action = preTickFeedbackGate({
			slug,
			studio,
			intentDirPath,
			intent: { studio, active_stage: "plan", stages },
			currentStage: "plan",
			currentPhase: "elaborate",
			stageState: { phase: "elaborate" },
		})
		assert.ok(action)
		assert.strictEqual(action.action, "feedback_triage")
		assert.strictEqual(action.items.length, 1)
		assert.strictEqual(action.items[0].feedback_id, "FB-01")
	})

	await test("triaged FB on earlier stage → revisited action", () => {
		const { projDir, slug, intentDirPath, studio, stages } = makeProject(
			"triage-earlier",
			{
				active_stage: "build",
				stages: ["plan", "build", "review"],
				stageStates: {
					plan: {
						phase: "gate",
						status: "completed",
						completed_at: "2026-04-15T00:00:00Z",
					},
					build: { phase: "execute" },
				},
			},
		)
		process.chdir(projDir)
		// agent-authored (auto-triaged).
		writeFeedbackFile(slug, "plan", {
			title: "Plan-rooted",
			body: "Body",
			origin: "adversarial-review",
			author: "review-agent",
		})
		const action = preTickFeedbackGate({
			slug,
			studio,
			intentDirPath,
			intent: { studio, active_stage: "build", stages },
			currentStage: "build",
			currentPhase: "execute",
			stageState: { phase: "execute" },
		})
		assert.ok(action)
		assert.strictEqual(action.action, "revisited")
		assert.strictEqual(action.target_stage, "plan")
	})

	await test("triaged FB on current stage only → null (fall through)", () => {
		const { projDir, slug, intentDirPath, studio, stages } = makeProject(
			"triage-current-only",
			{
				active_stage: "plan",
				stageStates: { plan: { phase: "execute" } },
			},
		)
		process.chdir(projDir)
		writeFeedbackFile(slug, "plan", {
			title: "On current",
			body: "Body",
			origin: "adversarial-review",
			author: "review-agent",
		})
		const action = preTickFeedbackGate({
			slug,
			studio,
			intentDirPath,
			intent: { studio, active_stage: "plan", stages },
			currentStage: "plan",
			currentPhase: "execute",
			stageState: { phase: "execute" },
		})
		assert.strictEqual(action, null)
	})

	await test("multiple earlier stages → revisits the EARLIEST one", () => {
		const { projDir, slug, intentDirPath, studio, stages } = makeProject(
			"triage-earliest",
			{
				active_stage: "review",
				stages: ["plan", "build", "review"],
				stageStates: {
					plan: { phase: "gate", status: "completed" },
					build: { phase: "gate", status: "completed" },
					review: { phase: "execute" },
				},
			},
		)
		process.chdir(projDir)
		// FBs on both plan and build — earliest is plan.
		writeFeedbackFile(slug, "plan", {
			title: "Plan-rooted",
			body: "x",
			origin: "adversarial-review",
		})
		writeFeedbackFile(slug, "build", {
			title: "Build-rooted",
			body: "y",
			origin: "adversarial-review",
		})
		const action = preTickFeedbackGate({
			slug,
			studio,
			intentDirPath,
			intent: { studio, active_stage: "review", stages },
			currentStage: "review",
			currentPhase: "execute",
			stageState: { phase: "execute" },
		})
		assert.ok(action)
		assert.strictEqual(action.action, "revisited")
		assert.strictEqual(action.target_stage, "plan")
	})

	console.log("\n=== haiku_feedback_move via MCP dispatch ===")

	await test("rejects move on closed FB (lifecycle violation)", async () => {
		const { projDir, slug } = makeProject("move-closed")
		process.chdir(projDir)
		const created = writeFeedbackFile(slug, "plan", {
			title: "Closed",
			body: "x",
			origin: "user-chat",
			author: "user",
		})
		// Manually flip status to "closed".
		const fbDir = join(projDir, ".haiku/intents", slug, "stages/plan/feedback")
		const files = readdirSync(fbDir).filter((f) => f.endsWith(".md"))
		const target = join(fbDir, files[0])
		const raw = readFileSync(target, "utf8").replace(
			/^status:\s*pending\s*$/m,
			"status: closed",
		)
		writeFileSync(target, raw)

		const result = await handleStateTool("haiku_feedback_move", {
			intent: slug,
			stage: "plan",
			feedback_id: created.feedback_id,
			to_stage: "build",
		})
		assert.ok(result.isError)
		const parsed = JSON.parse(result.content[0].text)
		assert.strictEqual(parsed.error, "lifecycle_violation")
	})

	await test("succeeds on a valid same-stage confirm via MCP", async () => {
		const { projDir, slug } = makeProject("move-mcp")
		process.chdir(projDir)
		const created = writeFeedbackFile(slug, "plan", {
			title: "Confirm me",
			body: "x",
			origin: "user-chat",
			author: "user",
		})
		const result = await handleStateTool("haiku_feedback_move", {
			intent: slug,
			stage: "plan",
			feedback_id: created.feedback_id,
			to_stage: "plan",
		})
		assert.ok(
			!result.isError,
			`Expected success, got: ${result.content[0].text}`,
		)
		const parsed = JSON.parse(result.content[0].text)
		assert.strictEqual(parsed.moved, false)
		assert.ok(parsed.triaged_at)
	})
} finally {
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true, force: true })
	console.log(`\n${passed} passed, ${failed} failed`)
	process.exit(failed > 0 ? 1 : 0)
}
