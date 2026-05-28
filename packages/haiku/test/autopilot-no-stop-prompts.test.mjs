#!/usr/bin/env npx tsx
// autopilot-no-stop-prompts.test.mjs
//
// Autopilot must not pause to ask the user during the parent-facing
// elaborate loop, and a user-decidable question FB must be resolved by
// the agent itself (not surfaced) in autopilot. These are the two
// parent prompts that carried unguarded "surface a decision to the
// user" copy; both now branch on the intent's mode.
//
// Regression for the wifiwithoutwalls/automated-starlink-rental-platform
// report (2026-05-25): an autopilot intent stopped between/within stages
// because the elaborate-loop prompt's no-yield directive was buried in a
// sub-section and its closing reminder actively invited a user decision.

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import feedbackQuestion from "../src/orchestrator/prompts/feedback/feedback_question/index.ts"
import elaborateLoop from "../src/orchestrator/prompts/stage/elaborate/elaborate_loop/index.ts"

/** Build a throwaway intent dir whose intent.md carries `mode`. */
function intentDir(mode) {
	const root = mkdtempSync(join(tmpdir(), "haiku-nostop-"))
	const dir = join(root, ".haiku", "intents", "x")
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, "intent.md"), `---\nmode: ${mode}\n---\n`)
	return { dir, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

function renderLoop(mode) {
	const { dir, cleanup } = intentDir(mode)
	try {
		return elaborateLoop({
			slug: "x",
			dir,
			studio: "software",
			action: {
				action: "elaborate_loop",
				stage: "operations",
				intent: "x",
				signals_unmet: [{ signal: "decompose" }],
			},
		})
	} finally {
		cleanup()
	}
}

function renderQuestion(mode) {
	const { dir, cleanup } = intentDir(mode)
	try {
		return feedbackQuestion({
			slug: "x",
			dir,
			action: {
				stage: "design",
				feedback_id: "FB-01",
				feedback_path: `${dir}/feedback/FB-01.md`,
			},
		})
	} finally {
		cleanup()
	}
}

test("elaborate_loop (autopilot): hoists a top-level no-stop directive", () => {
	const out = renderLoop("autopilot")
	assert.match(
		out,
		/AUTOPILOT — THIS PHASE DOES NOT STOP TO ASK/,
		"autopilot loop must carry the hoisted no-stop directive",
	)
	// The directive must precede the discovery/decompose signal bodies so
	// it governs the whole phase, not one sub-section.
	assert.ok(
		out.indexOf("DOES NOT STOP TO ASK") < out.indexOf("Signal: `decompose`"),
		"no-stop directive must sit above the per-signal blocks",
	)
})

test("elaborate_loop (autopilot): closing reminder does NOT invite a user handoff", () => {
	const out = renderLoop("autopilot")
	assert.ok(
		!/the user picks before the loop continues/.test(out),
		"autopilot must not tell the agent the user will pick",
	)
	assert.match(
		out,
		/NOT a reason to stop in autopilot/,
		"autopilot closing reminder must reframe a fork as self-resolved",
	)
})

test("elaborate_loop (non-autopilot): keeps the user-decision path, no autopilot banner", () => {
	const out = renderLoop("continuous")
	assert.ok(
		!/AUTOPILOT — THIS PHASE DOES NOT STOP/.test(out),
		"non-autopilot must not show the autopilot banner",
	)
	assert.match(
		out,
		/the user picks before the loop continues/,
		"non-autopilot keeps the surface-to-user reminder",
	)
})

test("feedback_question (autopilot): resolve the fork yourself, never AskUserQuestion", () => {
	const out = renderQuestion("autopilot")
	assert.match(
		out,
		/answer this yourself; do NOT surface it to the user/,
		"autopilot question FB must be self-resolved",
	)
	assert.match(
		out,
		/Decide it autonomously/,
		"autopilot step must decide, not ask",
	)
	assert.ok(
		!/Surface the question to the user/.test(out),
		"autopilot must not show the surface-to-user step",
	)
})

test("feedback_question (non-autopilot): still surfaces the question to the user", () => {
	const out = renderQuestion("continuous")
	assert.match(
		out,
		/Surface the question to the user/,
		"non-autopilot keeps the surface-to-user step",
	)
	assert.ok(
		!/answer this yourself; do NOT surface/.test(out),
		"non-autopilot must not show the autopilot banner",
	)
})
