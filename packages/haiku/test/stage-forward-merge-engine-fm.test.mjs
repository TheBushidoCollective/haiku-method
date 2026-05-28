// stage-forward-merge-engine-fm.test.mjs
//
// Bug 2 (worker-new-badge, 2026-05-28): at intent completion,
// `workflowIntentComplete` fans unmerged stage branches into intent main via
// `mergeStageBranchForward`. That function did a PLAIN `git merge --no-ff`,
// NOT the engine-protected merge the unit/fix-chain/downstream-sync paths use.
// When intent main and a stage branch carried divergent engine-owned
// `intent.md` frontmatter (different approval timestamps — the fallout of
// parallel approval stamping + push contention), the merge conflicted on
// `intent.md` and handed the agent `mid_merge_blocking_tick`. `intent.md` is
// engine-sole-write; it must never reach the agent conflicted.
//
// Fix: route `mergeStageBranchForward` through `engineProtectedMergeInCwd`, so
// engine-owned intent-root state is re-asserted from the TARGET (intent main —
// the authoritative side for cross-stage approvals) while stage-only files
// still merge forward.

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

const { mergeStageBranchForward } = await import(`${SRC}git-worktree.ts`)
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

function intentMd(approvalsYaml) {
	return [
		"---",
		"slug: wnb",
		"studio: software",
		"mode: continuous",
		"approvals:",
		approvalsYaml,
		"---",
		"# intent",
		"",
	].join("\n")
}

test("mergeStageBranchForward resolves divergent intent.md FM from the target — no conflict to the agent", () => {
	if (!HAS_GIT) return
	const root = mkdtempSync(join(tmpdir(), "haiku-stagefwd-"))
	const orig = process.cwd()
	try {
		git(root, "init", "-q", "-b", "haiku/wnb/main")
		git(root, "config", "user.email", "t@t")
		git(root, "config", "user.name", "t")
		git(root, "config", "commit.gpgsign", "false")
		const intentDir = join(root, ".haiku", "intents", "wnb")
		mkdirSync(join(intentDir, "stages", "development", "units"), {
			recursive: true,
		})
		const intentFile = join(intentDir, "intent.md")

		// Base: both branches share this intent.md (spec signed at T0).
		writeFileSync(
			intentFile,
			intentMd("  spec: { at: '2026-05-28T00:00:00Z' }"),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "base")

		// development forks here, then re-stamps spec at a DIFFERENT time +
		// produces a stage-only unit file (its real deliverable).
		git(root, "checkout", "-q", "-b", "haiku/wnb/development")
		writeFileSync(
			intentFile,
			intentMd("  spec: { at: '2026-05-28T02:00:00Z' }"),
		)
		writeFileSync(
			join(intentDir, "stages", "development", "units", "unit-01-x.md"),
			"---\ntitle: x\n---\nspec\n",
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "development work")

		// Intent main independently re-stamps spec at yet another time AND adds
		// the terminal user approval — the cross-stage state main owns.
		git(root, "checkout", "-q", "haiku/wnb/main")
		writeFileSync(
			intentFile,
			intentMd(
				[
					"  spec: { at: '2026-05-28T01:00:00Z' }",
					"  user: { at: '2026-05-28T03:00:00Z' }",
				].join("\n"),
			),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "main approvals")

		// Fan development forward into main. Pre-fix: intent.md conflicts on the
		// divergent spec.at → isConflict, mid_merge_blocking_tick to the agent.
		process.chdir(root)
		_resetIsGitRepoForTests()
		const res = mergeStageBranchForward("wnb", "development", "main")

		assert.equal(
			res.isConflict ?? false,
			false,
			`engine-owned intent.md must NOT conflict; got: ${JSON.stringify(res)}`,
		)
		assert.equal(res.success, true, `merge must succeed; got: ${res.message}`)

		// No mid-merge state left behind.
		assert.ok(
			!existsSync(join(root, ".git", "MERGE_HEAD")),
			"no MERGE_HEAD left for the agent",
		)
		// intent.md kept the TARGET (main) approvals — including the user gate.
		const merged = git(
			root,
			"show",
			"haiku/wnb/main:.haiku/intents/wnb/intent.md",
		)
		assert.ok(
			merged.includes("user: { at: '2026-05-28T03:00:00Z' }"),
			`main's user approval must survive; got intent.md:\n${merged}`,
		)
		assert.ok(
			merged.includes("'2026-05-28T01:00:00Z'"),
			"main's spec timestamp (target-authoritative) must win",
		)
		assert.ok(
			!merged.includes("'2026-05-28T02:00:00Z'"),
			"development's divergent spec timestamp must NOT leak in",
		)
		// development's stage-only deliverable still came forward.
		assert.ok(
			existsSync(
				join(intentDir, "stages", "development", "units", "unit-01-x.md"),
			),
			"the stage's unit file must merge forward (only intent-root FM is re-asserted)",
		)
	} finally {
		process.chdir(orig)
		rmSync(root, { recursive: true, force: true })
	}
})
