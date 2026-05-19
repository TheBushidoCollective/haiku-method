// drift-cascade-circuit-breaker.test.mjs
//
// Regression for the 2026-05-18 "drift loop on v8→v9 migration" bug
// (haiku-drift-loop-bug bundle). When a stale witness baseline produces
// a cascade of false-positive `input_deletion` drift FBs, the engine
// now refuses to file new ones once the open-FB count exceeds
// `HAIKU_DRIFT_CASCADE_THRESHOLD` (default 10). Slots still get
// restamped — the engine continues its bookkeeping — only the new-FB
// write is suppressed so the agent's fix loop can drain what's queued.
//
// The reported pattern was ~6 new drift FBs per tick, each closing
// cosmetically (the file exists; the witness was stale). Without the
// circuit breaker the queue never drained — new FBs arrived faster
// than agents closed them. The threshold caps total open drift FBs at
// the budget and lets the fix loop catch up.

import assert from "node:assert/strict"
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

function seedStageWithOpenDriftFbs(intentDir, stage, count) {
	const dir = join(intentDir, "stages", stage, "feedback")
	mkdirSync(dir, { recursive: true })
	for (let i = 1; i <= count; i++) {
		const id = String(i).padStart(3, "0")
		writeFileSync(
			join(dir, `${id}-stale-drift.md`),
			[
				"---",
				`title: 'input_deletion drift on file-${id}.md'`,
				"origin: drift",
				"author: engine",
				"author_type: system",
				`source_ref: 'drift:input_deletion:stages/${stage}/file-${id}.md'`,
				"targets:",
				"  unit: null",
				"  invalidates: []",
				"---",
				"body",
				"",
			].join("\n"),
		)
	}
}

test("cascade alarm trips when open drift FBs ≥ threshold; new FBs are suppressed", async () => {
	const { engineHandleDriftEvents } = await import(
		`${SRC}orchestrator/workflow/drift-handle-events.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-drift-cascade-"))
	try {
		const slug = "demo"
		const stage = "design"
		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })

		// Seed the threshold (10) of open drift FBs already on disk —
		// past the alarm-trip line.
		seedStageWithOpenDriftFbs(intentDir, stage, 10)

		// New drift event arrives for a different file. Without the
		// circuit breaker this would file an 11th FB. With it, the
		// new FB is suppressed.
		const result = engineHandleDriftEvents({
			events: [
				{
					unit: "(intent)",
					role: "spec",
					kind: "input_deletion",
					file: "stages/design/artifacts/file-NEW.md",
					since: "2026-05-18T17:00:00Z",
				},
			],
			intentDir,
			stage,
			slug,
		})

		assert.equal(result.cascade_alarm_tripped, true, "alarm must trip")
		assert.equal(result.fbs_filed, 0, "no new FBs filed when alarm is tripped")
		assert.equal(
			result.fbs_cascade_skipped,
			1,
			"new FB must be counted as cascade-skipped",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("alarm does NOT trip below threshold; new FBs file normally", async () => {
	const { engineHandleDriftEvents } = await import(
		`${SRC}orchestrator/workflow/drift-handle-events.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-drift-cascade-"))
	try {
		const slug = "demo"
		const stage = "design"
		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })

		// Seed below threshold (3 open drift FBs vs threshold 10).
		seedStageWithOpenDriftFbs(intentDir, stage, 3)

		const result = engineHandleDriftEvents({
			events: [
				{
					unit: "(intent)",
					role: "spec",
					kind: "input_deletion",
					file: "stages/design/artifacts/file-NEW.md",
					since: "2026-05-18T17:00:00Z",
				},
			],
			intentDir,
			stage,
			slug,
		})

		assert.equal(result.cascade_alarm_tripped, false, "alarm must NOT trip")
		assert.equal(result.fbs_cascade_skipped, 0)
		assert.equal(result.fbs_filed, 1, "new FB must file normally")
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("alarm tripped → slots still get restamped (bookkeeping survives the circuit break)", async () => {
	// The restamp is what neutralizes the drift signal at detect time.
	// Even when the FB write is suppressed, the witness must still be
	// updated so the next sweep doesn't re-emit the same event.
	const { engineHandleDriftEvents } = await import(
		`${SRC}orchestrator/workflow/drift-handle-events.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-drift-cascade-"))
	try {
		const slug = "demo"
		const stage = "design"
		const intentDir = join(tmp, ".haiku", "intents", slug)
		const unitsDir = join(intentDir, "stages", stage, "units")
		mkdirSync(unitsDir, { recursive: true })
		writeFileSync(
			join(unitsDir, "unit-01.md"),
			[
				"---",
				"inputs: []",
				"reviews:",
				"  spec:",
				"    at: '2026-05-18T15:00:00Z'",
				"    body_sha256: 'abc123'",
				"---",
				"body",
				"",
			].join("\n"),
		)

		seedStageWithOpenDriftFbs(intentDir, stage, 10)

		const result = engineHandleDriftEvents({
			events: [
				{
					unit: "unit-01",
					role: "spec",
					kind: "spec",
					file: "stages/design/units/unit-01.md",
					since: "2026-05-18T17:00:00Z",
				},
			],
			intentDir,
			stage,
			slug,
		})

		assert.equal(result.cascade_alarm_tripped, true)
		assert.equal(result.fbs_cascade_skipped, 1)
		assert.equal(
			result.slots_restamped,
			1,
			"slot must be restamped even when FB filing is suppressed",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
