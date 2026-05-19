// pick-design-direction-manifest.test.mjs
//
// Regression for the 2026-05-18 "pick_design_direction doesn't write
// the manifest" bug (haiku-pick-design-direction-bug bundle, intent
// admin-portal-reimagine/design).
//
// Root cause: `awaitDesignDirectionSession` returned the announcement
// text but never wrote the discovery manifest file the elaborate-loop
// prompt promised as a side effect. The cursor reads file existence at
// `stages/<stage>/artifacts/design-direction.md` as the discovery
// signal; with no file on disk, the gate never cleared and the agent
// looped on the same `elaborate_loop` action.
//
// Also covers the autopilot short-circuit: when `intent.mode === "autopilot"`,
// `pick_design_direction` must NOT open the SPA picker. It auto-writes
// a manifest using the first archetype (or an "auto" stamp when no
// candidates are supplied) so the cursor's gate clears immediately.

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

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function gitInit(repoRoot) {
	execFileSync("git", ["init", "-q", "-b", "main", repoRoot], {
		stdio: "ignore",
	})
	execFileSync("git", ["-C", repoRoot, "config", "user.email", "test@test"], {
		stdio: "ignore",
	})
	execFileSync("git", ["-C", repoRoot, "config", "user.name", "test"], {
		stdio: "ignore",
	})
	execFileSync("git", ["-C", repoRoot, "config", "commit.gpgsign", "false"], {
		stdio: "ignore",
	})
	writeFileSync(join(repoRoot, ".gitkeep"), "")
	execFileSync("git", ["-C", repoRoot, "add", "."], { stdio: "ignore" })
	execFileSync(
		"git",
		["-C", repoRoot, "commit", "-q", "-m", "init"],
		{ stdio: "ignore" },
	)
}

function seedAutopilotIntent(repoRoot, slug, stage = "design") {
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("intent body\n", {
			studio: "software",
			mode: "autopilot",
			stages: [stage],
			plugin_version: "9.0.0",
		}),
	)
	// Seed verified elaboration so the cursor's `findCurrentStage`
	// resolves to the design stage (not the pre-intent loop).
	writeFileSync(
		join(stageDir, "elaboration.md"),
		matter.stringify("elaboration body\n", {
			recorded_at: "t",
			intent: slug,
			stage,
			verified_at: "t",
			decompose_verified_at: "t",
		}),
	)
	// One unit so findCurrentStage doesn't trip on empty.
	writeFileSync(
		join(stageDir, "units", "unit-01.md"),
		matter.stringify("u\n", {
			title: "u1",
			depends_on: [],
			inputs: [],
			started_at: null,
			iterations: [],
			reviews: {},
			approvals: {},
		}),
	)
	execFileSync("git", ["-C", repoRoot, "add", "."], { stdio: "ignore" })
	execFileSync(
		"git",
		["-C", repoRoot, "commit", "-q", "-m", "seed intent"],
		{ stdio: "ignore" },
	)
	return intentDir
}

test("autopilot: pick_design_direction auto-selects first archetype and writes manifest (no SPA picker)", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-pick-dd-auto-"))
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		gitInit(repoRoot)
		const intentDir = seedAutopilotIntent(repoRoot, "demo-auto")

		const { handleToolCall } = await import(`${SRC}server/tool-call.ts`)

		const response = await handleToolCall({
			params: {
				name: "pick_design_direction",
				arguments: {
					intent_slug: "demo-auto",
					archetypes: [
						{
							name: "Triage Queue",
							description: "Side-rail signals layout",
							preview_html: "<div>triage</div>",
						},
						{
							name: "Split Mode",
							description: "Two-column workspace",
							preview_html: "<div>split</div>",
						},
					],
				},
			},
		})

		// Tool MUST return a success response (not an error), MUST NOT
		// block (we did NOT mock the SPA — if the tool tried to open
		// the browser and wait, this assertion would hang forever).
		assert.equal(
			response.isError,
			undefined,
			`autopilot must not error: ${JSON.stringify(response)}`,
		)
		const text = response.content[0]?.text ?? ""
		assert.match(
			text,
			/Triage Queue/,
			`autopilot must auto-select the FIRST archetype; got: ${text}`,
		)
		assert.match(
			text,
			/autopilot/i,
			`announcement must explain why no picker was shown; got: ${text}`,
		)

		// Manifest must exist on disk at the discovery template's location.
		const manifestPath = join(
			intentDir,
			"stages",
			"design",
			"artifacts",
			"design-direction.md",
		)
		assert.ok(
			existsSync(manifestPath),
			`manifest MUST be on disk at ${manifestPath}. Response: ${JSON.stringify(response, null, 2)}`,
		)
		const manifestFm = matter(readFileSync(manifestPath, "utf-8")).data
		assert.equal(
			manifestFm.archetype,
			"Triage Queue",
			`manifest must record the auto-selected archetype. got: ${JSON.stringify(manifestFm)}`,
		)
		assert.equal(manifestFm.mode, "select")
		assert.equal(manifestFm.source, "autopilot")
		assert.equal(manifestFm.stage, "design")
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("autopilot with no archetypes: stamps an 'auto' manifest so the gate still clears", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-pick-dd-auto-empty-"))
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		gitInit(repoRoot)
		const intentDir = seedAutopilotIntent(repoRoot, "demo-auto-empty")

		const { handleToolCall } = await import(`${SRC}server/tool-call.ts`)

		const response = await handleToolCall({
			params: {
				name: "pick_design_direction",
				arguments: {
					intent_slug: "demo-auto-empty",
					// No archetypes — intake mode in interactive flow.
				},
			},
		})
		assert.equal(response.isError, undefined)
		const manifestPath = join(
			intentDir,
			"stages",
			"design",
			"artifacts",
			"design-direction.md",
		)
		assert.ok(
			existsSync(manifestPath),
			"manifest must still be written even with no archetypes — gate must clear",
		)
		const fm = matter(readFileSync(manifestPath, "utf-8")).data
		assert.equal(fm.mode, "auto", `manifest mode for empty-archetypes path; got: ${JSON.stringify(fm)}`)
		assert.equal(fm.source, "autopilot")
		assert.equal(fm.archetype, undefined, "no archetype selected")
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
