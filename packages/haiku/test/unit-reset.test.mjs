#!/usr/bin/env npx tsx
// unit-reset.test.mjs — haiku_unit_reset (bug report Issue 1: the
// single-unit recovery primitive).
//
// Pins: resetting a bolt-capped/active unit (a) returns it to `pending`
// (iterations/reviews/approvals/started_at cleared), (b) discards its
// worktree + branch, and (c) leaves a SIBLING completed unit and the stage
// branch untouched. Plus a cancel case that mutates nothing.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
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

const activeUnitFm = {
	title: "capped",
	depends_on: [],
	inputs: [],
	outputs: [],
	started_at: "2026-05-13T00:00:00Z",
	// Several bolts, last hat in flight → derives "active".
	iterations: [
		{
			hat: "security-engineer",
			started_at: "2026-05-13T00:00:00Z",
			completed_at: "2026-05-13T01:00:00Z",
			result: "advance",
		},
		{
			hat: "security-reviewer",
			started_at: "2026-05-13T01:00:00Z",
			completed_at: null,
			result: null,
		},
	],
	reviews: {
		spec: { signed_at: "2026-05-13T00:00:00Z", agent: "engine:spec" },
	},
	approvals: {},
	model: "opus",
	model_original: "sonnet",
}
const completedUnitFm = {
	title: "done",
	depends_on: [],
	inputs: [],
	outputs: ["stages/security/artifacts/02.md"],
	started_at: "2026-05-12T00:00:00Z",
	iterations: [
		{
			hat: "security-reviewer",
			started_at: "2026-05-12T00:00:00Z",
			completed_at: "2026-05-12T01:00:00Z",
			result: "advance",
		},
	],
	reviews: {},
	approvals: {
		spec: { signed_at: "2026-05-12T01:00:00Z", agent: "engine:spec" },
	},
}

function setup(slug) {
	const stage = "security"
	const tmp = mkdtempSync(join(tmpdir(), "haiku-unit-reset-"))
	git(tmp, "init", "-q", "-b", "main")
	git(tmp, "config", "user.email", "test@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	git(tmp, "config", "commit.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "# test\n")
	const intentDir = join(tmp, ".haiku", "intents", slug)
	const unitsDir = join(intentDir, "stages", stage, "units")
	mkdirSync(unitsDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# t\n", {
			title: "t",
			studio: "software",
			mode: "continuous",
		}),
	)
	// Clone the fixtures per setup — gray-matter hands back a parse the reset
	// tool mutates in place, and identical fixture content across tests would
	// otherwise share (and corrupt) the module-level object.
	writeFileSync(
		join(unitsDir, "unit-06-capped.md"),
		matter.stringify("# capped\n", structuredClone(activeUnitFm)),
	)
	writeFileSync(
		join(unitsDir, "unit-01-done.md"),
		matter.stringify("# done\n", structuredClone(completedUnitFm)),
	)
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "seed")
	git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
	git(tmp, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)
	// Create the capped unit's worktree + branch (the thing reset discards).
	const unitBranch = `haiku/${slug}/unit-06-capped`
	const worktreePath = join(tmp, ".haiku", "worktrees", slug, "unit-06-capped")
	mkdirSync(dirname(worktreePath), { recursive: true })
	git(tmp, "branch", unitBranch, `haiku/${slug}/${stage}`)
	git(tmp, "worktree", "add", worktreePath, unitBranch)
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	return { tmp, stage, intentDir, unitBranch, worktreePath }
}

async function runReset(slug, stage, unit, pick) {
	const { orchestratorToolHandlers } = await import(
		`${SRC}/tools/orchestrator/index.ts`
	)
	process.env.HAIKU_TEST_PICKER_AUTO_SELECT = pick
	try {
		const tool = orchestratorToolHandlers.get("haiku_unit_reset")
		assert.ok(tool, "haiku_unit_reset not registered")
		const resp = await tool.handle({ intent: slug, stage, unit })
		return JSON.parse(resp.content?.[0]?.text ?? "{}")
	} finally {
		delete process.env.HAIKU_TEST_PICKER_AUTO_SELECT
	}
}

