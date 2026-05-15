#!/usr/bin/env npx tsx
// discovery-question-loop.test.mjs — GAPS.md § 4 (2026-05-14).
//
// End-to-end coverage for the discovery → question → close loop:
//   1. A discovery subagent files an FB with `origin: "discovery"`,
//      `resolution: "question"`. (The subagent is simulated — we
//      write the FB directly; the dispatch mechanics are covered by
//      `discovery-edge-cases.test.mjs` and `haiku-discovery-complete.test.mjs`.)
//   2. The next cursor tick MUST preempt the elaborate-loop walk and
//      return `feedback_question`, not `start_feedback_hat` (which is
//      the fix-hat chain — wrong for a question FB).
//   3. The agent answers the question by writing to the FB body and
//      closing the FB. (We simulate the agent's `haiku_feedback_update`
//      by writing `closed_at` directly.)
//   4. The next tick MUST fall through past the closed FB — the
//      cursor returns to Track A's elaborate-loop walk and emits the
//      next unmet signal (here, `decompose_review` because units
//      already exist on disk).
//
// Also asserts that elaborate-loop prompts carry the "Concurrent
// elaborate-loop activities" block (Option B, GAPS.md § 1).

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"
import {
	initTestRepo,
	makeFeedback,
	makeIntent,
	makeStudio,
	onStageBranch,
	runTickWithBranchAlignment,
	seedVerifiedElaboration,
} from "./_v4-fixtures.mjs"

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

async function withRepo(slug, fn) {
	const root = mkdtempSync(join(tmpdir(), "haiku-disc-q-"))
	const orig = process.cwd()
	try {
		const repo = initTestRepo({ repoRoot: root, slug })
		process.chdir(root)
		return await fn(repo)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(root, { recursive: true, force: true })
	}
}

test("discovery → question FB → feedback_question → close → cursor falls through", async () => {
	if (!HAS_GIT) return
	await withRepo("test-disc-q", async ({ repoRoot, intentDir, slug }) => {
		makeStudio({
			repoRoot,
			studio: "test",
			stages: [
				{
					name: "design",
					hats: ["planner", "verifier"],
					fix_hats: ["classifier", "planner", "feedback-assessor"],
					review: "ask",
					review_agents: ["code-reviewer"],
				},
			],
		})
		makeIntent({ intentDir, slug, studio: "test", stages: ["design"] })

		// Verified elaboration so the cursor doesn't trip on the
		// conversation gate — we're isolating the question-routing
		// behavior, not the elaborate gate.
		seedVerifiedElaboration({ intentDir, stage: "design" })

		// Seed one unit so units.length > 0; the cursor's next unmet
		// elaborate-loop signal (absent any FB) would be
		// `decompose_review` (units exist, decompose_verified_at
		// missing).
		onStageBranch(repoRoot, slug, "design", () => {
			const unitsDir = join(intentDir, "stages", "design", "units")
			mkdirSync(unitsDir, { recursive: true })
			const unitPath = join(unitsDir, "unit-001-data-model.md")
			writeFileSync(
				unitPath,
				matter.stringify("# unit 1\n", {
					title: "data model",
					hat: "planner",
					inputs: ["intent.md"],
					outputs: ["stages/design/artifacts/model.md"],
					depends_on: [],
				}),
			)
			execFileSync("git", ["-C", repoRoot, "add", unitPath])
			execFileSync("git", ["-C", repoRoot, "commit", "-m", "test: seed unit"])
		})

		// Step 1 — discovery subagent files a question FB on the
		// active stage. Simulate via the fixture (the dispatch path
		// itself is covered by other tests).
		onStageBranch(repoRoot, slug, "design", () => {
			makeFeedback({
				intentDir,
				stage: "design",
				id: 1,
				title: "stripe-elements-or-checkout",
				body: "Stripe Elements vs Checkout — which payment surface?",
				origin: "discovery",
				author: "agent",
				resolution: "question",
			})
		})

		// Step 2 — the cursor MUST emit `feedback_question`, NOT
		// `start_feedback_hat`. Question FBs are user-decidable; the
		// fix-hat chain is for findings.
		const tick1 = await runTickWithBranchAlignment(slug)
		assert.strictEqual(
			tick1.action,
			"feedback_question",
			`expected feedback_question, got ${tick1.action}: ${JSON.stringify(tick1)}`,
		)
		assert.strictEqual(tick1.stage, "design")
		assert.strictEqual(tick1.feedback_id, "FB-001")
		assert.ok(
			typeof tick1.feedback_path === "string" &&
				tick1.feedback_path.includes("design/feedback/"),
			"feedback_path should point at the on-disk FB file",
		)

		// Step 3 — agent answers the question and closes the FB.
		// Simulate by appending the decision and stamping closed_at.
		onStageBranch(repoRoot, slug, "design", () => {
			const fbPath = tick1.feedback_path
			const raw = readFileSync(fbPath, "utf8")
			const { data: fm, content } = matter(raw)
			const answered = `${content.trim()}\n\n**Decision:** Stripe Elements.\n`
			const updatedFm = {
				...fm,
				closed_at: new Date().toISOString(),
			}
			writeFileSync(fbPath, matter.stringify(answered, updatedFm))
			execFileSync("git", ["-C", repoRoot, "add", fbPath])
			execFileSync("git", [
				"-C",
				repoRoot,
				"commit",
				"-m",
				"test: close FB-001 with decision",
			])
		})

		// Step 4 — cursor MUST fall through past the closed FB. With
		// elaboration pre-verified (`seedVerifiedElaboration` stamps
		// both `verified_at` and `decompose_verified_at`) and units on
		// disk, the next unmet signal is the first hat dispatch
		// (`start_unit_hat`). The critical assertion is "no longer
		// emitting feedback_question on the closed FB" — the precise
		// downstream action depends on the seeded fixture state.
		const tick2 = await runTickWithBranchAlignment(slug)
		assert.notStrictEqual(
			tick2.action,
			"feedback_question",
			`cursor still emitting feedback_question after FB close: ${JSON.stringify(tick2)}`,
		)
		assert.strictEqual(
			tick2.action,
			"start_unit_hat",
			`expected start_unit_hat (the next elaborate-loop signal in this fixture's seeded state), got ${tick2.action}: ${JSON.stringify(tick2)}`,
		)
		assert.strictEqual(tick2.stage, "design")
	})
})

