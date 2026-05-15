#!/usr/bin/env npx tsx
// Atomicity test for forceStageComplete.
//
// When a stage has a mix of terminal-advance and non-terminal units, the
// op MUST refuse the entire request without writing anything. Earlier
// versions wrote partial signatures to the terminal units before the
// refusal check fired — the user reading the error response saw
// `partial_signed: N` but the on-disk state had already been mutated for
// those N units, which made re-running the op produce a different result
// than the first call. The two-pass design fixes this.
//
// Also asserts the renamed result field: `signed: 0` (was: ambiguous
// `partial_signed`) on refusal, signaling clearly that nothing was
// written.
//
// Run: npx tsx test/debug-ops-atomicity.test.mjs

import assert from "node:assert"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const tmp = mkdtempSync(join(tmpdir(), "haiku-debug-atomicity-"))
const projDir = join(tmp, "project")
const haikuRoot = join(projDir, ".haiku")
const intentSlug = "atomicity-test"
const intentDirPath = join(haikuRoot, "intents", intentSlug)

mkdirSync(join(intentDirPath, "stages", "design", "units"), { recursive: true })

// Stand up a local studio under .haiku/studios/ so resolveStudioStages
// finds the stage list without depending on the plugin's bundled studios.
mkdirSync(join(haikuRoot, "studios", "atomicity-studio", "stages", "design"), {
	recursive: true,
})
writeFileSync(
	join(haikuRoot, "studios", "atomicity-studio", "STUDIO.md"),
	`---
name: atomicity-studio
slug: atomicity-studio
description: Test studio
stages: [design]
category: testing
default_model: sonnet
---

Test studio.
`,
)
writeFileSync(
	join(
		haikuRoot,
		"studios",
		"atomicity-studio",
		"stages",
		"design",
		"STAGE.md",
	),
	`---
name: design
hats: [planner, implementer, verifier]
---

Test stage.
`,
)

writeFileSync(
	join(intentDirPath, "intent.md"),
	`---
title: Atomicity test
studio: atomicity-studio
mode: continuous
status: active
stages:
  - design
created_at: 2026-05-15T12:00:00Z
---
`,
)

// Two units in the same stage: one with iterations[].result === "advance"
// (eligible for sign), one without (must refuse the whole op).
writeFileSync(
	join(intentDirPath, "stages", "design", "units", "unit-01-ready.md"),
	`---
unit_id: unit-01
iterations:
  - hat: planner
    result: advance
  - hat: implementer
    result: advance
  - hat: verifier
    result: advance
---
ready unit body
`,
)
writeFileSync(
	join(intentDirPath, "stages", "design", "units", "unit-02-stalled.md"),
	`---
unit_id: unit-02
iterations:
  - hat: planner
    result: reject
---
stalled unit body
`,
)

process.chdir(projDir)

const { forceStageComplete } = await import(
	"../src/orchestrator/workflow/debug-ops.ts"
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
		if (process.env.VERBOSE) console.log(e.stack)
	}
}

console.log("\n=== forceStageComplete atomicity ===")

// Snapshot both unit files before the call.
const ready_before = readFileSync(
	join(intentDirPath, "stages", "design", "units", "unit-01-ready.md"),
	"utf8",
)
const stalled_before = readFileSync(
	join(intentDirPath, "stages", "design", "units", "unit-02-stalled.md"),
	"utf8",
)

const result = forceStageComplete({ slug: intentSlug, targetStage: "design" })

test("returns ok:false with units_not_terminal_advance", () => {
	assert.strictEqual(result.ok, false)
	if (result.ok === false) {
		assert.strictEqual(result.error, "units_not_terminal_advance")
		assert.ok(result.details, "details must be present")
		const details = result.details
		assert.strictEqual(details.signed, 0)
		assert.ok(Array.isArray(details.refusedUnits))
		assert.strictEqual(details.refusedUnits.length, 1)
		assert.strictEqual(details.refusedUnits[0].unit, "unit-02-stalled.md")
	}
})

test("ready unit was NOT signed (atomicity — no partial writes)", () => {
	const ready_after = readFileSync(
		join(intentDirPath, "stages", "design", "units", "unit-01-ready.md"),
		"utf8",
	)
	assert.strictEqual(
		ready_after,
		ready_before,
		"unit-01 file content must be byte-identical to before the call",
	)
	// Defensive double-check: the FM must NOT have grown a `reviews:` or
	// `approvals:` key.
	assert.ok(
		!/^reviews:/m.test(ready_after),
		"unit-01 must not have grown a `reviews:` key",
	)
	assert.ok(
		!/^approvals:/m.test(ready_after),
		"unit-01 must not have grown an `approvals:` key",
	)
})

test("stalled unit was NOT touched", () => {
	const stalled_after = readFileSync(
		join(intentDirPath, "stages", "design", "units", "unit-02-stalled.md"),
		"utf8",
	)
	assert.strictEqual(stalled_after, stalled_before)
})

// ── close_open_feedback option ────────────────────────────────────────
//
// Open FBs continue blocking the cursor even after every approval is
// signed. The opt-in option stamps closed_at + closed_by: "force_complete"
// on every open FB on the targeted stages — no `status: closed` write
// (v4 derives status from closed_at / closed_by).