test("haiku_unit_reset returns the unit to pending, reaps its worktree, leaves siblings + stage branch", async () => {
	if (!HAS_GIT) return
	const slug = "reset-ok"
	const { tmp, stage, intentDir, unitBranch, worktreePath } = setup(slug)
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { deriveUnitStatus } = await import(`${SRC}/state-tools.ts`)
		const parsed = await runReset(slug, stage, "unit-06-capped", "reset")
		assert.strictEqual(
			parsed.action,
			"unit_reset",
			`got ${JSON.stringify(parsed)}`,
		)
		assert.strictEqual(parsed.previous_status, "active")

		// Unit now derives pending.
		const fm = matter(
			readFileSync(
				join(intentDir, "stages", stage, "units", "unit-06-capped.md"),
				"utf8",
			),
		).data
		assert.strictEqual(
			deriveUnitStatus(fm),
			"pending",
			"reset unit must derive pending",
		)
		assert.ok(
			!fm.iterations || fm.iterations.length === 0,
			"iterations cleared",
		)
		assert.ok(
			!fm.approvals || Object.keys(fm.approvals).length === 0,
			"approvals cleared",
		)
		assert.strictEqual(fm.model, "sonnet", "model restored from model_original")
		assert.ok(!("model_original" in fm), "model_original cleared")

		// Worktree + branch reaped.
		assert.ok(!existsSync(worktreePath), "unit worktree must be removed")
		assert.strictEqual(
			git(tmp, "branch", "--list", unitBranch),
			"",
			"unit branch must be deleted",
		)

		// Sibling completed unit untouched; stage branch intact.
		const sib = matter(
			readFileSync(
				join(intentDir, "stages", stage, "units", "unit-01-done.md"),
				"utf8",
			),
		).data
		assert.strictEqual(
			deriveUnitStatus(sib),
			"completed",
			"sibling stays completed",
		)
		assert.ok(
			git(tmp, "branch", "--list", `haiku/${slug}/${stage}`).length > 0,
			"stage branch survives",
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

test("haiku_unit_reset cancel mutates nothing", async () => {
	if (!HAS_GIT) return
	const slug = "reset-cancel"
	const { tmp, stage, intentDir, unitBranch, worktreePath } = setup(slug)
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { deriveUnitStatus } = await import(`${SRC}/state-tools.ts`)
		const parsed = await runReset(slug, stage, "unit-06-capped", "cancel")
		assert.strictEqual(parsed.action, "cancelled")
		const fm = matter(
			readFileSync(
				join(intentDir, "stages", stage, "units", "unit-06-capped.md"),
				"utf8",
			),
		).data
		assert.strictEqual(
			deriveUnitStatus(fm),
			"active",
			"cancel leaves the unit active",
		)
		assert.ok(existsSync(worktreePath), "cancel leaves the worktree")
		assert.ok(
			git(tmp, "branch", "--list", unitBranch).length > 0,
			"cancel leaves the branch",
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

test("haiku_unit_reset refuses a completed unit — work is merged, unresettable", async () => {
	if (!HAS_GIT) return
	const slug = "reset-completed"
	const { tmp, stage, intentDir } = setup(slug)
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { deriveUnitStatus } = await import(`${SRC}/state-tools.ts`)
		// Auto-confirm the picker — the guard must refuse BEFORE the picker is
		// ever reached, so even a "yes" never gets the chance to mutate.
		const parsed = await runReset(slug, stage, "unit-01-done", "reset")
		assert.strictEqual(
			parsed.error,
			"unit_completed_not_resettable",
			`got ${JSON.stringify(parsed)}`,
		)
		// FM untouched — still completed.
		const fm = matter(
			readFileSync(
				join(intentDir, "stages", stage, "units", "unit-01-done.md"),
				"utf8",
			),
		).data
		assert.strictEqual(
			deriveUnitStatus(fm),
			"completed",
			"completed unit stays completed — reset must not touch it",
		)
		assert.ok(
			Array.isArray(fm.iterations) && fm.iterations.length === 1,
			"iterations untouched",
		)
		assert.ok(
			fm.approvals && Object.keys(fm.approvals).length > 0,
			"approvals untouched",
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
