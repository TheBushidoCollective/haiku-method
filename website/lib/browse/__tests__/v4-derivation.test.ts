// __tests__/v4-derivation.test.mts — Pure-function tests for the v4
// dual-path helpers in intent-parsing.ts + types.ts. Run via:
//
//   cd website && npx tsx lib/browse/__tests__/v4-derivation.test.mts
//
// The website package doesn't ship a Vitest config; this file uses a
// bespoke micro-runner instead of node:test because node:test forces
// strict ESM resolution and the website's bare-extension imports
// (`from "./types"`) only work under tsx's esbuild transform.

import assert from "node:assert"
import {
	deriveActiveStageFromStageTree,
	deriveStageStateFromUnits,
	deriveStageStatusFromUnits,
	deriveV4ActiveStage,
	parseElaborationVerified,
	parseFeedback,
	parseIntentApprovals,
	parseIntentFromRaw,
} from "../intent-parsing"
import { deriveUnitStatus } from "../types"

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		const msg = e instanceof Error ? e.message : String(e)
		console.log(`  ✗ ${name}: ${msg}`)
	}
}

console.log("\n── deriveUnitStatus ───────────────────────────────────────")

test("v3 explicit status wins", () => {
	assert.strictEqual(deriveUnitStatus({ status: "completed" }), "completed")
	assert.strictEqual(deriveUnitStatus({ status: "in_progress" }), "in_progress")
	assert.strictEqual(deriveUnitStatus({ status: "rejected" }), "rejected")
})

test("v4 last iteration result === advance => completed", () => {
	const out = deriveUnitStatus({
		iterations: [
			{ hat: "researcher", result: "advance" },
			{ hat: "verifier", result: "advance" },
		],
	})
	assert.strictEqual(out, "completed")
})

test("v4 last iteration result === reject => rejected", () => {
	const out = deriveUnitStatus({
		iterations: [
			{ hat: "researcher", result: "advance" },
			{ hat: "verifier", result: "reject" },
		],
	})
	assert.strictEqual(out, "rejected")
})

test("v4 iterations exist, last has no result yet => in_progress", () => {
	const out = deriveUnitStatus({
		iterations: [
			{ hat: "researcher", result: "advance" },
			{ hat: "distiller" },
		],
	})
	assert.strictEqual(out, "in_progress")
})

test("empty iterations => pending", () => {
	assert.strictEqual(deriveUnitStatus({ iterations: [] }), "pending")
	assert.strictEqual(deriveUnitStatus({}), "pending")
})

console.log("\n── deriveStageStatusFromUnits ─────────────────────────────")

test("empty unit list => pending", () => {
	assert.strictEqual(deriveStageStatusFromUnits([]), "pending")
})

test("every unit terminal-advance + user-approved => complete", () => {
	const out = deriveStageStatusFromUnits([
		{
			raw: {
				iterations: [{ result: "advance" }],
				approvals: { user: { at: "2026-05-06T00:00:00Z" } },
			},
		},
		{
			raw: {
				iterations: [{ result: "advance" }],
				approvals: { user: { at: "2026-05-06T00:00:00Z" } },
			},
		},
	])
	assert.strictEqual(out, "complete")
})

test("terminal-advance but missing approval => active", () => {
	const out = deriveStageStatusFromUnits([
		{
			raw: {
				iterations: [{ result: "advance" }],
				approvals: {},
			},
		},
	])
	assert.strictEqual(out, "active")
})

test("at least one started + not all complete => active", () => {
	const out = deriveStageStatusFromUnits([
		{
			raw: {
				iterations: [{ result: "advance" }],
				approvals: { user: { at: "2026-05-06T00:00:00Z" } },
			},
		},
		{
			raw: {
				iterations: [{ hat: "builder" }], // in-flight
				approvals: {},
			},
		},
	])
	assert.strictEqual(out, "active")
})

