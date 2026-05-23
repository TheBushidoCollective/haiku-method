#!/usr/bin/env npx tsx
// unit-worktree-sibling-clobber.test.mjs — Regression for the silent
// sibling-unit frontmatter revert through `mergeUnitWorktree`.
//
// THE BUG (reported 2026-05-22, intent `automated-starlink-rental-platform`,
// product stage): units that were decomposed RICH (description, model,
// inputs, outputs, quality_gates) silently lost those agent-authored fields
// and came back as a v3-shape skeleton (`status: pending` + title only). The
// loss was wrongly blamed on the v3→v4 migration; the migration chain
// actually PRESERVES every agent field. The real cause is git reconciliation
// of the engine-owned `.haiku/` tree across worktree branches.
//
// `mergeUnitWorktree` merges a unit's worktree branch back into the stage
// branch. The unit branch carries a frozen-at-fork snapshot of the WHOLE
// `.haiku/` tree, and the per-tick migration / pre-cursor sync rewrites
// sibling unit files inside that worktree. `git add -A` (in mergeUnitWorktree)
// commits those sibling rewrites onto the unit branch. The merge then has a
// 3-way where the sibling changed on ONLY the unit-branch side — git
// auto-resolves it to the unit branch's (skeleton) version with no conflict
// marker.
//
// The engine has a force-to-"ours" guard for this exact overwrite class, but
// `engineOwnedRelPaths` lists ONLY the merged unit's own file + state.json +
// baseline.json (git-worktree.ts ~3796). Every SIBLING unit file is
// unprotected, so its rich frontmatter is silently reverted to whatever the
// unit branch froze.
//
// This test proves the asymmetry: same merge, same kind of divergence —
// the MERGED unit (in the protect-list) keeps its frontmatter, while a
// SIBLING unit (not in the list) silently loses it.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

const richUnit = (title) =>
	matter.stringify(`# ${title}\n\nUnit spec body.\n`, {
		title,
		description: "Write the acceptance criteria and Gherkin scenarios.",
		model: "sonnet",
		inputs: ["knowledge/DISCOVERY.md", "product/ACCEPTANCE-CRITERIA.md"],
		outputs: ["features/thing.feature"],
		quality_gates: [
			{ name: "feature-exists", command: "true" },
			{ name: "has-scenarios", command: "true" },
		],
		iterations: [],
		reviews: {},
		approvals: {},
	})

// The v3 skeleton the corrupted worktree carries: a `status:` field (v4 NEVER
// writes this on a unit) + title, with the body intact. This is exactly the
// blob observed overwriting the rich units in the bug report.
const skeletonUnit = (title) =>
	matter.stringify(`# ${title}\n\nUnit spec body.\n`, {
		status: "pending",
		title,
	})

function fmOnBranch(repo, branch, relPath) {
	return matter(git(repo, "show", `${branch}:${relPath}`)).data
}

