#!/usr/bin/env npx tsx
// migration-commits-output.test.mjs — the `migrated` action must COMMIT its
// own .haiku/ output (livelock residual from the 2026-05-24 report).
//
// Without the commit, the migrator's rewritten intent/unit/feedback files sit
// uncommitted in the working tree. A later downstream-sync
// restoreEngineStateFromBase(HEAD) checks them back out to the pre-migration
// commit — reverting the migration and re-firing it next tick. Pinning: after
// runWorkflowTick returns `migrated`, the .haiku tree is clean (committed).

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(HERE, "..", "..", "..", "plugin")

const { runWorkflowTick } = await import(
	"../src/orchestrator/workflow/run-tick.ts"
)
await import("../src/orchestrator/migrations/v0-to-v4.ts")

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

test("the migrated action commits its .haiku output (no dirty tree left behind)", async () => {
	if (!HAS_GIT) return
	const slug = "legacy-commit"
	const tmp = mkdtempSync(join(tmpdir(), "haiku-mig-commit-"))
	const orig = process.cwd()
	try {
		git(tmp, "init", "-q", "-b", "main")
		git(tmp, "config", "user.email", "t@haiku")
		git(tmp, "config", "user.name", "haiku-test")
		git(tmp, "config", "commit.gpgsign", "false")
		const iDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(iDir, "stages", "design", "units"), { recursive: true })
		// v3 intent.md — no plugin_version, deprecated active_stage/phase/status.
		writeFileSync(
			join(iDir, "intent.md"),
			[
				"---",
				'title: "Legacy"',
				"studio: software",
				"mode: continuous",
				"active_stage: design",
				"phase: execute",
				"status: active",
				"---",
				"",
				"# body",
			].join("\n"),
		)
		// v3 unit with status: completed (v3 cruft).
		writeFileSync(
			join(iDir, "stages", "design", "units", "unit-01-foo.md"),
			["---", "title: foo", "status: completed", "---", "", "# unit"].join(
				"\n",
			),
		)
		// Commit the v3 state so it's the baseline — the migrator's rewrite is
		// what must end up committed.
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "seed v3 intent")

		process.chdir(tmp)
		const result = runWorkflowTick(slug, tmp)
		assert.strictEqual(
			result.action?.action,
			"migrated",
			`expected migrated, got ${JSON.stringify(result.action)}`,
		)

		// The migration's .haiku writes must be committed — no dirty tree.
		const dirty = git(tmp, "status", "--porcelain", "--", ".haiku")
		assert.strictEqual(
			dirty,
			"",
			`migration output must be committed; dirty: ${dirty}`,
		)
		// And the rewrite actually happened: intent.md now carries plugin_version.
		const committed = git(
			tmp,
			"show",
			"HEAD:.haiku/intents/" + slug + "/intent.md",
		)
		assert.match(
			committed,
			/plugin_version:/,
			"committed intent.md must carry the migrated plugin_version",
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

test("no-regress: an intent stamped ABOVE the engine version is never migrated down", async () => {
	if (!HAS_GIT) return
	const slug = "future-intent"
	const tmp = mkdtempSync(join(tmpdir(), "haiku-noregress-"))
	const orig = process.cwd()
	try {
		git(tmp, "init", "-q", "-b", "main")
		git(tmp, "config", "user.email", "t@haiku")
		git(tmp, "config", "user.name", "haiku-test")
		git(tmp, "config", "commit.gpgsign", "false")
		const iDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(iDir, "stages", "design", "units"), { recursive: true })
		// Stamp the intent at a major FAR above the running engine (9.x) — as
		// if an older engine opened a newer intent, or getPluginVersion read a
		// stale-low value during a concurrent bump.
		writeFileSync(
			join(iDir, "intent.md"),
			[
				"---",
				'title: "Future"',
				"studio: software",
				"mode: continuous",
				"plugin_version: 99.0.0",
				"stages: [design]",
				"---",
				"",
				"# body",
			].join("\n"),
		)
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "seed v99 intent")

		process.chdir(tmp)
		const result = runWorkflowTick(slug, tmp)
		// MUST NOT attempt to migrate (downgrade) the intent.
		assert.notStrictEqual(
			result.action?.action,
			"migrated",
			"must not migrate a future-versioned intent",
		)
		// intent.md must still carry the higher version — never regressed.
		const committed = git(tmp, "show", `HEAD:.haiku/intents/${slug}/intent.md`)
		assert.match(
			committed,
			/plugin_version: 99\.0\.0/,
			"must not downgrade the version stamp",
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
