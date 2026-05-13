#!/usr/bin/env npx tsx
// advance-hat-commits-user-code.test.mjs — pins the fix for the
// "engine stuck because the planner subagent left uncommitted
// implementation files" wedge reported 2026-05-13 (image 3 of the
// kagami-slice-1-sendgrid-mirror session screenshots).
//
// Pre-fix flow:
//   1. start_unit_hat dispatches a subagent to run a hat.
//   2. The subagent writes user-code files in the parent worktree
//      (e.g. `ops/bushi-dan/src/api/gitlab.ts`) — there's no
//      isolation worktree for unit hats in v4.
//   3. Subagent calls haiku_unit_advance_hat.
//   4. validateUnitScope passes (files are in-scope).
//   5. completeUnitIteration writes iter (state in .haiku/).
//   6. gitCommitState commits `.haiku/*` only — user-code files
//      stay dirty in the parent worktree.
//   7. Next git branch switch / merge refuses because of the
//      dirty tree. Agent has to run `git add ops/... && git commit`
//      manually to clear the wedge.
//
// Fix (gitCommitAll): the engine commits ALL dirty paths at advance
// time, leveraging the fact that validateUnitScope has already
// confirmed every dirty file is in-scope.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
const REPO_ROOT = resolve(HERE, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

test("haiku_unit_advance_hat commits ALL dirty in-scope files (not just .haiku/*)", async () => {
	if (!HAS_GIT) return
	const slug = "test-intent"
	const stage = "inception"
	const tmp = mkdtempSync(join(tmpdir(), "haiku-advance-commits-"))
	const orig = process.cwd()
	try {
		git(tmp, "init", "-q", "-b", "main")
		git(tmp, "config", "user.email", "test@haiku")
		git(tmp, "config", "user.name", "haiku-test")
		git(tmp, "config", "commit.gpgsign", "false")
		writeFileSync(join(tmp, "README.md"), "# test\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "init")
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)
		// Seed an intent with a unit that has a single hat sequence
		// ending at "researcher" (the software studio's inception's
		// first hat). Output declared at `knowledge/finding.md`.
		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		mkdirSync(join(intentDir, "knowledge"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				mode: "continuous",
				plugin_version: "4.0.0",
			}),
		)
		writeFileSync(
			join(intentDir, "stages", stage, "units", "unit-01-finding.md"),
			matter.stringify("# unit-01-finding\n", {
				title: "finding",
				depends_on: [],
				outputs: [".haiku/intents/test-intent/knowledge/finding.md"],
				inputs: [],
				started_at: "2026-05-13T00:00:00Z",
				iterations: [
					{
						hat: "researcher",
						started_at: "2026-05-13T00:00:00Z",
						completed_at: null,
						result: null,
					},
				],
				reviews: {},
				approvals: {},
				discovery: {},
			}),
		)
		// Commit the seed so the worktree's clean BEFORE the subagent
		// runs.
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "seed unit")
		// Now simulate the subagent's hat work: it writes the
		// declared output AND an unrelated-but-in-scope sibling
		// implementation file. Neither was committed — these dirty
		// files are what the bug screenshot showed.
		writeFileSync(
			join(intentDir, "knowledge", "finding.md"),
			"# Finding\n\nResearched output.\n",
		)
		mkdirSync(join(tmp, "ops", "bushi-dan", "src"), { recursive: true })
		writeFileSync(
			join(tmp, "ops", "bushi-dan", "src", "feature.ts"),
			"export const feature = 1\n",
		)
		// Sanity: status shows dirty content BEFORE advance.
		// `git status --porcelain` collapses untracked dirs into their
		// parent path (`?? ops/`) so we check for any non-empty
		// status, not the literal full path.
		const beforeStatus = git(tmp, "status", "--porcelain")
		assert.ok(
			beforeStatus.length > 0,
			`pre-advance: tree must be dirty; got empty status`,
		)
		assert.ok(
			/knowledge|ops/.test(beforeStatus),
			`pre-advance: expected knowledge/ or ops/ in status; got: ${beforeStatus}`,
		)

		// Invoke advance_hat.
		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { handleStateTool } = await import(`${SRC}/state-tools.ts`)
		const resp = handleStateTool("haiku_unit_advance_hat", {
			intent: slug,
			unit: "unit-01-finding",
			stage,
		})
		const text = resp.content?.[0]?.text ?? ""
		// Don't assert strict success — the software studio's
		// inception stage may have more hats after researcher and the
		// merge step may noop. The contract this test pins is:
		// AFTER the call, the working tree is CLEAN.
		const afterStatus = git(tmp, "status", "--porcelain")
		assert.strictEqual(
			afterStatus,
			"",
			`post-advance: tree must be clean; got:\n${afterStatus}\n(advance response: ${text.slice(0, 300)})`,
		)
		// And the previously-dirty files are now committed.
		const log = git(tmp, "log", "--oneline", "-5")
		assert.ok(
			/advance hat to|complete unit/i.test(log),
			`expected an advance/complete commit in the log; got:\n${log}`,
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(tmp, { recursive: true, force: true })
	}
})
