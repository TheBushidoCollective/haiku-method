// Layer 1: when the cursor fires the keep-or-drop offer on first arrival at
// an optional stage, it must NOT also surface discovery/decompose signals —
// booting discovery/decompose subagents before the keep-or-drop decision is
// made would do throwaway work on a stage the agent may immediately drop.
// The offer action carries ONLY the conversation-class signal(s); recording
// the conversation (writes elaboration.md) clears the one-shot offer, and the
// NEXT tick surfaces discovery+decompose normally (on keep) or nothing (on
// drop). See cursor.ts optional-offer branch.
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
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
	const { dir, slug, iDir } = setup(["inception", "design", "product"])
	const prevCwd = process.cwd()
	const prevPlugin = process.env.CLAUDE_PLUGIN_ROOT
	process.chdir(dir)
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		// inception complete (gate.md); design is next + optional + unstarted.
		const incDir = join(iDir, "stages", "inception")
		mkdirSync(incDir, { recursive: true })
		writeFileSync(join(incDir, "gate.md"), "signed\n")
		const { derivePosition } = await import(
			`../src/orchestrator/workflow/cursor.ts?d=${Date.now()}`
		)
		const action = derivePosition(slug, "software")
		assert.equal(action.kind, "elaborate_loop")
		assert.equal(action.optional_offer, true)
		// The decision is pending — discovery and decompose MUST be held back.
		assert.ok(
			Array.isArray(action.signals_unmet),
			"signals_unmet should be an array",
		)
		assert.ok(
			!action.signals_unmet.includes("discovery"),
			`offer must not surface 'discovery'; got ${JSON.stringify(action.signals_unmet)}`,
		)
		assert.ok(
			!action.signals_unmet.includes("decompose"),
			`offer must not surface 'decompose'; got ${JSON.stringify(action.signals_unmet)}`,
		)
		assert.ok(
			!action.signals_unmet.includes("verify_decompose"),
			`offer must not surface 'verify_decompose'; got ${JSON.stringify(action.signals_unmet)}`,
		)
		// The conversation signal is the gate that clears the offer — keep it.
		assert.ok(
			action.signals_unmet.includes("conversation"),
			`offer must keep 'conversation'; got ${JSON.stringify(action.signals_unmet)}`,
		)
	} finally {
		process.chdir(prevCwd)
		process.env.CLAUDE_PLUGIN_ROOT = prevPlugin
	}
})
