// pre-post-review-split.test.mjs
//
// Locks the 2026-05-18 split of stage-level reviews and approvals:
//
//   reviews   = PRE-execute  (check the SPEC before code lands)
//   approvals = POST-execute (check the WORK after it lands)
//
// Before the refactor BOTH walks fired post-execute, with the
// reviews/approvals naming inherited from a planned but unimplemented
// pre-execute pass. The cursor's own comment at the elaborate-loop
// fallthrough called it "the pre-execution review track" while the
// code went straight to wave-ready hat dispatch. This test locks the
// new ordering structurally:
//
//   elaborate_loop signals met
//     → pre-execute reviewRoles walk  (cursor returns dispatch_review)
//     → wave-ready / hat dispatch
//     → all hat sequences done
//     → post-execute approvalRoles walk (cursor returns dispatch_approval)
//     → complete_stage
//
// Plus: engine-built-in roles (spec, continuity, cross-stage-consistency)
// fire in BOTH lists with phase-appropriate mandate bodies. Per-phase
// bodies live in sibling engine-bodies/ dirs.

import assert from "node:assert/strict"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"

const SRC = new URL("../src/", import.meta.url).pathname

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const CURSOR_PATH = join(
	REPO_ROOT,
	"packages/haiku/src/orchestrator/workflow/cursor.ts",
)

