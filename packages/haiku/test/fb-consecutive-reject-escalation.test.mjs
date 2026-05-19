// fb-consecutive-reject-escalation.test.mjs
//
// Regression for the 2026-05-18 classifier reject loop
// (haiku-fix-loop-bug bundle, admin-portal-reimagine/design FB-111).
//
// Root cause: when a classifier hat (idx 0 in fix_hats) rejects, the
// cursor's `nextHatForUnit` re-dispatches the same first hat — there's
// no prior hat to fall back to. Same input → same answer → same reject.
// Infinite loop. The bolt-cap eventually fires, but only after burning
// through MAX_FIX_LOOP_BOLTS distinct bolts; in the bug report, bolts
// reached 4 because reject-without-advance doesn't always bump the
// counter.
//
// Fix: in `nextActionForFeedback`, detect "≥2 immediately-consecutive
// `rejected` iterations on the SAME hat" and refuse further dispatch
// (return null). The FB stays open and surfaces as escalated via the
// same path the bolt-cap uses; a human breaks the tie. The classifier
// no longer burns subagent budget bouncing off the same finding.

import assert from "node:assert/strict"
import {
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

function writeFbFile(path, fmYaml) {
	writeFileSync(path, `---\n${fmYaml}\n---\nbody\n`)
}

async function importCursor() {
	return import(`${SRC}orchestrator/workflow/cursor.ts`)
}

test("two consecutive rejected iterations on the same hat → escalate (no re-dispatch)", async () => {
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-stuck-"))
	try {
		const fbPath = join(tmp, "001-fb.md")
		// Agent-authored FB with classifier rejecting twice in a row on
		// bolts 3 and 4 — the exact footprint from the bug report
		// (FB-111: "Re-dispatched same hat" then "Rejected again —
		// cosmetic"). Pre-fix, nextHatForUnit would return classifier
		// again (idx=0 has no prior hat to fall back to), the dispatch
		// would re-fire, the subagent would reject for the third time,
		// and so on until MAX_FIX_LOOP_BOLTS was reached.
		writeFbFile(
			fbPath,
			[
				"author: agent",
				"author_type: agent",
				"origin: drift",
				"targets:",
				"  unit: unit-07",
				"  invalidates: []",
				"iterations:",
				"  - bolt: 1",
				"    hat: classifier",
				"    result: advanced",
				"  - bolt: 1",
				"    hat: designer",
				"    result: advanced",
				"  - bolt: 2",
				"    hat: feedback-assessor",
				"    result: rejected",
				"  - bolt: 3",
				"    hat: classifier",
				"    result: rejected",
				"  - bolt: 4",
				"    hat: classifier",
				"    result: rejected",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"design",
			fbPath,
			"software",
		)
		assert.equal(
			action,
			null,
			`two consecutive same-hat rejects MUST escalate (return null). Pre-fix this returned start_feedback_hat for hat=classifier and burned another bolt. got: ${JSON.stringify(action)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("single same-hat reject (not consecutive) still re-dispatches normally", async () => {
	// Control: ONE rejected iteration on a hat should still trigger the
	// normal reject path (re-dispatch the previous hat, or the same hat
	// if it's first). Don't break the fix loop's normal recovery.
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-stuck-"))
	try {
		const fbPath = join(tmp, "002-fb.md")
		writeFbFile(
			fbPath,
			[
				"author: agent",
				"author_type: agent",
				"origin: adversarial-review",
				"targets:",
				"  unit: unit-01",
				"  invalidates: [spec]",
				"iterations:",
				"  - bolt: 1",
				"    hat: classifier",
				"    result: rejected",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"design",
			fbPath,
			"software",
		)
		assert.ok(
			action !== null,
			`single same-hat reject must still re-dispatch (only 2+ consecutive should escalate). got null`,
		)
		assert.equal(
			action.kind,
			"start_feedback_hat",
			`single reject should produce start_feedback_hat, got ${action.kind}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("two consecutive rejects on DIFFERENT hats still re-dispatch (don't over-trigger)", async () => {
	// Control: rejections on different hats represent the normal
	// rewind-and-retry pattern. Only same-hat consecutive rejects
	// indicate a stuck-and-can't-progress state.
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-stuck-"))
	try {
		const fbPath = join(tmp, "003-fb.md")
		writeFbFile(
			fbPath,
			[
				"author: agent",
				"author_type: agent",
				"origin: adversarial-review",
				"targets:",
				"  unit: unit-01",
				"  invalidates: [spec]",
				"iterations:",
				"  - bolt: 1",
				"    hat: feedback-assessor",
				"    result: rejected",
				"  - bolt: 2",
				"    hat: designer",
				"    result: rejected",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"design",
			fbPath,
			"software",
		)
		assert.ok(
			action !== null,
			`different-hat consecutive rejects must still re-dispatch. got null`,
		)
		assert.equal(
			action.kind,
			"start_feedback_hat",
			`different-hat reject should produce start_feedback_hat, got ${action.kind}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("human-authored FB bypasses stuck-reject escalation (humans drive their own resolution)", async () => {
	// Same exemption as the bolt-cap: a human author expects to drive
	// the FB through to whatever conclusion they want, including bouncing
	// off the same hat repeatedly until they tell it to stop.
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-stuck-"))
	try {
		const fbPath = join(tmp, "004-fb.md")
		writeFbFile(
			fbPath,
			[
				"author: jwaldrip",
				"author_type: human",
				"origin: user-chat",
				"targets:",
				"  unit: unit-01",
				"  invalidates: [spec]",
				"iterations:",
				"  - bolt: 3",
				"    hat: classifier",
				"    result: rejected",
				"  - bolt: 4",
				"    hat: classifier",
				"    result: rejected",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"design",
			fbPath,
			"software",
		)
		assert.ok(
			action !== null,
			`human-authored FB must continue dispatching even on consecutive same-hat rejects. got null`,
		)
		assert.equal(
			action.kind,
			"start_feedback_hat",
			`human-authored stuck FB should still produce start_feedback_hat, got ${action.kind}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
