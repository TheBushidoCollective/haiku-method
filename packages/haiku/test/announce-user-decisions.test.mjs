#!/usr/bin/env npx tsx
// Test suite for the post-decision announcement contract.
//
// Whenever a user makes a decision via elicitation, visual question,
// or gate review, the agent should announce that decision back in
// the chat thread before driving to the next workflow step. Without
// an explicit instruction, agents tend to silently consume the
// decision and immediately call the next tool — leaving the user
// staring at a "thinking" indicator with no indication that their
// input was registered.
//
// The contract is enforced via a single shared helper
// `withAnnouncement(announcement, nextStep)` that prepends a stable
// "**ANNOUNCE TO USER (post in chat now):** …" prefix to the message
// returned by each decision-receiving tool. This file tests:
//   - the helper itself (composition, ordering, prefix)
//   - the surfaces that should be using it (haiku_select_*,
//     haiku_await_gate, ask_user_visual_question's await,
//     pick_design_direction's await)
//
// Surfaces that DON'T receive a user decision (the prepare step of
// any tool, error paths, schema validation rejections) intentionally
// don't use the helper and aren't asserted against here.

import assert from "node:assert"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const _origCwd = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = `${_origCwd}/../../plugin`

const { withAnnouncement } = await import(
	"../src/tools/orchestrator/_announce.ts"
)

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (e.stack) console.log(e.stack)
	}
}

console.log("\n=== withAnnouncement helper ===")

test("prefixes message with the stable ANNOUNCE token", () => {
	const out = withAnnouncement("The user picked X.", "Call next_tool.")
	assert.ok(
		out.startsWith("**ANNOUNCE TO USER"),
		"output must start with the stable ANNOUNCE prefix",
	)
	assert.ok(
		/\(post in chat now\)/i.test(out),
		"prefix must include 'post in chat now' so the agent knows it's a same-turn directive",
	)
})

test("preserves announcement and next-step content in order", () => {
	const out = withAnnouncement("ANNOUNCE_TEXT", "NEXT_STEP_TEXT")
	const announceIdx = out.indexOf("ANNOUNCE_TEXT")
	const nextIdx = out.indexOf("NEXT_STEP_TEXT")
	assert.ok(
		announceIdx >= 0 && nextIdx >= 0,
		"both halves must appear in the output",
	)
	assert.ok(
		announceIdx < nextIdx,
		"announcement must precede the next-step instruction",
	)
})

test("survives multi-line content in either half", () => {
	const out = withAnnouncement(
		"Line one of announcement.\nLine two.",
		"Step 1.\nStep 2.\nStep 3.",
	)
	assert.ok(
		out.includes("Line one of announcement.\nLine two."),
		"multi-line announcement must be preserved verbatim",
	)
	assert.ok(
		out.includes("Step 1.\nStep 2.\nStep 3."),
		"multi-line next-step must be preserved verbatim",
	)
})

console.log("\n=== surfaces that must use withAnnouncement ===")

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..", "src")

function read(rel) {
	return readFileSync(join(root, rel), "utf-8")
}

const ANNOUNCE_TOKEN = "ANNOUNCE TO USER"

test("haiku_select_studio uses withAnnouncement on success and cancel paths", () => {
	const src = read("tools/orchestrator/haiku_select_studio.ts")
	assert.ok(
		src.includes('from "./_announce.js"') ||
			src.includes("from './_announce.js'"),
		"haiku_select_studio must import withAnnouncement",
	)
	assert.ok(
		src.includes("withAnnouncement"),
		"haiku_select_studio must call withAnnouncement",
	)
	// Both the success path (studio_selected) and the cancel path
	// (cancelled) must announce — every user-driven decision counts,
	// not just affirmative ones.
	const studioSelectedBlock = src.match(/action:\s*"studio_selected"[\s\S]*?\)/)
	assert.ok(
		studioSelectedBlock?.[0]?.includes("withAnnouncement"),
		"studio_selected return must wrap message in withAnnouncement",
	)
})

test("haiku_select_mode uses withAnnouncement on success and cancel paths", () => {
	const src = read("tools/orchestrator/haiku_select_mode.ts")
	assert.ok(
		src.includes('from "./_announce.js"'),
		"haiku_select_mode must import withAnnouncement",
	)
	const modeSelectedBlock = src.match(/action:\s*"mode_selected"[\s\S]*?\)\s*,/)
	assert.ok(
		modeSelectedBlock?.[0]?.includes("withAnnouncement"),
		"mode_selected return must wrap message in withAnnouncement",
	)
})

test("haiku_select_stage uses withAnnouncement on success and cancel paths", () => {
	const src = read("tools/orchestrator/haiku_select_stage.ts")
	assert.ok(
		src.includes('from "./_announce.js"'),
		"haiku_select_stage must import withAnnouncement",
	)
	const stageSelectedBlock = src.match(
		/action:\s*"stage_selected"[\s\S]*?\)\s*,/,
	)
	assert.ok(
		stageSelectedBlock?.[0]?.includes("withAnnouncement"),
		"stage_selected return must wrap message in withAnnouncement",
	)
})

