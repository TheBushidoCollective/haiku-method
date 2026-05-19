// drift-untracked-surface-suppression.test.mjs
//
// Regression for the 2026-05-18 migration-drift flood
// (haiku-fix-loop-bug bundle, admin-portal-reimagine/design — FB-109,
// FB-110, FB-111, FB-129, FB-130, FB-131 and counting).
//
// Root cause: the v8→v9 plugin migration left stale `input_deletion`
// witnesses pointing at stage-root spec files (`DESIGN-BRIEF.md`,
// `THREAT-MODEL.md`, etc.). These paths live OUTSIDE the drift-tracked
// surface (`stages/<X>/{artifacts,outputs,knowledge,discovery}/...`
// and intent-root `knowledge/...`). When the sweep emits drift events
// for them, `engineHandleDriftEvents` files agent-facing FBs, but
// `haiku_record_agent_write` refuses to baseline against an
// untrackable path (`not_in_tracked_surface`). Result: the fix loop
// has no tool to close the FB, the classifier rejects, the cursor
// re-dispatches, and the user watches the queue grow.
//
// Fix: in `engineHandleDriftEvents`, before filing a new FB, check the
// witnessed path against the same tracked-surface predicate
// `haiku_record_agent_write` uses. If the path is untrackable, skip
// FB filing (the restamp already ran — the stale inventory entry is
// gone from the slot's input_witnesses). The path drops out naturally
// on subsequent sweeps; no agent-facing churn.

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

function seedMinimalIntent({ tmp, slug, stage, unit }) {
	const intentDir = join(tmp, ".haiku", "intents", slug)
	const unitsDir = join(intentDir, "stages", stage, "units")
	mkdirSync(unitsDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		"---\nstudio: software\n---\nbody\n",
	)
	// Unit with a signed review whose input_witnesses references a
	// stage-root spec file (outside the tracked surface). Whether the
	// file resolves or not, the FB filing path must be untrackable.
	writeFileSync(
		join(unitsDir, `${unit}.md`),
		[
			"---",
			"inputs: ['stages/design/DESIGN-BRIEF.md']",
			"started_at: '2026-05-18T14:00:00Z'",
			"reviews:",
			"  spec:",
			"    at: '2026-05-18T15:00:00Z'",
			"    body_sha256: 'unitbodysha'",
			"    input_witnesses:",
			"      files:",
			"        stages/design/DESIGN-BRIEF.md: 'a1b2c3d4e5f6'",
			"      dirs: {}",
			"---",
			"body",
			"",
		].join("\n"),
	)
	return intentDir
}

test("input_deletion on untracked-surface path → restamp runs, no FB filed", async () => {
	const { engineHandleDriftEvents } = await import(
		`${SRC}orchestrator/workflow/drift-handle-events.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-untracked-drift-"))
	try {
		const intentDir = seedMinimalIntent({
			tmp,
			slug: "demo",
			stage: "design",
			unit: "unit-01",
		})
		// Synthetic event: stage-root DESIGN-BRIEF.md is the witnessed
		// path, and it doesn't resolve (the migration moved it).
		const summary = engineHandleDriftEvents({
			events: [
				{
					unit: "unit-01",
					role: "spec",
					kind: "input_deletion",
					file: "stages/design/DESIGN-BRIEF.md",
					since: "2026-05-18T15:00:00Z",
				},
			],
			intentDir,
			stage: "design",
			slug: "demo",
		})
		assert.equal(
			summary.fbs_filed,
			0,
			`MUST NOT file an FB for an input_deletion on an untrackable path (the agent has no tool to clear it). got fbs_filed=${summary.fbs_filed}, summary=${JSON.stringify(summary)}`,
		)
		assert.equal(
			summary.fbs_untracked_skipped,
			1,
			`the untracked-surface skip counter must increment so the suppression is observable in telemetry. summary=${JSON.stringify(summary)}`,
		)
		assert.ok(
			summary.slots_restamped >= 1,
			`the restamp MUST still run so the stale inventory entry drops out of the witness. summary=${JSON.stringify(summary)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("input_deletion on tracked-surface path STILL files an FB (control)", async () => {
	const { engineHandleDriftEvents } = await import(
		`${SRC}orchestrator/workflow/drift-handle-events.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-untracked-drift-"))
	try {
		const intentDir = seedMinimalIntent({
			tmp,
			slug: "demo",
			stage: "design",
			unit: "unit-01",
		})
		// Same shape but the witnessed path lives under artifacts/ —
		// a tracked surface. The agent CAN baseline this path, so
		// filing the FB is the right move.
		const summary = engineHandleDriftEvents({
			events: [
				{
					unit: "unit-01",
					role: "spec",
					kind: "input_deletion",
					file: "stages/design/artifacts/something.md",
					since: "2026-05-18T15:00:00Z",
				},
			],
			intentDir,
			stage: "design",
			slug: "demo",
		})
		assert.equal(
			summary.fbs_filed,
			1,
			`tracked-surface drift MUST still file an FB (don't over-suppress). summary=${JSON.stringify(summary)}`,
		)
		assert.equal(
			summary.fbs_untracked_skipped ?? 0,
			0,
			`tracked-surface paths must NOT count as untracked-skipped. summary=${JSON.stringify(summary)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
