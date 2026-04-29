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
const { preTickFeedbackGate, countOpenFeedbackForGateCheck } = await import(
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

	await test("cross-stage move relocates sidecar attachment + rewrites body URL", () => {
		const { projDir, slug } = makeProject("cross-stage-sidecar")
		process.chdir(projDir)
		// 1×1 transparent PNG.
		const tinyPng =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
		const created = writeFeedbackFile(slug, "plan", {
			title: "Has attachment",
			body: "See screenshot.",
			origin: "user-chat",
			author: "user",
			attachmentDataUrl: `data:image/png;base64,${tinyPng}`,
		})
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
		// Pre-condition: sidecar PNG exists alongside the .md.
		const planSidecars = readdirSync(planDir).filter((f) => f.endsWith(".png"))
		assert.strictEqual(planSidecars.length, 1, "sidecar should be seeded")

		const result = moveFeedbackFile(slug, "plan", created.feedback_id, "build")
		assert.ok(result)
		assert.strictEqual(result.moved, true)

		// Source dir: .md AND sidecar both gone.
		const planLeftover = readdirSync(planDir)
		assert.strictEqual(planLeftover.length, 0, "plan dir should be empty")

		// Target dir: .md AND sidecar both present, both with the new NN.
		const buildFiles = readdirSync(buildDir).sort()
		assert.strictEqual(buildFiles.length, 2)
		const md = buildFiles.find((f) => f.endsWith(".md"))
		const png = buildFiles.find((f) => f.endsWith(".png"))
		assert.ok(md && png)
		// Filenames share the same NN-slug stem.
		const stem = md.replace(/\.md$/, "")
		assert.strictEqual(png, `${stem}.png`)

		// Body URL was rewritten to point at build/<new NN>.
		const newBody = readFileSync(join(buildDir, md), "utf8")
		assert.match(
			newBody,
			/\/api\/feedback-attachment\/[^/]+\/build\/01-has-attachment\.png/,
		)
		// Old URL pointing at plan must NOT appear.
		assert.doesNotMatch(
			newBody,
			/\/api\/feedback-attachment\/[^/]+\/plan\/01-has-attachment\.png/,
		)
	})

	await test("orphan attachment in target dir → throws BEFORE writing dest .md", () => {
		const { projDir, slug } = makeProject("orphan-collision")
		process.chdir(projDir)
		const tinyPng =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
		const created = writeFeedbackFile(slug, "plan", {
			title: "Has attachment",
			body: "x",
			origin: "user-chat",
			author: "user",
			attachmentDataUrl: `data:image/png;base64,${tinyPng}`,
		})
		const buildDir = join(
			projDir,
			".haiku/intents",
			slug,
			"stages/build/feedback",
		)
		// Plant an orphan attachment in the target dir at the slot the
		// move would write to. The move's pre-flight should refuse
		// without touching the source .md or writing the destination.
		mkdirSync(buildDir, { recursive: true })
		writeFileSync(
			join(buildDir, "01-has-attachment.png"),
			Buffer.from(tinyPng, "base64"),
		)
		const orphanBefore = readFileSync(join(buildDir, "01-has-attachment.png"))

		assert.throws(
			() => moveFeedbackFile(slug, "plan", created.feedback_id, "build"),
			/refusing to overwrite/,
		)

		// Source .md still present (move aborted).
		const planDir = join(
			projDir,
			".haiku/intents",
			slug,
			"stages/plan/feedback",
		)
		const planFiles = readdirSync(planDir).filter((f) => f.endsWith(".md"))
		assert.strictEqual(planFiles.length, 1, "source .md must still exist")

		// No destination .md was written.
		const buildMds = readdirSync(buildDir).filter((f) => f.endsWith(".md"))
		assert.strictEqual(
			buildMds.length,
			0,
			"destination .md must NOT have been written",
		)

		// Orphan attachment is untouched (byte-identical).
		const orphanAfter = readFileSync(join(buildDir, "01-has-attachment.png"))
		assert.ok(orphanBefore.equals(orphanAfter), "orphan attachment unchanged")
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

	await test("triaged agent-authored FB on current stage → feedback_dispatch (author-agnostic)", () => {
		// The pre-tick gate must dispatch open pending feedback no matter
		// who filed it. Letting agent-authored FBs fall through to null
		// means the elaborate / gate handler downstream emits
		// `gate_review` while feedback is still open — exactly the
		// review-screen-with-pending-feedback bug this gate is supposed
		// to prevent.
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
		assert.ok(action, "expected dispatch action, got null")
		assert.strictEqual(action.action, "feedback_dispatch")
		assert.strictEqual(action.counts.needs_triage, 1)
	})

	await test("agent-authored stage_revisit FB on current stage in elaborate phase → feedback_dispatch", () => {
		// Regression: this is the exact shape that hit the gate-while-
		// feedback-open bug. After a revisit, agent-authored FBs reset
		// to status:pending with resolution unset are buckets needsTriage
		// here. Before this fix, the human-only filter dropped them, the
		// pre-tick returned null, and elaborate.ts then emitted
		// `gate_review` to the user with feedback still open.
		const { projDir, slug, intentDirPath, studio, stages } = makeProject(
			"triage-current-elaborate",
			{
				active_stage: "plan",
				stageStates: { plan: { phase: "elaborate" } },
			},
		)
		process.chdir(projDir)
		writeFeedbackFile(slug, "plan", {
			title: "Stage-revisit FB",
			body: "Body",
			origin: "adversarial-review",
			author: "review-agent",
			resolution: "stage_revisit",
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
		assert.ok(action, "expected dispatch action, got null")
		assert.strictEqual(action.action, "feedback_dispatch")
		assert.strictEqual(action.counts.stage_revisits, 1)
	})

	await test("agent-authored inline_fix FB on current stage in execute phase → feedback_dispatch", () => {
		// inlineFix FBs were never dispatched from pre-tick before this
		// fix — the comment said gate.ts handles them. That's true in
		// gate phase, but not in execute / elaborate / review phases.
		// run_next must fix feedback no matter the author or phase.
		const { projDir, slug, intentDirPath, studio, stages } = makeProject(
			"triage-current-inline-fix",
			{
				active_stage: "plan",
				stageStates: { plan: { phase: "execute" } },
			},
		)
		process.chdir(projDir)
		writeFeedbackFile(slug, "plan", {
			title: "Inline-fix FB",
			body: "Body",
			origin: "adversarial-review",
			author: "review-agent",
			resolution: "inline_fix",
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
		assert.ok(action, "expected dispatch action, got null")
		assert.strictEqual(action.action, "feedback_dispatch")
		assert.strictEqual(action.counts.inline_fixes, 1)
	})

	await test("countOpenFeedbackForGateCheck does NOT count `answered` items (deadlock fix)", () => {
		// Regression for PR #275 review feedback: an `answered` FB
		// (agent replied to a human question, awaiting human
		// confirmation via the SPA) must NOT block gate_review.
		// Agents can't close `answered` items — only the human can —
		// so counting them deadlocks the workflow.
		const { projDir, slug, stages } = makeProject(
			"answered-fb-deadlock-check",
			{
				active_stage: "plan",
				stageStates: { plan: { phase: "gate" } },
			},
		)
		process.chdir(projDir)
		// One answered FB (agent replied, awaiting human).
		writeFeedbackFile(slug, "plan", {
			title: "Question the agent already answered",
			body: "Body",
			origin: "user-chat",
			author: "user",
		})
		// Manually flip status to "answered" to mirror the post-reply
		// state. (`writeFeedbackFile` doesn't expose a `status` opt;
		// flipping after creation matches existing test patterns
		// elsewhere in this file.)
		const fbDir = join(projDir, ".haiku/intents", slug, "stages/plan/feedback")
		const fbFiles = readdirSync(fbDir).filter((f) => f.endsWith(".md"))
		const fbPath = join(fbDir, fbFiles[0])
		const flipped = readFileSync(fbPath, "utf8").replace(
			/^status:\s*pending\s*$/m,
			"status: answered",
		)
		writeFileSync(fbPath, flipped)

		const count = countOpenFeedbackForGateCheck(
			slug,
			stages,
			stages.indexOf("plan"),
		)
		assert.strictEqual(
			count,
			0,
			`answered FB should not be counted as gate-blocking, got ${count}`,
		)
	})

	await test("countOpenFeedbackForGateCheck DOES count pending FBs", () => {
		// Sanity: the predicate isn't broken — it still counts truly
		// gate-blocking items (status: pending).
		const { projDir, slug, stages } = makeProject(
			"pending-fb-blocks-gate-check",
			{
				active_stage: "plan",
				stageStates: { plan: { phase: "gate" } },
			},
		)
		process.chdir(projDir)
		writeFeedbackFile(slug, "plan", {
			title: "Pending FB",
			body: "Body",
			origin: "adversarial-review",
			author: "review-agent",
		})
		const count = countOpenFeedbackForGateCheck(
			slug,
			stages,
			stages.indexOf("plan"),
		)
		assert.strictEqual(count, 1)
	})

	await test("agent-authored FBs on current stage during gate phase → null (gate.ts owns dispatch)", () => {
		// In gate phase, gate.ts owns the full fix-chain / review_fix /
		// feedback_revisit / feedback_dispatch chain for current-stage
		// pending feedback. Pre-tick must stay out entirely so we don't
		// double-dispatch (e.g. firing feedback_dispatch from pre-tick
		// when gate.ts would otherwise emit review_fix). The "no gate
		// review while feedback open" invariant in gate phase is
		// enforced by gate.ts itself plus the defensive check at the
		// gate_review emit site.
		const { projDir, slug, intentDirPath, studio, stages } = makeProject(
			"triage-current-gate",
			{
				active_stage: "plan",
				stageStates: { plan: { phase: "gate" } },
			},
		)
		process.chdir(projDir)
		writeFeedbackFile(slug, "plan", {
			title: "Stage-revisit FB during gate",
			body: "Body",
			origin: "adversarial-review",
			author: "review-agent",
			resolution: "stage_revisit",
		})
		writeFeedbackFile(slug, "plan", {
			title: "Untriaged-resolution FB during gate",
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
			currentPhase: "gate",
			stageState: { phase: "gate" },
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

	await test("deleteFeedbackFile cleans sidecar attachments", async () => {
		const { projDir, slug } = makeProject("delete-sidecar")
		process.chdir(projDir)
		const tinyPng =
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
		const created = writeFeedbackFile(slug, "plan", {
			title: "Will be deleted",
			body: "Body.",
			origin: "adversarial-review",
			author: "review-agent",
			attachmentDataUrl: `data:image/png;base64,${tinyPng}`,
		})
		const planDir = join(
			projDir,
			".haiku/intents",
			slug,
			"stages/plan/feedback",
		)
		// Pre: .md + sidecar both exist.
		assert.strictEqual(readdirSync(planDir).length, 2)

		// Flip status to "closed" so delete is allowed (delete refuses
		// pending/fixing items by design).
		const files = readdirSync(planDir).filter((f) => f.endsWith(".md"))
		const target = join(planDir, files[0])
		const raw = readFileSync(target, "utf8").replace(
			/^status:\s*pending\s*$/m,
			"status: closed",
		)
		writeFileSync(target, raw)

		const result = await handleStateTool("haiku_feedback_delete", {
			intent: slug,
			stage: "plan",
			feedback_id: created.feedback_id,
		})
		assert.ok(
			!result.isError,
			`Expected success, got: ${result.content[0].text}`,
		)
		// Post: dir is empty — both the .md and the .png are gone.
		assert.strictEqual(readdirSync(planDir).length, 0)
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

	console.log("\n=== End-to-end: triage → move → revisit chain ===")

	await test("misplaced human FB triages, moves to right stage, revisits", () => {
		// Setup: active stage is `build`, plan is completed. A reviewer
		// files a finding on `build` that actually belongs on `plan`
		// (origin: user-chat → triaged_at null on creation).
		const { projDir, slug, intentDirPath, studio, stages } = makeProject(
			"e2e-triage-move-revisit",
			{
				active_stage: "build",
				stages: ["plan", "build", "review"],
				stageStates: {
					plan: {
						status: "completed",
						phase: "gate",
						completed_at: "2026-04-15T00:00:00Z",
					},
					build: { status: "active", phase: "execute" },
					review: { status: "pending", phase: "" },
				},
			},
		)
		process.chdir(projDir)
		const created = writeFeedbackFile(slug, "build", {
			title: "Plan-rooted issue filed on build",
			body: "Belongs on plan.",
			origin: "user-chat",
			author: "user",
		})

		// Tick 1: pre-tick gate sees the untriaged FB → emits
		// feedback_triage (NOT revisit yet — must triage first).
		const tick1 = preTickFeedbackGate({
			slug,
			studio,
			intentDirPath,
			intent: { studio, active_stage: "build", stages },
			currentStage: "build",
			currentPhase: "execute",
			stageState: { phase: "execute" },
		})
		assert.ok(tick1)
		assert.strictEqual(tick1.action, "feedback_triage")
		assert.strictEqual(tick1.items.length, 1)
		assert.strictEqual(tick1.items[0].stage, "build")

		// Agent reads the FB, decides it belongs on plan, calls
		// haiku_feedback_move. The move relocates the file AND sets
		// triaged_at.
		const moveResult = moveFeedbackFile(
			slug,
			"build",
			created.feedback_id,
			"plan",
		)
		assert.ok(moveResult)
		assert.strictEqual(moveResult.moved, true)
		assert.ok(moveResult.file.includes("/stages/plan/feedback/"))

		// Tick 2: pre-tick gate sees one open FB on plan (earlier than
		// build), all triaged → emits revisit targeting plan.
		const tick2 = preTickFeedbackGate({
			slug,
			studio,
			intentDirPath,
			intent: { studio, active_stage: "build", stages },
			currentStage: "build",
			currentPhase: "execute",
			stageState: { phase: "execute" },
		})
		assert.ok(tick2)
		assert.strictEqual(tick2.action, "revisited")
		assert.strictEqual(tick2.target_stage, "plan")

		// After the revisit, intent.active_stage is now "plan" (revisit
		// helper sets it). Tick 3 perspective: with active_stage =
		// plan, the FB on plan is now "current stage" — outcome 3
		// (added 2026-04-28): a triaged human FB with no resolution on
		// the current stage routes through `feedback_dispatch` so the
		// agent triages / replies inline, instead of falling through to
		// elaborate.ts (which would re-pop the review UI).
		const tick3 = preTickFeedbackGate({
			slug,
			studio,
			intentDirPath,
			intent: { studio, active_stage: "plan", stages },
			currentStage: "plan",
			currentPhase: "elaborate",
			stageState: { phase: "elaborate" },
		})
		assert.ok(tick3)
		assert.strictEqual(tick3.action, "feedback_dispatch")
		assert.strictEqual(tick3.stage, "plan")

		// Sanity-check: verify the FB actually lives on plan now and
		// has triaged_at stamped.
		const planDir = join(
			projDir,
			".haiku/intents",
			slug,
			"stages/plan/feedback",
		)
		const planFiles = readdirSync(planDir).filter((f) => f.endsWith(".md"))
		assert.strictEqual(planFiles.length, 1, "FB should live on plan now")
		const raw = readFileSync(join(planDir, planFiles[0]), "utf8")
		assert.match(raw, /triaged_at:\s*'?20\d\d-/, "triaged_at stamped")
		// And source dir empty.
		const buildDir = join(
			projDir,
			".haiku/intents",
			slug,
			"stages/build/feedback",
		)
		const buildFiles = readdirSync(buildDir).filter((f) => f.endsWith(".md"))
		assert.strictEqual(buildFiles.length, 0, "build dir should be empty")
	})
} finally {
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true, force: true })
	console.log(`\n${passed} passed, ${failed} failed`)
	process.exit(failed > 0 ? 1 : 0)
}
