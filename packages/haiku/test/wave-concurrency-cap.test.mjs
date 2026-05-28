// wave-concurrency-cap.test.mjs
//
// History:
//   - Pre-2026-05-18: `start_unit_hat` / `start_feedback_hat` said
//     "spawn N in parallel" with no concurrency cap teaching, so big
//     waves spawned N concurrent Tasks ignoring `MAX_CONCURRENT_SUBAGENTS`.
//   - 2026-05-18: wired `batchDispatchDirective` into both templates,
//     teaching the agent a slot-pool / batch-serial protocol.
//   - 2026-05-19: removed the slot-pool teaching entirely under the
//     no-agent-mechanics rule (`.claude/rules/no-agent-mechanics-teaching.md`).
//     Concurrency now flows from the engine: `haiku_feedback_advance_hat`
//     emits a `next_subagent_dispatch_block` relay breadcrumb on its
//     return, the subagent relays it, the parent spawns it. No prose
//     about slot pools, batch boundaries, or env-var caps in the prompt.
//
// What survives in the prompt:
//   - The "spawn each block in parallel; follow each subagent's return"
//     directive (engine-threaded, no count math).
//   - The closure-reminder + workflow-contracts block (unrelated to
//     mechanics — these are behavioral rules, not engine sequencing).

import assert from "node:assert/strict"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname

test("start_unit_hat prompt does NOT teach the agent slot-pool / batch mechanics", async () => {
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
			units: Array.from({ length: 12 }, (_, i) => `unit-${String(i + 1).padStart(2, "0")}`),
			terminal: false,
		},
	})
	// Banned mechanics-teaching prose under the no-agent-mechanics rule.
	const banned = [
		/slot pool/i,
		/seed the pool/i,
		/batch-serial/i,
		/Concurrency cap:/,
		/HAIKU_MAX_CONCURRENT_SUBAGENTS/,
		/spawn batch \d/i,
		/wait for every .* return/i,
		/Multiple simultaneous completions/i,
		/fire one replacement/i,
	]
	for (const re of banned) {
		assert.ok(
			!re.test(out),
			`start_unit_hat prompt must NOT teach mechanics (${re}); got: ${out.slice(0, 800)}`,
		)
	}
	// Still says "spawn in parallel" — that's a directive, not mechanics.
	assert.ok(
		/parallel/i.test(out),
		`prompt should still tell the agent to spawn in parallel; got: ${out.slice(0, 600)}`,
	)
})

test("start_feedback_hat prompt does NOT teach the agent slot-pool / batch mechanics", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("start_feedback_hat")
	assert.ok(builder)
	const dispatches = Array.from({ length: 12 }, (_, i) => ({
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
	const banned = [
		/slot pool/i,
		/seed the pool/i,
		/batch-serial/i,
		/Concurrency cap:/,
		/HAIKU_MAX_CONCURRENT_SUBAGENTS/,
		/spawn batch \d/i,
		/wait for every .* return/i,
	]
	for (const re of banned) {
		assert.ok(
			!re.test(out),
			`start_feedback_hat prompt must NOT teach mechanics (${re}); got: ${out.slice(0, 800)}`,
		)
	}
	assert.ok(
		/parallel/i.test(out),
		`prompt should still tell the agent to spawn in parallel; got: ${out.slice(0, 600)}`,
	)
})

test("start_unit_hat prompt embeds closure-reminder + workflow contracts (all counts)", async () => {
	// Regression for the 2026-05-18 "subagent terminated without
	// advance_hat" reports. Engine-side: the spawn prompt MUST carry
	// (a) an explicit closure reminder that's the last instruction the
	// subagent reads, AND (b) the workflow contracts block. Studio md
	// files are NOT touched — closure instructions live in the engine.
	//
	// File-backed dispatch (2026-05-19): the closure reminder now lives
	// in each per-unit subagent prompt FILE (not the parent prompt). The
	// parent embeds `<subagent prompt_file="...">` markup; we read the
	// referenced file and assert the reminder is there. The workflow
	// contracts block stays referenced in the parent prompt.
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const { readFileSync } = await import("node:fs")
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
		// Every dispatched unit's prompt file MUST carry the closure
		// reminder. Pull each prompt_file path out of the parent output
		// and verify the file's body. Filter the literal `prompt_file="..."`
		// placeholder in the attribute-mapping instructions (only real
		// absolute paths count).
		const promptFiles = [...out.matchAll(/prompt_file="([^"]+)"/g)]
			.map((m) => m[1])
			.filter((p) => p.startsWith("/"))
		assert.equal(
			promptFiles.length,
			count,
			`unit dispatch (count=${count}) MUST emit one prompt_file per unit; got ${promptFiles.length}`,
		)
		for (const pf of promptFiles) {
			const body = readFileSync(pf, "utf8")
			assert.ok(
				/CLOSURE REQUIRED|Closure required|haiku_unit_advance_hat/.test(body),
				`unit dispatch (count=${count}) prompt file ${pf} MUST embed an explicit closure reminder`,
			)
		}
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
