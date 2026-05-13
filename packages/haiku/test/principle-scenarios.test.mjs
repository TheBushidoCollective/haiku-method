#!/usr/bin/env npx tsx
// principle-scenarios.test.mjs
//
// Pins the workflow-engine principle stated 2026-05-12:
//
//   "Git is not a signal, the filesystem is the only signal. Git's
//    only job is (A) merge default → intent main → stage branch, and
//    (B) switch to the appropriate stage."
//
// Each scenario asserts the per-tick contract end-to-end:
//
//   Scenario 1 — Agent on stage branch:
//     Stay on branch. Merge default → main → stage (default → main
//     happens in a worktree, doesn't move agent). Walk FS for cursor.
//     Switch only if cursor moved.
//
//   Scenario 2 — Agent on intent main:
//     Walk FS. If first stage / new intent, switch to that stage
//     (create if needed). Re-walk for exact position.
//
//   Scenario 3 — Agent on default branch:
//     Walk FS. If intent not sealed, switch to intent main (creating
//     from default if needed). Then proceed as scenario 2.
//
//   Feedback / drift:
//     - User-origin FB clears the user approval on close — the next
//       cursor walk re-emits user_gate so user must re-approve before
//       advancing.
//     - Agent-origin FB does not clear the user approval; auto-merges
//       back to the later stage.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"

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

function setupRepo(slug, { defaultBranch = "main" } = {}) {
	const repo = mkdtempSync(join(tmpdir(), `haiku-principle-${slug}-`))
	git(repo, "init", "-q", "-b", defaultBranch)
	git(repo, "config", "user.email", "t@t")
	git(repo, "config", "user.name", "t")
	git(repo, "config", "commit.gpgsign", "false")
	git(repo, "commit", "--allow-empty", "-qm", "default branch seed")
	const intentDir = join(repo, ".haiku/intents", slug)
	mkdirSync(intentDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# intent\n", {
			title: slug,
			studio: "software",
			mode: "continuous",
		}),
	)
	git(repo, "add", "-A")
	git(repo, "commit", "-qm", "seed intent")
	git(repo, "checkout", "-qb", `haiku/${slug}/main`)
	return { repo, intentDir, slug }
}

function writeUnit(intentDir, stage, name, fm) {
	const dir = join(intentDir, "stages", stage, "units")
	mkdirSync(dir, { recursive: true })
	writeFileSync(
		join(dir, `${name}.md`),
		matter.stringify("# unit\n", { title: name, ...fm }),
	)
}

async function importEngine() {
	const m = await import("../src/git-worktree.ts")
	const cursor = await import("../src/orchestrator/workflow/cursor.ts")
	return { ...m, ...cursor }
}

