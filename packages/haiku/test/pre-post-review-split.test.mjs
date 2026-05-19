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
	// Match `return { kind: "..." ` to skip the type-union declarations
	// at the top of the file. Only the cursor-walk emissions use the
	// return shape.
	const reviewEmitIdx = src.indexOf('return { kind: "dispatch_review"')
	const waveReadyIdx = src.indexOf("if (waveReady.length > 0)")
	const approvalEmitIdx = src.indexOf('return { kind: "dispatch_approval"')
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

test("cursor: reviewRoles AND approvalRoles both include the three engine roles", () => {
	const src = readFileSync(CURSOR_PATH, "utf8")
	const block = src.match(
		/const engineRoles[\s\S]*?const approvalRoles[\s\S]*?\][\s\S]*?\]/,
	)?.[0]
	assert.ok(block, "could not locate the engineRoles + lists block")
	assert.ok(
		/"spec"[\s\S]*"continuity"[\s\S]*"cross-stage-consistency"/.test(block),
		`engineRoles MUST include all three checks in order. got: ${block}`,
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
	// Pre-execute markers: "PRE-execute", "no code has landed", "auditing the planned"
	assert.ok(
		/PRE-execute|pre-execute|spec before any code lands|auditing the planned|no code has landed/i.test(
			out,
		),
		`dispatch_review must signal pre-execute context. got: ${out.slice(0, 800)}`,
	)
	// Anti-pattern lock: must explicitly warn against evaluating code at pre-exec.
	assert.ok(
		/no code exists yet|MUST NOT.*evaluate/i.test(out),
		`pre-execute mandate must warn against evaluating code (none exists yet). got: ${out.slice(0, 800)}`,
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
	// Pre-exec continuity is about PLANNED wiring; post-exec is about
	// BUILT outputs. They must differ.
	assert.ok(
		/PLANNED|planned wiring|plans|orphan-output PLANS/i.test(reviewOut),
		`pre-execute continuity must reference PLANNED wiring. got: ${reviewOut.slice(0, 600)}`,
	)
	assert.ok(
		/BUILT|built work|declared output path/i.test(approvalOut),
		`post-execute continuity must reference BUILT work. got: ${approvalOut.slice(0, 600)}`,
	)
	assert.notEqual(
		reviewOut,
		approvalOut,
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