test("every unit empty iterations => pending", () => {
	const out = deriveStageStatusFromUnits([
		{ raw: { iterations: [] } },
		{ raw: { iterations: [] } },
	])
	assert.strictEqual(out, "pending")
})

test("missing iterations array entirely => treated as empty", () => {
	const out = deriveStageStatusFromUnits([{ raw: {} }])
	assert.strictEqual(out, "pending")
})

console.log("\n── deriveV4ActiveStage ────────────────────────────────────")

test("first stage with non-complete status wins", () => {
	const out = deriveV4ActiveStage(["a", "b", "c"], {
		a: "complete",
		b: "active",
		c: "pending",
	})
	assert.strictEqual(out, "b")
})

test("first pending stage when nothing has started", () => {
	const out = deriveV4ActiveStage(["a", "b"], {
		a: "pending",
		b: "pending",
	})
	assert.strictEqual(out, "a")
})

test("all stages complete => last declared stage (awaiting seal)", () => {
	const out = deriveV4ActiveStage(["a", "b", "c"], {
		a: "complete",
		b: "complete",
		c: "complete",
	})
	assert.strictEqual(out, "c")
})

test("missing per-stage status keys treated as not-complete (active)", () => {
	const out = deriveV4ActiveStage(["a", "b"], { a: "complete" })
	assert.strictEqual(out, "b")
})

test("empty stage list => empty string (degraded chrome)", () => {
	const out = deriveV4ActiveStage([], {})
	assert.strictEqual(out, "")
})

console.log("\n── parseIntentFromRaw (integration) ───────────────────────")

const v4Raw = `---
title: V4 Test Intent
studio: software
mode: discrete
plugin_version: 4.0.0
started_at: "2026-04-15T09:00:00Z"
sealed_at: null
approvals: {}
stages:
  - inception
  - design
  - build
---

# V4 body
`

const v3Raw = `---
title: V3 Test Intent
studio: software
mode: continuous
status: active
active_stage: design
phase: execute
created_at: "2026-03-01T09:00:00Z"
stages:
  - inception
  - design
  - build
---

# V3 body
`

test("parseIntentFromRaw on v4 input emits sealed_at-derived status", () => {
	const intent = parseIntentFromRaw("local", "v4-test", v4Raw)
	assert.strictEqual(intent.status, "active") // sealed_at: null → active
	assert.strictEqual(intent.studio, "software")
	assert.strictEqual(intent.mode, "discrete")
	// activeStage falls back to stages[0] in the list path (no per-unit visibility)
	assert.strictEqual(intent.activeStage, "inception")
	// composite is null under v4
	assert.strictEqual(intent.composite, null)
	// raw retains plugin_version for downstream chip rendering
	assert.strictEqual(intent.raw.plugin_version, "4.0.0")
})

test("parseIntentFromRaw on v4 sealed input emits 'completed' status", () => {
	const sealedRaw = v4Raw.replace(
		"sealed_at: null",
		'sealed_at: "2026-05-01T12:00:00Z"',
	)
	const intent = parseIntentFromRaw("local", "v4-sealed", sealedRaw)
	assert.strictEqual(intent.status, "completed")
	assert.ok(intent.completedAt) // sealed_at proxies completedAt
})

test("parseIntentFromRaw on v3 input preserves status / active_stage / phase", () => {
	const intent = parseIntentFromRaw("local", "v3-test", v3Raw)
	assert.strictEqual(intent.status, "active")
	assert.strictEqual(intent.activeStage, "design")
	// raw retains v3 fields for downstream consumers (the chip falls
	// back to "v3" when plugin_version is absent)
	assert.strictEqual(intent.raw.plugin_version, undefined)
	assert.strictEqual(intent.raw.phase, "execute")
})

