#!/usr/bin/env npx tsx
// migrate-banner.test.mjs — runWorkflowTick must surface a structured
// `migrated` action when it auto-migrates a pre-v4 intent on first read.
// Without this, the agent sees deleted v3 state files in `git status` and
// incorrectly tells the user data was lost (real-world report 2026-05-08).
//
// Coverage:
//   1. v3 intent on a v4 build → first tick returns action: "migrated"
//      with a message naming what was preserved, what was deleted, and
//      what v4 derives instead of stores
//   2. Already-v4 intent on the same build → no `migrated` action; cursor
//      walks normally (covered by the broader run-tick test suite, but
//      double-checked here because the migration banner code lives next
//      to the cursor entry point)

import assert from "node:assert"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { runWorkflowTick } = await import(
	"../src/orchestrator/workflow/run-tick.ts"
)
// Loading the v0-to-v4 module triggers its registerMigrator side-effect.
await import("../src/orchestrator/migrations/v0-to-v4.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}`)
		console.log(`    ${err.message}`)
		if (err.stack)
			console.log(`    ${err.stack.split("\n").slice(1, 4).join("\n    ")}`)
	}
}

function makeV3Fixture(slug = "legacy") {
	const root = mkdtempSync(join(tmpdir(), "haiku-migrate-banner-"))
	const haikuRoot = join(root, ".haiku")
	const iDir = join(haikuRoot, "intents", slug)
	mkdirSync(iDir, { recursive: true })
	mkdirSync(join(iDir, "stages", "design", "units"), { recursive: true })
	mkdirSync(join(iDir, "stages", "design", "feedback"), { recursive: true })

	// v3 intent.md — no plugin_version, has deprecated active_stage / phase
	writeFileSync(
		join(iDir, "intent.md"),
		[
			"---",
			'title: "Legacy intent"',
			'studio: "software"',
			'mode: "continuous"',
			'active_stage: "design"',
			'phase: "execute"',
			'status: "active"',
			"---",
			"",
			"# Legacy intent body",
		].join("\n"),
	)

	// v3 unit with status: completed (will get synthesized approvals.user)
	writeFileSync(
		join(iDir, "stages", "design", "units", "unit-01-foo.md"),
		[
			"---",
			'name: "unit-01-foo"',
			'status: "completed"',
			'completed_at: "2026-04-01T01:00:00Z"',
			"---",
			"",
			"# foo",
		].join("\n"),
	)

	// v3 stage state.json (will be deleted)
	writeFileSync(
		join(iDir, "stages", "design", "state.json"),
		JSON.stringify({ phase: "execute", status: "active" }, null, 2),
	)

	return {
		root,
		haikuRoot,
		slug,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	}
}

console.log("=== migrate-banner ===")

test("first tick on a v3 intent returns action: 'migrated' with details", () => {
	const { root, haikuRoot, slug, cleanup } = makeV3Fixture("legacy-1")
	const origCwd = process.cwd()
	let result
	try {
		process.chdir(root)
		result = runWorkflowTick(slug, haikuRoot)
	} finally {
		process.chdir(origCwd)
		cleanup()
	}
	assert.ok(result, "tick must return a result")
	assert.ok(result.action, "result must have an action")
	if (result.action.action !== "migrated") {
		throw new Error(
			`expected action 'migrated', got '${result.action.action}'\nmessage: ${result.action.message}`,
		)
	}
	const msg = result.action.message
	assert.ok(typeof msg === "string" && msg.length > 0, "message must be set")
	// Sanity-check the message names what got preserved AND what got
	// deleted, plus the reassurance that this is intentional.
	assert.match(msg, /preserved/i, "message must explain what was preserved")
	assert.match(
		msg,
		/state\.json/,
		"message must call out state.json deletion explicitly",
	)
	assert.match(
		msg,
		/iterations\[\]/,
		"message must reassure that iterations[] is preserved",
	)
	assert.match(
		msg,
		/firstUnmergedStage|derived|derives/i,
		"message must explain v4 derives stage position from git",
	)
	assert.match(
		msg,
		/downgrade-or-redrive|wrong/i,
		"message must explicitly counter the 'tell user to downgrade' anti-pattern",
	)
})

test("second tick on the same intent does NOT re-emit 'migrated' (idempotent)", () => {
	const { root, haikuRoot, slug, cleanup } = makeV3Fixture("legacy-2")
	const origCwd = process.cwd()
	try {
		process.chdir(root)
		const first = runWorkflowTick(slug, haikuRoot)
		assert.strictEqual(first?.action?.action, "migrated")
		// Second tick: the intent is now v4-stamped, no migration needed.
		// The cursor walks normally and emits whatever the next action is
		// (likely select_studio, select_mode, or a cursor action — anything
		// EXCEPT 'migrated').
		const second = runWorkflowTick(slug, haikuRoot)
		assert.notStrictEqual(
			second?.action?.action,
			"migrated",
			`second tick should not re-emit 'migrated'; got: ${JSON.stringify(second?.action)}`,
		)
	} finally {
		process.chdir(origCwd)
		cleanup()
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
