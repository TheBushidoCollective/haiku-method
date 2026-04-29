#!/usr/bin/env npx tsx
// Test suite for gate-phase feedback check and stage_revisit FB integration
// Covers auto-revisit.feature and revisit-with-reasons.feature scenarios

import assert from "node:assert"
import {
	chmodSync,
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

import { runNext } from "../src/orchestrator.ts"
import { readJson, writeFeedbackFile, writeJson } from "../src/state-tools.ts"

// ── Setup ──────────────────────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), "haiku-gate-fb-test-"))
const origCwd = process.cwd()

// Stub git so gitCommitState doesn't fail
mkdirSync(join(tmp, "fake-bin"), { recursive: true })
writeFileSync(join(tmp, "fake-bin", "git"), "#!/bin/sh\nexit 0\n")
chmodSync(join(tmp, "fake-bin", "git"), 0o755)
process.env.PATH = `${join(tmp, "fake-bin")}:${process.env.PATH}`

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		const result = fn()
		if (result && typeof result.then === "function") {
			return result.then(
				() => {
					passed++
					console.log(`  \u2713 ${name}`)
				},
				(e) => {
					failed++
					console.log(`  \u2717 ${name}: ${e.message}`)
				},
			)
		}
		passed++
		console.log(`  \u2713 ${name}`)
	} catch (e) {
		failed++
		console.log(`  \u2717 ${name}: ${e.message}`)
	}
}

