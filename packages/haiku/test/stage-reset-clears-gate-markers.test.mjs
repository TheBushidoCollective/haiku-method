#!/usr/bin/env npx tsx
// stage-reset-clears-gate-markers.test.mjs — regression pin for the
// #357 secondary fix.
//
// Without this defense, a stage reset would leave stale
// `gate_review_session_<stage>`, `gate_review_url_<stage>`, and
// `gate_review_context` fields in intent.md. The next
// `haiku_await_gate` could then attach to a SPA session whose
// `pending_decision` was made for the pre-reset version of the
// stage, replaying a workflow verb (approve / complete_intent /
// etc.) against state it no longer matches. That's the class of
// bug the user reported in #357's "Suggested fixes" §2.
//
// What this test pins (no full e2e — assert on FM directly):
//
//   1. Stage reset clears the keyed gate-session markers for the
//      reset stage.
//   2. Stage reset clears the global gate context fields
//      (gate_review_context, gate_review_next_stage,
//      gate_review_next_phase) when keyed markers existed.
//   3. Stage reset does NOT touch unrelated FM fields (title,
//      studio, mode, plugin_version, sealed_at, etc.).

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

function setupRepoWithIntent(slug, stage, extraFm = {}) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-stage-reset-"))
	git(tmp, "init", "-q", "-b", "main")
	git(tmp, "config", "user.email", "test@haiku")
	git(tmp, "config", "user.name", "haiku-test")
	git(tmp, "config", "commit.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "# test\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "init")
	// Seed intent.md on main BEFORE branching so `haiku/<slug>/main`
	// has it. stage_reset's "move HEAD off stage branch" step
	// checks out haiku/<slug>/main; without intent.md committed
	// there, the working tree loses the file mid-test.
	const haikuDir = join(tmp, ".haiku")
	mkdirSync(haikuDir, { recursive: true })
	const intentDir = join(haikuDir, "intents", slug)
	mkdirSync(intentDir, { recursive: true })
	const intentFile = join(intentDir, "intent.md")
	writeFileSync(
		intentFile,
		matter.stringify("# test\n", {
			title: "test intent",
			studio: "software",
			mode: "continuous",
			plugin_version: "4.0.0",
			...extraFm,
		}),
	)
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "seed intent on main")
	git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
	git(tmp, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(stageDir, { recursive: true })
	// Seed something in the stage dir so reset has something to wipe;
	// the gate-marker cleanup only fires after the wipe path runs.
	writeFileSync(join(stageDir, "elaboration.md"), "elab body\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "seed stage content")
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	return { tmp, intentDir, intentFile, stageDir }
}

function readFm(path) {
	return matter(readFileSync(path, "utf8")).data
}

test("stage reset clears keyed gate-session markers + global gate context", async () => {
	if (!HAS_GIT) return
	const slug = "test-intent"
	const stage = "inception"
	const { tmp, intentFile } = setupRepoWithIntent(slug, stage, {
		[`gate_review_session_${stage}`]: "session-abc",
		[`gate_review_url_${stage}`]: "http://localhost:0/test",
		gate_review_context: "stage_gate",
		gate_review_next_stage: "design",
		gate_review_next_phase: "elaborate",
		// An unrelated marker that must survive the cleanup.
		sealed_at: null,
	})
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { orchestratorToolHandlers } = await import(
			`${SRC}/tools/orchestrator/index.ts`
		)
		// Bypass the SPA picker via the test seam.
		process.env.HAIKU_TEST_PICKER_AUTO_SELECT = "reset"
		try {
			const tool = orchestratorToolHandlers.get("haiku_stage_reset")
			assert.ok(tool, "haiku_stage_reset not registered")
			const resp = await tool.handle({ intent: slug, stage })
			const txt = resp.content?.[0]?.text ?? ""
			assert.ok(
				txt.includes("stage_reset"),
				`reset response should signal completion; got ${txt.slice(0, 200)}`,
			)
		} finally {
			delete process.env.HAIKU_TEST_PICKER_AUTO_SELECT
		}

		const finalFm = readFm(intentFile)
		// Keyed gate-session markers gone.
		assert.ok(
			!(`gate_review_session_${stage}` in finalFm),
			"keyed session marker must be cleared",
		)
		assert.ok(
			!(`gate_review_url_${stage}` in finalFm),
			"keyed url marker must be cleared",
		)
		// Global gate context fields gone.
		assert.ok(
			!("gate_review_context" in finalFm),
			"gate_review_context must be cleared",
		)
		assert.ok(
			!("gate_review_next_stage" in finalFm),
			"gate_review_next_stage must be cleared",
		)
		assert.ok(
			!("gate_review_next_phase" in finalFm),
			"gate_review_next_phase must be cleared",
		)
		// Unrelated FM untouched.
		assert.strictEqual(finalFm.title, "test intent")
		assert.strictEqual(finalFm.studio, "software")
		assert.strictEqual(finalFm.mode, "continuous")
		assert.strictEqual(finalFm.plugin_version, "4.0.0")
		assert.ok("sealed_at" in finalFm, "unrelated sealed_at must survive")
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("stage reset is a no-op for global gate context when no keyed markers existed", async () => {
	// Defense against accidentally clearing another stage's gate
	// markers: if THIS stage had no keyed session, the global context
	// fields (which could point at a different stage) must be left
	// alone.
	if (!HAS_GIT) return
	const slug = "test-intent"
	const stage = "inception"
	const { tmp, intentFile } = setupRepoWithIntent(slug, stage, {
		// NO keyed markers for inception. Just a global context that
		// refers to a different stage's session.
		gate_review_context: "stage_gate",
		gate_review_next_stage: "design",
		gate_review_next_phase: "elaborate",
		gate_review_session_design: "other-stage-session",
	})
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { orchestratorToolHandlers } = await import(
			`${SRC}/tools/orchestrator/index.ts`
		)
		process.env.HAIKU_TEST_PICKER_AUTO_SELECT = "reset"
		try {
			const tool = orchestratorToolHandlers.get("haiku_stage_reset")
			await tool.handle({ intent: slug, stage })
		} finally {
			delete process.env.HAIKU_TEST_PICKER_AUTO_SELECT
		}

		const finalFm = readFm(intentFile)
		// The OTHER stage's session must survive — we didn't reset that
		// stage.
		assert.strictEqual(
			finalFm.gate_review_session_design,
			"other-stage-session",
			"another stage's keyed session must NOT be cleared",
		)
		// Global context lines stay (no keyed markers for THIS stage =
		// nothing to anchor the cleanup against).
		assert.ok(
			"gate_review_context" in finalFm,
			"global context should survive when no keyed markers were present for this stage",
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
