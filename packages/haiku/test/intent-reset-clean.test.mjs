#!/usr/bin/env npx tsx
// intent-reset-clean.test.mjs — proves haiku_intent_reset wipes every
// per-intent artifact: stage branches, intent main, the intent
// directory tree (stages/, feedback/, knowledge/, drift sidecars,
// gate-session.json, decisions.jsonl, legacy iterations.jsonl from
// pre-2026-05-13 v3 intents, etc.) — and that a follow-up
// haiku_intent_create starts on a clean slate with no carry-over.
//
// Note: iterations.jsonl is seeded in this fixture as a *legacy*
// artifact (pre-2026-05-13). It's never written by current code, but
// reset must still scrub it so migrated v3 intents don't leak state.
//
// Pinning the 2026-05-13 contract: "reseting the intent should not
// carry any stage/feedback/etc artifacts."

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
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

function writeFm(path, fm, body = "") {
	writeFileSync(path, matter.stringify(body, fm))
}

function repoRootFromIntentDir(intentDir) {
	// intentDir = <root>/.haiku/intents/<slug>; walk three up to the repo root.
	return dirname(dirname(dirname(intentDir)))
}

async function withRepo(slug, fn) {
	const root = mkdtempSync(join(tmpdir(), "intent-reset-"))
	const orig = process.cwd()
	try {
		git(root, "init", "-q", "-b", "main")
		git(root, "config", "user.email", "test@haiku.test")
		git(root, "config", "user.name", "haiku test")
		git(root, "config", "commit.gpgsign", "false")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		git(root, "checkout", "-q", "-b", `haiku/${slug}/main`)
		const haikuDir = join(root, ".haiku")
		mkdirSync(haikuDir, { recursive: true })
		writeFileSync(join(haikuDir, "settings.yml"), "drift_detection: false\n")
		const intentDir = join(root, ".haiku", "intents", slug)
		mkdirSync(intentDir, { recursive: true })
		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(root)
		await fn({ root, intentDir, slug })
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(root, { recursive: true, force: true })
	}
}

/**
 * Drop a "fat" set of artifacts under an intent dir — the kind of
 * payload a real running intent accumulates. Pinning makes the
 * post-reset "everything's gone" assertion meaningful instead of
 * trivially passing on an empty fixture.
 */
function seedIntentArtifacts(intentDir, slug) {
	writeFm(
		join(intentDir, "intent.md"),
		{
			title: "fat intent",
			studio: "software",
			mode: "continuous",
			plugin_version: "4.0.0",
		},
		"# fat intent\n\nReal-ish body.",
	)
	// knowledge/
	mkdirSync(join(intentDir, "knowledge"), { recursive: true })
	writeFileSync(
		join(intentDir, "knowledge", "CONVERSATION-CONTEXT.md"),
		"# Conversation Context\n\nuser told me to do X.",
	)
	writeFileSync(
		join(intentDir, "knowledge", "DISCOVERY.md"),
		"# discovery\n\nstuff\n",
	)
	// stages/inception with units, feedback, elaboration, iterations log,
	// gate-session, decisions log — the lot.
	for (const stage of ["inception", "design"]) {
		const sdir = join(intentDir, "stages", stage)
		mkdirSync(join(sdir, "units"), { recursive: true })
		mkdirSync(join(sdir, "feedback"), { recursive: true })
		mkdirSync(join(sdir, "artifacts"), { recursive: true })
		writeFm(
			join(sdir, "elaboration.md"),
			{ stage, recorded_at: "2026-05-13T00:00:00Z" },
			"elab body",
		)
		writeFm(
			join(sdir, "units", "unit-01.md"),
			{ title: "u1", started_at: "2026-05-13T00:00:00Z", iterations: [] },
			"u1 body",
		)
		writeFm(
			join(sdir, "feedback", "01-stale-finding.md"),
			{
				title: "stale",
				status: "pending",
				origin: "adversarial-review",
				author: "agent",
				author_type: "agent",
				created_at: "2026-05-13T00:00:00Z",
			},
			"fb body",
		)
		writeFileSync(
			join(sdir, "artifacts", "deliverable.md"),
			"# stage output\n\nhello\n",
		)
		writeFileSync(
			join(sdir, "iterations.jsonl"),
			'{"event":"open","at":"2026-05-13T00:00:00Z"}\n',
		)
		writeFileSync(
			join(sdir, "decisions.jsonl"),
			'{"decision":"x","at":"2026-05-13T00:00:00Z"}\n',
		)
		writeFileSync(
			join(sdir, "gate-session.json"),
			'{"gate_review_session_id":"abc"}',
		)
		writeFileSync(join(sdir, "DESIGN-BRIEF.md"), "# brief\n")
	}
	// A scratch file at the intent root — non-canonical but agents drop
	// stuff here sometimes.
	writeFileSync(join(intentDir, "scratch.txt"), "scratch")
	// Create the stage branches that reset is supposed to delete.
	const root = repoRootFromIntentDir(intentDir)
	try {
		execFileSync("git", ["branch", `haiku/${slug}/inception`], {
			cwd: root,
			stdio: "pipe",
		})
		execFileSync("git", ["branch", `haiku/${slug}/design`], {
			cwd: root,
			stdio: "pipe",
		})
	} catch {
		/* nothing — best effort */
	}
}

