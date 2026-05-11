#!/usr/bin/env npx tsx
// Tests for `haiku_discovery_complete` — the subagent-triggered
// discovery merge-back tool that replaces the deleted engine sweep.
// See gigsmart/haiku-method#333.

import assert from "node:assert"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { test } from "node:test"
import matter from "gray-matter"

import {
	createDiscoveryWorktree,
	discoveryBranchName,
	discoveryWorktreePath,
} from "../src/git-worktree.ts"
import { _resetIsGitRepoForTests } from "../src/state-tools.ts"
import haiku_discovery_complete from "../src/tools/orchestrator/haiku_discovery_complete.ts"

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

function setupRepo(opts = {}) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-disc-complete-"))
	git(tmp, "init", "--initial-branch=main")
	git(tmp, "config", "user.email", "test@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	git(tmp, "config", "commit.gpgsign", "false")
	git(tmp, "config", "tag.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "# test\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-m", "initial")

	const slug = opts.slug ?? "test-intent"
	const stage = opts.stage ?? "inception"
	git(tmp, "branch", `haiku/${slug}/main`, "main")
	git(tmp, "checkout", `haiku/${slug}/main`)
	git(tmp, "branch", `haiku/${slug}/${stage}`, `haiku/${slug}/main`)
	git(tmp, "checkout", `haiku/${slug}/${stage}`)

	// Seed an intent.md so the tool's existence check passes.
	const intentDir = join(tmp, ".haiku", "intents", slug)
	mkdirSync(intentDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test\n", {
			title: "test",
			studio: "software",
			mode: "continuous",
			plugin_version: "4.0.0",
		}),
	)
	git(tmp, "add", "-A")
	git(tmp, "commit", "-m", "intent")

	return { tmp, slug, stage }
}

function parseToolResponse(result) {
	const text = result?.content
		?.map((c) => (c.type === "text" ? c.text : ""))
		.join("\n")
		.trim()
	if (!text) return null
	return JSON.parse(text)
}

const originalCwd = process.cwd()

test("clean merge: subagent commits in worktree → tool merges into stage branch + reaps worktree/branch", async () => {
	_resetIsGitRepoForTests()
	const { tmp, slug, stage } = setupRepo()
	try {
		process.chdir(tmp)

		// Simulate the subagent's flow: dispatch creates the worktree,
		// subagent writes + commits the artifact inside.
		const wt = createDiscoveryWorktree(slug, stage, "discovery")
		assert.ok(wt && existsSync(wt))
		const artifact = join(
			wt,
			".haiku",
			"intents",
			slug,
			"knowledge",
			"DISCOVERY.md",
		)
		mkdirSync(join(artifact, ".."), { recursive: true })
		writeFileSync(artifact, "# discovery output\n")
		git(wt, "add", "-A")
		git(wt, "commit", "-m", "discovery artifact")

		// Subagent's completion call.
		const result = await haiku_discovery_complete.handle({
			intent: slug,
			stage,
			template: "discovery",
		})
		const body = parseToolResponse(result)
		assert.ok(body.ok, `expected ok: true; got ${JSON.stringify(body)}`)
		assert.strictEqual(body.intent, slug)
		assert.strictEqual(body.stage, stage)
		assert.strictEqual(body.template, "discovery")

		// Worktree gone, branch gone, artifact on stage branch.
		assert.ok(!existsSync(wt), "worktree reaped")
		try {
			git(
				tmp,
				"rev-parse",
				"--verify",
				"-q",
				discoveryBranchName(slug, stage, "discovery"),
			)
			assert.fail("discovery branch should have been deleted")
		} catch {
			/* expected — branch gone */
		}
		const stageArtifact = join(
			tmp,
			".haiku",
			"intents",
			slug,
			"knowledge",
			"DISCOVERY.md",
		)
		assert.ok(existsSync(stageArtifact), "artifact landed on stage branch")
	} finally {
		process.chdir(originalCwd)
		rmSync(tmp, { recursive: true, force: true })
		_resetIsGitRepoForTests()
	}
})

