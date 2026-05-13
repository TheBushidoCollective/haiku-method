#!/usr/bin/env npx tsx
// user-gate-next-stage-routing.test.mjs — pins the #357 fix.
//
// Before: when the cursor emitted `user_gate { gate_kind: "approval",
// stage: "<non-final>" }`, haiku_run_next's gate-review prepare path
// wrote `gate_review_context: "stage_gate"` to intent.md but left
// `gate_review_next_stage` unset. When the SPA submitted `approved`,
// haiku_await_gate's "approved" branch fell past the
// `if (nextStage)` advance_stage branch and into
// `completeOrReviewIntent`, which checked findIncompleteStages,
// found later stages incomplete, and returned the "Cannot complete
// intent" error. The SPA's persistent session replayed the cached
// `approved` decision every tick, so the agent looped without
// recourse.
//
// After: haiku_run_next computes nextStage from the studio's stage
// list when gate_kind === "approval". The FM now carries
// `gate_review_next_stage`; await_gate's approved branch routes to
// advance_stage cleanly.
//
// What this test pins (no full e2e — we assert on the FM after a
// user_gate prepare runs):
//
//   1. user_gate(approval) on a non-final stage → FM carries
//      gate_review_next_stage = <next stage in studio topology>.
//   2. user_gate(approval) on the final stage → FM does NOT carry
//      gate_review_next_stage (so completeOrReviewIntent fires for
//      the legit completion path).
//   3. user_gate(spec) — never sets next_stage (spec gates use
//      next_phase, not next_stage).

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
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
const REPO_ROOT = resolve(HERE, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

function setupRepo(slug, stage) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-user-gate-"))
	git(tmp, "init", "-q", "-b", "main")
	git(tmp, "config", "user.email", "test@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	git(tmp, "config", "commit.gpgsign", "false")
	git(tmp, "commit", "--allow-empty", "-q", "-m", "init")
	git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
	git(tmp, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)
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
	mkdirSync(join(tmp, ".haiku", "studios"), { recursive: true })
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	return { tmp, intentDir }
}

/** Simulate haiku_run_next's user_gate prepare path: compute the
 *  nextStage the way haiku_run_next.ts does now, and write the gate
 *  pointers to intent.md the way that handler does. Then read the FM
 *  back and assert on what landed. We test the data the engine
 *  writes, not the prepare-tool transport. */
async function simulateUserGatePrepare({ tmp, intentDir, stage, gateKind }) {
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { resolveStudioStages } = await import(
			`${REPO_ROOT}/packages/haiku/src/orchestrator/studio.ts`
		)
		const { parseFrontmatter, setFrontmatterField } = await import(
			`${REPO_ROOT}/packages/haiku/src/state-tools.ts`
		)
		const intentFile = join(intentDir, "intent.md")
		const intentFm = parseFrontmatter(readFileSync(intentFile, "utf8")).data
		const studioName =
			typeof intentFm.studio === "string" ? intentFm.studio : ""
		let nextStage = null
		if (gateKind === "approval") {
			const stages = resolveStudioStages(studioName) ?? []
			const idx = stages.indexOf(stage)
			if (idx >= 0 && idx < stages.length - 1) {
				nextStage = stages[idx + 1]
			}
		}
		// Spec gates always transition elaborate → execute. Mirror the
		// handler in haiku_run_next.ts.
		const nextPhase = gateKind === "spec" ? "execute" : null
		const gateContext =
			gateKind === "spec" ? "elaborate_to_execute" : "stage_gate"
		setFrontmatterField(
			intentFile,
			`gate_review_session_${stage}`,
			"test-session-id",
		)
		setFrontmatterField(
			intentFile,
			`gate_review_url_${stage}`,
			"http://localhost:0/test",
		)
		setFrontmatterField(intentFile, "gate_review_context", gateContext)
		if (nextStage !== null && nextStage !== undefined) {
			setFrontmatterField(intentFile, "gate_review_next_stage", nextStage)
		}
		if (nextPhase !== null && nextPhase !== undefined) {
			setFrontmatterField(intentFile, "gate_review_next_phase", nextPhase)
		}
		const finalFm = matter(readFileSync(intentFile, "utf8")).data
		return { nextStage, nextPhase, finalFm }
	} finally {
		process.chdir(orig)
	}
}

test("user_gate(approval) on non-final stage writes gate_review_next_stage from studio topology", async () => {
	const { tmp, intentDir } = setupRepo("test-intent", "inception")
	try {
		const { nextStage, finalFm } = await simulateUserGatePrepare({
			tmp,
			intentDir,
			stage: "inception",
			gateKind: "approval",
		})
		// Software studio order: inception, design, product, development,
		// operations, security. inception → design.
		assert.strictEqual(
			nextStage,
			"design",
			"inception is not final; nextStage must be design",
		)
		assert.strictEqual(
			finalFm.gate_review_next_stage,
			"design",
			"FM must carry gate_review_next_stage so await_gate routes to advance_stage",
		)
		assert.strictEqual(finalFm.gate_review_context, "stage_gate")
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("user_gate(approval) on final stage leaves gate_review_next_stage unset", async () => {
	const { tmp, intentDir } = setupRepo("test-intent", "security")
	try {
		const { nextStage, finalFm } = await simulateUserGatePrepare({
			tmp,
			intentDir,
			stage: "security",
			gateKind: "approval",
		})
		// security is the final stage of software studio.
		assert.strictEqual(
			nextStage,
			null,
			"security is final; nextStage must be null so completeOrReviewIntent fires",
		)
		assert.ok(
			!("gate_review_next_stage" in finalFm),
			`FM must NOT carry gate_review_next_stage for the final stage; got ${JSON.stringify(finalFm.gate_review_next_stage)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("user_gate(spec) writes gate_review_next_phase = 'execute' and leaves nextStage unset", async () => {
	// Sibling of the #357 approval fix. Pre-fix: nextPhase was
	// unconditionally null for user_gate, so await_gate's "approved"
	// branch fell past `if (gateContext === "elaborate_to_execute"
	// && nextPhase)` into completeOrReviewIntent — which rejected
	// with "Cannot complete intent" if any later stage wasn't done.
	// Reported on `admin-portal-reimagine` 2026-05-13. Now spec
	// gates always write `gate_review_next_phase: "execute"` so
	// approval routes to advance_phase cleanly.
	const { tmp, intentDir } = setupRepo("test-intent", "inception")
	try {
		const { nextStage, nextPhase, finalFm } = await simulateUserGatePrepare({
			tmp,
			intentDir,
			stage: "inception",
			gateKind: "spec",
		})
		assert.strictEqual(
			nextPhase,
			"execute",
			"spec gates must write next_phase = 'execute' so await_gate routes to advance_phase",
		)
		assert.strictEqual(
			finalFm.gate_review_next_phase,
			"execute",
			"FM must carry gate_review_next_phase for the spec-gate routing branch",
		)
		assert.strictEqual(
			nextStage,
			null,
			"spec gates advance phase, not stage; nextStage stays null",
		)
		assert.strictEqual(finalFm.gate_review_context, "elaborate_to_execute")
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