test("cursor ordering: reviewRoles walk comes BEFORE wave-ready hat dispatch", () => {
	const src = readFileSync(CURSOR_PATH, "utf8")
	// Anchor on the cursor-walk surrounding context, not the helper
	// functions (isUnitFullyApproved also iterates approvalRoles). Use
	// `dispatch_review` / `dispatch_approval` action emissions as the
	// unique anchor for the cursor-track walks.
	// Match `return {` + `kind: "..."` (allowing a newline between, since
	// the batched-dispatch emissions span multiple lines) to skip the
	// type-union declarations at the top of the file — only the cursor-walk
	// emissions use the `return {` shape.
	const reviewEmitIdx = src.search(/return \{\s*kind: "dispatch_review"/)
	const waveReadyIdx = src.indexOf("if (waveReady.length > 0)")
	const approvalEmitIdx = src.search(/return \{\s*kind: "dispatch_approval"/)
	assert.ok(reviewEmitIdx > 0, "dispatch_review emission must exist in cursor.ts")
	assert.ok(waveReadyIdx > 0, "waveReady dispatch must exist in cursor.ts")
	assert.ok(
		approvalEmitIdx > 0,
		"dispatch_approval emission must exist in cursor.ts",
	)
	assert.ok(
		reviewEmitIdx < waveReadyIdx,
		`dispatch_review emission MUST precede waveReady dispatch (review = pre-execute). reviewEmitIdx=${reviewEmitIdx} waveReadyIdx=${waveReadyIdx}`,
	)
	assert.ok(
		waveReadyIdx < approvalEmitIdx,
		`waveReady dispatch MUST precede dispatch_approval emission (approval = post-execute). waveReadyIdx=${waveReadyIdx} approvalEmitIdx=${approvalEmitIdx}`,
	)
})

test("cursor: reviewRoles AND approvalRoles both lead with the three engine roles in order", async () => {
	const { stageRoleLists } = await import(
		`${SRC}orchestrator/workflow/cursor.ts`
	)
	// Behavioral check (not source grep): both walks must lead with the
	// engine roles spec → continuity → cross-stage-consistency, in order.
	const agents = ["observability", "reliability"]
	const { reviewRoles, approvalRoles } = stageRoleLists(
		"software",
		"operations",
		"interactive",
		agents,
	)
	const engine = ["spec", "continuity", "cross-stage-consistency"]
	assert.deepStrictEqual(
		reviewRoles.slice(0, 3),
		engine,
		`reviewRoles must lead with the engine roles in order. got: ${reviewRoles}`,
	)
	assert.deepStrictEqual(
		approvalRoles.slice(0, 3),
		engine,
		`approvalRoles must lead with the engine roles in order. got: ${approvalRoles}`,
	)
})

test("stageRoleLists: autopilot KEEPS the studio review agents, drops only the human user gate", async () => {
	const { stageRoleLists } = await import(
		`${SRC}orchestrator/workflow/cursor.ts`
	)
	// Pass agents explicitly so the assertion doesn't depend on what's on
	// disk for any particular stage — we're testing the mode logic.
	const agents = ["observability", "reliability"]
	const auto = stageRoleLists("software", "operations", "autopilot", agents)
	const inter = stageRoleLists("software", "operations", "interactive", agents)

	// Autopilot is exactly when the automated adversarial reviewers matter
	// most (no human watching) — they MUST still run in parallel. Mirrors
	// `intentReviewRoles`, which keeps its agents in autopilot.
	assert.ok(
		auto.reviewRoles.includes("observability") &&
			auto.reviewRoles.includes("reliability"),
		`autopilot reviewRoles must keep the studio agents. got: ${auto.reviewRoles}`,
	)
	assert.ok(
		auto.approvalRoles.includes("observability") &&
			auto.approvalRoles.includes("reliability"),
		`autopilot approvalRoles must keep the studio agents. got: ${auto.approvalRoles}`,
	)
	// Only the HUMAN gate drops in autopilot — automated roles always run.
	assert.ok(
		!auto.reviewRoles.includes("user") && !auto.approvalRoles.includes("user"),
		`autopilot must drop the user gate. got: ${auto.reviewRoles} / ${auto.approvalRoles}`,
	)
	assert.ok(
		inter.reviewRoles.includes("user") && inter.approvalRoles.includes("user"),
		"interactive must keep the user gate",
	)
})

test("stageRoleLists: quality_gates TRAILS the adversarial fan-out so the agents stay contiguous (one group)", async () => {
	const { stageRoleLists } = await import(
		`${SRC}orchestrator/workflow/cursor.ts`
	)
	const agents = ["observability", "reliability"]
	const { approvalRoles } = stageRoleLists(
		"software",
		"operations",
		"interactive",
		agents,
	)
	// quality_gates wedged between the engine reviewers and the studio
	// agents would split one parallel "adversarial approval" milestone into
	// two. It MUST come after every adversarial agent (only the user gate
	// after it) so they collapse into a single fan-out pip.
	const qgIdx = approvalRoles.indexOf("quality_gates")
	const lastAgentIdx = Math.max(
		approvalRoles.indexOf("continuity"),
		approvalRoles.indexOf("cross-stage-consistency"),
		approvalRoles.indexOf("observability"),
		approvalRoles.indexOf("reliability"),
	)
	assert.ok(
		qgIdx > lastAgentIdx,
		`quality_gates (idx ${qgIdx}) must trail every adversarial agent (last idx ${lastAgentIdx}). got: ${approvalRoles}`,
	)
	assert.strictEqual(
		approvalRoles[approvalRoles.length - 1],
		"user",
		"user gate is terminal in interactive mode",
	)
})

test("dispatch_review engine-bodies render PRE-execute prose (spec checks the SPEC, not the work)", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("dispatch_review")
	assert.ok(builder, "dispatch_review builder must be registered")
	const out = builder({
		slug: "demo-intent",
		studio: "software",
		action: {
			kind: "dispatch_review",
			stage: "execution",
			role: "spec",
			units: ["unit-01-foo"],
		},
	})
	// Parent prompt signals pre-execute context.
	assert.ok(
		/PRE-execute|pre-execute|spec before any code lands|auditing the planned|no code has landed/i.test(
			out,
		),
		`dispatch_review must signal pre-execute context. got: ${out.slice(0, 800)}`,
	)
	// File-backed dispatch (2026-05-19): subagent prompt body lives in
	// the file referenced by `<subagent prompt_file="...">`. Engine body
	// + anti-evaluation prose belongs there, not in the parent.
	const promptFileMatch = out.match(/prompt_file="([^"]+)"/)
	assert.ok(
		promptFileMatch,
		`dispatch_review must emit a file-backed subagent block. got: ${out.slice(0, 800)}`,
	)
	const { readFileSync } = await import("node:fs")
	const subagent = readFileSync(promptFileMatch[1], "utf8")
	assert.ok(
		/no code exists yet|no code has landed|nothing is built on disk|MUST NOT.*evaluate/i.test(
			subagent,
		),
		`pre-execute mandate must signal there's no code yet (audit specs, don't evaluate work). subagent body: ${subagent.slice(0, 800)}`,
	)
})

