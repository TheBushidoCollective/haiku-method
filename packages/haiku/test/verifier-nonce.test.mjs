#!/usr/bin/env npx tsx
// verifier-nonce.test.mjs — GAPS.md § 3 (2026-05-14).
//
// End-to-end coverage for the verifier-nonce contract:
//
//   1. The cursor mints a `verifier_nonce` on the action payload when
//      it emits `elaborate_review` or `decompose_review`.
//   2. Seal tools (`haiku_intent_seal`, `haiku_stage_elaboration_seal`,
//      `haiku_stage_decompose_seal`) refuse without a valid nonce —
//      a missing nonce returns `verifier_nonce_invalid: missing`, a
//      wrong nonce returns `verifier_nonce_invalid: mismatch`.
//   3. The correct nonce consumes the entry: calling seal twice with
//      the same nonce fails the second time.
//   4. `haiku_stage_elaboration_record` clears any pending nonces for
//      the stage (so an in-flight verifier dispatched against the old
//      body can't seal the new body).
//
// The sidecar storage lives at `.haiku/intents/<slug>/.verifier-nonces.json`
// (see `packages/haiku/src/orchestrator/workflow/verifier-nonce.ts`).

import assert from "node:assert"
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
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"
import {
	initTestRepo,
	makeIntent,
	makeStudio,
	onStageBranch,
	runTickWithBranchAlignment,
} from "./_v4-fixtures.mjs"

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

async function withRepo(slug, fn) {
	const root = mkdtempSync(join(tmpdir(), "haiku-nonce-"))
	const orig = process.cwd()
	try {
		const repo = initTestRepo({ repoRoot: root, slug })
		process.chdir(root)
		return await fn(repo)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(root, { recursive: true, force: true })
	}
}

function noncePath(intentDir) {
	return join(intentDir, ".verifier-nonces.json")
}

function readSidecar(intentDir) {
	const p = noncePath(intentDir)
	if (!existsSync(p)) return {}
	return JSON.parse(readFileSync(p, "utf8"))
}

test("cursor mints verifier_nonce on elaborate_review (per-stage)", async () => {
	if (!HAS_GIT) return
	await withRepo(
		"test-nonce-elaborate",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({
				repoRoot,
				studio: "test",
				stages: [
					{ name: "design", hats: ["planner", "verifier"], review: "ask" },
				],
			})
			makeIntent({ intentDir, slug, studio: "test", stages: ["design"] })

			// Record an unverified elaboration so the cursor emits
			// elaborate_review on the next tick. We seed it directly rather
			// than going through `haiku_stage_elaboration_record` because we
			// want the cursor to be the thing that mints the nonce, not the
			// record tool.
			const elabPath = join(intentDir, "stages", "design", "elaboration.md")
			onStageBranch(repoRoot, slug, "design", () => {
				mkdirSync(join(intentDir, "stages", "design"), { recursive: true })
				writeFileSync(
					elabPath,
					matter.stringify("test elaboration", {
						recorded_at: new Date().toISOString(),
						intent: slug,
						stage: "design",
					}),
				)
				execFileSync("git", ["-C", repoRoot, "add", elabPath])
				execFileSync("git", ["-C", repoRoot, "commit", "-m", "seed elab"])
			})

			const tick = await runTickWithBranchAlignment(slug)
			// Post-Option-A: the cursor emits a single `elaborate_loop`
			// carrying `verify_conversation` in `signals_unmet`, with the
			// nonce surfaced on `verifier_nonces.verify_conversation`.
			assert.strictEqual(tick.action, "elaborate_loop")
			assert.strictEqual(tick.stage, "design")
			const nonce = tick.verifier_nonces?.verify_conversation
			assert.ok(
				typeof nonce === "string" && nonce.length === 32,
				`expected 32-char hex nonce on verifier_nonces.verify_conversation; got ${JSON.stringify(tick.verifier_nonces)}`,
			)

			const sidecar = readSidecar(intentDir)
			assert.deepStrictEqual(
				Object.keys(sidecar).sort(),
				["stages/design/elaborate"],
				`unexpected sidecar keys: ${JSON.stringify(sidecar)}`,
			)
			assert.strictEqual(sidecar["stages/design/elaborate"].nonce, nonce)

			// Idempotent: a second tick against the same disk state reuses
			// the same nonce (no rotation while recorded_at is unchanged).
			const tick2 = await runTickWithBranchAlignment(slug)
			assert.strictEqual(tick2.verifier_nonces?.verify_conversation, nonce)
		},
	)
})

