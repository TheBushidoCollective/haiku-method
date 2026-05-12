#!/usr/bin/env npx tsx
// mid-merge-blocking-tick.test.mjs
//
// Pins the wedge reproduced 2026-05-12 against the real
// admin-portal-reimagine wedge state:
//
// 1. Pre-cursor sync step 2 (intent main → stage, in-place merge)
//    hits a real conflict on intent.md.
// 2. mergeRefInPlace leaves the working tree mid-merge with
//    `<<<<<<<` markers in intent.md.
// 3. Next tick: readFrontmatter on intent.md returns {} because the
//    conflict markers corrupt the YAML. The selection-phase guard
//    sees empty studio/mode, calls ensureOnStageBranch, which
//    detects MERGE_HEAD and surfaces the cryptic
//    "git operation in progress" error. The agent has no idea what
//    to do.
//
// Fix: top-of-handler mid-merge detector returns a clean
// `mid_merge_blocking_tick` error with the exact list of conflicted
// files and the recovery recipe (resolve + add + commit + re-tick).

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

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

test("mid-merge blocking tick: clear recovery message instead of cryptic stage-branch enforcement error", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const repo = mkdtempSync(join(tmpdir(), "haiku-midmerge-"))
	const origCwd = process.cwd()
	try {
		git(repo, "init", "-q", "-b", "dev")
		git(repo, "config", "user.email", "test@haiku.test")
		git(repo, "config", "user.name", "test")

		const slug = "test-intent"
		const intentDir = join(repo, ".haiku/intents", slug)
		const unitsDir = join(intentDir, "stages/inception/units")
		mkdirSync(unitsDir, { recursive: true })
		// intent.md valid v4 frontmatter — the file becomes invalid
		// AFTER the conflict markers land, not before.
		writeFileSync(
			join(intentDir, "intent.md"),
			`---
title: Test intent
studio: software
mode: continuous
plugin_version: 4.0.0
stages: [inception, design]
---
body
`,
		)
		writeFileSync(join(unitsDir, "unit-01-foo.md"), "---\ntitle: foo\n---\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "seed")
		git(repo, "checkout", "-qb", `haiku/${slug}/main`)
		git(repo, "checkout", "-qb", `haiku/${slug}/inception`)

		// Now manually replay the wedge: edit intent.md on inception,
		// then start a merge with main that conflicts (main also edits it).
		writeFileSync(
			join(intentDir, "intent.md"),
			`---
title: Test intent
studio: software
mode: continuous
plugin_version: 4.0.0
stages: [inception, design]
active_stage: inception
---
body
`,
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "inception edits intent.md")
		git(repo, "checkout", "-q", `haiku/${slug}/main`)
		writeFileSync(
			join(intentDir, "intent.md"),
			`---
title: Test intent
studio: software
mode: continuous
plugin_version: 4.0.0
stages: [inception, design]
active_stage: design
---
body
`,
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "main edits intent.md (conflict bait)")
		git(repo, "checkout", "-q", `haiku/${slug}/inception`)
		// Force an in-place merge that will leave conflict markers.
		try {
			git(repo, "merge", `haiku/${slug}/main`, "--no-ff", "--no-edit")
		} catch {
			// Expected — merge failed with conflicts.
		}
		// Verify the wedge shape.
		const status = git(repo, "status", "--porcelain")
		assert.ok(
			status.includes("UU "),
			`fixture: expected unmerged paths (UU) in git status, got: ${status}`,
		)

		process.chdir(repo)
		const { orchestratorToolHandlers } = await import(
			"../src/tools/orchestrator/index.ts"
		)
		const runNext = orchestratorToolHandlers.get("haiku_run_next")
		assert.ok(runNext, "expected haiku_run_next to be registered")

		const resp = await runNext.handle({ intent: slug })
		const text = resp?.content?.[0]?.text ?? ""
		// Parse the JSON head.
		const headEnd = text.indexOf("\n\n---")
		const head = headEnd > 0 ? text.slice(0, headEnd) : text
		let parsed
		try {
			parsed = JSON.parse(head.trim())
		} catch (err) {
			throw new Error(`expected JSON head, got: ${text.slice(0, 200)}`)
		}

		assert.strictEqual(
			parsed.error,
			"mid_merge_blocking_tick",
			`expected error=mid_merge_blocking_tick, got: ${JSON.stringify(parsed)}`,
		)
		assert.strictEqual(parsed.marker, "MERGE_HEAD")
		assert.ok(
			Array.isArray(parsed.conflict_files) && parsed.conflict_files.length > 0,
			"conflict_files should list the unmerged paths",
		)
		assert.ok(
			parsed.conflict_files.some((f) => f.includes("intent.md")),
			`expected intent.md among conflict files, got: ${JSON.stringify(parsed.conflict_files)}`,
		)
		assert.match(
			parsed.message,
			/resolve/i,
			"message should tell agent to resolve",
		)
		assert.match(
			parsed.message,
			/git add/,
			"message should tell agent to git add",
		)
		assert.match(
			parsed.message,
			/git commit/,
			"message should tell agent to git commit",
		)
		assert.match(
			parsed.message,
			/re-run.*haiku_run_next/,
			"message should tell agent to re-tick",
		)
		// The OLD wedge surfaced the cryptic stage-branch enforcement
		// error. Pin that we are NOT returning it.
		assert.doesNotMatch(
			parsed.message,
			/stage-branch enforcement/,
			"message must NOT fall through to the stage-branch enforcement guard's cryptic error",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})

test("mid-merge guard: after resolution + commit, tick proceeds normally", async (t) => {
	if (!HAS_GIT) {
		t.skip("no git in environment")
		return
	}
	const repo = mkdtempSync(join(tmpdir(), "haiku-midmerge-recover-"))
	const origCwd = process.cwd()
	try {
		git(repo, "init", "-q", "-b", "dev")
		git(repo, "config", "user.email", "test@haiku.test")
		git(repo, "config", "user.name", "test")

		const slug = "test-recover"
		const intentDir = join(repo, ".haiku/intents", slug)
		const unitsDir = join(intentDir, "stages/inception/units")
		mkdirSync(unitsDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			`---
title: Test intent
studio: software
mode: continuous
plugin_version: 4.0.0
stages: [inception, design]
verified_at: '2026-05-12T00:00:00Z'
---
body
`,
		)
		writeFileSync(
			join(unitsDir, "unit-01-foo.md"),
			"---\ntitle: foo\nstarted_at: '2026-05-12T00:00:00Z'\n---\n",
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-qm", "seed")
		git(repo, "checkout", "-qb", `haiku/${slug}/main`)
		git(repo, "checkout", "-qb", `haiku/${slug}/inception`)

		// No conflict — clean state. Mid-merge guard must NOT fire.
		process.chdir(repo)
		const { orchestratorToolHandlers } = await import(
			"../src/tools/orchestrator/index.ts"
		)
		const runNext = orchestratorToolHandlers.get("haiku_run_next")
		const resp = await runNext.handle({ intent: slug })
		const text = resp?.content?.[0]?.text ?? ""
		assert.doesNotMatch(
			text,
			/mid_merge_blocking_tick/,
			"clean working tree must NOT trip the mid-merge guard",
		)
	} finally {
		process.chdir(origCwd)
		rmSync(repo, { recursive: true, force: true })
	}
})