test("dispatch_approval engine-bodies render POST-execute prose (spec checks the WORK against the spec)", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("dispatch_approval")
	assert.ok(builder, "dispatch_approval builder must be registered")
	const out = builder({
		slug: "demo-intent",
		studio: "software",
		action: {
			kind: "dispatch_approval",
			stage: "execution",
			role: "spec",
			units: ["unit-01-foo"],
		},
	})
	// Post-execute markers: "POST-execute", "the BUILT work", "outputs conform"
	assert.ok(
		/POST-execute|post-execute|BUILT work|outputs conform|read each declared output path/i.test(
			out,
		),
		`dispatch_approval must signal post-execute context. got: ${out.slice(0, 800)}`,
	)
})

test("both walks: continuity engine body renders distinct prose per phase", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const reviewBuilder = actionPromptBuilders.get("dispatch_review")
	const approvalBuilder = actionPromptBuilders.get("dispatch_approval")
	const reviewOut = reviewBuilder({
		slug: "x",
		studio: "software",
		action: {
			kind: "dispatch_review",
			stage: "execution",
			role: "continuity",
			units: ["unit-01-foo"],
		},
	})
	const approvalOut = approvalBuilder({
		slug: "x",
		studio: "software",
		action: {
			kind: "dispatch_approval",
			stage: "execution",
			role: "continuity",
			units: ["unit-01-foo"],
		},
	})
	// File-backed dispatch: engine-body prose lives in the subagent
	// prompt files referenced by the parent's <subagent> blocks.
	const { readFileSync } = await import("node:fs")
	const reviewSubagentPath = reviewOut.match(/prompt_file="([^"]+)"/)?.[1]
	const approvalSubagentPath = approvalOut.match(/prompt_file="([^"]+)"/)?.[1]
	assert.ok(reviewSubagentPath, "dispatch_review must emit a file-backed subagent block")
	assert.ok(
		approvalSubagentPath,
		"dispatch_approval must emit a file-backed subagent block",
	)
	const reviewSubagent = readFileSync(reviewSubagentPath, "utf8")
	const approvalSubagent = readFileSync(approvalSubagentPath, "utf8")

	// Pre-exec continuity is about PLANNED wiring; post-exec is about
	// BUILT outputs. They must differ.
	assert.ok(
		/PLANNED|planned wiring|plans|orphan-output PLANS/i.test(reviewSubagent),
		`pre-execute continuity must reference PLANNED wiring. subagent body: ${reviewSubagent.slice(0, 600)}`,
	)
	assert.ok(
		/BUILT|built work|declared output path/i.test(approvalSubagent),
		`post-execute continuity must reference BUILT work. subagent body: ${approvalSubagent.slice(0, 600)}`,
	)
	assert.notEqual(
		reviewSubagent,
		approvalSubagent,
		"pre- and post-execute continuity bodies must render distinct prose",
	)
})

test("orphan deletions: `review` and `intent_completion_review` are no longer registered builders", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	assert.equal(
		actionPromptBuilders.get("review"),
		undefined,
		"`review` was a confirmed orphan and should be unregistered after the 2026-05-18 cleanup",
	)
	assert.equal(
		actionPromptBuilders.get("intent_completion_review"),
		undefined,
		"`intent_completion_review` was a confirmed orphan and should be unregistered",
	)
})