function listHaikuBranches(root, slug) {
	try {
		const out = execFileSync("git", ["branch", "--list", `haiku/${slug}/*`], {
			cwd: root,
			encoding: "utf8",
			stdio: "pipe",
		})
		return out
			.split("\n")
			.map((l) => l.replace(/^\*?\s*/, "").trim())
			.filter(Boolean)
	} catch {
		return []
	}
}

test("haiku_intent_reset wipes intent dir + every haiku/{slug}/* branch", {
	timeout: 60_000,
}, async () => {
	if (!HAS_GIT) return
	await withRepo("reset-clean", async ({ root, intentDir, slug }) => {
		seedIntentArtifacts(intentDir, slug)
		// Sanity: every artifact is present pre-reset.
		assert.ok(existsSync(join(intentDir, "stages", "inception")))
		assert.ok(existsSync(join(intentDir, "stages", "design")))
		assert.ok(existsSync(join(intentDir, "knowledge", "DISCOVERY.md")))
		assert.ok(
			existsSync(
				join(
					intentDir,
					"stages",
					"inception",
					"feedback",
					"01-stale-finding.md",
				),
			),
		)
		assert.ok(
			existsSync(join(intentDir, "stages", "inception", "iterations.jsonl")),
		)
		assert.ok(
			existsSync(join(intentDir, "stages", "inception", "gate-session.json")),
		)
		const branchesBefore = listHaikuBranches(root, slug)
		assert.ok(
			branchesBefore.includes(`haiku/${slug}/inception`),
			`expected inception branch pre-reset; got: ${branchesBefore.join(",")}`,
		)

		// Drive the reset tool. We bypass the SPA picker via the
		// `HAIKU_TEST_PICKER_AUTO_SELECT` env seam (see
		// `packages/haiku/src/server/picker.ts`).
		//
		// COUPLING: The value below ("reset") must match the option
		// `id` that `haiku_intent_reset`'s confirmation picker emits.
		// If that handler is ever renamed (e.g. to "confirm-reset"),
		// the picker seam falls through to the real SPA path and this
		// test hangs until the picker timeout. Source of truth:
		// `packages/haiku/src/tools/orchestrator/haiku_intent_reset.ts`.
		const { orchestratorToolHandlers } = await import(
			`${SRC}/tools/orchestrator/index.ts`
		)
		process.env.HAIKU_TEST_PICKER_AUTO_SELECT = "reset"
		try {
			const resetTool = orchestratorToolHandlers.get("haiku_intent_reset")
			assert.ok(resetTool, "haiku_intent_reset not registered")
			const resp = await resetTool.handle({ intent: slug })
			const txt = resp.content?.[0]?.text ?? ""
			assert.ok(
				txt.includes('"action": "intent_reset"') ||
					txt.includes('"action":"intent_reset"'),
				`reset did not return intent_reset action; got: ${txt.slice(0, 200)}`,
			)
		} finally {
			delete process.env.HAIKU_TEST_PICKER_AUTO_SELECT
		}

		// Intent dir is gone, in its entirety.
		assert.strictEqual(
			existsSync(intentDir),
			false,
			"intent dir should be wiped after reset; it still exists",
		)
		// No stage/feedback/etc files survive — recursively check
		// nothing under .haiku/intents/<slug>/ exists.
		const intentRoot = join(root, ".haiku", "intents", slug)
		assert.strictEqual(
			existsSync(intentRoot),
			false,
			"intent root should be gone after reset",
		)

		// Every haiku/{slug}/* branch is deleted.
		const branchesAfter = listHaikuBranches(root, slug)
		assert.deepStrictEqual(
			branchesAfter,
			[],
			`expected no haiku/${slug}/* branches after reset; got: ${branchesAfter.join(",")}`,
		)

		// The .haiku/ parent + sibling intents (if any) untouched.
		assert.ok(
			existsSync(join(root, ".haiku")),
			".haiku/ root should remain after reset",
		)
	})
})

