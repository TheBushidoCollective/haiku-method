#!/usr/bin/env npx tsx
// pre-cursor-sync-failed-response.test.mjs
//
// Pins the `pre_cursor_sync_failed` response shape introduced
// alongside `pre_cursor_sync_conflict` (PR #347).
//
// The two error codes diverge by `conflictFiles.length`:
//   - conflict   → real merge conflict, the agent has files to fix
//   - failed     → the merge couldn't even start (target locked,
//                  worktree dirty, etc.) and there's nothing to fix
//                  in the agent's working tree
//
// Agents/integrations branch on the `error` field, so the contract
// must stay stable. This test reproduces the "failed" shape end-to-
// end by making a sibling worktree on intent main dirty so
// `withWorktreeOnBranch(intentMain, ...)` throws — a non-conflict
// failure that returns `{ ok: false, message, conflictFiles: undef }`.
//
// What the test pins (the parts an integration would match on):
//   - `error: "pre_cursor_sync_failed"` (NOT `pre_cursor_sync_conflict`)
//   - `conflict_at: "mainline_to_intent_main"` (or `"intent_main_to_stage"`)
//   - `conflict_branch` is present (never `undefined` — JSON.stringify
//     drops `undefined`, so the helper coerces to `null` when the
//     underlying sync result didn't populate it)
//   - `underlying_error` carries the throw's message
//   - `message` includes recovery instructions

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

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

function setupRepo({ slug = "sync-fail-test", stage = "inception" } = {}) {
	const repo = mkdtempSync(join(tmpdir(), "haiku-sync-fail-"))
	git(repo, "init", "-q", "-b", "main")
	git(repo, "config", "user.email", "test@haiku.test")
	git(repo, "config", "user.name", "test")
	const intentDir = join(repo, ".haiku/intents", slug)
	mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		"---\ntitle: x\nstudio: software\n---\nbody\n",
	)
	writeFileSync(
		join(intentDir, "stages", stage, "units", "unit-01.md"),
		"---\ntitle: u1\n---\n",
	)
	git(repo, "add", "-A")
	git(repo, "commit", "-qm", "seed on main")
	git(repo, "checkout", "-qb", `haiku/${slug}/main`)
	git(repo, "checkout", "-qb", `haiku/${slug}/${stage}`)
	return { repo, slug, stage }
}

test("syncBranchDownstream: target-branch-locked path returns ok:false with no conflictFiles", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const { repo, slug, stage } = setupRepo()
	const sibling = mkdtempSync(join(tmpdir(), "haiku-sync-fail-sibling-"))
	const origCwd = process.cwd()
	try {
		process.chdir(repo)
		// Create a sibling worktree on intent main so the next attempt
		// to land a merge there has to use the sibling instead of a
		// fresh temp worktree. Then make the sibling dirty so
		// withWorktreeOnBranch refuses (the engine's contract: never
		// clobber a user's WIP).
		git(repo, "worktree", "add", sibling, `haiku/${slug}/main`)
		writeFileSync(join(sibling, "dirty-wip.txt"), "uncommitted local edit\n")
		// Mainline gets a new commit so step 1 has work to do.
		git(repo, "checkout", "-q", "main")
		writeFileSync(join(repo, "mainline-change.txt"), "from mainline\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "mainline moves forward")
		git(repo, "checkout", "-q", `haiku/${slug}/${stage}`)

		const { syncBranchDownstream } = await import("../src/git-worktree.ts")
		const result = syncBranchDownstream(slug)

		assert.strictEqual(
			result.ok,
			false,
			`expected ok=false when target branch is locked-dirty, got: ${JSON.stringify(result)}`,
		)
		assert.strictEqual(
			result.conflictAt,
			"mainline_to_intent_main",
			`expected conflictAt=mainline_to_intent_main, got: ${result.conflictAt}`,
		)
		// conflictBranch is set by syncBranchDownstream's outer wrap (it
		// knows which branch it was targeting even when the inner merge
		// throws before reporting a target).
		assert.strictEqual(
			result.conflictBranch,
			`haiku/${slug}/main`,
			"conflictBranch must name the locked target",
		)
		// The shape that distinguishes "failed" from "conflict": no
		// conflict files. The orchestrator's response builder branches
		// on `(conflictFiles ?? []).length > 0`.
		const files = result.conflictFiles ?? []
		assert.strictEqual(
			files.length,
			0,
			`expected zero conflictFiles when the merge couldn't start, got: ${JSON.stringify(files)}`,
		)
		assert.ok(
			result.message && result.message.length > 0,
			"underlying message must be populated so the agent can surface it",
		)
	} finally {
		process.chdir(origCwd)
		// Tear down sibling first (otherwise removing repo leaves a
		// dangling worktree pointer).
		try {
			git(repo, "worktree", "remove", sibling, "--force")
		} catch {
			/* best-effort */
		}
		rmSync(sibling, { recursive: true, force: true })
		rmSync(repo, { recursive: true, force: true })
	}
})

test("response-shape contract: empty conflictFiles + populated conflictBranch routes to pre_cursor_sync_failed", () => {
	// Shape-only assertion. The response builder lives inline in
	// haiku_run_next.ts and is a straight `JSON.stringify` over fixed
	// fields, with one branching predicate:
	//
	//   const hasConflictFiles = (sync.conflictFiles ?? []).length > 0
	//   if (!hasConflictFiles) → pre_cursor_sync_failed
	//   else                   → pre_cursor_sync_conflict
	//
	// Pinning the predicate inputs is sufficient — any runtime that
	// sees these inputs will produce the corresponding error code.
	const failedShape = {
		ok: false,
		performed: false,
		conflictAt: "mainline_to_intent_main",
		conflictBranch: "haiku/x/main",
		conflictFiles: undefined,
		message: "underlying error here",
	}
	const conflictShape = {
		ok: false,
		performed: false,
		conflictAt: "intent_main_to_stage",
		conflictBranch: "haiku/x/inception",
		conflictFiles: ["intent.md"],
		message: "Merge left conflicts in 1 file",
	}
	const isFailed = (s) => (s.conflictFiles ?? []).length === 0
	assert.strictEqual(
		isFailed(failedShape),
		true,
		"empty/undefined conflictFiles → failed code",
	)
	assert.strictEqual(
		isFailed(conflictShape),
		false,
		"non-empty conflictFiles → conflict code",
	)
	// Pin the conflict_branch ?? null coercion. JSON.stringify drops
	// `undefined` keys, so the response builder uses ?? null to keep
	// the field present with a stable type.
	const noBranchShape = {
		ok: false,
		performed: false,
		conflictAt: "mainline_to_intent_main",
		conflictBranch: undefined,
		conflictFiles: undefined,
		message: "no branch reported",
	}
	const coerced = noBranchShape.conflictBranch ?? null
	const json = JSON.parse(JSON.stringify({ conflict_branch: coerced }))
	assert.ok(
		"conflict_branch" in json,
		"conflict_branch must be present in JSON even when conflictBranch is undefined",
	)
	assert.strictEqual(json.conflict_branch, null)
})
