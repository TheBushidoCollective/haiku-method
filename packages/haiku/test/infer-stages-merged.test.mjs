// infer-stages-merged.test.mjs — Locks the git-history sweep that
// recovers `stages_merged` when the migrator's primary signal
// (per-stage `state.json` status) is missing or unreliable.
//
// The migrator's failure mode this fixes:
//   - v3's "create FB" path rewrote state.json from "completed" back
//     to "active" after a stage was already done.
//   - The migrator reads HEAD's state.json, sees "active", and skips
//     the stages_merged stamp.
//   - The cursor on first v4 tick sees stages_merged empty + the
//     stage branch missing/stale → returns the early stage as active
//     and rewinds.
//
// `inferStagesMergedFromGit` walks `git log haiku/<slug>/main` for
// the two stable v3 commit-message patterns and unions the result
// with whatever the migrator already stamped. This test locks both
// patterns, the configured-stages filter, and the idempotent merge
// in `reconcileStagesMerged`.

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

async function withRepo(slug, fn) {
	const root = mkdtempSync(join(tmpdir(), "haiku-infer-merged-"))
	const orig = process.cwd()
	try {
		git(root, "init", "-q", "-b", "main")
		git(root, "config", "user.email", "test@haiku.test")
		git(root, "config", "user.name", "haiku test")
		git(root, "config", "commit.gpgsign", "false")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		git(root, "checkout", "-q", "-b", `haiku/${slug}/main`)
		const intentDir = join(root, ".haiku", "intents", slug)
		mkdirSync(intentDir, { recursive: true })
		process.chdir(root)
		await fn({ root, slug })
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(root, { recursive: true, force: true })
	}
}

function emptyCommit(root, message) {
	writeFileSync(
		join(root, ".haiku", `marker-${Date.now()}-${Math.random()}`),
		"",
	)
	git(root, "add", "-A")
	git(root, "commit", "-q", "-m", message)
}

test("inferStagesMergedFromGit: detects 'haiku: complete stage <X>' commits", async () => {
	if (!HAS_GIT) return
	await withRepo("test-intent", async ({ root, slug }) => {
		emptyCommit(root, "haiku: complete stage inception")
		emptyCommit(root, "haiku: complete stage design")
		const { inferStagesMergedFromGit } = await import(
			"../src/orchestrator/workflow/infer-stages-merged.js"
		)
		const merged = inferStagesMergedFromGit(slug, [
			"inception",
			"design",
			"product",
		])
		assert.deepStrictEqual(merged.sort(), ["design", "inception"])
	})
})

test("inferStagesMergedFromGit: detects 'haiku: merge stage <X> into main' commits", async () => {
	if (!HAS_GIT) return
	await withRepo("test-intent", async ({ root, slug }) => {
		emptyCommit(root, "haiku: merge stage inception into main")
		emptyCommit(root, "haiku: merge stage product into main")
		const { inferStagesMergedFromGit } = await import(
			"../src/orchestrator/workflow/infer-stages-merged.js"
		)
		const merged = inferStagesMergedFromGit(slug, ["inception", "product"])
		// Lock parser symmetry across multiple stages — same shape as the
		// `complete stage` test so a regex regression in either pattern
		// would surface here, not just under the matching test.
		assert.deepStrictEqual(merged.sort(), ["inception", "product"])
	})
})

test("inferStagesMergedFromGit: filters to configured stages", async () => {
	if (!HAS_GIT) return
	await withRepo("test-intent", async ({ root, slug }) => {
		emptyCommit(root, "haiku: complete stage rogue-stage")
		emptyCommit(root, "haiku: complete stage inception")
		const { inferStagesMergedFromGit } = await import(
			"../src/orchestrator/workflow/infer-stages-merged.js"
		)
		const merged = inferStagesMergedFromGit(slug, ["inception", "design"])
		// `rogue-stage` is in git but not in the configured stages — drop it.
		assert.deepStrictEqual(merged, ["inception"])
	})
})

test("inferStagesMergedFromGit: returns [] when no completion commits exist", async () => {
	if (!HAS_GIT) return
	await withRepo("test-intent", async ({ root, slug }) => {
		emptyCommit(root, "haiku: regular commit")
		emptyCommit(root, "fix: something unrelated")
		const { inferStagesMergedFromGit } = await import(
			"../src/orchestrator/workflow/infer-stages-merged.js"
		)
		const merged = inferStagesMergedFromGit(slug, ["inception", "design"])
		assert.deepStrictEqual(merged, [])
	})
})

test("inferStagesMergedFromGit: dedups when both 'complete' and 'merge' commits exist for the same stage", async () => {
	if (!HAS_GIT) return
	await withRepo("test-intent", async ({ root, slug }) => {
		emptyCommit(root, "haiku: complete stage inception")
		emptyCommit(root, "haiku: merge stage inception into main")
		const { inferStagesMergedFromGit } = await import(
			"../src/orchestrator/workflow/infer-stages-merged.js"
		)
		const merged = inferStagesMergedFromGit(slug, ["inception"])
		assert.deepStrictEqual(merged, ["inception"])
	})
})

test("reconcileStagesMerged: idempotent merge", async () => {
	const { reconcileStagesMerged } = await import(
		"../src/orchestrator/workflow/infer-stages-merged.js"
	)
	// No new entries → unchanged.
	const a = reconcileStagesMerged(["inception"], ["inception"])
	assert.strictEqual(a.changed, false)
	assert.deepStrictEqual(a.value, ["inception"])

	// New entry → changed, union.
	const b = reconcileStagesMerged(["inception"], ["design"])
	assert.strictEqual(b.changed, true)
	assert.deepStrictEqual(b.value.sort(), ["design", "inception"])

	// Empty inferred → unchanged.
	const c = reconcileStagesMerged(["inception"], [])
	assert.strictEqual(c.changed, false)
	assert.deepStrictEqual(c.value, ["inception"])

	// Empty existing → changed, equal to inferred.
	const d = reconcileStagesMerged([], ["design"])
	assert.strictEqual(d.changed, true)
	assert.deepStrictEqual(d.value, ["design"])
})

test("reconcileStagesMerged: never removes existing entries", async () => {
	const { reconcileStagesMerged } = await import(
		"../src/orchestrator/workflow/infer-stages-merged.js"
	)
	// Existing has more than inferred — preserve everything.
	const r = reconcileStagesMerged(
		["inception", "design", "product"],
		["inception"],
	)
	assert.strictEqual(r.changed, false)
	assert.deepStrictEqual(r.value.sort(), ["design", "inception", "product"])
})

test("inferStagesMergedFromGit: returns [] when no git refs exist (defensive)", async () => {
	if (!HAS_GIT) return
	await withRepo("test-intent", async ({ root: _root }) => {
		const { inferStagesMergedFromGit } = await import(
			"../src/orchestrator/workflow/infer-stages-merged.js"
		)
		// Different slug → no `haiku/<slug>/main` ref.
		const merged = inferStagesMergedFromGit("nonexistent-intent", ["inception"])
		assert.deepStrictEqual(merged, [])
	})
})
