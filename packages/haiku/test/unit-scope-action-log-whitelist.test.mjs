// unit-scope-action-log-whitelist.test.mjs
//
// Phase 3 (Issue 3 from the bug report): the unit-scope validator must NOT
// flag the engine's OWN intent-root telemetry writes as out-of-scope. The
// record-agent-write hook appends an `agent_write` entry to
// `.haiku/intents/<slug>/action-log.jsonl` after every legit in-scope edit;
// that file lives at the intent ROOT (not under a stage), so before the
// whitelist the validator reported `unit_scope_violation` on the engine's
// own bookkeeping and blocked the advance (the operator had to
// `git checkout HEAD -- action-log.jsonl` by hand).
//
// This pins: (a) an action-log.jsonl change in the unit worktree is in
// scope (no violation), and (b) a genuinely out-of-scope write (another
// stage's artifacts) still IS a violation — so the whitelist didn't punch
// a hole in the validator.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname
const HERE = fileURLToPath(new URL(".", import.meta.url))
const REPO_ROOT = resolve(HERE, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT

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

async function setupUnitWorktree(label, extraWritesInWorktree) {
	const slug = `scope-${label}`
	const stage = "design"
	const unit = "unit-01-thing"
	const tmp = mkdtempSync(join(tmpdir(), `haiku-${label}-`))
	git(tmp, "init", "-q", "-b", "main")
	git(tmp, "config", "user.email", "test@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	git(tmp, "config", "commit.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "# test\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "init")
	git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
	const stageBranch = `haiku/${slug}/${stage}`
	git(tmp, "checkout", "-q", "-b", stageBranch)

	// Seed the canonical unit spec in the parent intent dir (unitPath lookup).
	const matter = (await import("gray-matter")).default
	const intentDir = join(tmp, ".haiku", "intents", slug)
	mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test\n", {
			title: "test",
			studio: "software",
			mode: "continuous",
		}),
	)
	const unitSpecBody = matter.stringify("# unit-01\n", {
		title: "thing",
		depends_on: [],
		outputs: [],
		inputs: [],
		started_at: "2026-05-13T00:00:00Z",
		iterations: [
			{
				hat: "designer",
				started_at: "2026-05-13T00:00:00Z",
				completed_at: null,
				result: null,
			},
		],
		reviews: {},
		approvals: {},
	})
	writeFileSync(
		join(intentDir, "stages", stage, "units", `${unit}.md`),
		unitSpecBody,
	)

	// Create the unit worktree, mirror the spec, and let the caller add files.
	const unitBranch = `haiku/${slug}/${unit}`
	const worktreesDir = join(tmp, ".haiku", "worktrees", slug)
	mkdirSync(worktreesDir, { recursive: true })
	const worktreePath = join(worktreesDir, unit)
	git(tmp, "branch", unitBranch, stageBranch)
	git(tmp, "worktree", "add", worktreePath, unitBranch)

	const wIntent = join(worktreePath, ".haiku", "intents", slug)
	mkdirSync(join(wIntent, "stages", stage, "units"), { recursive: true })
	mkdirSync(join(wIntent, "stages", stage, "artifacts"), { recursive: true })
	writeFileSync(
		join(wIntent, "stages", stage, "units", `${unit}.md`),
		unitSpecBody,
	)
	// An in-scope artifact (the unit's real deliverable).
	writeFileSync(
		join(wIntent, "stages", stage, "artifacts", "01-design.md"),
		"# design\n",
	)
	extraWritesInWorktree({ worktreePath, wIntent, stage, slug })
	git(worktreePath, "add", "-A")
	git(worktreePath, "commit", "-q", "-m", "work")

	return { slug, stage, unit, tmp, worktreePath }
}

test("intent-root action-log.jsonl write is IN scope (no violation)", async () => {
	if (!HAS_GIT) return
	const orig = process.cwd()
	let tmp
	try {
		const ctx = await setupUnitWorktree("actionlog-ok", ({ wIntent }) => {
			// The engine's own telemetry append at the intent ROOT.
			writeFileSync(
				join(wIntent, "action-log.jsonl"),
				`${JSON.stringify({ entry_type: "agent_write", path: "stages/design/artifacts/01-design.md" })}\n`,
			)
			writeFileSync(join(wIntent, "write-audit.jsonl"), "{}\n")
		})
		tmp = ctx.tmp
		process.chdir(ctx.tmp)
		const { validateUnitScope } = await import(`${SRC}state-tools.ts`)
		const result = validateUnitScope(ctx.slug, "software", ctx.stage, ctx.unit)
		assert.strictEqual(
			result,
			null,
			`expected no scope violation, got: ${result ? JSON.stringify(result.violations) : "null"}`,
		)
	} finally {
		process.chdir(orig)
		if (tmp) rmSync(tmp, { recursive: true, force: true })
	}
})

test("control: a write to ANOTHER stage's dir is still a scope violation", async () => {
	if (!HAS_GIT) return
	const orig = process.cwd()
	let tmp
	try {
		const ctx = await setupUnitWorktree(
			"actionlog-control",
			({ wIntent, slug }) => {
				// Out of scope: a different stage's artifacts dir.
				mkdirSync(join(wIntent, "stages", "operations", "artifacts"), {
					recursive: true,
				})
				writeFileSync(
					join(wIntent, "stages", "operations", "artifacts", "leak.md"),
					"# not mine\n",
				)
			},
		)
		tmp = ctx.tmp
		process.chdir(ctx.tmp)
		const { validateUnitScope } = await import(`${SRC}state-tools.ts`)
		const result = validateUnitScope(ctx.slug, "software", ctx.stage, ctx.unit)
		assert.ok(result, "expected a scope violation for the cross-stage write")
		assert.ok(
			result.violations.some((v) => v.includes("operations/artifacts/leak.md")),
			`violation list should name the out-of-scope file; got ${JSON.stringify(result.violations)}`,
		)
	} finally {
		process.chdir(orig)
		if (tmp) rmSync(tmp, { recursive: true, force: true })
	}
})