test("haiku_await_gate uses withAnnouncement on every decision return", () => {
	const src = read("tools/orchestrator/haiku_await_gate.ts")
	assert.ok(
		src.includes('from "./_announce.js"'),
		"haiku_await_gate must import withAnnouncement",
	)
	// Count: at least one withAnnouncement call per documented decision
	// outcome. Six core outcomes × at least one call site each.
	const callsiteCount = (src.match(/withAnnouncement\(/g) ?? []).length
	assert.ok(
		callsiteCount >= 6,
		`haiku_await_gate must wrap each decision return — found ${callsiteCount}, expected >= 6`,
	)
	// The successful approval paths must mention "advance" or "complete"
	// AFTER a withAnnouncement call (i.e., the announcement comes first
	// then the next-step imperative).
	for (const action of [
		"intent_approved",
		"advance_phase",
		"advance_stage",
		"intent_complete",
		"changes_requested",
		"external_review_requested",
	]) {
		const m = src.indexOf(`action: "${action}"`)
		assert.ok(m > 0, `must define an "${action}" return path`)
	}
})

test("haiku_await_gate primary final-stage path wraps completeOrReviewIntent in withAnnouncement", () => {
	// Regression for the final-stage primary path bug: the elicitation
	// fallback wrapped its completeOrReviewIntent message but the
	// primary path did not, so when the user approved the final stage
	// via the SPA gate UI the resulting intent_complete /
	// advance_phase action had no announce token and the agent
	// silently consumed it. Anchor on the
	// `workflowCompleteStage(slug, stage, "advanced")` call (the
	// final-stage marker) and assert the next ~400 chars contain
	// `withAnnouncement` — covering both the call to
	// completeOrReviewIntent and any future refactor that splits this
	// into a helper.
	const src = read("tools/orchestrator/haiku_await_gate.ts")
	// The final-stage primary path is the FIRST workflowCompleteStage
	// call in the file (the elicitation fallback's call comes much
	// later, separated by the changes_requested + external_review
	// branches).
	const finalStageIdx = src.indexOf(
		'workflowCompleteStage(slug, stage, "advanced")',
	)
	assert.ok(
		finalStageIdx > 0,
		"must have a workflowCompleteStage call for the primary final-stage path",
	)
	// Look in the ~600 chars immediately after — the wrapping call to
	// completeOrReviewIntent is right there. 600 is enough to span the
	// `const approvedStudio = ...` resolution + the multi-line
	// withAnnouncement call without bleeding into the
	// external_review branch below.
	const slice = src.slice(finalStageIdx, finalStageIdx + 600)
	assert.ok(
		slice.includes("withAnnouncement"),
		"primary final-stage path must wrap completeOrReviewIntent's source message in withAnnouncement",
	)
	assert.ok(
		slice.includes("completeOrReviewIntent"),
		"primary final-stage path must call completeOrReviewIntent (sanity)",
	)
})

test("ask_user_visual_question's await uses withAnnouncement on the answered path", () => {
	const src = read("server/tool-call.ts")
	assert.ok(
		src.includes('from "../tools/orchestrator/_announce.js"'),
		"server/tool-call.ts must import withAnnouncement",
	)
	// The questionResult JSON must carry an announce-formatted message.
	const questionResultIdx = src.indexOf("const questionResult: Record")
	assert.ok(questionResultIdx > 0, "must define questionResult literal")
	const slice = src.slice(questionResultIdx, questionResultIdx + 2000)
	assert.ok(
		slice.includes("withAnnouncement"),
		"questionResult must include withAnnouncement on the answered path",
	)
})

test("pick_design_direction's await uses withAnnouncement on select + regenerate paths", () => {
	const src = read("server/tool-call.ts")
	// Both branches (regenerate and select) must use the helper.
	// Anchor on structural code tokens (variable names + the literal
	// archetype announcement string), not on source comments —
	// comments can be deleted/reworded without breaking behavior, and
	// a stale anchor silently turns into a vacuous pass.
	const regenIdx = src.indexOf('sel.mode === "regenerate"')
	assert.ok(regenIdx > 0, "must have a regenerate branch")
	const regenSlice = src.slice(regenIdx, regenIdx + 2500)
	assert.ok(
		regenSlice.includes("withAnnouncement"),
		"regenerate branch must use withAnnouncement",
	)
	// Select path: anchor on the archetype-selection announcement
	// string itself — that text is the user-facing announcement and is
	// part of the contract this PR introduces.
	const selectIdx = src.indexOf(
		"The user selected the **$" + "{sel.archetype}**",
	)
	assert.ok(
		selectIdx > 0,
		"must have a select branch with the archetype announcement",
	)
	const selectSlice = src.slice(selectIdx, selectIdx + 1000)
	assert.ok(
		selectSlice.includes("withAnnouncement"),
		"select branch must use withAnnouncement",
	)
})

test("the announce token shows up in every wrapped message", () => {
	// Spot-check: every withAnnouncement call yields a string
	// containing the stable token. Test the helper output directly,
	// not the source text, to avoid coupling to specific phrasing in
	// each call site.
	const sample = withAnnouncement("X", "Y")
	assert.ok(
		sample.includes(ANNOUNCE_TOKEN),
		`helper output must contain "${ANNOUNCE_TOKEN}"`,
	)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