test("haiku_stage_elaboration_seal refuses without nonce, accepts the minted one once", async () => {
	if (!HAS_GIT) return
	await withRepo("test-nonce-seal", async ({ repoRoot, intentDir, slug }) => {
		makeStudio({
			repoRoot,
			studio: "test",
			stages: [
				{ name: "design", hats: ["planner", "verifier"], review: "ask" },
			],
		})
		makeIntent({ intentDir, slug, studio: "test", stages: ["design"] })

		const elabPath = join(intentDir, "stages", "design", "elaboration.md")
		onStageBranch(repoRoot, slug, "design", () => {
			mkdirSync(join(intentDir, "stages", "design"), { recursive: true })
			writeFileSync(
				elabPath,
				matter.stringify("test elaboration", {
					recorded_at: new Date().toISOString(),
					intent: slug,
					stage: "design",
				}),
			)
			execFileSync("git", ["-C", repoRoot, "add", elabPath])
			execFileSync("git", ["-C", repoRoot, "commit", "-m", "seed elab"])
		})

		const tick = await runTickWithBranchAlignment(slug)
		const nonce = tick.verifier_nonces?.verify_conversation
		assert.ok(typeof nonce === "string", "missing minted nonce on tick")
		const { default: sealTool } = await import(
			"../src/tools/orchestrator/haiku_stage_elaboration_seal.ts"
		)

		// Missing nonce → gate rejects at the schema layer (required field).
		const noNonce = await sealTool.handle({ intent: slug, stage: "design" })
		assert.ok(noNonce.isError)
		const noNonceBody = JSON.parse(noNonce.content[0].text)
		assert.ok(
			noNonceBody.error === "haiku_stage_elaboration_seal_input_invalid" ||
				noNonceBody.error === "verifier_nonce_invalid",
			`expected input-invalid or verifier_nonce_invalid; got ${noNonceBody.error}`,
		)

		// Wrong nonce → handler rejects with verifier_nonce_invalid: mismatch.
		const wrong = await sealTool.handle({
			intent: slug,
			stage: "design",
			nonce: "deadbeef".repeat(4),
		})
		assert.ok(wrong.isError)
		const wrongBody = JSON.parse(wrong.content[0].text)
		assert.strictEqual(wrongBody.error, "verifier_nonce_invalid")
		assert.strictEqual(wrongBody.reason, "mismatch")

		// Correct nonce → seal stamps verified_at on the artifact and
		// consumes the sidecar entry.
		onStageBranch(repoRoot, slug, "design", async () => {
			const ok = await sealTool.handle({
				intent: slug,
				stage: "design",
				nonce,
			})
			assert.ok(!ok.isError, `seal failed: ${JSON.stringify(ok)}`)
			const okBody = JSON.parse(ok.content[0].text)
			assert.strictEqual(okBody.action, "elaboration_sealed")
		})

		// Sidecar entry cleared.
		const sidecar = readSidecar(intentDir)
		assert.strictEqual(sidecar["stages/design/elaborate"], undefined)

		// Second call with same nonce → verifier_nonce_invalid: missing.
		const replay = await sealTool.handle({
			intent: slug,
			stage: "design",
			nonce,
		})
		assert.ok(replay.isError)
		const replayBody = JSON.parse(replay.content[0].text)
		assert.strictEqual(replayBody.error, "verifier_nonce_invalid")
		assert.strictEqual(replayBody.reason, "missing")
	})
})

