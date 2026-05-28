// ensure-stage-branch-engine-fm.test.mjs
//
// Regression (worker-new-badge, 2026-05-28): the version auto-bump to 10
// activated the v9→v10 migration, which materializes `stages` onto intent.md.
// When that ran on intent main mid-flight, it diverged intent main's intent.md
// from a stage branch's. `ensureOnStageBranch` Stage 2 then did a PLAIN
// `git merge intent-main` into the stage branch, conflicted on intent.md, and
// left conflict markers in a workflow-managed file → the seal choked parsing
// it (`YAMLException`), and the cursor reported "stage-branch enforcement
// failed".
//
// Fix: Stage 2 routes through `engineProtectedMergeInCwd`, which re-asserts
// engine-owned state (intent.md, units, feedback) from the TARGET — the stage
// branch (HEAD) — exactly like the other engine merges. Per the stage-branch
// invariant the stage is AHEAD of main and authoritative for its own state
// (see downstream-sync-clobber.test.mjs), so target-restore is correct AND it
// deterministically resolves intent.md to a single valid copy — no conflict
// markers ever reach the agent in a workflow-managed file.
//
// Version-independent: forces the divergent-intent.md condition directly.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	existsSync,
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
process.env.CLAUDE_PLUGIN_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
	"plugin",
)

const { ensureOnStageBranch } = await import(`${SRC}git-worktree.ts`)
const { _resetIsGitRepoForTests } = await import(`${SRC}state/shared.ts`)

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

function intentMd(extra) {
	return [
		"---",
		"slug: wnb",
		"studio: software",
		"mode: continuous",
		...extra,
		"---",
		"# intent",
		"",
	].join("\n")
}

test("ensureOnStageBranch merges main→stage without leaving intent.md conflicted", () => {
	if (!HAS_GIT) return
	const root = mkdtempSync(join(tmpdir(), "haiku-ensurefm-"))
	const orig = process.cwd()
	try {
		git(root, "init", "-q", "-b", "haiku/wnb/main")
		git(root, "config", "user.email", "t@t")
		git(root, "config", "user.name", "t")
		git(root, "config", "commit.gpgsign", "false")
		const intentDir = join(root, ".haiku", "intents", "wnb")
		mkdirSync(intentDir, { recursive: true })
		const intentFile = join(intentDir, "intent.md")

		// Base intent.md (both branches fork from here).
		writeFileSync(
			intentFile,
			intentMd(["reflection: false", "approvals:", "  spec: { at: 'T0' }"]),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "base")

		// Stage branch forks, then diverges intent.md (a stale approval stamp).
		git(root, "checkout", "-q", "-b", "haiku/wnb/knowledge")
		writeFileSync(
			intentFile,
			intentMd(["reflection: false", "approvals:", "  spec: { at: 'STAGE' }"]),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "stage diverges intent.md")

		// Intent main independently rewrites intent.md (the migration-shaped
		// change: materializes `stages` + a different approval stamp) — the
		// authoritative cross-stage state.
		git(root, "checkout", "-q", "haiku/wnb/main")
		writeFileSync(
			intentFile,
			intentMd([
				"reflection: false",
				"stages:",
				"  - knowledge",
				"approvals:",
				"  spec: { at: 'MAIN' }",
				"  user: { at: 'MAIN' }",
			]),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "main migration + approvals")

		// Enforce the stage branch. Pre-fix: the plain merge conflicts on
		// intent.md → ok:false, MERGE_HEAD + markers left.
		process.chdir(root)
		_resetIsGitRepoForTests()
		const res = ensureOnStageBranch("wnb", "knowledge")

		assert.equal(
			res.ok,
			true,
			`enforcement must succeed (engine merge resolves intent.md, no markers); got: ${JSON.stringify(res)}`,
		)
		assert.ok(
			!existsSync(join(root, ".git", "MERGE_HEAD")),
			"no MERGE_HEAD left for the agent",
		)
		// The whole point: intent.md is a SINGLE valid copy — never conflict
		// markers in a workflow-managed file (that's what broke the seal).
		const onStage = git(root, "show", "HEAD:.haiku/intents/wnb/intent.md")
		assert.ok(!onStage.includes("<<<<<<<"), "no conflict markers in intent.md")
		assert.ok(!onStage.includes(">>>>>>>"), "no conflict markers in intent.md")
		// Target(stage)-authoritative, consistent with the stage-branch
		// invariant: the stage's own intent.md copy is kept (the engine guard
		// re-asserts engine state from HEAD = the stage branch).
		assert.ok(
			onStage.includes("'STAGE'"),
			`stage-authoritative intent.md must survive; got:\n${onStage}`,
		)
	} finally {
		process.chdir(orig)
		rmSync(root, { recursive: true, force: true })
	}
})
