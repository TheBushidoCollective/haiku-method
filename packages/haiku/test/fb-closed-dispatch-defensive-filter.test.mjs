// fb-closed-dispatch-defensive-filter.test.mjs
//
// Regression for haiku-bug-report-2026-05-19 — stuck loop on
// `start_feedback_hat` for an FB that is closed on disk.
//
// The bug: `walkFeedbackTrack` emitted a `start_feedback_hat` action
// whose `dispatches[]` named a closed FB. The prompt builder for
// `start_feedback_hat` ran its defensive filter, found the file
// closed, and rendered the "no FBs, retick" body. The two surfaces
// disagreed — the action JSON still showed the FB, but the prompt
// said there was nothing to do. The agent retick'd, the cursor
// re-emitted the same action, the loop never converged.
//
// Fix: `walkFeedbackTrack` does the same defensive on-disk re-check
// the prompt builder does, so the action JSON and the prompt agree.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = fileURLToPath(new URL(".", import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function makeRepo(label) {
	const dir = mkdtempSync(join(tmpdir(), `haiku-fb-defensive-${label}-`))
	if (HAS_GIT) {
		execFileSync("git", ["init", "-q", "-b", "main", dir], { stdio: "ignore" })
	}
	return dir
}

function seedIntent(repoRoot, slug, stage) {
	const stageDir = join(repoRoot, ".haiku", "intents", slug, "stages", stage)
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	mkdirSync(join(stageDir, "units"), { recursive: true })
	writeFileSync(
		join(repoRoot, ".haiku", "intents", slug, "intent.md"),
		matter.stringify("body\n", {
			title: "Test intent",
			studio: "software",
			mode: "continuous",
		}),
	)
	writeFileSync(
		join(stageDir, "state.json"),
		JSON.stringify({
			stage,
			status: "active",
			phase: "review",
			started_at: "2026-05-19T00:00:00Z",
			completed_at: null,
		}),
	)
	writeFileSync(
		join(stageDir, "units", "unit-01-foo.md"),
		matter.stringify("u\n", {
			title: "u",
			depends_on: [],
			inputs: [],
			outputs: [],
			started_at: "2026-05-19T00:00:00Z",
			completed_at: "2026-05-19T01:00:00Z",
			iterations: [],
			reviews: { spec: { at: "t", by: "spec" } },
			approvals: { spec: { at: "t", by: "spec" } },
		}),
	)
	return stageDir
}

test("walkFeedbackTrack drops dispatch entries whose FB is closed on disk", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("closed-fb")
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const slug = "stuck-loop-repro"
		const stage = "security"
		const stageDir = seedIntent(repoRoot, slug, stage)
		// Write a CLOSED FB. All three terminal signals fire:
		// status: closed + closed_by: fix-loop:... + closed_at set.
		writeFileSync(
			join(stageDir, "feedback", "001-stuck.md"),
			matter.stringify("body\n", {
				title: "Stuck FB",
				status: "closed",
				origin: "adversarial-review",
				author: "agent",
				author_type: "agent",
				created_at: "2026-05-18T14:00:00Z",
				triaged_at: "2026-05-18T14:00:00Z",
				closed_by: "fix-loop:FB-001:bolt-1",
				closed_at: "2026-05-18T14:46:18Z",
				targets: { unit: "unit-01-foo", invalidates: ["spec"] },
				iterations: [
					{
						bolt: 1,
						hat: "feedback-assessor",
						completed_at: "2026-05-18T14:46:12Z",
						result: "closed",
					},
				],
			}),
		)

		const cursor = await import(`${SRC}orchestrator/workflow/cursor.ts`)
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const action = cursor.__testOnly.walkFeedbackTrack({
			intentDir,
			studio: "software",
			currentStage: stage,
			intent: { studio: "software" },
		})
		assert.strictEqual(
			action,
			null,
			`walkFeedbackTrack must return null when every FB on disk is closed (got: ${JSON.stringify(
				action,
			)})`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("walkFeedbackTrack still dispatches when an open FB is alongside a closed one", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("mixed")
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const slug = "mixed-fb-repro"
		const stage = "security"
		const stageDir = seedIntent(repoRoot, slug, stage)
		// Closed FB.
		writeFileSync(
			join(stageDir, "feedback", "001-closed.md"),
			matter.stringify("body\n", {
				title: "Closed",
				status: "closed",
				origin: "adversarial-review",
				author: "agent",
				author_type: "agent",
				created_at: "2026-05-18T14:00:00Z",
				closed_at: "2026-05-18T14:46:18Z",
				closed_by: "fix-loop:FB-001:bolt-1",
				targets: { unit: "unit-01-foo", invalidates: ["spec"] },
				iterations: [],
			}),
		)
		// Open FB (no terminal signals).
		writeFileSync(
			join(stageDir, "feedback", "002-open.md"),
			matter.stringify("body\n", {
				title: "Open",
				origin: "adversarial-review",
				author: "agent",
				author_type: "agent",
				created_at: "2026-05-19T08:00:00Z",
				triaged_at: "2026-05-19T08:00:00Z",
				targets: { unit: "unit-01-foo", invalidates: ["spec"] },
				iterations: [],
			}),
		)

		const cursor = await import(`${SRC}orchestrator/workflow/cursor.ts`)
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		const action = cursor.__testOnly.walkFeedbackTrack({
			intentDir,
			studio: "software",
			currentStage: stage,
			intent: { studio: "software" },
		})
		assert.ok(action, "expected an action when an open FB exists")
		assert.strictEqual(action.kind, "start_feedback_hat")
		const ids = action.dispatches.map((d) => d.feedback_id)
		assert.deepStrictEqual(
			ids,
			["FB-002"],
			`dispatches must include only the open FB. got: ${ids.join(", ")}`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
