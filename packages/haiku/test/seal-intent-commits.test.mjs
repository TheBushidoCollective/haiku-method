#!/usr/bin/env npx tsx
// seal-intent-commits.test.mjs — admin-portal-reimagine BUG-4.
//
// The `haiku_run_next` seal_intent handler stamps `sealed_at` on intent.md.
// Pre-fix it did so via setFrontmatterField WITHOUT committing — so the
// branch never went ahead-of-origin and the end-of-tick auto-push silently
// skipped, leaving the sealed intent unpushed (origin 20+ commits behind, the
// delivery PR's CI on stale code). The fix commits the seal stamp
// (gitCommitState) so the branch is ahead and the push fires.
//
// This drives the REAL `haiku_run_next` tool handler (where the fix lives —
// the engine-layer dispatchOrchestratorAction the e2e harness uses bypasses
// it) to a seal-ready autopilot intent and asserts the seal stamp is
// COMMITTED, not left dirty.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"
import {
	initTestRepo,
	makeIntent,
	makeMergedUnit,
	makeStudio,
} from "./_v4-fixtures.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
process.env.CLAUDE_PLUGIN_ROOT = join(resolve(HERE, "..", "..", ".."), "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function git(repo, ...args) {
	return execFileSync("git", ["-C", repo, ...args], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

const STAGE = "knowledge"
const AT = "2026-05-24T00:00:00Z"

test("seal_intent COMMITS the sealed_at stamp (so the auto-push can fire)", async () => {
	if (!HAS_GIT) return
	const slug = "seal-commit"
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-seal-"))
	const orig = process.cwd()
	try {
		initTestRepo({ repoRoot, slug })
		makeStudio({
			repoRoot,
			studio: "test-studio",
			stages: [
				{
					name: STAGE,
					hats: ["planner", "builder", "verifier"],
					review: "auto",
				},
			],
		})
		const intentDir = join(repoRoot, ".haiku", "intents", slug)
		// Autopilot intent, every intent-completion approval pre-signed, so the
		// cursor walks straight to seal_intent. Reflection off so it doesn't
		// detour through record_reflection first.
		makeIntent({
			intentDir,
			slug,
			studio: "test-studio",
			mode: "autopilot",
			approvals: {
				spec: { at: AT },
				continuity: { at: AT },
				"cross-stage-consistency": { at: AT },
				intent_quality_gates: { at: AT },
			},
		})
		// Turn reflection off (default-on would route to record_reflection),
		// and stamp the running engine version so the first tick walks to seal
		// instead of running a v0→v9 migration.
		const intentMd = join(intentDir, "intent.md")
		const { getPluginVersion } = await import(`${SRC}/version.ts`)
		const parsed = matter(readFileSync(intentMd, "utf8"))
		writeFileSync(
			intentMd,
			matter.stringify(parsed.content, {
				...parsed.data,
				reflection: false,
				plugin_version: getPluginVersion(),
			}),
		)
		// One fully-merged + approved unit so the stage reads complete
		// (autopilot approval roles = spec + quality_gates) → activeStage null.
		makeMergedUnit({
			intentDir,
			stage: STAGE,
			unit: "unit-01-x",
			hats: ["planner", "builder", "verifier"],
			roles: ["spec", "quality_gates"],
		})
		// Commit the seed so the only post-tick commit is the seal.
		git(repoRoot, "add", "-A")
		git(repoRoot, "commit", "-q", "-m", "seed", "--allow-empty")
		// Be on intent main (where seal commits).
		git(repoRoot, "checkout", "-q", `haiku/${slug}/main`)

		process.chdir(repoRoot)
		const { _resetIsGitRepoForTests } = await import(`${SRC}/state-tools.ts`)
		_resetIsGitRepoForTests()
		const { handleToolCall } = await import(`${SRC}/server/tool-call.ts`)
		// Tick until the intent seals (first tick may run the version migration;
		// the seal walk follows once the cursor reaches all-merged + approved).
		const actions = []
		for (let i = 0; i < 8; i++) {
			const rnResp = await handleToolCall({
				params: { name: "haiku_run_next", arguments: { intent: slug } },
			})
			let parsedResp
			try {
				parsedResp = JSON.parse(rnResp?.content?.[0]?.text ?? "{}")
			} catch {
				parsedResp = { action: rnResp?.content?.[0]?.text?.slice(0, 60) }
			}
			actions.push(parsedResp.action)
			if (matter(readFileSync(intentMd, "utf8")).data.sealed_at) break
		}

		// sealed_at is stamped...
		const sealedFm = matter(readFileSync(intentMd, "utf8")).data
		assert.ok(
			sealedFm.sealed_at,
			`sealed_at must be stamped on intent.md; action sequence: ${JSON.stringify(actions)}`,
		)

		// ...AND committed (BUG-4): a `seal intent` commit exists on the branch,
		// and the tree is clean (the stamp isn't left dirty/uncommitted).
		const log = git(repoRoot, "log", "--oneline", "-5")
		assert.match(
			log,
			new RegExp(`seal intent ${slug}`),
			`expected a 'seal intent ${slug}' commit; log:\n${log}`,
		)
		const sealedAtCommitted = git(
			repoRoot,
			"show",
			`HEAD:.haiku/intents/${slug}/intent.md`,
		)
		assert.match(
			sealedAtCommitted,
			/sealed_at:/,
			"sealed_at must be in the committed intent.md, not just the working tree",
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