test("worktree_not_found: caller hit the tool twice or the worktree never existed", async () => {
	_resetIsGitRepoForTests()
	const { tmp, slug, stage } = setupRepo()
	try {
		process.chdir(tmp)
		const result = await haiku_discovery_complete.handle({
			intent: slug,
			stage,
			template: "nonexistent",
		})
		const body = parseToolResponse(result)
		assert.strictEqual(body.ok, false)
		assert.strictEqual(body.error, "worktree_not_found")
		// The message must guide the agent toward redispatching (the
		// user's principle: "if discovery output isn't on disk, error
		// and redispatch").
		assert.match(body.message, /redispatch|re-tick/)
	} finally {
		process.chdir(originalCwd)
		rmSync(tmp, { recursive: true, force: true })
		_resetIsGitRepoForTests()
	}
})

test("intent_not_found: tool refuses when the intent dir doesn't exist", async () => {
	_resetIsGitRepoForTests()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-disc-noint-"))
	try {
		process.chdir(tmp)
		git(tmp, "init", "--initial-branch=main")
		git(tmp, "config", "user.email", "test@haiku")
		git(tmp, "config", "user.name", "haiku-test")
		git(tmp, "config", "commit.gpgsign", "false")
		writeFileSync(join(tmp, "README.md"), "# test\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-m", "init")
		// .haiku/ exists so findHaikuRoot resolves, but the specific
		// intent dir under it is absent — the case a subagent would hit
		// if it called with the wrong slug.
		mkdirSync(join(tmp, ".haiku", "intents"), { recursive: true })

		const result = await haiku_discovery_complete.handle({
			intent: "missing-slug",
			stage: "inception",
			template: "discovery",
		})
		const body = parseToolResponse(result)
		assert.strictEqual(body.ok, false)
		assert.strictEqual(body.error, "intent_not_found")
	} finally {
		process.chdir(originalCwd)
		rmSync(tmp, { recursive: true, force: true })
		_resetIsGitRepoForTests()
	}
})

test("conflict: tool returns discovery_merge_conflict + conflict_files when stage and discovery diverge on the same file", async () => {
	_resetIsGitRepoForTests()
	const { tmp, slug, stage } = setupRepo()
	try {
		process.chdir(tmp)
		// Land a baseline on stage branch.
		const sharedRel = join(".haiku", "intents", slug, "knowledge")
		mkdirSync(join(tmp, sharedRel), { recursive: true })
		writeFileSync(join(tmp, sharedRel, "ARCH.md"), "stage baseline\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-m", "stage baseline")

		const wt = createDiscoveryWorktree(slug, stage, "architecture")
		writeFileSync(join(wt, sharedRel, "ARCH.md"), "discovery edit\n")
		git(wt, "add", "-A")
		git(wt, "commit", "-m", "discovery edit")

		// Stage advances on the same file → conflict on merge-back.
		writeFileSync(join(tmp, sharedRel, "ARCH.md"), "stage edit\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-m", "stage advance")

		const result = await haiku_discovery_complete.handle({
			intent: slug,
			stage,
			template: "architecture",
		})
		const body = parseToolResponse(result)
		assert.strictEqual(body.ok, false)
		assert.strictEqual(body.error, "discovery_merge_conflict")
		assert.ok(
			Array.isArray(body.conflict_files) && body.conflict_files.length > 0,
		)
	} finally {
		process.chdir(originalCwd)
		rmSync(tmp, { recursive: true, force: true })
		_resetIsGitRepoForTests()
	}
})

test("registered: tool appears in orchestratorToolHandlers under its canonical name", async () => {
	const { orchestratorToolHandlers } = await import(
		"../src/tools/orchestrator/index.ts"
	)
	assert.ok(orchestratorToolHandlers.has("haiku_discovery_complete"))
	const tool = orchestratorToolHandlers.get("haiku_discovery_complete")
	assert.strictEqual(typeof tool.handle, "function")
})

test("input validation: missing required fields return haiku_discovery_complete_input_invalid", async () => {
	const result = await haiku_discovery_complete.handle({ intent: "x" })
	const body = parseToolResponse(result)
	assert.strictEqual(body.error, "haiku_discovery_complete_input_invalid")
	assert.ok(Array.isArray(body.errors))
})