console.log("\n=== forceStageComplete close_open_feedback ===")

// Make unit-02 also terminal-advance so the "all units terminal" pass
// check succeeds and we exercise the post-sign FB closure path.
writeFileSync(
	join(intentDirPath, "stages", "design", "units", "unit-02-stalled.md"),
	`---
unit_id: unit-02
iterations:
  - hat: planner
    result: advance
  - hat: implementer
    result: advance
  - hat: verifier
    result: advance
---
now-ready unit body
`,
)

// Add three FBs — one open, one already closed (closed_at), one already
// closed via closed_by. Only the open one should be touched.
mkdirSync(join(intentDirPath, "stages", "design", "feedback"), {
	recursive: true,
})
writeFileSync(
	join(intentDirPath, "stages", "design", "feedback", "001-open-fb.md"),
	`---
title: Open finding
origin: agent
created_at: 2026-05-15T10:00:00Z
---
Body of the open finding.
`,
)
writeFileSync(
	join(intentDirPath, "stages", "design", "feedback", "002-already-closed.md"),
	`---
title: Already-closed finding
origin: agent
created_at: 2026-05-15T10:00:00Z
closed_at: 2026-05-15T11:00:00Z
---
Body of the already-closed finding.
`,
)
writeFileSync(
	join(intentDirPath, "stages", "design", "feedback", "003-closed-by.md"),
	`---
title: Closed-by-someone finding
origin: agent
created_at: 2026-05-15T10:00:00Z
closed_by: feedback-assessor
---
Body.
`,
)

const closeRes = forceStageComplete({
	slug: intentSlug,
	targetStage: "design",
	closeOpenFeedback: true,
})

test("returns ok:true with feedback_closed === 2 (open + closed_by-only)", () => {
	// FB-001 (truly open) and FB-003 (closed_by but no closed_at — still
	// open from the cursor's POV) both get closed_at stamped. FB-002
	// (closed_at already set) is skipped. Earlier versions counted only
	// FB-001 because they treated closed_by alone as closed.
	assert.strictEqual(closeRes.ok, true)
	if (closeRes.ok === true) {
		assert.strictEqual(closeRes.result.feedback_closed, 2)
		assert.strictEqual(closeRes.result.units_signed, 2)
	}
})

test("open FB now has closed_at + closed_by: force_complete (NO status write)", () => {
	const openFbAfter = readFileSync(
		join(intentDirPath, "stages", "design", "feedback", "001-open-fb.md"),
		"utf8",
	)
	assert.match(openFbAfter, /^closed_at: /m)
	assert.match(openFbAfter, /^closed_by: force_complete$/m)
	// Status field MUST NOT be written — v4 derives it.
	assert.ok(
		!/^status:/m.test(openFbAfter),
		"force_complete must not write a status field — v4 derives status from closed_at / closed_by",
	)
})

test("already-closed FB (closed_at) is NOT touched", () => {
	const fbAfter = readFileSync(
		join(
			intentDirPath,
			"stages",
			"design",
			"feedback",
			"002-already-closed.md",
		),
		"utf8",
	)
	// Original closed_at value must be preserved (not overwritten with now()).
	assert.match(fbAfter, /^closed_at: 2026-05-15T11:00:00Z$/m)
	assert.ok(
		!/closed_by: force_complete/.test(fbAfter),
		"already-closed FB must not get force_complete provenance",
	)
})

test("elaboration.md synthesized when missing — cursor walks past elaborate", () => {
	// The atomicity-test fixture never wrote elaboration.md. After the
	// successful close run above (units_signed === 2), the debug op should
	// have synthesized stages/design/elaboration.md with both verified_at
	// and decompose_verified_at stamps so the cursor doesn't sit at
	// `elaborate` waiting for the verifier subagent that's never coming
	// in a recovery scenario.
	assert.strictEqual(closeRes.ok, true)
	if (closeRes.ok === true) {
		assert.strictEqual(
			closeRes.result.elaborations_sealed,
			1,
			"design stage should have its elaboration synthesized",
		)
	}
	const elabPath = join(intentDirPath, "stages", "design", "elaboration.md")
	const elabContent = readFileSync(elabPath, "utf8")
	assert.match(elabContent, /^recorded_at: /m)
	assert.match(elabContent, /^verified_at: /m)
	assert.match(elabContent, /^decompose_verified_at: /m)
	assert.match(elabContent, /synthesized_by: force_complete/)
})

test("already-closed FB (closed_by) IS stamped with closed_at — closed_by alone is not closure", () => {
	// Regression: earlier versions skipped FBs that had closed_by but no
	// closed_at, treating closed_by-alone as "already closed". The cursor
	// truth is closed_at — closed_by alone is "claimed but unverified",
	// which still blocks the gate. force_complete now stamps closed_at on
	// these FBs while preserving the existing closed_by provenance.
	const fbAfter = readFileSync(
		join(intentDirPath, "stages", "design", "feedback", "003-closed-by.md"),
		"utf8",
	)
	assert.match(
		fbAfter,
		/^closed_by: feedback-assessor$/m,
		"existing closed_by provenance must be preserved (no overwrite with force_complete)",
	)
	assert.match(
		fbAfter,
		/^closed_at: /m,
		"closed_at must be stamped — closed_by alone wasn't enough",
	)
})

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