// ─────────────────────────────────────────────────────────────────────
// Scenario 1: Agent on stage branch
// ─────────────────────────────────────────────────────────────────────
test("scenario 1: agent on stage branch stays on it during pre-cursor sync", async () => {
	if (!HAS_GIT) return
	const { repo, slug, intentDir } = setupRepo("s1")
	try {
		// Create the intent main + a stage branch; switch to stage.
		git(repo, "checkout", "-qb", `haiku/${slug}/inception`)
		writeUnit(intentDir, "inception", "unit-01-foo", {
			started_at: null,
			iterations: [],
		})
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "stage work in progress")

		// Make the default branch ("main") advance — we expect step 1
		// (default → intent main) to bring those commits onto intent
		// main WITHOUT moving the agent off `haiku/<slug>/inception`.
		git(repo, "checkout", "-q", "main")
		writeFileSync(join(repo, "default-branch-update.txt"), "from default\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "default-branch advance")
		git(repo, "checkout", "-q", `haiku/${slug}/inception`)

		const origCwd = process.cwd()
		try {
			process.chdir(repo)
			const { syncBranchDownstream, getCurrentBranch } = await importEngine()
			const before = getCurrentBranch()
			const result = syncBranchDownstream(slug)
			const after = getCurrentBranch()

			assert.strictEqual(
				result.ok,
				true,
				`sync must succeed: ${result.message}`,
			)
			assert.strictEqual(
				after,
				before,
				"agent must stay on the stage branch during default→main step (worktree-isolated)",
			)
			assert.strictEqual(
				after,
				`haiku/${slug}/inception`,
				"agent must still be on the stage branch after the sync completes",
			)
			// Intent main should now contain the default-branch update.
			const mainHasUpdate = git(
				repo,
				"ls-tree",
				`haiku/${slug}/main`,
				"--",
				"default-branch-update.txt",
			)
			assert.ok(
				mainHasUpdate.length > 0,
				"default-branch update must have been merged into intent main",
			)
		} finally {
			process.chdir(origCwd)
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// ─────────────────────────────────────────────────────────────────────
// Scenario 2: Agent on intent main
// ─────────────────────────────────────────────────────────────────────
test("scenario 2: agent on intent main + cursor names a stage → ensureOnStageBranch switches and creates the stage branch", async () => {
	if (!HAS_GIT) return
	const { repo, slug, intentDir } = setupRepo("s2")
	try {
		// Agent stays on intent main. No stage branches yet.
		writeUnit(intentDir, "inception", "unit-01-foo", {
			started_at: null,
			iterations: [],
		})

		const origCwd = process.cwd()
		try {
			process.chdir(repo)
			const { ensureOnStageBranch, branchExists, getCurrentBranch } =
				await importEngine()
			const before = getCurrentBranch()
			assert.strictEqual(before, `haiku/${slug}/main`)
			assert.strictEqual(
				branchExists(`haiku/${slug}/inception`),
				false,
				"stage branch should not exist before ensureOnStageBranch",
			)

			const result = ensureOnStageBranch(slug, "inception")
			assert.strictEqual(
				result.ok,
				true,
				`switch must succeed: ${result.message}`,
			)
			assert.strictEqual(
				branchExists(`haiku/${slug}/inception`),
				true,
				"ensureOnStageBranch must create the stage branch",
			)
			assert.strictEqual(
				getCurrentBranch(),
				`haiku/${slug}/inception`,
				"agent must end up on the named stage branch",
			)
		} finally {
			process.chdir(origCwd)
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// ─────────────────────────────────────────────────────────────────────
// Scenario 3: Agent on default branch
// ─────────────────────────────────────────────────────────────────────
test("scenario 3: agent on default branch + intent exists → engine routes through intent main into the stage branch", async () => {
	if (!HAS_GIT) return
	const { repo, slug, intentDir } = setupRepo("s3")
	try {
		writeUnit(intentDir, "inception", "unit-01-foo", {
			started_at: null,
			iterations: [],
		})
		// Move the agent back onto the default branch.
		git(repo, "checkout", "-q", "main")

		const origCwd = process.cwd()
		try {
			process.chdir(repo)
			const { ensureOnStageBranch, branchExists, getCurrentBranch } =
				await importEngine()
			const before = getCurrentBranch()
			assert.strictEqual(
				before,
				"main",
				"fixture: agent must start on default branch",
			)
			assert.strictEqual(
				branchExists(`haiku/${slug}/main`),
				true,
				"intent main should exist (setupRepo creates it)",
			)
			assert.strictEqual(
				branchExists(`haiku/${slug}/inception`),
				false,
				"stage branch should not exist yet",
			)

			const result = ensureOnStageBranch(slug, "inception")
			assert.strictEqual(
				result.ok,
				true,
				`switch must succeed: ${result.message}`,
			)
			assert.strictEqual(
				getCurrentBranch(),
				`haiku/${slug}/inception`,
				"agent must end up on the named stage branch (created from intent main, which was forked from default)",
			)
		} finally {
			process.chdir(origCwd)
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// ─────────────────────────────────────────────────────────────────────
// Feedback / drift: user-origin FB invalidates user approval
// ─────────────────────────────────────────────────────────────────────
test("feedback: user-origin FB closure clears the user approval (re-emits user_gate before advancing)", async () => {
	// Pure FS — no git ops needed for this test; the mechanism is the
	// applyFeedbackInvalidations function that runs on FB close.
	const repo = mkdtempSync(join(tmpdir(), "haiku-principle-fb-"))
	try {
		const slug = "fb-user-invalidates"
		const intentDir = join(repo, ".haiku/intents", slug)
		mkdirSync(intentDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# intent\n", {
				title: slug,
				studio: "software",
				mode: "continuous",
			}),
		)
		const stage = "inception"
		writeUnit(intentDir, stage, "unit-01-foo", {
			started_at: "2026-04-27T19:00:00Z",
			iterations: [
				{
					hat: "researcher",
					started_at: "2026-04-27T19:00:00Z",
					completed_at: "2026-04-27T19:01:00Z",
					result: "advance",
				},
			],
			reviews: { spec: true, user: true },
			approvals: { spec: true, user: { at: "2026-04-27T19:10:00Z" } },
		})

		const { setHaikuRootForTests } = await import("../src/state/shared.ts")
		setHaikuRootForTests(join(repo, ".haiku"))
		try {
			const { applyFeedbackInvalidations } = await import(
				"../src/orchestrator/workflow/dispatch-stamps.ts"
			)
			// FB closes with `invalidates: ["user"]` (the classifier's
			// default for user-origin FBs).
			applyFeedbackInvalidations({
				slug,
				stage,
				targetUnit: "unit-01-foo",
				invalidates: ["user"],
			})

			const { readFileSync } = await import("node:fs")
			const after = matter(
				readFileSync(
					join(intentDir, "stages", stage, "units", "unit-01-foo.md"),
					"utf8",
				),
			)
			assert.strictEqual(
				after.data.approvals?.user,
				undefined,
				"user approval must be cleared after FB.invalidates=['user']",
			)
			assert.ok(
				after.data.approvals?.spec,
				"non-invalidated approvals must remain stamped",
			)
		} finally {
			setHaikuRootForTests(null)
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// ─────────────────────────────────────────────────────────────────────
// Cursor invariant: derivePosition reads the filesystem only
// ─────────────────────────────────────────────────────────────────────
test("cursor invariant: cursor module imports nothing from git-worktree (FS is the only signal)", async () => {
	const { readFileSync } = await import("node:fs")
	const src = readFileSync(
		new URL("../src/orchestrator/workflow/cursor.ts", import.meta.url),
		"utf8",
	)
	// Both the static import line and any dynamic `await import(...)` of
	// git-worktree count. This invariant codifies the principle "git is
	// not a signal" by forbidding the cursor module from touching the
	// git layer at all.
	const forbidden = [
		/from\s+["']\.\.\/\.\.\/git-worktree(?:\.js)?["']/,
		/import\s*\(\s*["']\.\.\/\.\.\/git-worktree(?:\.js)?["']\s*\)/,
		/\bexecFileSync\b/,
		/\brun\s*\(\s*\[\s*["']git["']/,
	]
	for (const pat of forbidden) {
		assert.strictEqual(
			pat.test(src),
			false,
			`cursor.ts must not reference git directly (pattern ${pat}). The cursor reads the filesystem only; git is for merges and branch switches, not cursor decisions.`,
		)
	}
})

// ─────────────────────────────────────────────────────────────────────
// Feedback: agent-origin FB does NOT clear user approval — auto-merge
// path. User-origin FB DOES clear user approval — user-approval-
// required path. The classifier's `target_invalidates` is the
// mechanism that produces the divergence; this test pins both
// branches by side-by-side simulation.
// ─────────────────────────────────────────────────────────────────────
test("feedback: agent-origin FB leaves user approval intact (auto-merge back); user-origin FB clears it (user_gate required)", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-principle-fb-both-"))
	try {
		const slug = "fb-both"
		const intentDir = join(repo, ".haiku/intents", slug)
		mkdirSync(intentDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# intent\n", {
				title: slug,
				studio: "software",
				mode: "continuous",
			}),
		)
		// Pre-write two units fully approved (user stamp present).
		const baseFm = () => ({
			started_at: "2026-04-27T19:00:00Z",
			iterations: [
				{
					hat: "researcher",
					started_at: "2026-04-27T19:00:00Z",
					completed_at: "2026-04-27T19:01:00Z",
					result: "advance",
				},
			],
			reviews: { spec: true, user: true },
			approvals: { spec: true, user: { at: "2026-04-27T19:10:00Z" } },
		})
		writeUnit(intentDir, "inception", "unit-agent-fb", baseFm())
		writeUnit(intentDir, "inception", "unit-user-fb", baseFm())

		const { setHaikuRootForTests } = await import("../src/state/shared.ts")
		setHaikuRootForTests(join(repo, ".haiku"))
		try {
			const { applyFeedbackInvalidations } = await import(
				"../src/orchestrator/workflow/dispatch-stamps.ts"
			)
			const { readFileSync } = await import("node:fs")
			const readApprovals = (unit) =>
				matter(
					readFileSync(
						join(intentDir, "stages/inception/units", `${unit}.md`),
						"utf8",
					),
				).data.approvals

			// Agent-origin FB closes with empty invalidates (the classifier
			// default for `agent` origin) — user approval stays intact, so
			// the cursor will NOT re-fire user_gate; the stage auto-advances
			// back to wherever it was.
			applyFeedbackInvalidations({
				slug,
				stage: "inception",
				targetUnit: "unit-agent-fb",
				invalidates: [],
			})
			const agentApprovals = readApprovals("unit-agent-fb")
			assert.ok(
				agentApprovals?.user,
				"agent-origin FB (invalidates=[]) must NOT clear the user approval — the agent's fix flows through without re-asking the user",
			)

			// User-origin FB closes with invalidates=['user'] (the
			// classifier default for `user-chat`/`user-visual`/etc.) —
			// user approval is cleared, so the cursor's next walk will
			// re-emit user_gate before the stage can advance back.
			applyFeedbackInvalidations({
				slug,
				stage: "inception",
				targetUnit: "unit-user-fb",
				invalidates: ["user"],
			})
			const userApprovals = readApprovals("unit-user-fb")
			assert.strictEqual(
				userApprovals?.user,
				undefined,
				"user-origin FB (invalidates=['user']) must clear the user approval — user must re-approve before the stage advances back to the later stage",
			)
			assert.ok(
				userApprovals?.spec,
				"non-invalidated approvals (spec, etc.) remain stamped",
			)
		} finally {
			setHaikuRootForTests(null)
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// ─────────────────────────────────────────────────────────────────────
// Feedback: cursor walks intent-scope FBs (intent-level FB must be
// solved before the intent seals)
// ─────────────────────────────────────────────────────────────────────
test("feedback: intent-scope FB walks via Track B (intent-level FB must be solved before seal)", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-principle-fb-intent-"))
	try {
		const slug = "fb-intent-scope"
		const intentDir = join(repo, ".haiku/intents", slug)
		mkdirSync(intentDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# intent\n", {
				title: slug,
				studio: "software",
				mode: "continuous",
			}),
		)
		// One FM-complete inception stage. findCurrentStage advances
		// past it and returns the next unstarted stage (`design`) —
		// `areStageUnitsComplete` returns false for stages with no
		// units dir, so the walk pins there. The assertion below
		// checks the FB track wins regardless of the active-stage
		// result.
		writeUnit(intentDir, "inception", "unit-01", {
			started_at: "2026-04-27T19:00:00Z",
			iterations: [
				{
					hat: "researcher",
					started_at: "2026-04-27T19:00:00Z",
					completed_at: "2026-04-27T19:01:00Z",
					result: "advance",
				},
			],
			reviews: {
				spec: true,
				completeness: true,
				feasibility: true,
				user: true,
			},
			approvals: {
				spec: true,
				quality_gates: true,
				completeness: true,
				feasibility: true,
				user: true,
			},
		})
		// Plant an intent-scope FB.
		const intentFbDir = join(intentDir, "feedback")
		mkdirSync(intentFbDir, { recursive: true })
		writeFileSync(
			join(intentFbDir, "01-cross-cutting.md"),
			matter.stringify("# cross-cutting concern\n", {
				origin: "user-chat",
				author: "user",
				author_type: "human",
				status: "pending",
				created_at: "2026-04-27T20:00:00Z",
				targets: { unit: null, invalidates: ["user"] },
				triaged_at: "2026-04-27T20:00:01Z",
			}),
		)

		const pluginRoot = join(import.meta.dirname, "..", "..", "..", "plugin")
		const prevPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
		process.env.CLAUDE_PLUGIN_ROOT = pluginRoot
		const { _resetPluginRootForTests } = await import("../src/config.ts")
		_resetPluginRootForTests()
		const { setHaikuRootForTests } = await import("../src/state/shared.ts")
		setHaikuRootForTests(join(repo, ".haiku"))
		try {
			const { derivePosition } = await import(
				"../src/orchestrator/workflow/cursor.ts"
			)
			const pos = derivePosition({ slug, intentDir, studio: "software" })
			assert.strictEqual(
				pos.track,
				"feedback",
				`intent-scope FB must surface via Track B; cursor returned track=${pos.track}, action=${JSON.stringify(pos.action)}`,
			)
			assert.ok(
				pos.action,
				"cursor must produce a non-null feedback action for the intent-scope FB",
			)
		} finally {
			setHaikuRootForTests(null)
			if (prevPluginRoot === undefined) {
				delete process.env.CLAUDE_PLUGIN_ROOT
			} else {
				process.env.CLAUDE_PLUGIN_ROOT = prevPluginRoot
			}
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// ─────────────────────────────────────────────────────────────────────
// Feedback: stage-level FB on the current stage walks via Track B,
// pinning the cursor to the FB-handling action before any stage-track
// (Track A) action.
// ─────────────────────────────────────────────────────────────────────
test("feedback: stage-level FB on current stage preempts Track A", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-principle-fb-stage-"))
	try {
		const slug = "fb-stage-current"
		const intentDir = join(repo, ".haiku/intents", slug)
		mkdirSync(intentDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# intent\n", {
				title: slug,
				studio: "software",
				mode: "continuous",
			}),
		)
		writeUnit(intentDir, "inception", "unit-01", {
			started_at: null,
			iterations: [],
		})
		const stageFbDir = join(intentDir, "stages/inception/feedback")
		mkdirSync(stageFbDir, { recursive: true })
		writeFileSync(
			join(stageFbDir, "01-inline.md"),
			matter.stringify("# stage-scope finding\n", {
				origin: "agent",
				author: "agent",
				author_type: "agent",
				status: "pending",
				created_at: "2026-04-27T20:00:00Z",
				targets: { unit: "unit-01", invalidates: [] },
				triaged_at: "2026-04-27T20:00:01Z",
			}),
		)

		const pluginRoot = join(import.meta.dirname, "..", "..", "..", "plugin")
		const prevPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
		process.env.CLAUDE_PLUGIN_ROOT = pluginRoot
		const { _resetPluginRootForTests } = await import("../src/config.ts")
		_resetPluginRootForTests()
		const { setHaikuRootForTests } = await import("../src/state/shared.ts")
		setHaikuRootForTests(join(repo, ".haiku"))
		try {
			const { derivePosition } = await import(
				"../src/orchestrator/workflow/cursor.ts"
			)
			const pos = derivePosition({ slug, intentDir, studio: "software" })
			assert.strictEqual(
				pos.track,
				"feedback",
				`stage-level FB on the current stage must surface via Track B before Track A (intent track); cursor returned track=${pos.track}`,
			)
		} finally {
			setHaikuRootForTests(null)
			if (prevPluginRoot === undefined) {
				delete process.env.CLAUDE_PLUGIN_ROOT
			} else {
				process.env.CLAUDE_PLUGIN_ROOT = prevPluginRoot
			}
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})
