// verification-doctrine.test.mjs — the shared runtime-verification
// doctrine block and its injection into runtime-verifier dispatches.
//
// The doctrine rides the engine-built prompt (not a Claude-Code-only
// skill), so it reaches every harness. It's injected ONLY for
// runtime-observation roles (runtime-verifier) — engine roles like
// `spec` and other lenses must not pick it up.

import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")
// Keep sharedBlockRef materialization out of the real home dir.
process.env.HAIKU_PROJECTS_ROOT = mkdtempSync(join(tmpdir(), "haiku-doctrine-"))

const DOCTRINE_TITLE = "Runtime-verification doctrine"

test("runtime-verification shared block is registered and carries the doctrine", async () => {
	const { sharedBlockContent } = await import(
		`${SRC}orchestrator/prompts/_shared/index.ts`
	)
	const body = sharedBlockContent("runtime-verification")
	// Core posture
	assert.match(body, /runtime observation/i, "names verification as runtime observation")
	assert.match(body, /do not run the test suite|don't run tests/i, "bans tests-as-verification")
	// Routes through OUR machinery, and explicitly steers AWAY from CC's.
	assert.match(body, /haiku_view/, "routes web/GUI through haiku_view")
	assert.match(body, /haiku-playwright/, "names the bundled playwright MCP")
	assert.match(
		body,
		/never reach for[\s\S]*?(chromium|\.claude\/skills\/run-)/i,
		"frames Claude-Code-only machinery (chromium-cli / .claude/skills/run-*) as something to AVOID, not use",
	)
	// All surfaces
	for (const surface of ["CLI", "Server", "Library"]) {
		assert.ok(body.includes(surface), `surface taxonomy includes ${surface}`)
	}
	// Boot recipe + verdict
	assert.match(body, /\.haiku\/boot\.md/, "references the project boot recipe")
	for (const v of ["PASS", "FAIL", "BLOCKED", "SKIP"]) {
		assert.ok(body.includes(v), `verdict set includes ${v}`)
	}
})

test("sharedBlockRef('runtime-verification') emits a REQUIRED-reading reference", async () => {
	const { sharedBlockRef } = await import(
		`${SRC}orchestrator/prompts/_shared/index.ts`
	)
	const ref = sharedBlockRef("runtime-verification")
	assert.match(ref, new RegExp(`### ${DOCTRINE_TITLE} \\(REQUIRED reading\\)`))
	assert.match(ref, /\*\*Read\*\* `[^`]*runtime-verification\.md`/)
})

/** Build a dispatch_approval prompt and return the file-backed subagent body. */
async function approvalSubagentBody(role, stage = "development") {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("dispatch_approval")
	const out = builder({
		slug: "demo-intent",
		studio: "software",
		action: { kind: "dispatch_approval", stage, role, units: ["unit-01-foo"] },
	})
	const m = out.match(/prompt_file="([^"]+)"/)
	assert.ok(m, `dispatch_approval must emit a file-backed subagent block for ${role}`)
	return readFileSync(m[1], "utf8")
}

test("dispatch_approval injects the doctrine for the runtime-verifier role", async () => {
	const body = await approvalSubagentBody("runtime-verifier")
	assert.ok(
		body.includes(DOCTRINE_TITLE),
		`runtime-verifier approval subagent must reference the doctrine. got: ${body.slice(0, 600)}`,
	)
})

test("dispatch_approval does NOT inject the doctrine for the engine spec role", async () => {
	const body = await approvalSubagentBody("spec")
	assert.ok(
		!body.includes(DOCTRINE_TITLE),
		"the spec approval (static audit) must not pick up the runtime doctrine",
	)
})

test("intent_review injects the doctrine for the runtime-verifier studio role", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("intent_review")
	const out = builder({
		slug: "demo-intent",
		studio: "software",
		action: { kind: "intent_review", role: "runtime-verifier" },
	})
	const m = out.match(/prompt_file="([^"]+)"/)
	assert.ok(m, "intent_review must emit a file-backed subagent block")
	const body = readFileSync(m[1], "utf8")
	assert.ok(body.includes(DOCTRINE_TITLE), "intent-completion runtime-verifier must reference the doctrine")
	// Evidence-only write carve-out replaces the strict no-write scope.
	assert.match(body, /Write scope \(evidence only\)/, "runtime-verifier gets the proof/ write carve-out")
})

test("cleanup", () => {
	rmSync(process.env.HAIKU_PROJECTS_ROOT, { recursive: true, force: true })
})
