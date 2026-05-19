// wave-concurrency-cap.test.mjs
//
// Both `start_unit_hat` and `start_feedback_hat` prompts MUST render
// the standardized batchDispatchDirective so unit and FB waves obey
// `MAX_CONCURRENT_SUBAGENTS` (default 5; env `HAIKU_MAX_CONCURRENT_SUBAGENTS`).
//
// Pre-2026-05-18 these prompts said "spawn N in parallel" with no
// concurrency cap. A wave of 50 units / 30 FBs would spawn 50/30
// concurrent Tasks, ignoring the pool. The fix wires
// `batchDispatchDirective(count, label)` into both templates — same
// helper used by discovery / stage-review / intent-completion-review.

import assert from "node:assert/strict"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname

test("start_unit_hat prompt embeds concurrency-cap directive (Concurrency cap)", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("start_unit_hat")
	assert.ok(builder)
	const out = builder({
		slug: "test-intent",
		studio: "software",
		action: {
			stage: "design",
			hat: "builder",
			units: ["unit-01", "unit-02", "unit-03"],
			terminal: false,
		},
	})
	assert.ok(
		/Concurrency cap/.test(out),
		`start_unit_hat MUST emit a Concurrency cap directive. Got: ${out.slice(0, 600)}`,
	)
	assert.ok(
		/HAIKU_MAX_CONCURRENT_SUBAGENTS/.test(out),
		"directive MUST name the env var",
	)
})

test("start_feedback_hat prompt embeds concurrency-cap directive (Concurrency cap)", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("start_feedback_hat")
	assert.ok(builder)
	const out = builder({
		slug: "test-intent",
		studio: "software",
		action: {
			dispatches: [
				{ feedback_id: "FB-001", stage: "design", hat: "classifier", terminal: false },
				{ feedback_id: "FB-002", stage: "design", hat: "classifier", terminal: false },
				{ feedback_id: "FB-003", stage: "design", hat: "classifier", terminal: false },
			],
		},
	})
	assert.ok(
		/Concurrency cap/.test(out),
		`start_feedback_hat MUST emit a Concurrency cap directive. Got: ${out.slice(0, 600)}`,
	)
	assert.ok(
		/HAIKU_MAX_CONCURRENT_SUBAGENTS/.test(out),
		"directive MUST name the env var",
	)
})

test("start_unit_hat prompt embeds closure-reminder + workflow contracts (all counts)", async () => {
	// Regression for the 2026-05-18 "subagent terminated without
	// advance_hat" reports. Engine-side: the spawn prompt MUST carry
	// (a) an explicit closure reminder that's the last instruction the
	// subagent reads in its "what to do" block, AND (b) the workflow
	// contracts block unconditionally (pre-fix it was gated on
	// units.length > 1, leaving single-unit dispatches without the
	// reinforcement). Studio md files are NOT touched — closure
	// instructions live in the engine.
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("start_unit_hat")
	assert.ok(builder)
	for (const count of [1, 3, 12]) {
		const units = Array.from(
			{ length: count },
			(_, i) => `unit-${String(i + 1).padStart(2, "0")}`,
		)
		const out = builder({
			slug: "test-intent",
			studio: "software",
			action: { stage: "design", hat: "builder", units, terminal: false },
		})
		assert.ok(
			/CLOSURE REQUIRED|Closure required|haiku_unit_advance_hat/.test(out),
			`unit dispatch (count=${count}) MUST embed an explicit closure reminder`,
		)
		assert.ok(
			/workflow contracts/i.test(out),
			`unit dispatch (count=${count}) MUST embed the workflow contracts block unconditionally`,
		)
	}
})

test("start_feedback_hat prompt embeds closure-reminder + workflow contracts (all counts)", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("start_feedback_hat")
	assert.ok(builder)
	const { readFileSync } = await import("node:fs")
	for (const count of [1, 3, 12]) {
		const dispatches = Array.from({ length: count }, (_, i) => ({
			feedback_id: `FB-${String(i + 1).padStart(3, "0")}`,
			stage: "design",
			hat: "classifier",
			terminal: false,
		}))
		const out = builder({
			slug: "test-intent",
			studio: "software",
			action: { dispatches },
		})
		// Post-refactor: closure rules live in the materialized
		// workflow-contracts-fix-loop.md shared file referenced by the
		// parent prompt + inlined into each subagent prompt file. Verify
		// both: the parent prompt references the fix-loop contracts block,
		// AND the referenced file contains the closure obligation.
		assert.ok(
			/workflow contracts.*fix.loop/i.test(out),
			`FB dispatch (count=${count}) MUST reference the fix-loop workflow contracts block`,
		)
		const sharedPathMatch = out.match(
			/`([^`]+workflow-contracts-fix-loop\.md)`/,
		)
		assert.ok(
			sharedPathMatch,
			`FB dispatch (count=${count}) MUST point at workflow-contracts-fix-loop.md by path`,
		)
		const sharedBody = readFileSync(sharedPathMatch[1], "utf8")
		assert.ok(
			/haiku_feedback_advance_hat/.test(sharedBody),
			`Referenced fix-loop contract file MUST contain the closure obligation (advance_hat)`,
		)
	}
})

test("directive renders the slot-pool protocol when count > MAX_CONCURRENT_SUBAGENTS", async () => {
	// Default MAX_CONCURRENT_SUBAGENTS is 5. Render a wave of 12 units
	// → expect either slot-pool prose (if backgroundSpawn capability)
	// or batch-serial prose (if not). Either way, the directive must
	// mention >5-item handling.
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("start_unit_hat")
	assert.ok(builder)
	const units = Array.from({ length: 12 }, (_, i) => `unit-${String(i + 1).padStart(2, "0")}`)
	const out = builder({
		slug: "test-intent",
		studio: "software",
		action: {
			stage: "design",
			hat: "builder",
			units,
			terminal: false,
		},
	})
	// Either flavor of "more items than fit in a single in-flight batch"
	// is acceptable — what matters is that count=12 isn't dispatched
	// flat-out as 12 simultaneous Tasks ignoring the cap.
	const seedsPool = /slot pool|seed the pool|Seed the pool/.test(out)
	const splitsBatches =
		/split into|batches of|batch-serial/.test(out)
	assert.ok(
		seedsPool || splitsBatches,
		`12-item wave MUST trigger slot-pool or batch-serial discipline. Got: ${out.slice(0, 1200)}`,
	)
})
