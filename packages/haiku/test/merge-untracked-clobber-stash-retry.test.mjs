#!/usr/bin/env npx tsx
// merge-untracked-clobber-stash-retry.test.mjs
//
// Bug 2026-05-20 (twelve-week-plan-accountability-app, intent quality_gates
// stuck): the `security` stage-close merge into intent-main was aborted by
// untracked working-tree files the merge would overwrite —
//
//   error: The following untracked working tree files would be overwritten
//   by merge: <path>. Please move or remove them before you merge. Aborting
//
// `mergeStageBranchIntoMain` let that abort fall through as a non-conflict
// failure, the caller `break`'d silently, and the stage branch was left
// orphaned (163 commits ahead of intent-main) while HEAD sat on stale main
// → cursor rewound to derived state.
//
// Fix: on the untracked-clobber abort, stash the offending files aside
// (`git stash push -u`), retry the merge, then restore the stash. The merge
// must complete — never silently no-op.
//
// Tests:
//   1. An untracked file blocking the merge no longer no-ops: the merge
//      succeeds, the stage content lands on intent-main, and the merge is
//      no longer pending.
//   2. Control: a clean merge (no untracked blocker) still succeeds.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { mergeStageBranchIntoMain } from "../src/git-worktree.ts"
import { _resetIsGitRepoForTests } from "../src/state-tools.ts"

const GIT_ENV = {
	...process.env,
	GIT_COMMITTER_DATE: "2026-05-20T12:00:00+00:00",
	GIT_AUTHOR_DATE: "2026-05-20T12:00:00+00:00",
}
function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		env: GIT_ENV,
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

function seedRepo(slug, stage) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-clobber-"))
	git(tmp, "init", "--initial-branch=main")
	git(tmp, "config", "user.email", "t@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	git(tmp, "config", "commit.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "# base\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-m", "initial")

	const main = `haiku/${slug}/main`
	const stageBranch = `haiku/${slug}/${stage}`
	git(tmp, "branch", main, "main")

	// Stage branch adds a tracked app file the merge will introduce on main.
	git(tmp, "branch", stageBranch, main)
	git(tmp, "checkout", stageBranch)
	mkdirSync(join(tmp, "app"), { recursive: true })
	writeFileSync(join(tmp, "app", "new.txt"), "FROM-STAGE\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-m", "stage: add app/new.txt")

	return { tmp, main, stageBranch }
}

const origCwd = process.cwd()
function restore() {
	try {
		process.chdir(origCwd)
	} catch {
		process.chdir(tmpdir())
	}
	_resetIsGitRepoForTests()
}

test("untracked file that would be clobbered no longer makes the merge silently no-op", () => {
	_resetIsGitRepoForTests()
	const slug = "clobber-merge"
	const stage = "dev"
	const { tmp, main, stageBranch } = seedRepo(slug, stage)
	try {
		process.chdir(tmp)
		// HEAD on intent-main (no auto-commit of the working tree here), with
		// an UNTRACKED file at exactly the path the merge wants to create →
		// `git merge` aborts with "untracked working tree files would be
		// overwritten".
		git(tmp, "checkout", main)
		mkdirSync(join(tmp, "app"), { recursive: true })
		writeFileSync(join(tmp, "app", "new.txt"), "UNTRACKED-LEFTOVER\n")

		const result = mergeStageBranchIntoMain(slug, stage)

		assert.strictEqual(
			result.success,
			true,
			`merge must succeed via stash-and-retry, not no-op; got: ${JSON.stringify(result)}`,
		)
		assert.notStrictEqual(
			result.isConflict,
			true,
			"a recoverable untracked clobber is not a content conflict",
		)
		// The merge actually happened: stage is now an ancestor of main.
		const stageSha = git(tmp, "rev-parse", stageBranch)
		const isAncestor = (() => {
			try {
				git(tmp, "merge-base", "--is-ancestor", stageSha, main)
				return true
			} catch {
				return false
			}
		})()
		assert.ok(
			isAncestor,
			"stage branch must be merged into intent-main (an ancestor) after the fix — proves no silent no-op",
		)
		// The merged (authoritative) content stands; the untracked leftover
		// was stashed aside (retained, recoverable), not silently kept.
		const merged = readFileSync(join(tmp, "app", "new.txt"), "utf8")
		assert.match(
			merged,
			/FROM-STAGE/,
			"the completed-stage content is what landed, not the untracked leftover",
		)
		const stashList = git(tmp, "stash", "list")
		assert.ok(
			stashList.includes("untracked clobber guard"),
			"the colliding untracked file is retained in the stash for recovery, not destroyed",
		)
	} finally {
		restore()
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("control: a clean stage merge (no untracked blocker) still succeeds", () => {
	_resetIsGitRepoForTests()
	const slug = "clean-merge"
	const stage = "dev"
	const { tmp, main, stageBranch } = seedRepo(slug, stage)
	try {
		process.chdir(tmp)
		git(tmp, "checkout", main)
		const result = mergeStageBranchIntoMain(slug, stage)
		assert.strictEqual(result.success, true, JSON.stringify(result))
		const stageSha = git(tmp, "rev-parse", stageBranch)
		git(tmp, "merge-base", "--is-ancestor", stageSha, main) // throws if not merged
		assert.match(
			readFileSync(join(tmp, "app", "new.txt"), "utf8"),
			/FROM-STAGE/,
		)
	} finally {
		restore()
		rmSync(tmp, { recursive: true, force: true })
	}
})
