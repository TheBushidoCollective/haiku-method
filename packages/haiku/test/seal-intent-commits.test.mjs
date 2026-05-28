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
	deliverIntent,
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
		// detour through record_reflection first. NOTE: the terminal `user`
		// gate fires in EVERY mode now (2026-05-26) — autopilot included — so
		// it must be pre-signed here too, or the walk parks at the final gate
		// instead of sealing (which is the whole point of the always-on gate).
		makeIntent({
			intentDir,
			slug,
			studio: "test-studio",
			mode: "autopilot",
			approvals: {
				spec: { at: AT },
				continuity: { at: AT },
				"cross-stage-consistency": { at: AT },
				// delivery-verifier is a GLOBAL intent-review-agent every studio
				// walks; pre-sign it so the cursor reaches the terminal merge
				// gate (the subject under test) instead of parking on its
				// dispatch.
				"delivery-verifier": { at: AT },
				user: { at: AT },
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

		const tick = async () => {
			const rnResp = await handleToolCall({
				params: { name: "haiku_run_next", arguments: { intent: slug } },
			})
			// The response is the action JSON, then `\n\n---\n\n`, then prose.
			const txt = rnResp?.content?.[0]?.text ?? "{}"
			const jsonPart = txt.split("\n\n---\n\n")[0]
			try {
				return JSON.parse(jsonPart)
			} catch {
				return { action: txt.slice(0, 60) }
			}
		}

		// MERGE GATE (2026-05-28): the hub branch `haiku/<slug>/main` has NOT
		// landed on the default branch yet, so the intent must HOLD at
		// `pending_seal` — built, signed, reflected, but not delivered. It
		// must NOT stamp `sealed_at`. (First tick may run a no-op migration;
		// give it a couple ticks to settle on the terminal action.)
		let preDeliverAction
		for (let i = 0; i < 4; i++) {
			preDeliverAction = (await tick()).action
			if (preDeliverAction === "pending_seal") break
		}
		assert.equal(
			preDeliverAction,
			"pending_seal",
			`unmerged intent must hold at pending_seal, got: ${preDeliverAction}`,
		)
		assert.ok(
			!matter(readFileSync(intentMd, "utf8")).data.sealed_at,
			"sealed_at must NOT be stamped while the hub branch is unmerged",
		)

		// LEGACY guard: an intent that ALREADY carries a sealed_at stamp
		// (sealed before the merge gate, or a premature seal) must STILL hold
		// at pending_seal while unmerged — the cursor's sealed short-circuit
		// must NOT fire until the work lands. This is what lets a pickup
		// re-audit the PR instead of treating the intent as done.
		{
			const p = matter(readFileSync(intentMd, "utf8"))
			writeFileSync(
				intentMd,
				matter.stringify(p.content, {
					...p.data,
					sealed_at: "2026-05-24T00:00:00Z",
				}),
			)
			const legacyHeld = (await tick()).action
			assert.equal(
				legacyHeld,
				"pending_seal",
				`a sealed-but-unmerged intent must stay held (not short-circuit to sealed), got: ${legacyHeld}`,
			)
			// Clear it so the seal-commit flow below exercises the real
			// seal_intent stamp + commit path.
			const p2 = matter(readFileSync(intentMd, "utf8"))
			const { sealed_at: _drop, ...rest } = p2.data
			writeFileSync(intentMd, matter.stringify(p2.content, rest))
		}

		// Simulate the human/host merging the delivery into the default
		// branch — the engine never does this itself.
		deliverIntent({ repoRoot, slug })

		// Now tick until the intent seals (the cursor walks `seal_intent`
		// once the hub branch is an ancestor of the default branch).
		const actions = []
		for (let i = 0; i < 8; i++) {
			actions.push((await tick()).action)
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