test("mergeUnitWorktree silently reverts a SIBLING unit's frontmatter (protect-list only covers the merged unit)", async () => {
	if (!HAS_GIT) return
	const slug = "test-sibling-clobber"
	const stage = "product"
	const mergedUnit = "unit-A-executing"
	const siblingUnit = "unit-B-sibling"
	const unitsRel = `.haiku/intents/${slug}/stages/${stage}/units`
	const mergedRel = `${unitsRel}/${mergedUnit}.md`
	const siblingRel = `${unitsRel}/${siblingUnit}.md`

	const tmp = mkdtempSync(join(tmpdir(), "haiku-sibling-clobber-"))
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

		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				mode: "continuous",
				plugin_version: "9.0.0",
				stages: [stage],
			}),
		)
		// Decompose: BOTH units written rich. This commit is the merge base.
		writeFileSync(join(intentDir, "stages", stage, "units", `${mergedUnit}.md`), richUnit("Executing Unit"))
		writeFileSync(join(intentDir, "stages", stage, "units", `${siblingUnit}.md`), richUnit("Sibling Unit"))
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "decompose: rich units")

		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		const { createUnitWorktree, mergeUnitWorktree, unitWorktreePath } = await import(
			`${SRC}/git-worktree.ts`
		)

		// Fork the executing unit's worktree off the (rich) stage branch.
		const wt = createUnitWorktree(slug, mergedUnit, stage)
		assert.ok(wt, "unit worktree created")

		// Inside the worktree, the per-tick migration / pre-cursor sync rewrites
		// BOTH unit files to the v3 skeleton (modeled directly). For the MERGED
		// unit this also collides with a stage-side change below → a conflict the
		// protect-list resolves to "ours". For the SIBLING the stage side stays
		// untouched, so the rewrite is the only change → git auto-takes it.
		writeFileSync(join(wt, mergedRel), skeletonUnit("Executing Unit"))
		writeFileSync(join(wt, siblingRel), skeletonUnit("Sibling Unit"))
		git(wt, "add", "-A")
		git(wt, "commit", "-q", "-m", "worktree: stale-snapshot rewrite of units")

		// On the stage branch the engine advances the MERGED unit's own FM (a
		// review stamp) — a real divergence so its merge is a true conflict the
		// protect-list must resolve. The SIBLING is left exactly as decomposed.
		const stageMerged = matter(readFileSync(join(intentDir, "stages", stage, "units", `${mergedUnit}.md`), "utf8"))
		stageMerged.data.reviews = { spec: { at: "2026-05-22T00:00:00Z", body_sha256: "deadbeef" } }
		writeFileSync(join(intentDir, "stages", stage, "units", `${mergedUnit}.md`), matter.stringify(stageMerged.content, stageMerged.data))
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "stage: stamp spec review on executing unit")

		// Merge the unit worktree back into the stage branch.
		const res = mergeUnitWorktree(slug, mergedUnit, stage)
		assert.ok(
			res.success,
			`merge should succeed (the sibling change is conflict-free); got: ${res.message}`,
		)

		const stageBranch = `haiku/${slug}/${stage}`
		const mergedAfter = fmOnBranch(tmp, stageBranch, mergedRel)
		const siblingAfter = fmOnBranch(tmp, stageBranch, siblingRel)

		// CONTROL: the merged unit IS in `engineOwnedRelPaths`, so the force-to-
		// "ours" guard restored the stage's authoritative frontmatter. Its rich
		// fields survive. (Passes today — proves the guard works for named units.)
		assert.ok(
			Array.isArray(mergedAfter.quality_gates) && mergedAfter.quality_gates.length === 2,
			`CONTROL: merged unit '${mergedUnit}' should keep its quality_gates (protect-list covers it); got keys: ${Object.keys(mergedAfter).join(", ")}`,
		)
		assert.equal(mergedAfter.status, undefined, "merged unit should not carry the v3 `status` skeleton field")

		// THE BREAK: the sibling unit is NOT in the protect-list, so the merge
		// silently took the worktree's stale skeleton. Its rich frontmatter is
		// gone and the v3 `status` field is back. This assertion FAILS on the
		// current engine — that is the bug we are proving. After the fix it
		// must pass.
		assert.ok(
			Array.isArray(siblingAfter.quality_gates) && siblingAfter.quality_gates.length === 2,
			`BREAK: sibling unit '${siblingUnit}' silently lost its quality_gates through mergeUnitWorktree — siblings are absent from engineOwnedRelPaths. Resulting frontmatter keys: ${Object.keys(siblingAfter).join(", ")}`,
		)
		assert.ok(
			Array.isArray(siblingAfter.inputs) && siblingAfter.inputs.length > 0,
			`BREAK: sibling unit '${siblingUnit}' silently lost its declared inputs through mergeUnitWorktree`,
		)
		assert.equal(
			siblingAfter.status,
			undefined,
			"BREAK: sibling unit reverted to the v3 `status: pending` skeleton — this is the blob that later trips the migration's v3-cruft detector",
		)

		void unitWorktreePath
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

test("mergeFixChainWorktree does not silently revert a bystander unit's frontmatter (this was the actual pre-execute incident)", async () => {
	if (!HAS_GIT) return
	const slug = "test-fc-sibling-clobber"
	const stage = "product"
	const sibling = "unit-009-quote-request-management"
	const unitsRel = `.haiku/intents/${slug}/stages/${stage}/units`
	const siblingRel = `${unitsRel}/${sibling}.md`

	const tmp = mkdtempSync(join(tmpdir(), "haiku-fc-sibling-"))
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

		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		mkdirSync(join(intentDir, "stages", stage, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				mode: "continuous",
				plugin_version: "9.0.0",
				stages: [stage],
			}),
		)
		// Bystander sibling decomposed rich (the merge base).
		writeFileSync(join(intentDir, "stages", stage, "units", `${sibling}.md`), richUnit("Quote Request"))
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "decompose: rich sibling")

		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		const { createFixChainWorktree, mergeFixChainWorktree } = await import(`${SRC}/git-worktree.ts`)

		// Fix chain (against some OTHER finding) forks off the stage branch and
		// lands a real code correction. Its worktree's frozen snapshot of the
		// bystander sibling then gets rewritten to the v3 skeleton (per-tick
		// migration / stale-remote resurrection), and committed via `git add -A`.
		const wt = createFixChainWorktree(slug, stage, "FB-007")
		assert.ok(wt, "fix-chain worktree created")
		writeFileSync(join(wt, "fix.txt"), "fix-chain correction\n")
		writeFileSync(join(wt, siblingRel), skeletonUnit("Quote Request"))
		git(wt, "add", "-A")
		git(wt, "commit", "-q", "-m", "haiku: builder fix for FB-007 (+ stale sibling snapshot)")

		const res = mergeFixChainWorktree(slug, stage, "FB-007")
		assert.ok(res.success, `fix-chain merge should succeed; got: ${res.message}`)

		const stageBranch = `haiku/${slug}/${stage}`
		// The fix code landed.
		assert.match(git(tmp, "show", `${stageBranch}:fix.txt`), /fix-chain correction/, "fix code merged onto the stage branch")
		// The bystander sibling kept its rich frontmatter (the break, fixed).
		const siblingAfter = fmOnBranch(tmp, stageBranch, siblingRel)
		assert.ok(
			Array.isArray(siblingAfter.quality_gates) && siblingAfter.quality_gates.length === 2,
			`bystander unit '${sibling}' must keep its quality_gates through mergeFixChainWorktree; got keys: ${Object.keys(siblingAfter).join(", ")}`,
		)
		assert.equal(siblingAfter.status, undefined, "bystander unit must not revert to the v3 `status` skeleton")
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
