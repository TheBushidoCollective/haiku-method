#!/usr/bin/env npx tsx
// Regression for gigsmart/haiku-method#333 bug 1.
//
// `runWorkflowTick` emits selection actions as bare names — `select_studio`,
// `select_mode`, `select_stage`. `haiku_run_next.runSelectionPicker` then
// looks the handler up in `orchestratorToolHandlers`. Before the fix it
// looked up the bare action name, but the registry keys are MCP tool
// names (`haiku_select_studio`). Result: every freshly-created intent
// errored with `Engine bug: no handler registered for selection action
// 'select_studio'` on the post-migration tick.
//
// This test asserts the contract: for each select_* action the cursor
// can return, `haiku_<action>` IS the key registered in the handler map.

import assert from "node:assert"

const { orchestratorToolHandlers } = await import(
	"../src/tools/orchestrator/index.ts"
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
	}
}

console.log("\n=== selection-action handler lookup (regression: #333) ===")

for (const action of ["select_studio", "select_mode", "select_stage"]) {
	test(`${action} resolves to haiku_${action} handler`, () => {
		const tool = orchestratorToolHandlers.get(`haiku_${action}`)
		assert.ok(
			tool,
			`expected handler at key 'haiku_${action}' — broke #333 bug 1 fix`,
		)
		assert.strictEqual(typeof tool.handle, "function")
	})

	test(`${action} bare name is NOT a handler key (would re-introduce #333)`, () => {
		assert.ok(
			!orchestratorToolHandlers.has(action),
			`bare '${action}' should not be a handler key — runSelectionPicker prefixes with 'haiku_'`,
		)
	})
}

console.log("")
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`)
console.log("")

if (failed > 0) process.exit(1)
