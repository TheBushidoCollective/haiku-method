// cross-stage-consistency-built-in.test.mjs
//
// Locks the 2026-05-18 promotion of cross-stage-consistency from a
// per-studio mandate file into the engine. Before this change:
//
//   - 24 studios shipped `plugin/studios/<studio>/intent-review-agents/
//     cross-stage-consistency.md` (22 byte-identical + 2 outliers)
//   - The cursor's intent-level walk was hardcoded to
//     `["spec", "continuity", "user"]` — it NEVER appended studio
//     review agents to the role list
//   - Net effect: the mandate files were loaded by
//     `readStudioReviewAgentPaths` for diagram generation only, and the
//     cross-stage check never actually ran at intent completion
//
// The promotion does two things at once:
//
//   1. Adds `cross-stage-consistency` to the cursor's `intentRoles`
//      so the check actually fires.
//   2. Inlines the mandate body in `intent_review/index.ts` as a peer
//      of the existing `spec` and `continuity` built-ins — generic
//      enough to apply to every studio, no per-studio mandate file.
//
// These tests lock both invariants so the check can't silently regress.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

/** Build a minimal-but-valid intent dir where every stage in the
 *  studio's STUDIO.md `stages:` list has been merged. The cursor's
 *  intent-level walk fires only when `activeStage` is null, which
 *  happens when every stage's `status: completed` is stamped in the
 *  intent FM. */
function seedCompletedIntent(root, slug, studio, stages) {
	const intentDir = join(root, ".haiku", "intents", slug)
	mkdirSync(intentDir, { recursive: true })
	const stagesYaml = stages.map((s) => `  - ${s}`).join("\n")
	const stageStatusYaml = stages
		.map((s) => `  ${s}: { status: completed }`)
		.join("\n")
	writeFileSync(
		join(intentDir, "intent.md"),
		[
			"---",
			`slug: ${slug}`,
			`studio: ${studio}`,
			"status: active",
			"mode: continuous",
			"stages:",
			stagesYaml,
			"stage_status:",
			stageStatusYaml,
			"approvals: {}",
			"---",
			"# Intent body",
			"",
		].join("\n"),
	)
	for (const s of stages) {
		const sd = join(intentDir, "stages", s)
		mkdirSync(sd, { recursive: true })
		writeFileSync(join(sd, "state.json"), JSON.stringify({ status: "completed" }))
	}
	return intentDir
}

test("intent_review prompt builder emits the cross-stage-consistency inline body", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("intent_review")
	assert.ok(builder, "intent_review prompt builder must be registered")
	const out = builder({
		slug: "demo-intent",
		studio: "software",
		action: { kind: "intent_review", role: "cross-stage-consistency" },
	})
	assert.ok(
		/cross-stage-consistency|cross stage consistency/i.test(out),
		`prompt must name the role. got: ${out.slice(0, 500)}`,
	)
	assert.ok(
		/internally consistent/i.test(out),
		"prompt must include the engine-inline mandate body — not fall through to the generic placeholder",
	)
	assert.ok(
		/upstream stages specified/.test(out),
		"mandate body must include the upstream-alignment check",
	)
	assert.ok(
		/MUST NOT|must not/i.test(out) ||
			/Anti-patterns|anti-patterns/.test(out),
		"mandate body must include the anti-patterns block",
	)
})

test("intent_review for a never-cross-stage-shipping studio still emits the inline body (no studio mandate fallthrough)", async () => {
	// Pick a studio that no longer has any intent-review-agents/ dir
	// (post-promotion: all of them). The prompt builder must use the
	// engine-inline body, not a "no mandate file" placeholder.
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("intent_review")
	const out = builder({
		slug: "demo-intent",
		studio: "hwdev",
		action: { kind: "intent_review", role: "cross-stage-consistency" },
	})
	assert.ok(
		/internally consistent/i.test(out),
		"hwdev (which used to ship a custom mandate) must now get the engine-inline body",
	)
})

test("cursor's intent-level walk includes cross-stage-consistency role", async () => {
	// Black-box check: drive cursor.computeAction with a fully-merged
	// intent and assert it returns an `intent_review { role: ... }` for
	// cross-stage-consistency at some point in the walk. This locks the
	// role into the hardcoded `intentRoles` list — without the new
	// entry, the check goes silent again.
	const cursor = await import(`${SRC}orchestrator/workflow/cursor.ts`)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-cross-stage-cursor-"))
	const origCwd = process.cwd()
	process.chdir(tmp)
	try {
		const intentDir = seedCompletedIntent(tmp, "demo", "software", [
			"inception",
		])
		// computeAction is the cursor's top-level — walk it until we see
		// cross-stage-consistency in the role list. We sign earlier roles
		// (spec, continuity) by stamping their approvals to advance the
		// walk past them, since we only care that cross-stage is reachable.
		// Behavioral lock against the real `intentReviewRoles` helper (the
		// single source of truth for the intent-level walk, shared by the
		// cursor and the progress track). cross-stage-consistency MUST be
		// present in BOTH the autopilot and non-autopilot role lists —
		// without it the intent-completion review goes silent on the
		// cross-stage check. (Pre-2026-05-19 this scraped an inline ternary
		// in cursor.ts; that ternary was extracted into `intentReviewRoles`,
		// so we now assert the function's output directly.)
		assert.ok(
			cursor.intentReviewRoles("autopilot").includes("cross-stage-consistency"),
			"intentReviewRoles(autopilot) MUST include cross-stage-consistency",
		)
		assert.ok(
			cursor.intentReviewRoles("continuous").includes("cross-stage-consistency"),
			"intentReviewRoles(continuous) MUST include cross-stage-consistency",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})
