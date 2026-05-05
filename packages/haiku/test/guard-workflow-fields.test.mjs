#!/usr/bin/env npx tsx
// Tests for the guard-workflow-fields PreToolUse hook.
//
// The hook enforces the FSM-ownership boundary: generic file
// Read/Write/Edit/MultiEdit on FSM-managed paths is denied; agents must
// use the MCP tools instead. This is path-boundary based (not content-
// matching) so it can't be bypassed by clever Edit slices and it doesn't
// false-positive on legitimate edits to non-status fields.

import assert from "node:assert"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { guardWorkflowFields } from "../src/hooks/guard-workflow-fields.ts"

const tmp = mkdtempSync(join(tmpdir(), "haiku-guard-test-"))
const origCwd = process.cwd()
process.chdir(tmp)

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		const r = fn()
		if (r && typeof r.then === "function") {
			return r.then(
				() => {
					passed++
					console.log(`  ✓ ${name}`)
				},
				(e) => {
					failed++
					console.log(`  ✗ ${name}: ${e.message}`)
				},
			)
		}
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
	}
}

// The hook calls process.exit(2) on block. Wrap it so tests can assert.
function runGuard(input) {
	const origExit = process.exit
	const origStderr = process.stderr.write.bind(process.stderr)
	let exited = false
	let stderr = ""
	process.exit = (code) => {
		exited = true
		throw new Error(`EXIT:${code}`)
	}
	process.stderr.write = (chunk) => {
		stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8")
		return true
	}
	let error = null
	try {
		const r = guardWorkflowFields(input)
		if (r && typeof r.then === "function")
			return r
				.finally(() => {
					process.exit = origExit
					process.stderr.write = origStderr
				})
				.then(
					() => ({ blocked: exited, stderr }),
					(e) => {
						if (e?.message?.startsWith("EXIT:")) {
							return { blocked: true, stderr }
						}
						throw e
					},
				)
	} catch (e) {
		error = e
	}
	process.exit = origExit
	process.stderr.write = origStderr
	if (error) {
		if (error.message.startsWith("EXIT:")) return { blocked: true, stderr }
		throw error
	}
	return { blocked: exited, stderr }
}

