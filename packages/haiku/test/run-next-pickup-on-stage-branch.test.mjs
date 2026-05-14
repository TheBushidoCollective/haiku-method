// run-next-pickup-on-stage-branch.test.mjs — Regression for bug #21.
//
// On a fresh pickup, the worktree is typically already checked out on
// a stage branch (`haiku/<slug>/<stage>`) — the engine left it there
// at the end of the previous tick. The first `haiku_run_next` call
// must NOT try to switch back to intent main just because intent.md
// happens to be missing `studio:` / `mode:` (selection-phase shape).
//
// The 2026-05-06 contract had `ensureOnStageBranch` hard-refuse any
// switch on a locked worktree, which surfaced as a cryptic
// `Refusing to checkout 'haiku/<slug>/main' on a locked worktree
// (current: 'haiku/<slug>/design')` error on every parked-intent
// pickup. That refusal was removed in PR #355 (see
// worktree-lock-guard.test.mjs for the inverted contract). But the
// underlying wasteful switch — main is where the selection picker
// lives, but the picker just writes intent.md, which doesn't care
// which branch it's on — was still there. Bug #21 (2026-05-13) pins
// the short-circuit: if the current branch is already
// `haiku/<slug>/*`, the selection-phase guard skips the
// ensureOnStageBranch(slug, undefined) call entirely.
//
// This test reproduces the pickup-on-stage-branch shape directly:
// fresh intent.md (no studio/mode), worktree on `haiku/<slug>/design`,
// worktree locked. Pre-fix: refusal. Post-fix: a selection action.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")

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

function currentBranch(cwd) {
	return git(cwd, "rev-parse", "--abbrev-ref", "HEAD")
}

async function withPickedUpIntent(opts, fn) {
	const { slug, stage = "design", studio, mode, lock = true } = opts
	const repoRoot = mkdtempSync(join(tmpdir(), "rn-pickup-"))
	const orig = process.cwd()
	try {
		git(repoRoot, "init", "-q")
		git(repoRoot, "config", "commit.gpgsign", "false")
		git(repoRoot, "config", "user.email", "test@haiku.test")
		git(repoRoot, "config", "user.name", "haiku test")
		git(repoRoot, "commit", "--allow-empty", "-q", "-m", "init")

		// Set up haiku/<slug>/main and the stage branch.
		git(repoRoot, "checkout", "-q", "-b", `haiku/${slug}/main`)

		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		mkdirSync(intentDir, { recursive: true })

		// intent.md with studio/mode controlled by the caller (a missing
		// studio/mode triggers the selection-phase guard).
		const fm = {
			title: slug,
			plugin_version: "4.0.0",
			started_at: new Date().toISOString(),
		}
		if (studio) fm.studio = studio
		if (mode) fm.mode = mode
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify(`# ${slug}\n`, fm),
		)
		git(repoRoot, "add", "-A")
		git(repoRoot, "commit", "-q", "-m", "intent")

		// Fork the stage branch and leave the worktree on it — the
		// "fresh pickup" shape.
		git(repoRoot, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		// Lock the worktree to reproduce the parked-intent scenario the
		// 2026-05-06 contract was hostile to. The lock-guard refusal is
		// gone (PR #355), but locking here pins the inverse — the new
		// short-circuit must work in this exact shape regardless.
		if (lock) {
			const gitDir = git(repoRoot, "rev-parse", "--git-dir")
			const lockedPath = join(
				gitDir.startsWith("/") ? gitDir : join(repoRoot, gitDir),
				"locked",
			)
			writeFileSync(lockedPath, "test: parked intent\n")
		}

		process.chdir(repoRoot)
		await fn({ repoRoot, intentDir, slug, stage })
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repoRoot, { recursive: true, force: true })
	}
}

test("run_next: pickup on stage branch w/ no studio/mode does NOT switch to main", async () => {
	if (!HAS_GIT) return
	const slug = "pickup-fresh"
	await withPickedUpIntent({ slug, stage: "design" }, async ({ repoRoot }) => {
		// Pre-check: we ARE on the stage branch.
		assert.equal(currentBranch(repoRoot), `haiku/${slug}/design`)

		const { orchestratorToolHandlers } = await import(
			`${SRC}/tools/orchestrator/index.ts`
		)
		const runNextTool = orchestratorToolHandlers.get("haiku_run_next")
		const resp = await runNextTool.handle({ intent: slug })

		const text = resp.content?.[0]?.text ?? ""

		// The call must not refuse. The pre-fix shape was a guard error
		// with `stage-branch enforcement failed`. Post-fix the
		// selection-phase guard short-circuits and the cursor proceeds
		// to emit a select_* action (studio missing → select_studio).
		assert.doesNotMatch(
			text,
			/stage-branch enforcement failed/,
			`run_next should not refuse on a fresh pickup with the worktree already on a stage branch; got: ${text.slice(0, 400)}`,
		)
		assert.doesNotMatch(
			text,
			/Refusing to checkout/,
			`run_next should not surface the legacy locked-worktree refusal; got: ${text.slice(0, 400)}`,
		)

		// And we must STILL be on the stage branch — the short-circuit
		// is the whole point. No wasted switch to intent main.
		assert.equal(
			currentBranch(repoRoot),
			`haiku/${slug}/design`,
			`pre-selection short-circuit must leave the worktree on the stage branch; got ${currentBranch(repoRoot)}`,
		)
	})
})

test("run_next: pickup on intent main w/ no studio/mode still ends up on main (baseline)", async () => {
	if (!HAS_GIT) return
	// Inverse sanity: when we're NOT on a stage branch of this intent,
	// the pre-selection guard still runs and aligns us to intent main.
	// The short-circuit is narrowly scoped.
	const slug = "pickup-on-main"
	const repoRoot = mkdtempSync(join(tmpdir(), "rn-pickup-main-"))
	const orig = process.cwd()
	try {
		git(repoRoot, "init", "-q")
		git(repoRoot, "config", "commit.gpgsign", "false")
		git(repoRoot, "config", "user.email", "test@haiku.test")
		git(repoRoot, "config", "user.name", "haiku test")
		git(repoRoot, "commit", "--allow-empty", "-q", "-m", "init")
		git(repoRoot, "checkout", "-q", "-b", `haiku/${slug}/main`)

		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		mkdirSync(intentDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify(`# ${slug}\n`, {
				title: slug,
				plugin_version: "4.0.0",
				started_at: new Date().toISOString(),
			}),
		)
		git(repoRoot, "add", "-A")
		git(repoRoot, "commit", "-q", "-m", "intent")

		process.chdir(repoRoot)

		const { orchestratorToolHandlers } = await import(
			`${SRC}/tools/orchestrator/index.ts`
		)
		const runNextTool = orchestratorToolHandlers.get("haiku_run_next")
		const resp = await runNextTool.handle({ intent: slug })
		const text = resp.content?.[0]?.text ?? ""
		assert.doesNotMatch(text, /stage-branch enforcement failed/)
		// We started on intent main and there's no stage branch — we
		// should still be on intent main.
		assert.equal(currentBranch(repoRoot), `haiku/${slug}/main`)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
