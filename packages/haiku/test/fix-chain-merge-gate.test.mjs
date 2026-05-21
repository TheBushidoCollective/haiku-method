#!/usr/bin/env npx tsx
// fix-chain-merge-gate.test.mjs — Phase 6: the pre-tick fix-chain merge gate
// (completePendingFixChainMerges). It completes a fix-chain worktree merge
// left pending after a terminal close, and skips chains that aren't
// advance-CLOSED (open or rejected) so a rejected finding's code never lands.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

function seedFb(dir, { id, status }) {
	const fm = {
		id,
		title: `finding ${id}`,
		origin: "agent",
		author: "test",
		stage: "design",
		hat: "builder",
		bolt: 1,
		created_at: "2026-05-13T00:00:00Z",
		triaged_at: "2026-05-13T00:00:00Z",
		iterations: [],
		reviews: {},
		approvals: {},
		targets: { unit: "unit-01-stub", invalidates: [] },
	}
	if (status === "closed") {
		fm.closed_at = "2026-05-13T01:00:00Z"
		fm.closed_by = `fix-loop:${id}:bolt-1`
	} else if (status === "rejected") {
		fm.rejected_at = "2026-05-13T01:00:00Z"
	}
	const num = id.replace(/^FB-/i, "")
	writeFileSync(join(dir, `${num}-f.md`), matter.stringify("body\n", fm))
}

test("fix-chain merge gate completes a closed chain's pending merge, skips a rejected chain", async () => {
	if (!HAS_GIT) return
	const slug = "test-fc-gate"
	const stage = "design"
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fc-gate-"))
	const orig = process.cwd()
	try {
		git(tmp, "init", "-q", "-b", "main")
		git(tmp, "config", "user.email", "test@haiku")
		git(tmp, "config", "user.name", "haiku-test")
		git(tmp, "config", "commit.gpgsign", "false")
		writeFileSync(join(tmp, "README.md"), "# t\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "init")
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		const intentDir = join(tmp, ".haiku", "intents", slug)
		const fbDir = join(intentDir, "stages", stage, "feedback")
		mkdirSync(fbDir, { recursive: true })
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# t\n", {
				title: "t",
				studio: "software",
				mode: "continuous",
				plugin_version: "9.0.0",
				stages: [stage],
			}),
		)
		// FB-001 closed (its merge is pending), FB-002 rejected (must NOT merge).
		seedFb(fbDir, { id: "FB-001", status: "closed" })
		seedFb(fbDir, { id: "FB-002", status: "rejected" })
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "seed")

		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		const { createFixChainWorktree, fixChainWorktreePath } = await import(
			`${SRC}/git-worktree.ts`
		)
		const { completePendingFixChainMerges } = await import(
			`${SRC}/orchestrator/workflow/fix-chain-merge-gate.ts`
		)

		// Both chains left a worktree with committed code (as if a conflict had
		// stranded the inline merge / a reject didn't reap).
		for (const id of ["FB-001", "FB-002"]) {
			const wt = createFixChainWorktree(slug, stage, id)
			assert.ok(wt, `${id} worktree created`)
			writeFileSync(join(wt, `${id}.txt`), `${id} code\n`)
			git(wt, "add", "-A")
			git(wt, "commit", "-q", "-m", `code for ${id}`)
		}

		const { action } = completePendingFixChainMerges(slug, "software")
		assert.strictEqual(action, null, "no unresolved conflicts → null action")

		// FB-001 (closed) merged + reaped; its code is on the stage branch.
		assert.ok(
			!existsSync(fixChainWorktreePath(slug, stage, "FB-001")),
			"closed chain's worktree reaped after gate completes the merge",
		)
		assert.match(
			git(tmp, "show", `haiku/${slug}/${stage}:FB-001.txt`),
			/FB-001 code/,
			"closed chain's code merged onto the stage branch",
		)

		// FB-002 (rejected) skipped — worktree survives, code NOT on the branch.
		assert.ok(
			existsSync(fixChainWorktreePath(slug, stage, "FB-002")),
			"rejected chain's worktree NOT merged by the gate",
		)
		assert.throws(
			() => git(tmp, "show", `haiku/${slug}/${stage}:FB-002.txt`),
			"rejected chain's code must NOT reach the stage branch",
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		rmSync(tmp, { recursive: true, force: true })
	}
})
