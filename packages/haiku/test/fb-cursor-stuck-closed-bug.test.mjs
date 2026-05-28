// fb-cursor-stuck-closed-bug.test.mjs
//
// Regression for the 2026-05-18 "cursor stuck dispatching closed FB"
// bug (haiku-bug-fb-cursor-stuck-2026-05-18 bundle).
//
// Root cause: `nextActionForFeedback` checked closure with
// `typeof fm.closed_at === "string" && fm.closed_at.length > 0`.
// When the FB on disk had an unquoted ISO timestamp
// (`closed_at: 2026-05-18T14:46:18.472Z` without quotes), gray-matter
// parses it as a Date object. The typeof check fails, the FB falls
// through the closure guard, and the cursor returns `start_feedback_hat`
// with `hat: classifier` (the first fix-hat) on every tick. The
// subagent dispatched then calls advance_hat against the already-closed
// FB and gets `lifecycle_violation`. Infinite re-dispatch.
//
// Fix layers locked here:
//   1. `isFbClosed(fm)` in cursor.ts — accepts string OR Date for
//      closed_at, plus checks `status === "closed"` and
//      `closed_by` starts with "fix-loop:". Any one signal skips.
//   2. Defensive filter in start_feedback_hat dispatch builder — even
//      if a future regression lets a closed FB through the cursor,
//      the dispatch refuses to spawn a subagent that would loop.

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

/** Build a stage-scope feedback file at the given path with the given
 *  YAML frontmatter body (verbatim, so the test controls quoting). */
function writeFbFile(path, fmYaml) {
	writeFileSync(path, `---\n${fmYaml}\n---\nbody\n`)
}

async function importCursor() {
	return import(`${SRC}orchestrator/workflow/cursor.ts`)
}

test("cursor skips closed FB even when closed_at is parsed as Date (unquoted YAML)", async () => {
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-bug-"))
	try {
		const fbPath = join(tmp, "001-fb.md")
		// EXACT bug shape: unquoted ISO timestamps → gray-matter
		// parses closed_at as Date. Pre-fix typeof check missed this.
		writeFbFile(
			fbPath,
			[
				"status: closed",
				"closed_at: 2026-05-18T14:46:18.472Z",
				"closed_by: 'fix-loop:FB-001:bolt-1'",
				"targets:",
				"  unit: unit-01",
				"  invalidates: [spec]",
				"closure_reply_unread: true",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"security",
			fbPath,
			"software",
		)
		assert.equal(
			action,
			null,
			`cursor MUST skip a closed FB regardless of closed_at type. Pre-fix this returned start_feedback_hat for hat=classifier. got: ${JSON.stringify(action)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("cursor skips closed FB via status fallback (no closed_at, no iterations)", async () => {
	// Belt-and-suspenders: even if closed_at and iterations are both
	// missing/empty, `status: closed` alone must short-circuit the
	// dispatch.
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-bug-"))
	try {
		const fbPath = join(tmp, "002-fb.md")
		writeFbFile(
			fbPath,
			[
				"status: closed",
				"targets:",
				"  unit: unit-04",
				"  invalidates: [spec]",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"security",
			fbPath,
			"software",
		)
		assert.equal(
			action,
			null,
			`status: closed alone MUST skip the FB. got: ${JSON.stringify(action)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("cursor skips closed FB via closed_by fix-loop fallback", async () => {
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-bug-"))
	try {
		const fbPath = join(tmp, "003-fb.md")
		writeFbFile(
			fbPath,
			[
				"closed_by: 'fix-loop:FB-003:bolt-1'",
				"targets:",
				"  unit: unit-02",
				"  invalidates: [spec]",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"security",
			fbPath,
			"software",
		)
		assert.equal(
			action,
			null,
			`closed_by: 'fix-loop:*' alone MUST skip the FB. got: ${JSON.stringify(action)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("start_feedback_hat dispatch defensively filters closed FBs on disk", async () => {
	// Even if the cursor regresses and emits a dispatch for a closed
	// FB, the prompt builder reads the file and filters it out before
	// spawning a subagent.
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("start_feedback_hat")
	assert.ok(builder, "start_feedback_hat builder must be registered")

	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-bug-disp-"))
	const origCwd = process.cwd()
	process.chdir(tmp)
	try {
		const slug = "demo-intent"
		const stage = "security"
		const stageDir = join(tmp, ".haiku", "intents", slug, "stages", stage)
		mkdirSync(join(stageDir, "feedback"), { recursive: true })
		// Closed FB with unquoted closed_at (the bug shape).
		writeFbFile(
			join(stageDir, "feedback", "001-closed.md"),
			[
				"status: closed",
				"closed_at: 2026-05-18T14:46:18.472Z",
				"closed_by: 'fix-loop:FB-001:bolt-1'",
				"targets:",
				"  unit: unit-01",
				"  invalidates: [spec]",
			].join("\n"),
		)

		const out = builder({
			slug,
			studio: "software",
			action: {
				kind: "start_feedback_hat",
				dispatches: [
					{
						feedback_id: "FB-001",
						stage,
						hat: "classifier",
						terminal: false,
					},
				],
			},
		})
		// With FB filtered out: dispatchCount becomes 0 and the
		// template renders the "no FBs" branch (a retick instruction).
		assert.ok(
			!out.includes("Read .*hats/classifier.md"),
			`dispatch must NOT instruct subagent to run classifier on a closed FB. got: ${out.slice(0, 600)}`,
		)
		assert.ok(
			/no FBs|haiku_run_next/.test(out),
			`with closed FB filtered, dispatch should render the no-op retick branch. got: ${out.slice(0, 600)}`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("control: cursor still dispatches OPEN FBs (no false-positive skip)", async () => {
	const { __testOnly } = await importCursor()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-bug-"))
	try {
		const fbPath = join(tmp, "004-open.md")
		writeFbFile(
			fbPath,
			[
				"status: open",
				"origin: adversarial-review",
				"author_type: agent",
				"targets:",
				"  unit: unit-01",
				"  invalidates: [spec]",
				"triaged_at: '2026-05-18T14:41:16Z'",
			].join("\n"),
		)
		const action = __testOnly.nextActionForFeedback(
			"security",
			fbPath,
			"software",
		)
		// Open FB → cursor should emit start_feedback_hat for the first hat.
		assert.ok(
			action && action.kind === "start_feedback_hat",
			`open FB MUST dispatch (no false-positive skip). got: ${JSON.stringify(action)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
