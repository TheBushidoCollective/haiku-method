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
	join(haikuRoot, "studios", "atomicity-studio", "stages", "design", "STAGE.md"),
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

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