test("elaborate_loop prompt enumerates every unmet signal (Option A composite)", async () => {
	const { actionPromptBuilders } = await import(
		"../src/orchestrator/prompts/index.ts"
	)

	// Synthesize a multi-signal action shape — the post-Option-A cursor
	// hands the prompt builder ONE action listing every unmet signal.
	const action = {
		action: "elaborate_loop",
		stage: "design",
		intent: "test-intent",
		signals_unmet: [
			{ signal: "conversation" },
			{ signal: "verify_conversation" },
			{ signal: "discovery", agent: "design-direction", units: [] },
			{ signal: "decompose" },
			{ signal: "verify_decompose" },
		],
		verifier_nonces: {
			verify_conversation: "test-nonce-conv",
			verify_decompose: "test-nonce-dec",
		},
	}
	const body = actionPromptBuilders.get("elaborate_loop")({
		slug: "test-intent",
		studio: "test",
		dir: "/tmp/test-haiku-method-fake",
		action,
	})

	// The router emits the umbrella heading and one section per signal.
	assert.ok(
		body.includes("Elaborate Loop"),
		"prompt is missing the Elaborate Loop heading",
	)
	for (const signal of [
		"conversation",
		"verify_conversation",
		"discovery",
		"decompose",
		"verify_decompose",
	]) {
		assert.ok(
			body.includes(`Signal: \`${signal}\``),
			`prompt is missing the per-signal heading for ${signal}`,
		)
	}
	// Concurrent execution reminder is the footer block; verifier nonces
	// land in the verify_* sub-instructions.
	assert.ok(
		body.includes("Concurrent execution reminder"),
		"prompt is missing the concurrent execution reminder",
	)
	assert.ok(
		body.includes("test-nonce-conv"),
		"verify_conversation nonce did not surface in the prompt",
	)
	assert.ok(
		body.includes("test-nonce-dec"),
		"verify_decompose nonce did not surface in the prompt",
	)
})