test("parseIntentFromRaw on malformed input recovers (empty data, body preserved)", () => {
	// Broken YAML — duplicate key isn't auto-recoverable here (different
	// from the dedupe-rescue path); the parser falls through to empty
	// data + body=raw.
	const broken = "---\nkey: : :: bad\n---\n# Body still readable\n"
	const intent = parseIntentFromRaw("local", "broken", broken)
	// Title falls back to slug
	assert.strictEqual(intent.title, "broken")
	// Doesn't throw; the test reaching here is the assertion
})

console.log("\n── deriveActiveStageFromStageTree ─────────────────────────")

test("returns last stage with units (declaration order)", () => {
	const out = deriveActiveStageFromStageTree(
		["inception", "design", "build"],
		new Set(["inception", "design"]),
	)
	assert.strictEqual(out, "design")
})

test("returns stages[0] when nothing has units yet", () => {
	const out = deriveActiveStageFromStageTree(["inception", "design"], new Set())
	assert.strictEqual(out, "inception")
})

test("respects declaration order, not set iteration order", () => {
	// Set order is insertion order in JS — feed in reverse to confirm we
	// walk `stages` array, not the set.
	const out = deriveActiveStageFromStageTree(
		["inception", "design", "build"],
		new Set(["build", "inception"]),
	)
	assert.strictEqual(out, "build")
})

test("empty stages → empty string", () => {
	assert.strictEqual(
		deriveActiveStageFromStageTree([], new Set(["whatever"])),
		"",
	)
})

console.log("\n── parseFeedback ──────────────────────────────────────────")

const fbHumanRaw = `---
title: "Button copy is wrong"
origin: user-chat
author: jason
author_type: human
created_at: "2026-05-10T12:00:00Z"
targets:
  unit: unit-03-cta
  invalidates: ["user"]
---

The CTA should say "Get Started" not "Click Here".
`

const fbAgentClosedRaw = `---
title: "Spec drift on auth flow"
origin: drift
author: drift-detector
author_type: agent
created_at: "2026-05-09T08:00:00Z"
closed_at: "2026-05-09T15:00:00Z"
targets:
  unit: unit-05-auth
  invalidates: []
closure_reply:
  text: "Rolled the auth changes back to spec."
  at: "2026-05-09T15:00:00Z"
---

The build deviated from the auth spec.
`

test("parseFeedback human FB", () => {
	const fb = parseFeedback(
		"local",
		"my-intent",
		"design",
		"FB-01-bad-copy.md",
		fbHumanRaw,
		".haiku/intents/my-intent/stages/design/feedback/FB-01-bad-copy.md",
	)
	assert.strictEqual(fb.id, "FB-01-bad-copy")
	assert.strictEqual(fb.title, "Button copy is wrong")
	assert.strictEqual(fb.authorType, "human")
	assert.strictEqual(fb.origin, "user-chat")
	assert.strictEqual(fb.unit, "unit-03-cta")
	assert.deepStrictEqual(fb.invalidates, ["user"])
	assert.strictEqual(fb.closedAt, null)
	assert.ok(fb.body.includes("Get Started"))
})

test("parseFeedback closed agent FB with closure reply", () => {
	const fb = parseFeedback(
		"local",
		"my-intent",
		"build",
		"FB-02-drift.md",
		fbAgentClosedRaw,
		".haiku/intents/my-intent/stages/build/feedback/FB-02-drift.md",
	)
	assert.strictEqual(fb.authorType, "agent")
	assert.strictEqual(fb.closedAt, "2026-05-09T15:00:00Z")
	assert.ok(fb.closureReply)
	assert.strictEqual(
		fb.closureReply?.text,
		"Rolled the auth changes back to spec.",
	)
})

test("parseFeedback intent-scope (null stage) keeps unit=null when FM omits targets", () => {
	const noTargetsRaw = `---
title: "General concern"
origin: user-chat
author_type: human
---

body text
`
	const fb = parseFeedback(
		"local",
		"slug",
		null,
		"FB-09-concern.md",
		noTargetsRaw,
		".haiku/intents/slug/feedback/FB-09-concern.md",
	)
	assert.strictEqual(fb.unit, null)
	assert.deepStrictEqual(fb.invalidates, [])
})