test("reset → intent_create produces a clean slate (no stale stages/feedback/etc)", {
	timeout: 60_000,
}, async () => {
	if (!HAS_GIT) return
	await withRepo("reset-then-create", async ({ root, intentDir, slug }) => {
		seedIntentArtifacts(intentDir, slug)

		const { orchestratorToolHandlers } = await import(
			`${SRC}/tools/orchestrator/index.ts`
		)
		process.env.HAIKU_TEST_PICKER_AUTO_SELECT = "reset"
		let preservedContext = ""
		try {
			const resetTool = orchestratorToolHandlers.get("haiku_intent_reset")
			const resetResp = await resetTool.handle({ intent: slug })
			// reset returns the conversation context as a `context`
			// field on its structured payload — that's how the
			// preservation contract works. Reset itself doesn't write
			// it to disk; the recreate flow does, via intent_create's
			// `context:` argument. Pull it out so we can prove the
			// roundtrip.
			const resetTxt = resetResp.content?.[0]?.text ?? ""
			const ctxMatch = resetTxt.match(/"context":\s*"((?:[^"\\]|\\.)*)"/)
			if (ctxMatch) preservedContext = ctxMatch[1].replace(/\\n/g, "\n")
		} finally {
			delete process.env.HAIKU_TEST_PICKER_AUTO_SELECT
		}
		assert.ok(
			preservedContext.length > 0,
			"reset should return preserved CONVERSATION-CONTEXT.md content in its payload — got empty",
		)
		assert.ok(
			preservedContext.includes("user told me to do X"),
			`preserved context should carry the seeded body; got: ${preservedContext.slice(0, 200)}`,
		)

		// Now create a fresh intent at the same slug — the dance the
		// reset prompt instructs the agent to do. Pass the preserved
		// context through so the recreate flow writes it back to disk.
		const createTool = orchestratorToolHandlers.get("haiku_intent_create")
		assert.ok(createTool, "haiku_intent_create not registered")
		const createResp = await createTool.handle({
			slug,
			title: "fat intent",
			description: "Real-ish body.",
			context: preservedContext,
		})
		const createTxt = createResp.content?.[0]?.text ?? ""
		assert.ok(
			!createTxt.includes("intent_exists"),
			`create should succeed post-reset; got: ${createTxt.slice(0, 300)}`,
		)

		// Fresh intent dir: only the just-created intent.md + the
		// engine-created knowledge/ and stages/ scaffolding. NO
		// pre-reset content survives.
		const intentRoot = join(root, ".haiku", "intents", slug)
		assert.ok(existsSync(intentRoot), "intent root recreated by create")
		// stages/ must be empty (no inception/design subdirs from
		// before).
		const stagesDir = join(intentRoot, "stages")
		if (existsSync(stagesDir)) {
			const stageEntries = readdirSync(stagesDir)
			assert.deepStrictEqual(
				stageEntries,
				[],
				`stages/ should be empty after create; got: ${stageEntries.join(",")}`,
			)
		}
		// knowledge/ proves the preservation roundtrip:
		//   - CONVERSATION-CONTEXT.md MUST exist (recreate-with-context
		//     restored it from the reset payload).
		//   - DISCOVERY.md must be absent (it was stage-produced output,
		//     not session context — reset must not resurrect it).
		const knowledgeDir = join(intentRoot, "knowledge")
		assert.ok(existsSync(knowledgeDir), "knowledge/ should be recreated")
		const kEntries = readdirSync(knowledgeDir)
		assert.ok(
			kEntries.includes("CONVERSATION-CONTEXT.md"),
			`CONVERSATION-CONTEXT.md should be restored post-recreate; got: ${kEntries.join(",")}`,
		)
		const ctxBody = readFileSync(
			join(knowledgeDir, "CONVERSATION-CONTEXT.md"),
			"utf8",
		)
		assert.ok(
			ctxBody.includes("user told me to do X"),
			`restored CONVERSATION-CONTEXT.md should carry the seeded body; got: ${ctxBody.slice(0, 200)}`,
		)
		assert.ok(
			!kEntries.includes("DISCOVERY.md"),
			`knowledge/ should not contain stale DISCOVERY.md; got: ${kEntries.join(",")}`,
		)
		// No scratch files survive at the intent root.
		assert.strictEqual(
			existsSync(join(intentRoot, "scratch.txt")),
			false,
			"scratch.txt from pre-reset should NOT survive",
		)
	})
})
