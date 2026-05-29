// Layer 1: when the cursor fires the keep-or-drop offer on first arrival at
// an optional stage, it must NOT also surface discovery/decompose signals —
// booting discovery/decompose subagents before the keep-or-drop decision is
// made would do throwaway work on a stage the agent may immediately drop.
// The offer action carries ONLY the conversation-class signal(s); recording
// the conversation (writes elaboration.md) clears the one-shot offer, and the
// NEXT tick surfaces discovery+decompose normally (on keep) or nothing (on
// drop). See cursor.ts optional-offer branch.
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const PLUGIN_ROOT = join(process.cwd(), "..", "..", "plugin")

function setup(stages) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-opt-hold-"))
	const slug = "t"
	const iDir = join(dir, ".haiku", "intents", slug)
	mkdirSync(join(iDir, "stages"), { recursive: true })
	writeFileSync(
		join(iDir, "intent.md"),
		[
			"---",
			`title: "T"`,
			"studio: software",
			`stages: [${stages.join(", ")}]`,
			"mode: discrete",
			"status: active",
			"---",
			"",
			"# T",
			"",
		].join("\n"),
	)
	return { dir, slug, iDir }
}

test("optional-offer action holds discovery/decompose signals", async () => {
	// Put the optional `design` stage FIRST so it's the active, unstarted stage
	// immediately — no upstream stage to complete (the proven shape from
	// drop-stage-lands-on-main). First-arrival fires the keep-or-drop offer.
	const { dir, slug, iDir } = setup(["design", "product"])
	const prevCwd = process.cwd()
	const prevPlugin = process.env.CLAUDE_PLUGIN_ROOT
	process.chdir(dir)
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		const { derivePosition } = await import(
			`../src/orchestrator/workflow/cursor.ts?d=${Date.now()}`
		)
		// derivePosition takes an options object and returns a CursorPosition
		// ({ track, action }); the cursor action is on `.action`. signals_unmet
		// holds SIGNAL OBJECTS ({ signal: "discovery", … }), not bare strings —
		// so membership is tested via .some(s => s.signal === …), not .includes().
		const pos = derivePosition({ slug, intentDir: iDir, studio: "software" })
		const action = pos.action
		assert.equal(action.kind, "elaborate_loop")
		assert.equal(action.optional_offer, true)
		assert.ok(
			Array.isArray(action.signals_unmet),
			"signals_unmet should be an array",
		)
		const hasSignal = (name) =>
			action.signals_unmet.some((s) => s.signal === name)
		// The decision is pending — discovery and decompose MUST be held back.
		assert.ok(
			!hasSignal("discovery"),
			`offer must not surface 'discovery'; got ${JSON.stringify(action.signals_unmet)}`,
		)
		assert.ok(
			!hasSignal("decompose"),
			`offer must not surface 'decompose'; got ${JSON.stringify(action.signals_unmet)}`,
		)
		assert.ok(
			!hasSignal("verify_decompose"),
			`offer must not surface 'verify_decompose'; got ${JSON.stringify(action.signals_unmet)}`,
		)
		// The conversation signal is the gate that clears the offer — keep it.
		assert.ok(
			hasSignal("conversation"),
			`offer must keep 'conversation'; got ${JSON.stringify(action.signals_unmet)}`,
		)
	} finally {
		process.chdir(prevCwd)
		process.env.CLAUDE_PLUGIN_ROOT = prevPlugin
	}
})