test("haiku_stage_elaboration_record clears pending nonces (in-flight verifier can't seal new body)", async () => {
	if (!HAS_GIT) return
	await withRepo(
		"test-nonce-rerecord",
		async ({ repoRoot, intentDir, slug }) => {
			makeStudio({
				repoRoot,
				studio: "test",
				stages: [
					{ name: "design", hats: ["planner", "verifier"], review: "ask" },
				],
			})
			makeIntent({ intentDir, slug, studio: "test", stages: ["design"] })

			const elabPath = join(intentDir, "stages", "design", "elaboration.md")
			onStageBranch(repoRoot, slug, "design", () => {
				mkdirSync(join(intentDir, "stages", "design"), { recursive: true })
				writeFileSync(
					elabPath,
					matter.stringify("first body", {
						recorded_at: new Date().toISOString(),
						intent: slug,
						stage: "design",
					}),
				)
				execFileSync("git", ["-C", repoRoot, "add", elabPath])
				execFileSync("git", ["-C", repoRoot, "commit", "-m", "seed elab v1"])
			})

			const tick1 = await runTickWithBranchAlignment(slug)
			const oldNonce = tick1.verifier_nonces?.verify_conversation
			assert.ok(typeof oldNonce === "string" && oldNonce.length === 32)

			// Re-record clears the nonce.
			const { default: recordTool } = await import(
				"../src/tools/orchestrator/haiku_stage_elaboration_record.ts"
			)
			await onStageBranch(repoRoot, slug, "design", async () => {
				const r = await recordTool.handle({
					intent: slug,
					stage: "design",
					body: "rewritten body with more substance",
				})
				assert.ok(!r.isError)
			})

			// Old nonce in the stale verifier subagent's hands is gone.
			const sidecarAfter = readSidecar(intentDir)
			assert.strictEqual(sidecarAfter["stages/design/elaborate"], undefined)

			const { default: sealTool } = await import(
				"../src/tools/orchestrator/haiku_stage_elaboration_seal.ts"
			)
			const stale = await sealTool.handle({
				intent: slug,
				stage: "design",
				nonce: oldNonce,
			})
			assert.ok(stale.isError)
			const staleBody = JSON.parse(stale.content[0].text)
			assert.strictEqual(staleBody.error, "verifier_nonce_invalid")
			assert.strictEqual(staleBody.reason, "missing")

			// Next tick mints a fresh nonce tied to the new recorded_at.
			const tick2 = await runTickWithBranchAlignment(slug)
			assert.strictEqual(tick2.action, "elaborate_loop")
			const newNonce = tick2.verifier_nonces?.verify_conversation
			assert.ok(typeof newNonce === "string")
			assert.notStrictEqual(newNonce, oldNonce)
		},
	)
})

test("haiku_intent_seal requires nonce for pre-intent elaborate_review", async () => {
	if (!HAS_GIT) return
	await withRepo("test-nonce-intent", async ({ repoRoot, intentDir, slug }) => {
		makeStudio({
			repoRoot,
			studio: "test",
			stages: [
				{ name: "design", hats: ["planner", "verifier"], review: "ask" },
			],
		})
		// Truly-fresh intent: no verified_at, no units. Pre-intent
		// elaborate_review fires.
		makeIntent({
			intentDir,
			slug,
			studio: "test",
			stages: ["design"],
			verifyOnCreate: false,
		})

		const tick = await runTickWithBranchAlignment(slug)
		assert.strictEqual(tick.action, "elaborate_loop")
		assert.strictEqual(tick.stage, undefined)
		const nonce = tick.verifier_nonces?.verify_conversation
		assert.ok(typeof nonce === "string", "missing pre-intent nonce")

		const { default: intentSeal } = await import(
			"../src/tools/orchestrator/haiku_intent_seal.ts"
		)

		const wrong = await intentSeal.handle({
			intent: slug,
			nonce: `${"wrongwrong".repeat(3)}ab`,
		})
		assert.ok(wrong.isError)
		const wrongBody = JSON.parse(wrong.content[0].text)
		assert.strictEqual(wrongBody.error, "verifier_nonce_invalid")

		const ok = await intentSeal.handle({
			intent: slug,
			nonce,
		})
		assert.ok(!ok.isError, `intent seal failed: ${JSON.stringify(ok)}`)
		const okBody = JSON.parse(ok.content[0].text)
		assert.strictEqual(okBody.action, "intent_sealed")
	})
})