try {
	console.log("\n=== guard-workflow-fields: unit file boundary ===")

	await test("Write to unit.md is blocked, redirects to haiku_unit_write", async () => {
		const r = await runGuard({
			tool_name: "Write",
			tool_input: {
				file_path:
					".haiku/intents/test-intent/stages/inception/units/unit-01-foo.md",
				content: "---\nstatus: pending\n---\n",
			},
		})
		assert.ok(r.blocked, "expected blocked")
		assert.ok(
			r.stderr.includes("haiku_unit_write"),
			"redirect message must name the right MCP tool",
		)
		assert.ok(
			r.stderr.includes("unit-01-foo"),
			"redirect message must name the unit",
		)
	})

	await test("Read on unit.md is blocked, redirects to haiku_unit_read", async () => {
		const r = await runGuard({
			tool_name: "Read",
			tool_input: {
				file_path:
					".haiku/intents/test-intent/stages/inception/units/unit-01-foo.md",
			},
		})
		assert.ok(r.blocked, "Read on FSM-managed unit must be blocked")
		assert.ok(r.stderr.includes("haiku_unit_read"))
	})

	await test("Edit on unit.md is blocked, redirects to haiku_unit_set", async () => {
		const r = await runGuard({
			tool_name: "Edit",
			tool_input: {
				file_path:
					".haiku/intents/test-intent/stages/inception/units/unit-01-foo.md",
				old_string: "x",
				new_string: "y",
			},
		})
		assert.ok(r.blocked)
		assert.ok(r.stderr.includes("haiku_unit_set"))
	})

	await test("MultiEdit on unit.md is blocked", async () => {
		const r = await runGuard({
			tool_name: "MultiEdit",
			tool_input: {
				file_path:
					".haiku/intents/test-intent/stages/inception/units/unit-01-foo.md",
				edits: [{ old_string: "a", new_string: "b" }],
			},
		})
		assert.ok(r.blocked)
	})

	console.log("\n=== guard-workflow-fields: feedback file boundary ===")

	await test("Write on stage-scope FB is blocked, redirects to haiku_feedback", async () => {
		const r = await runGuard({
			tool_name: "Write",
			tool_input: {
				file_path:
					".haiku/intents/test-intent/stages/inception/feedback/01-some-finding.md",
				content: "---\nstatus: open\n---\n",
			},
		})
		assert.ok(r.blocked)
		assert.ok(r.stderr.includes("haiku_feedback"))
	})

	await test("Read on intent-scope FB is blocked, redirects to haiku_feedback_read", async () => {
		const r = await runGuard({
			tool_name: "Read",
			tool_input: {
				file_path: ".haiku/intents/test-intent/feedback/01-cross-stage.md",
			},
		})
		assert.ok(r.blocked)
		assert.ok(r.stderr.includes("haiku_feedback_read"))
	})

	await test("Edit on FB is blocked", async () => {
		const r = await runGuard({
			tool_name: "Edit",
			tool_input: {
				file_path:
					".haiku/intents/test-intent/stages/inception/feedback/01-finding.md",
				old_string: "a",
				new_string: "b",
			},
		})
		assert.ok(r.blocked)
	})

	console.log(
		"\n=== guard-workflow-fields: intent and stage-state boundary ===",
	)

	await test("Write on intent.md is blocked", async () => {
		const r = await runGuard({
			tool_name: "Write",
			tool_input: {
				file_path: ".haiku/intents/test-intent/intent.md",
				content: "---\nstatus: active\n---\n",
			},
		})
		assert.ok(r.blocked)
		assert.ok(r.stderr.includes("intent.md"))
	})

	await test("Edit on stage state.json is blocked", async () => {
		const r = await runGuard({
			tool_name: "Edit",
			tool_input: {
				file_path: ".haiku/intents/test-intent/stages/inception/state.json",
				old_string: "active",
				new_string: "completed",
			},
		})
		assert.ok(r.blocked)
		assert.ok(r.stderr.includes("state.json"))
	})

	await test("Write on .haiku/settings.yml is blocked + names haiku_settings_set", async () => {
		const r = await runGuard({
			tool_name: "Write",
			tool_input: {
				file_path: ".haiku/settings.yml",
				content: "studio: software\n",
			},
		})
		assert.ok(r.blocked, "settings.yml writes must be blocked")
		assert.ok(
			r.stderr.includes("haiku_settings_set"),
			"redirect names the haiku_settings_set tool",
		)
	})

	await test("Read on .haiku/settings.yml is blocked + names haiku_settings_get", async () => {
		const r = await runGuard({
			tool_name: "Read",
			tool_input: { file_path: ".haiku/settings.yml" },
		})
		assert.ok(r.blocked, "settings.yml reads route through haiku_settings_get")
		assert.ok(r.stderr.includes("haiku_settings_get"))
	})

	await test("Edit on .haiku/settings.yml is blocked", async () => {
		const r = await runGuard({
			tool_name: "Edit",
			tool_input: {
				file_path: ".haiku/settings.yml",
				old_string: "studio: ideation",
				new_string: "studio: software",
			},
		})
		assert.ok(r.blocked)
	})

	console.log("\n=== guard-workflow-fields: pass-through paths ===")

	await test("Edit on non-haiku file passes through", async () => {
		const r = await runGuard({
			tool_name: "Edit",
			tool_input: {
				file_path: "some/other/file.md",
				old_string: "x",
				new_string: "status: completed",
			},
		})
		assert.ok(!r.blocked, "non-haiku files should not be guarded")
	})

	await test("Read on a hat mandate file passes through", async () => {
		const r = await runGuard({
			tool_name: "Read",
			tool_input: {
				file_path: "plugin/studios/software/stages/inception/hats/verifier.md",
			},
		})
		assert.ok(!r.blocked, "hat mandate files are not FSM-managed state")
	})

	await test("Write on .haiku/worktrees content passes through", async () => {
		// Worktree paths are isolation copies — the FSM owns merge-back, but
		// agents do legitimate authoring inside worktrees during execution.
		const r = await runGuard({
			tool_name: "Write",
			tool_input: {
				file_path: ".haiku/worktrees/test-intent/unit-01/some-source-file.ts",
				content: "...",
			},
		})
		assert.ok(!r.blocked, "non-state worktree files are not boundary-guarded")
	})

	await test("Bash tool is not handled by this hook", async () => {
		// Bash bypass is explicitly out of scope for this hook; a separate
		// soft-warn hook handles audit logging. This test asserts we don't
		// accidentally fire on Bash.
		const r = await runGuard({
			tool_name: "Bash",
			tool_input: {
				command:
					"cat .haiku/intents/test-intent/stages/inception/units/unit-01-foo.md",
			},
		})
		assert.ok(!r.blocked, "Bash is not in this hook's scope")
	})

	console.log(`\n${passed} passed, ${failed} failed\n`)
} finally {
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true })
	process.exit(failed > 0 ? 1 : 0)
}
