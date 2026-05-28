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
	assert.match(
		body,
		/runtime observation/i,
		"names verification as runtime observation",
	)
	assert.match(
		body,
		/do not run the test suite|don't run tests/i,
		"bans tests-as-verification",
	)
	// Routes through OUR machinery, and explicitly steers AWAY from CC's.
	assert.match(body, /haiku_view/, "routes web/GUI through haiku_view boot")
	assert.match(
		body,
		/haiku-playwright/,
		"names the bundled playwright MCP (now the fallback driver)",
	)
	assert.match(
		body,
		/don't hunt for[\s\S]*?\.claude\/skills\/run-/i,
		"frames Claude-Code-only machinery (.claude/skills/run-*) as something to AVOID, not use",
	)
	// The driver is a self-provisioned Playwright script that records video —
	// NOT the project's own deps, and NOT the MCP as the primary driver.
	assert.match(
		body,
		/Playwright script/i,
		"the web/GUI driver is a written Playwright script",
	)
	assert.match(
		body,
		/record[\s\S]{0,40}video|video[\s\S]{0,40}(record|proof)/i,
		"the script records video of the run",
	)
	assert.match(
		body,
		/never (touch|add)[\s\S]{0,80}(project'?s|package\.json|dependenc)/i,
		"the driver is self-provisioned and never couples to the project's deps",
	)
	// Proof is gitignored binary churn → uploaded to the PR, not committed.
	assert.match(
		body,
		/gitignored/i,
		"proof is framed as gitignored (not committed)",
	)
	assert.match(
		body,
		/upload[\s\S]{0,120}(PR|MR|change request)/i,
		"proof is uploaded to the change request",
	)
	assert.match(
		body,
		/release asset/i,
		"names GitHub release-asset as the upload path (no inline-attachment API)",
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
	// Sign-off is earned by observation, never by intention (2026-05-26):
	// a BLOCKED/can't-run state must HOLD, never decay into a pass, and a
	// recipe / closed finding / green CI is not a substitute for the run.
	assert.match(
		body,
		/Sign-off is earned by observation/i,
		"doctrine spells out that sign-off requires actually running the thing",
	)
	assert.match(
		body,
		/MUST NOT[\s\S]*sign off/i,
		"BLOCKED must withhold sign-off, not pass",
	)
	assert.match(
		body,
		/recipe[\s\S]*is not the run|not itself the verification|clears the obstacle/i,
		"a boot recipe / fix is explicitly NOT the verification",
	)
	// Internal infra must be real; external SaaS may be mocked (2026-05-26):
	// a journey "verified" against a mocked Postgres/Redis verified nothing.
	assert.match(
		body,
		/Internal infrastructure must be real/i,
		"doctrine states internal infra runs real, external SaaS may be mocked",
	)
	for (const real of ["Postgres", "Redis"]) {
		assert.ok(
			body.includes(real),
			`names a real-required internal service: ${real}`,
		)
	}
	for (const ext of ["Stripe", "Twilio"]) {
		assert.ok(body.includes(ext), `names a mockable external SaaS: ${ext}`)
	}
})

test("service-dependencies block forbids mocking internal infra, allows mocking external SaaS", async () => {
	// The boot.md / quality-gate helper doctrine. Same internal-vs-external
	// line as the verifier doctrine: real Postgres/Redis, mockable Stripe/Twilio.
	const { sharedBlockContent } = await import(
		`${SRC}orchestrator/prompts/_shared/index.ts`
	)
	const body = sharedBlockContent("service-dependencies")
	assert.match(
		body,
		/Internal infrastructure runs for real/i,
		"service-dependencies doctrine carries the internal-vs-external rule",
	)
	assert.match(
		body,
		/MUST run for real/i,
		"internal infra MUST run for real (no mock/stub/in-memory)",
	)
	assert.match(
		body,
		/mock|stub|sandbox/i,
		"external SaaS may be mocked/stubbed/sandboxed",
	)
	for (const real of ["Postgres", "Redis"]) {
		assert.ok(
			body.includes(real),
			`names a real-required internal service: ${real}`,
		)
	}
	for (const ext of ["Stripe", "Twilio"]) {
		assert.ok(body.includes(ext), `names a mockable external SaaS: ${ext}`)
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
	assert.ok(
		m,
		`dispatch_approval must emit a file-backed subagent block for ${role}`,
	)
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
	assert.ok(
		body.includes(DOCTRINE_TITLE),
		"intent-completion runtime-verifier must reference the doctrine",
	)
	// runtime-verifier is in BOTH role-classes (RUNTIME_OBSERVATION +
	// PR_INTERACTION), so the scope carve-outs are ADDITIVE — it gets the
	// proof-write block AND the PR-interaction (upload) block, not the old
	// mutually-exclusive "evidence only" heading.
	assert.match(
		body,
		/Write scope \(evidence \+ delivery/i,
		"runtime-verifier gets the combined evidence+delivery write scope",
	)
	assert.match(body, /Proof capture/i, "keeps the proof/ write carve-out")
	assert.match(
		body,
		/PR\/MR interaction/i,
		"ALSO gets the PR-interaction carve-out (uploads proof to the PR)",
	)
	assert.ok(
		!/Write scope \(STRICT\)/.test(body),
		"the strict no-write block must NOT render for a both-sets role",
	)
})

test("cleanup", () => {
	rmSync(process.env.HAIKU_PROJECTS_ROOT, { recursive: true, force: true })
})
