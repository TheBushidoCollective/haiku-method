// fb-terminal-rejected-no-redispatch.test.mjs
//
// Regression for the 2026-05-18 "terminal-rejected FB stuck in
// classifier dispatch loop" bug (haiku-bug-fb111-stuck-loop bundle,
// admin-portal-reimagine/design FB-111).
//
// Root cause: `isFbClosed` only matched the closure signals
// (`closed_at`, `status: closed`, `closed_by: fix-loop:*`). A
// manually-rejected FB (`status: rejected`, `rejected_at` set) fell
// through the gate and the cursor kept dispatching the classifier
// against it. Both `haiku_feedback_advance_hat` and
// `haiku_feedback_reject_hat` refused with `lifecycle_violation`
// (correctly — the FB is terminal) so the subagent terminated without
// stamping any on-disk progress. The next cursor walk saw the same
// state and re-dispatched. After N identical signatures the loop guard
// fired `loop_halted`, wedging the WHOLE intent (including unrelated
// open FBs that were advancing normally).
//
// Fix: rename `isFbClosed` → `isFbTerminal` and add `rejected_at` +
// `status === "rejected"` to the signal set. Any one terminal signal
// is sufficient to skip dispatch.

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

test("cursor skips FB with status: rejected (terminal — no further dispatch)", async () => {
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-rejected-"))
	try {
		const fbPath = join(tmp, "111-drift.md")
		// Exact FB-111 shape from the bug bundle: drift-origin FB that
		// was manually rejected. status: rejected, rejected_at set.
		// closed_at is NOT set (rejection isn't closure under v4 FB
		// derivation).
		writeFbFile(
			fbPath,
			[
				"author: engine",
				"author_type: system",
				"origin: drift",
				"status: rejected",
				"rejected_at: '2026-05-18T17:25:02.503Z'",
				"targets:",
				"  unit: unit-07",
				"  invalidates: []",
				"iterations:",
				"  - bolt: 1",
				"    hat: classifier",
				"    result: advanced",
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
			`cursor MUST skip a terminal-rejected FB. Pre-fix this returned start_feedback_hat for hat=classifier and triggered the loop guard. got: ${JSON.stringify(action)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("cursor skips FB with rejected_at but no status field", async () => {
	// Belt-and-suspenders: an older FB writer might stamp
	// `rejected_at` without setting the status string. The terminal
	// predicate must catch that too.
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-rejected-"))
	try {
		const fbPath = join(tmp, "112-drift.md")
		writeFbFile(
			fbPath,
			[
				"author: engine",
				"author_type: system",
				"origin: drift",
				"rejected_at: '2026-05-18T17:25:02.503Z'",
				"targets:",
				"  unit: unit-07",
				"  invalidates: []",
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
			`rejected_at alone MUST skip the FB. got: ${JSON.stringify(action)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("cursor still dispatches OPEN FBs (no false-positive skip)", async () => {
	// Control: a pending FB (no terminal signals) must still get
	// dispatched. The predicate should be conservative — only skip
	// when at least one terminal signal is present.
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-rejected-"))
	try {
		const fbPath = join(tmp, "113-drift.md")
		writeFbFile(
			fbPath,
			[
				"author: engine",
				"author_type: system",
				"origin: drift",
				"status: pending",
				"targets:",
				"  unit: unit-07",
				"  invalidates: []",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"design",
			fbPath,
			"software",
		)
		assert.ok(
			action !== null,
			`open FB must still dispatch — got null (false-positive terminal skip)`,
		)
		assert.equal(
			action.kind,
			"start_feedback_hat",
			`open FB should produce start_feedback_hat, got ${action.kind}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