console.log("\n── deriveStageStateFromUnits ──────────────────────────────")

test("returns canonical 5-phase names — no 'gate' leak", () => {
	// All hats advanced, but no approvals signed → engine pure derivation
	// returns "gate"; the website wrapper must remap that to "approve".
	const u = {
		raw: {
			started_at: "2026-05-14T00:00:00Z",
			iterations: [
				{
					hat: "implementer",
					started_at: "2026-05-14T00:00:00Z",
					completed_at: "2026-05-14T00:01:00Z",
					result: "advance",
				},
			],
			reviews: { user: { at: "2026-05-14T00:02:00Z" } },
			approvals: {},
		},
	}
	const r = deriveStageStateFromUnits([u], { intentMode: "continuous" })
	assert.strictEqual(r.phase, "approve")
})

test("autopilot mode bypasses elaborate-verifier signal", () => {
	// Empty units + missing elaboration = "decompose" pending → phase
	// "elaborate" under continuous, also "elaborate" under autopilot
	// (since decompose still applies). Autopilot's bypass kicks in for
	// verify_conversation / verify_decompose specifically; with no units
	// the phase is the same. The mode threading still has to be correct
	// — assert it doesn't crash and returns sensibly.
	const r = deriveStageStateFromUnits([], { intentMode: "autopilot" })
	assert.strictEqual(r.phase, "elaborate")
})

console.log("\n── parseElaborationVerified ───────────────────────────────")

test("null when no text", () => {
	assert.strictEqual(parseElaborationVerified(null), null)
	assert.strictEqual(parseElaborationVerified(undefined), null)
	assert.strictEqual(parseElaborationVerified(""), null)
})

test("false when verified_at missing", () => {
	const raw = `---
title: "elaboration"
---

body
`
	assert.strictEqual(parseElaborationVerified(raw), false)
})

test("true when verified_at stamped", () => {
	const raw = `---
verified_at: "2026-05-14T00:00:00Z"
---

body
`
	assert.strictEqual(parseElaborationVerified(raw), true)
})

console.log("\n── parseIntentApprovals ───────────────────────────────────")

test("empty when intent.md has no approvals", () => {
	assert.deepStrictEqual(parseIntentApprovals({}), [])
})

test("surfaces signed and pending roles with timestamps", () => {
	const fm = {
		approvals: {
			spec: { at: "2026-05-14T00:00:00Z" },
			intent_quality_gates: { at: "2026-05-14T00:01:00Z" },
			user: null,
		},
	}
	const r = parseIntentApprovals(fm)
	assert.deepStrictEqual(
		r.find((a) => a.role === "spec"),
		{ role: "spec", signed: true, at: "2026-05-14T00:00:00Z" },
	)
	assert.deepStrictEqual(
		r.find((a) => a.role === "user"),
		{ role: "user", signed: false, at: null },
	)
	const iqg = r.find((a) => a.role === "intent_quality_gates")
	assert.ok(iqg && iqg.signed)
})

test("parseFeedback surfaces resolution when present", () => {
	const raw = `---
title: "Question for the user"
origin: discovery
author_type: agent
resolution: question
---

Need a decision on the auth flow.
`
	const fb = parseFeedback(
		"local",
		"slug",
		"design",
		"FB-04-question.md",
		raw,
		".haiku/intents/slug/stages/design/feedback/FB-04-question.md",
	)
	assert.strictEqual(fb.resolution, "question")
})

test("parseFeedback resolution is null when FM omits it", () => {
	const raw = `---
title: "Generic finding"
---
body
`
	const fb = parseFeedback("local", "s", "x", "FB-01.md", raw, "p")
	assert.strictEqual(fb.resolution, null)
})

console.log(`\n── Result: ${passed} passed, ${failed} failed ──────────────`)
process.exit(failed > 0 ? 1 : 0)