function createProject(name, opts = {}) {
	const projDir = join(tmp, name)
	const haikuRoot = join(projDir, ".haiku")
	const slug = opts.slug || "test-intent"
	const intentDirPath = join(haikuRoot, "intents", slug)
	const studio = opts.studio || "test-studio"

	mkdirSync(join(intentDirPath, "stages"), { recursive: true })
	writeFileSync(
		join(intentDirPath, "intent.md"),
		`---
title: ${opts.title || "Test Intent"}
studio: ${studio}
mode: ${opts.mode || "continuous"}
active_stage: ${opts.active_stage || ""}
status: ${opts.status || "active"}
intent_reviewed: ${opts.intent_reviewed !== undefined ? opts.intent_reviewed : true}
started_at: 2026-04-15T18:00:00Z
completed_at: null
---

Test intent body.
`,
	)

	const stages = opts.stages || ["plan", "build", "review"]
	const studioDir = join(haikuRoot, "studios", studio)
	mkdirSync(studioDir, { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		`---
name: ${studio}
description: Test studio
stages: [${stages.join(", ")}]
---

A test studio.
`,
	)

	for (const stage of stages) {
		const stageDir = join(studioDir, "stages", stage)
		mkdirSync(stageDir, { recursive: true })
		const stageOpts = opts.stageConfig?.[stage] || {}
		writeFileSync(
			join(stageDir, "STAGE.md"),
			`---
name: ${stage}
description: ${stage} stage
hats: [${(stageOpts.hats || ["worker"]).join(", ")}]
review: ${stageOpts.review || "auto"}
---

${stage} stage instructions.
`,
		)
	}

	return { projDir, haikuRoot, intentDirPath, slug, studio }
}

function createStageState(intentDirPath, stage, state) {
	const stageDir = join(intentDirPath, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	writeJson(join(stageDir, "state.json"), {
		stage,
		status: "active",
		phase: "elaborate",
		started_at: "2026-04-15T18:05:00Z",
		completed_at: null,
		gate_entered_at: null,
		gate_outcome: null,
		visits: 0,
		...state,
	})
}

function _createUnit(intentDirPath, stage, unitName, opts = {}) {
	const unitsDir = join(intentDirPath, "stages", stage, "units")
	mkdirSync(unitsDir, { recursive: true })
	const inputs = opts.inputs || ["intent.md"]
	writeFileSync(
		join(unitsDir, `${unitName}.md`),
		`---
name: ${unitName}
type: ${opts.type || "task"}
status: ${opts.status || "pending"}
depends_on: [${(opts.depends_on || []).join(", ")}]
inputs: [${inputs.join(", ")}]
bolt: ${opts.bolt || 0}
hat: ${opts.hat || ""}
---

## Completion Criteria

${(opts.criteria || ["- [ ] Default criteria"]).join("\n")}
`,
	)
}

function createFeedbackFile(intentDirPath, _slug, stage, title, opts = {}) {
	const feedbackDirPath = join(intentDirPath, "stages", stage, "feedback")
	mkdirSync(feedbackDirPath, { recursive: true })

	const existingFiles = existsSync(feedbackDirPath)
		? readdirSync(feedbackDirPath).filter((f) => f.endsWith(".md"))
		: []
	const maxNum = existingFiles.reduce((max, f) => {
		const match = f.match(/^(\d+)-/)
		return match ? Math.max(max, Number.parseInt(match[1], 10)) : max
	}, 0)
	const num = maxNum + 1
	const nn = String(num).padStart(2, "0")
	const fileSlug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/(^-|-$)/g, "")
		.slice(0, 60)

	const status = opts.status || "pending"
	const origin = opts.origin || "adversarial-review"
	const authorType = opts.author_type || "agent"
	const author = opts.author || "review-agent"
	// Tests exercise the gate / fix-loop / revisit logic that runs
	// AFTER triage. Default `triaged_at` to a fixed timestamp so the
	// pre-tick triage gate doesn't intercept these FBs. Tests that
	// specifically exercise the triage gate pass `opts.triaged_at:
	// null` to keep the FB untriaged.
	const triagedAt =
		"triaged_at" in opts ? opts.triaged_at : "2026-04-15T21:15:00Z"
	const triagedAtLine =
		triagedAt === null ? "triaged_at: null" : `triaged_at: "${triagedAt}"`

	const resolutionLine =
		opts.resolution !== undefined ? `\nresolution: ${opts.resolution}` : ""
	writeFileSync(
		join(feedbackDirPath, `${nn}-${fileSlug}.md`),
		`---
title: "${title}"
status: ${status}
origin: ${origin}
author: ${author}
author_type: ${authorType}
created_at: "2026-04-15T21:15:00Z"
visit: ${opts.visit || 0}
source_ref: null
closed_by: null
${triagedAtLine}${resolutionLine}
---

${opts.body || `Finding: ${title}`}
`,
	)

	return { feedback_id: `FB-${nn}`, num }
}

// ── Tests ──────────────────────────────────────────────────────────────────

try {
	// =========================================================================
	// Gate-phase feedback check (auto-revisit.feature)
	// =========================================================================

	console.log(
		"\n=== Gate-phase feedback check: pending feedback triggers rollback ===",
	)

	test("gate handler rolls to elaborate when pending feedback exists", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-1", {
			active_stage: "plan",
			stageConfig: { plan: { review: "auto" } },
		})
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Null guard missing")
		createFeedbackFile(intentDirPath, slug, "plan", "Race condition")

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(result.action, "feedback_revisit")
		assert.strictEqual(result.pending_count, 2)
		assert.strictEqual(result.visits, 1)
		assert.strictEqual(result.stage, "plan")

		// Verify state.json was updated
		const state = readJson(join(intentDirPath, "stages", "plan", "state.json"))
		assert.strictEqual(state.phase, "elaborate")
		assert.strictEqual(state.visits, 1)
	})

	test("gate handler proceeds normally when no pending feedback exists", () => {
		const { projDir, intentDirPath, slug } = createProject(
			"gate-fb-no-pending",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "auto" } },
			},
		)
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Old finding", {
			status: "closed",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Another finding", {
			status: "addressed",
		})

		process.chdir(projDir)
		const result = runNext(slug)

		// Should proceed to normal gate logic (auto-advance for auto gate)
		assert.ok(
			result.action === "advance_stage" || result.action === "intent_complete",
			`Expected advance_stage or intent_complete, got: ${result.action}`,
		)
	})

	test("gate handler proceeds when all feedback is resolved", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-resolved", {
			active_stage: "plan",
			stageConfig: { plan: { review: "auto" } },
		})
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Finding A", {
			status: "addressed",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Finding B", {
			status: "rejected",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Finding C", {
			status: "closed",
		})

		process.chdir(projDir)
		const result = runNext(slug)

		assert.ok(
			result.action !== "feedback_revisit",
			`Should not trigger feedback_revisit when all resolved, got: ${result.action}`,
		)
	})

	test("mixed pending and resolved feedback still triggers rollback", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-mixed", {
			active_stage: "plan",
			stageConfig: { plan: { review: "auto" } },
		})
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Resolved", {
			status: "closed",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Addressed", {
			status: "addressed",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Still open", {
			status: "pending",
		})

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(result.action, "feedback_revisit")
		assert.strictEqual(result.pending_count, 1)
		assert.strictEqual(result.pending_items.length, 1)
		assert.strictEqual(result.pending_items[0].title, "Still open")
	})

	test("visits counter increments on each successive rollback", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-visits", {
			active_stage: "plan",
			stageConfig: { plan: { review: "auto" } },
		})
		// Start at visits: 0 so the first rollback lands at visits: 1, still
		// within MAX_STAGE_ITERATIONS (2). Previously this test started at
		// visits: 2, but the cap was dropped from 5 → 2 to force spec rigor
		// rather than repeated execute cycles.
		createStageState(intentDirPath, "plan", { phase: "gate", visits: 0 })
		createFeedbackFile(intentDirPath, slug, "plan", "Pending item")

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(result.action, "feedback_revisit")
		assert.strictEqual(result.visits, 1)

		const state = readJson(join(intentDirPath, "stages", "plan", "state.json"))
		assert.strictEqual(state.visits, 1)
	})

	test("escalation leaves stage phase unchanged (does not pre-flip to elaborate)", () => {
		// Regression: the feedback_revisit path used to flip gateState.phase
		// to "elaborate" and write it to disk BEFORE calling maybeEscalate.
		// When escalation fired (iteration cap exceeded), the stage state
		// had already been mutated to elaborate — and a follow-up revisit
		// with no `stage` arg would then read phase="elaborate" and route
		// through revisitEarlierStage, silently jumping active_stage back
		// to the previous stage. The fix: only flip phase AFTER the
		// escalation check passes. On escalation, the stage remains in
		// its original phase so the subsequent revisit correctly stays
		// on the current stage.
		const { projDir, intentDirPath, slug } = createProject(
			"gate-fb-escalation-phase",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "auto" } },
			},
		)
		// Seed a state that already sits at the iteration cap so the next
		// feedback check triggers escalation rather than revisit.
		createStageState(intentDirPath, "plan", {
			phase: "gate",
			visits: 2,
			iterations: [
				{
					index: 1,
					trigger: "initial",
					started_at: "2026-04-20T17:00:00Z",
					completed_at: "2026-04-20T17:01:00Z",
					result: "feedback-revisit",
				},
				{
					index: 2,
					trigger: "feedback",
					started_at: "2026-04-20T17:01:00Z",
					completed_at: "2026-04-20T17:02:00Z",
					result: "feedback-revisit",
					reason: "1 pending feedback item(s)",
				},
			],
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Still pending")

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(
			result.action,
			"escalate",
			`Expected escalate at iteration cap, got: ${result.action}`,
		)

		// The phase must NOT have been pre-flipped to elaborate. Otherwise
		// a follow-up revisit would jump back to a prior stage.
		const state = readJson(join(intentDirPath, "stages", "plan", "state.json"))
		assert.strictEqual(
			state.phase,
			"gate",
			`Stage phase must stay "gate" on escalation so a follow-up revisit targets the current stage, got: ${state.phase}`,
		)
	})

	test("missing feedback directory treated as zero pending", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-no-dir", {
			active_stage: "plan",
			stageConfig: { plan: { review: "auto" } },
		})
		createStageState(intentDirPath, "plan", { phase: "gate" })
		// No feedback directory at all

		process.chdir(projDir)
		const result = runNext(slug)

		assert.ok(
			result.action !== "feedback_revisit",
			`Should not trigger feedback_revisit when no feedback dir, got: ${result.action}`,
		)
	})

	console.log("\n=== Gate-phase feedback check: structural enforcement ===")

	test("feedback check fires before auto gate type", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-auto", {
			active_stage: "plan",
			stageConfig: { plan: { review: "auto" } },
		})
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Blocks auto advance")

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(result.action, "feedback_revisit")
		// Auto-advance does NOT fire
	})

	test("feedback check fires before ask gate type", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-ask", {
			active_stage: "plan",
			stageConfig: { plan: { review: "ask" } },
		})
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Blocks ask gate")

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(result.action, "feedback_revisit")
	})

	test("feedback check fires before external gate type", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-external", {
			active_stage: "plan",
			stageConfig: { plan: { review: "external" } },
		})
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Blocks external gate")

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(result.action, "feedback_revisit")
	})

	test("rollback preserves existing stage state", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-preserve", {
			active_stage: "plan",
			stageConfig: { plan: { review: "auto" } },
		})
		createStageState(intentDirPath, "plan", {
			phase: "gate",
			started_at: "2026-04-15T10:00:00Z",
			elaboration_turns: 3,
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Pending")

		process.chdir(projDir)
		runNext(slug)

		const state = readJson(join(intentDirPath, "stages", "plan", "state.json"))
		assert.strictEqual(state.phase, "elaborate")
		assert.strictEqual(state.visits, 1)
		assert.strictEqual(state.started_at, "2026-04-15T10:00:00Z")
		assert.strictEqual(state.status, "active")
		assert.strictEqual(state.elaboration_turns, 3)
	})

	test("elaborate phase with leftover stage_revisit FB routes to feedback_dispatch (NOT gate_review)", () => {
		// Reproduces the user-reported bug: after a Request Changes
		// rolled the stage back to elaborate, the user-authored FB
		// stays pending with `resolution: stage_revisit` because no
		// auto-close mechanism fires. Once pre-review is acknowledged
		// (or skipped), elaborate.ts's spec gate would re-emit
		// gate_review on every tick — review UI re-pops on
		// unaddressed feedback. Pre-tick triage gate now dispatches
		// stage_revisit FBs to the agent for inline closure when
		// phase ≠ gate, breaking the loop without rolling the stage
		// back again.
		const { projDir, intentDirPath, slug } = createProject(
			"gate-fb-stage-revisit-elaborate",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "ask" } },
			},
		)
		createStageState(intentDirPath, "plan", {
			phase: "elaborate",
			pre_review_dispatched: true,
			pre_review_skipped_no_agents: true,
			pre_review_reviewers_acknowledged: true,
			gate_outcome: "changes_requested",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Stage needs rework", {
			origin: "user-chat",
			author: "user",
			author_type: "human",
			resolution: "stage_revisit",
		})

		process.chdir(projDir)
		const tick1 = runNext(slug)
		assert.strictEqual(
			tick1.action,
			"feedback_dispatch",
			`Tick 1: expected feedback_dispatch for stage_revisit FB outside gate phase; got ${tick1.action}.`,
		)
		assert.strictEqual(tick1.stage, "plan")
		assert.strictEqual(
			tick1.counts.stage_revisits,
			1,
			`expected stage_revisits count of 1; got ${JSON.stringify(tick1.counts)}`,
		)

		// Replay must not loop or mutate state.
		const stateBefore = readJson(
			join(intentDirPath, "stages", "plan", "state.json"),
		)
		const tick2 = runNext(slug)
		assert.strictEqual(
			tick2.action,
			"feedback_dispatch",
			`Tick 2: expected feedback_dispatch (no loop); got ${tick2.action}.`,
		)
		const stateAfter = readJson(
			join(intentDirPath, "stages", "plan", "state.json"),
		)
		assert.deepStrictEqual(
			stateAfter,
			stateBefore,
			"pre-tick stage_revisit dispatch must not mutate state.json across ticks",
		)
	})

	test("gate-phase stage_revisit FB still falls through to gate.ts (rollback owner)", () => {
		// Inverse of the test above: when the stage IS in gate phase,
		// the pre-tick gate must NOT dispatch stage_revisit FBs —
		// gate.ts owns the rollback (calls revisitCurrentStage).
		const { projDir, intentDirPath, slug } = createProject(
			"gate-fb-stage-revisit-gate",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "auto" } },
			},
		)
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Roll it back", {
			origin: "user-chat",
			author: "user",
			author_type: "human",
			resolution: "stage_revisit",
		})

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(
			result.action,
			"revisited",
			`gate-phase stage_revisit must let gate.ts handle rollback; got ${result.action}`,
		)
		const state = readJson(join(intentDirPath, "stages", "plan", "state.json"))
		assert.strictEqual(state.phase, "elaborate")
	})

	test("elaborate phase with leftover human FB routes to feedback_dispatch (NOT gate_review)", () => {
		// Reproduces the bug the prior fix missed: after a Request Changes
		// on the spec gate, the stage stays in `elaborate` phase with a
		// triaged human FB sitting on it. The next `haiku_run_next` tick
		// would re-emit `gate_review` from `elaborate.ts` (the `gate.ts`
		// fix only covered the post-execute stage gate). Pre-tick triage
		// gate now intercepts these and emits `feedback_dispatch` so the
		// review UI never re-pops on unaddressed feedback.
		//
		// Drives TWO ticks back-to-back (without the agent doing any
		// work between them) to guard against an infinite re-dispatch
		// loop. Both ticks must return `feedback_dispatch` — and
		// neither tick may produce a side effect (state mutation /
		// commit storm) that compounds across calls.
		const { projDir, intentDirPath, slug } = createProject(
			"gate-fb-elaborate-replay",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "ask" } },
			},
		)
		createStageState(intentDirPath, "plan", {
			phase: "elaborate",
			pre_review_dispatched: true,
			pre_review_skipped_no_agents: true,
			gate_outcome: "changes_requested",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Reviewer concern", {
			origin: "user-chat",
			author: "user",
			author_type: "human",
		})

		process.chdir(projDir)
		const tick1 = runNext(slug)
		assert.strictEqual(
			tick1.action,
			"feedback_dispatch",
			`Tick 1: expected feedback_dispatch; got ${tick1.action}.`,
		)
		assert.strictEqual(tick1.stage, "plan")

		// Snapshot the state.json before tick 2 so we can assert no
		// mutation happens — the pre-tick gate is read-only here.
		const stateBefore = readJson(
			join(intentDirPath, "stages", "plan", "state.json"),
		)
		const tick2 = runNext(slug)
		assert.strictEqual(
			tick2.action,
			"feedback_dispatch",
			`Tick 2: expected feedback_dispatch (no loop); got ${tick2.action}.`,
		)
		const stateAfter = readJson(
			join(intentDirPath, "stages", "plan", "state.json"),
		)
		assert.deepStrictEqual(
			stateAfter,
			stateBefore,
			"pre-tick feedback_dispatch must not mutate state.json across ticks",
		)
	})

	test("human-authored pending feedback routes to feedback_dispatch (no UI re-open)", () => {
		const { projDir, intentDirPath, slug } = createProject(
			"gate-fb-summaries",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "auto" } },
			},
		)
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Security issue", {
			origin: "adversarial-review",
			author: "security-agent",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "User concern", {
			origin: "user-visual",
			author: "user",
			author_type: "human",
		})

		process.chdir(projDir)
		const result = runNext(slug)

		// Contract: open feedback ⇒ never engage the user. A human-
		// authored FB with no explicit resolution lands in the
		// needsTriage bucket and the gate hands it back to the agent
		// via `feedback_dispatch` so the agent classifies / replies
		// inline. The review UI does NOT re-open while feedback is
		// unaddressed — that was the loop the workflow engine used
		// to fall into when the reviewer left "Let agent decide" on
		// a comment and walked away.
		assert.strictEqual(result.action, "feedback_dispatch")
		assert.strictEqual(result.stage, "plan")
		assert.ok(
			result.counts && result.counts.needs_triage >= 1,
			`Expected needs_triage >= 1, got: ${JSON.stringify(result.counts)}`,
		)
	})

	test("pure agent-authored pending feedback still auto-dispatches fix loop (no human interrupt)", () => {
		const { projDir, intentDirPath, slug } = createProject(
			"gate-fb-agent-only",
			{
				active_stage: "plan",
				stageConfig: {
					plan: { review: "auto", hats: ["builder", "feedback-assessor"] },
				},
			},
		)
		createStageState(intentDirPath, "plan", { phase: "gate" })
		// Add a fix_hats entry on the STAGE.md so the fix-loop path is
		// available when the gate sees pending agent findings.
		const stagePath = join(
			projDir,
			".haiku",
			"studios",
			"test-studio",
			"stages",
			"plan",
			"STAGE.md",
		)
		const stageContent = readFileSync(stagePath, "utf8")
		writeFileSync(
			stagePath,
			stageContent.replace(
				"hats: [builder, feedback-assessor]",
				"hats: [builder, feedback-assessor]\nfix_hats: [builder, feedback-assessor]",
			),
		)
		mkdirSync(
			join(
				projDir,
				".haiku",
				"studios",
				"test-studio",
				"stages",
				"plan",
				"hats",
			),
			{
				recursive: true,
			},
		)
		writeFileSync(
			join(
				projDir,
				".haiku",
				"studios",
				"test-studio",
				"stages",
				"plan",
				"hats",
				"builder.md",
			),
			"---\nname: builder\n---\nBuild stuff.\n",
		)
		writeFileSync(
			join(
				projDir,
				".haiku",
				"studios",
				"test-studio",
				"stages",
				"plan",
				"hats",
				"feedback-assessor.md",
			),
			"---\nname: feedback-assessor\n---\nAssess fixes.\n",
		)

		createFeedbackFile(intentDirPath, slug, "plan", "Adversarial finding 1", {
			origin: "adversarial-review",
			author: "security-agent",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Adversarial finding 2", {
			origin: "studio-review",
			author: "perf-agent",
		})

		process.chdir(projDir)
		const result = runNext(slug)

		// All items are agent-authored → legacy fix-loop contract
		// stands. The workflow engine dispatches without human intervention.
		assert.strictEqual(result.action, "review_fix")
		assert.strictEqual(result.items.length, 2)
	})

	// =========================================================================
	// haiku_revisit with reasons (revisit-with-reasons.feature)
	// =========================================================================

	console.log(
		"\n=== Integration: stage_revisit feedback routes through pre-tick gate ===",
	)

	// Helper: write the same shape of FBs that the /api/revisit HTTP
	// endpoint and the /haiku:revisit slash command produce. Replaces
	// the legacy `handleOrchestratorTool("haiku_revisit", ...)` path.
	const writeRevisitFeedback = (slug, stage, reasons) => {
		for (const reason of reasons) {
			writeFeedbackFile(slug, stage, {
				title: reason.title,
				body: reason.body,
				origin: "user-revisit",
				author: "user",
				resolution: "stage_revisit",
				triaged_at: "2026-04-29T17:00:00Z",
			})
		}
	}

	await test("stage_revisit feedback blocks gate on next cycle", async () => {
		const { projDir, intentDirPath, slug } = createProject(
			"revisit-then-gate",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "auto" } },
			},
		)
		createStageState(intentDirPath, "plan", { phase: "execute" })
		process.chdir(projDir)

		writeRevisitFeedback(slug, "plan", [
			{ title: "Issue A", body: "Detail A" },
			{ title: "Issue B", body: "Detail B" },
		])

		// Now simulate the stage being at gate again
		const statePath = join(intentDirPath, "stages", "plan", "state.json")
		const state = readJson(statePath)
		state.phase = "gate"
		writeJson(statePath, state)

		const gateResult = runNext(slug)
		// FBs carry `resolution: stage_revisit` + agent-stamped `triaged_at`,
		// so the pre-tick gate routes them through revisit() on the next
		// tick. Accept either the auto-revisit action or the escalate branch
		// (when the iteration-signature loop detector fires).
		assert.ok(
			gateResult.action === "revisited" ||
				gateResult.action === "feedback_revisit" ||
				gateResult.action === "escalate",
			`Expected revisited, feedback_revisit, or escalate, got: ${gateResult.action}`,
		)
	})

	await test("addressed stage_revisit feedback does not block gate", async () => {
		const { projDir, intentDirPath, slug } = createProject(
			"revisit-addressed",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "auto" } },
			},
		)
		createStageState(intentDirPath, "plan", { phase: "execute" })
		process.chdir(projDir)

		writeRevisitFeedback(slug, "plan", [
			{ title: "Issue A", body: "Detail A" },
			{ title: "Issue B", body: "Detail B" },
		])

		// Mark both as addressed
		const feedbackDirPath = join(intentDirPath, "stages", "plan", "feedback")
		const files = readdirSync(feedbackDirPath).filter((f) => f.endsWith(".md"))
		for (const f of files) {
			const filePath = join(feedbackDirPath, f)
			let content = readFileSync(filePath, "utf8")
			content = content.replace("status: pending", "status: addressed")
			writeFileSync(filePath, content)
		}

		// Set to gate
		const statePath = join(intentDirPath, "stages", "plan", "state.json")
		const state = readJson(statePath)
		state.phase = "gate"
		writeJson(statePath, state)

		const gateResult = runNext(slug)
		assert.ok(
			gateResult.action !== "feedback_revisit",
			`Should not trigger feedback_revisit when all addressed, got: ${gateResult.action}`,
		)
	})

	// =========================================================================
	// feedback_revisit payload shape — each pending item carries the fields
	// downstream consumers (review UI, revisit command) rely on.
	// =========================================================================

	console.log("\n=== feedback_revisit payload shape ===")

	test("feedback_revisit pending_items carries id, title, status, origin, author, file", () => {
		const { projDir, intentDirPath, slug } = createProject("gate-fb-payload", {
			active_stage: "plan",
			stageConfig: { plan: { review: "auto" } },
		})
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Payload finding A", {
			status: "pending",
			origin: "adversarial-review",
			author: "reviewer-bot",
		})
		createFeedbackFile(intentDirPath, slug, "plan", "Payload finding B", {
			status: "pending",
			origin: "user-visual",
			author: "alice",
		})

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(result.action, "feedback_revisit")
		assert.strictEqual(result.pending_count, 2)
		assert.strictEqual(result.pending_items.length, 2)

		// Every pending item must carry the required fields for the review UI
		// and revisit flow to work downstream. Dropping any of these would
		// break the review page or the per-item reject/close flow.
		for (const item of result.pending_items) {
			assert.ok(
				typeof item.feedback_id === "string" && item.feedback_id.length > 0,
			)
			assert.ok(typeof item.title === "string" && item.title.length > 0)
			assert.ok(typeof item.status === "string")
			assert.ok(typeof item.origin === "string")
			assert.ok(typeof item.author === "string")
			assert.ok(typeof item.file === "string" && item.file.length > 0)
		}

		// Origins are preserved (adversarial-review, user-visual); not coerced
		// to a single default.
		const origins = new Set(result.pending_items.map((i) => i.origin))
		assert.ok(origins.has("adversarial-review"))
		assert.ok(origins.has("user-visual"))
	})

	// =========================================================================
	// review_fix dispatch — stages with `fix_hats:` route findings through
	// the fix-hat sequence instead of the feedback_revisit path. Each finding
	// dispatches in order, one per tick, with a per-finding bolt counter.
	// =========================================================================

	console.log("\n=== review_fix dispatch (stage fix_hats) ===")

	test("gate dispatches review_fix when stage has fix_hats + pending feedback", () => {
		const { projDir, intentDirPath, slug, studio } = createProject(
			"review-fix-basic",
			{
				active_stage: "plan",
				stageConfig: {
					plan: {
						review: "auto",
						hats: ["worker"],
					},
				},
			},
		)
		// Add fix_hats to STAGE.md + create feedback-assessor hat file
		const stageFile = join(
			projDir,
			".haiku/studios",
			studio,
			"stages/plan/STAGE.md",
		)
		const updated = readFileSync(stageFile, "utf8").replace(
			"hats: [worker]",
			"hats: [worker]\nfix_hats: [worker, feedback-assessor]",
		)
		writeFileSync(stageFile, updated)
		const hatsDir = join(projDir, ".haiku/studios", studio, "stages/plan/hats")
		mkdirSync(hatsDir, { recursive: true })
		writeFileSync(
			join(hatsDir, "worker.md"),
			`---\nname: worker\n---\nProducer mandate.`,
		)
		writeFileSync(
			join(hatsDir, "feedback-assessor.md"),
			`---\nname: feedback-assessor\n---\nAssessor mandate.`,
		)
		createStageState(intentDirPath, "plan", { phase: "gate" })
		createFeedbackFile(intentDirPath, slug, "plan", "Null guard missing")

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(
			result.action,
			"review_fix",
			`Expected review_fix, got: ${result.action}`,
		)
		assert.ok(Array.isArray(result.items), "expected items[] on review_fix")
		assert.strictEqual(result.items.length, 1)
		assert.strictEqual(result.items[0].feedback_id, "FB-01")
		assert.strictEqual(result.items[0].bolt, 1)
		assert.deepStrictEqual(result.fix_hats, ["worker", "feedback-assessor"])
		assert.strictEqual(result.max_bolts, 3)
	})

	test("review_fix escalates after 3 bolts without closure", () => {
		const { projDir, intentDirPath, slug, studio } = createProject(
			"review-fix-cap",
			{
				active_stage: "plan",
				stageConfig: { plan: { review: "auto", hats: ["worker"] } },
			},
		)
		const stageFile = join(
			projDir,
			".haiku/studios",
			studio,
			"stages/plan/STAGE.md",
		)
		writeFileSync(
			stageFile,
			readFileSync(stageFile, "utf8").replace(
				"hats: [worker]",
				"hats: [worker]\nfix_hats: [worker, feedback-assessor]",
			),
		)
		const hatsDir = join(projDir, ".haiku/studios", studio, "stages/plan/hats")
		mkdirSync(hatsDir, { recursive: true })
		writeFileSync(join(hatsDir, "worker.md"), `---\nname: worker\n---\n.`)
		writeFileSync(
			join(hatsDir, "feedback-assessor.md"),
			`---\nname: feedback-assessor\n---\n.`,
		)
		createStageState(intentDirPath, "plan", { phase: "gate" })
		// Seed a feedback item already at bolt=3 (the cap) — next dispatch escalates.
		const fbDir = join(intentDirPath, "stages/plan/feedback")
		mkdirSync(fbDir, { recursive: true })
		writeFileSync(
			join(fbDir, "01-stuck-finding.md"),
			`---
title: "Stuck finding"
status: "fixing"
origin: "adversarial-review"
author: "agent"
author_type: "agent"
created_at: "2026-04-15T00:00:00Z"
visit: 0
source_ref: null
closed_by: null
bolt: 3
triaged_at: "2026-04-15T00:00:00Z"
---

Cannot be resolved autonomously.`,
		)

		process.chdir(projDir)
		const result = runNext(slug)

		assert.strictEqual(result.action, "escalate")
		assert.strictEqual(result.reason, "fix_loop_cap_exceeded")
		assert.strictEqual(result.iteration, 3)
	})

	test("pre-tick triage gate revisits earliest earlier stage with open feedback", () => {
		// Cross-stage routing flows through file location: an open FB
		// sitting on stage `plan` while active stage is `build`
		// triggers the pre-tick triage gate to issue a revisit back to
		// `plan`.
		const { projDir, intentDirPath, slug } = createProject("upstream-revisit", {
			active_stage: "build",
			stages: ["plan", "build"],
			stageConfig: {
				plan: { review: "auto", hats: ["planner"] },
				build: { review: "auto", hats: ["builder"] },
			},
		})

		// Mark plan as completed so the workflow engine's consistency
		// check doesn't rewind to it for the wrong reason.
		createStageState(intentDirPath, "plan", {
			status: "completed",
			phase: "gate",
			completed_at: "2026-04-15T00:00:00Z",
			gate_outcome: "advanced",
		})
		createStageState(intentDirPath, "build", { phase: "execute" })

		// Open, triaged FB on the EARLIER stage (plan) — pre-tick
		// gate should revisit `plan` regardless of build's state.
		createFeedbackFile(intentDirPath, slug, "plan", "Plan contradicts spec", {
			origin: "adversarial-review",
			author: "reviewer",
			body: "Plan from earlier stage is wrong.",
		})

		process.chdir(projDir)
		const result = runNext(slug)

		// `revisit()` returns { action: "revisited", target_stage: "plan", ... }
		assert.strictEqual(result.action, "revisited")
		assert.strictEqual(result.target_stage, "plan")
	})

	// ── Discrete-mode external-PR coercion ─────────────────────────────
	console.log(
		"\n=== Discrete mode: gate review type forced to include external ===",
	)

	test("discrete mode + review:auto coerces gate to external (no auto-advance)", () => {
		const { projDir, intentDirPath, slug } = createProject(
			"discrete-auto-coerce",
			{
				active_stage: "plan",
				mode: "discrete",
				stageConfig: { plan: { review: "auto" } },
			},
		)
		// Stage at gate phase, no pending feedback, ready to advance.
		createStageState(intentDirPath, "plan", {
			phase: "gate",
			status: "active",
		})
		process.chdir(projDir)
		const result = runNext(slug)
		// Discrete mode must NOT auto-advance — external review required.
		assert.notStrictEqual(
			result.action,
			"advance_stage",
			"discrete mode should not advance_stage from review:auto without external approval",
		)
		// The gate should emit gate_review with gate_type containing external.
		assert.strictEqual(result.action, "gate_review")
		assert.ok(
			(result.gate_type || "").includes("external"),
			`gate_type should include external in discrete mode, got: ${result.gate_type}`,
		)
	})

	test("discrete mode + review:ask coerces gate to ask,external compound", () => {
		const { projDir, intentDirPath, slug } = createProject(
			"discrete-ask-coerce",
			{
				active_stage: "plan",
				mode: "discrete",
				stageConfig: { plan: { review: "ask" } },
			},
		)
		createStageState(intentDirPath, "plan", {
			phase: "gate",
			status: "active",
		})
		process.chdir(projDir)
		const result = runNext(slug)
		assert.strictEqual(result.action, "gate_review")
		assert.ok(
			(result.gate_type || "").includes("external"),
			`gate_type should include external (compound) in discrete mode, got: ${result.gate_type}`,
		)
	})

	test("discrete mode + review:await is NOT coerced (await is a wait-gate, not a review type)", () => {
		const { projDir, intentDirPath, slug } = createProject(
			"discrete-await-not-coerced",
			{
				active_stage: "plan",
				mode: "discrete",
				stageConfig: { plan: { review: "await" } },
			},
		)
		createStageState(intentDirPath, "plan", {
			phase: "gate",
			status: "active",
		})
		process.chdir(projDir)
		const result = runNext(slug)
		assert.strictEqual(result.action, "gate_review")
		// Per the contract documented in gate.ts: await stays await,
		// resolved to the existing `effectiveGateType: external` mapping
		// (matches non-discrete behavior — no behavioral divergence).
		assert.strictEqual(
			result.gate_type,
			"external",
			`await should resolve to external in both discrete and continuous, got: ${result.gate_type}`,
		)
	})

	test("continuous mode + review:auto still auto-advances (no coercion)", () => {
		const { projDir, intentDirPath, slug } = createProject(
			"continuous-auto-no-coerce",
			{
				active_stage: "plan",
				mode: "continuous",
				stageConfig: { plan: { review: "auto" } },
			},
		)
		createStageState(intentDirPath, "plan", {
			phase: "gate",
			status: "active",
		})
		process.chdir(projDir)
		const result = runNext(slug)
		// Continuous mode honors review:auto exactly as before — auto-advance.
		assert.strictEqual(result.action, "advance_stage")
	})

	// ── Cleanup ───────────────────────────────────────────────────────────────

	console.log(`\n${passed} passed, ${failed} failed\n`)
} finally {
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true })
	process.exit(failed > 0 ? 1 : 0)
}
