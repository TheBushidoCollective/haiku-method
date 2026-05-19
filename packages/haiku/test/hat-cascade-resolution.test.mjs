// hat-cascade-resolution.test.mjs
//
// Locks the three-tier hat resolution cascade introduced 2026-05-18:
//
//   1. {plugin}/hats/                                ── global tier
//   2. {project}/.haiku/hats/                        ── global project override
//   3. {plugin}/studios/{studio}/hats/               ── studio tier
//   4. {project}/.haiku/studios/{studio}/hats/       ── studio project override
//   5. {plugin}/studios/{studio}/stages/{stage}/hats/── stage tier
//   6. {project}/.haiku/studios/{studio}/stages/{stage}/hats/ ── stage project override
//
// More-specific wins. Project beats plugin at every tier (general
// invariant: any plugin-defined asset can be overridden by a same-name
// asset in `project/.haiku/`).
//
// classifier and feedback-assessor were promoted to the global tier in
// the same change — 240 byte-identical per-stage duplicates deleted.
// The first two tests prove the promotion didn't break resolution for
// the studios that depended on the duplicates.

import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname

// resolvePluginRoot self-resolves from the binary / module location at
// import time and caches the result. From `node --test` invocations that
// don't bundle the plugin, the auto-resolve can come up empty. Pin it
// to the repo's `plugin/` dir before the studio-reader module loads so
// the cascade actually finds the global hats.
const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

/** Run `fn` with cwd pinned to a tmp dir that we seed with project-side
 *  hat overrides for the cascade test. The plugin underlay (global +
 *  per-studio hats already in the real plugin/ dir) is the
 *  haiku-method repo itself, which is the harness's cwd ancestor —
 *  resolvePluginRoot finds it. */
async function withProjectOverrides(seed, fn) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-hat-cascade-"))
	const origCwd = process.cwd()
	process.chdir(tmp)
	try {
		seed(tmp)
		await fn(tmp)
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
}

test("global tier: classifier resolves for every (studio, stage) without per-stage files", async () => {
	// Post-promotion the per-stage classifier.md files are deleted.
	// readHatDefs must still return the classifier for any (studio, stage).
	const { readHatDefs } = await import(`${SRC}studio-reader.ts`)
	const tier = readHatDefs("documentation", "outline")
	assert.ok(
		tier.classifier,
		"classifier MUST resolve via the global tier even when no per-stage file exists",
	)
	assert.ok(
		tier["feedback-assessor"],
		"feedback-assessor MUST resolve via the global tier",
	)
	// Sanity: a per-stage hat (e.g. architect for documentation/outline)
	// still resolves from the stage tier — global promotion doesn't hide it.
	assert.ok(
		tier.architect || tier.editor || Object.keys(tier).length > 2,
		"per-stage hats must still resolve alongside the global ones",
	)
})

test("global tier: same global classifier reaches a completely different studio/stage pair", async () => {
	const { readHatDefs } = await import(`${SRC}studio-reader.ts`)
	const tier = readHatDefs("security-assessment", "reconnaissance")
	assert.ok(tier.classifier, "global classifier must reach security-assessment too")
	assert.ok(tier["feedback-assessor"], "global feedback-assessor must reach it too")
})

test("resolveHatPath returns the global path for classifier when no override exists", async () => {
	const { resolveHatPath } = await import(`${SRC}studio-reader.ts`)
	const path = resolveHatPath("documentation", "outline", "classifier")
	assert.ok(path, "resolveHatPath must find the global classifier")
	assert.ok(
		path.endsWith("/plugin/hats/classifier.md"),
		`expected global-tier resolution, got: ${path}`,
	)
})

test("project override at global tier beats plugin global", async () => {
	await withProjectOverrides(
		(tmp) => {
			const overrideDir = join(tmp, ".haiku", "hats")
			mkdirSync(overrideDir, { recursive: true })
			writeFileSync(
				join(overrideDir, "classifier.md"),
				"---\nmodel: opus\n---\nPROJECT OVERRIDE\n",
			)
		},
		async () => {
			const { readHatDefs, resolveHatPath } = await import(
				`${SRC}studio-reader.ts`
			)
			const tier = readHatDefs("documentation", "outline")
			assert.equal(tier.classifier?.model, "opus")
			assert.match(tier.classifier?.content ?? "", /PROJECT OVERRIDE/)
			const path = resolveHatPath("documentation", "outline", "classifier")
			assert.ok(path?.includes("/.haiku/hats/classifier.md"), `got: ${path}`)
		},
	)
})

test("studio-tier override beats global tier", async () => {
	await withProjectOverrides(
		(tmp) => {
			const overrideDir = join(
				tmp,
				".haiku",
				"studios",
				"documentation",
				"hats",
			)
			mkdirSync(overrideDir, { recursive: true })
			writeFileSync(
				join(overrideDir, "classifier.md"),
				"---\nmodel: sonnet\n---\nSTUDIO OVERRIDE\n",
			)
		},
		async () => {
			const { resolveHatPath, readHatDefs } = await import(
				`${SRC}studio-reader.ts`
			)
			const tier = readHatDefs("documentation", "outline")
			assert.equal(tier.classifier?.model, "sonnet")
			assert.match(tier.classifier?.content ?? "", /STUDIO OVERRIDE/)
			const path = resolveHatPath("documentation", "outline", "classifier")
			assert.ok(
				path?.includes("/.haiku/studios/documentation/hats/classifier.md"),
				`got: ${path}`,
			)
		},
	)
})

test("stage-tier override beats studio tier and global tier", async () => {
	await withProjectOverrides(
		(tmp) => {
			// Seed both studio and stage overrides; stage MUST win.
			const studioDir = join(
				tmp,
				".haiku",
				"studios",
				"documentation",
				"hats",
			)
			mkdirSync(studioDir, { recursive: true })
			writeFileSync(
				join(studioDir, "classifier.md"),
				"---\nmodel: sonnet\n---\nSTUDIO LOSES\n",
			)
			const stageDir = join(
				tmp,
				".haiku",
				"studios",
				"documentation",
				"stages",
				"outline",
				"hats",
			)
			mkdirSync(stageDir, { recursive: true })
			writeFileSync(
				join(stageDir, "classifier.md"),
				"---\nmodel: opus\n---\nSTAGE WINS\n",
			)
		},
		async () => {
			const { resolveHatPath, readHatDefs } = await import(
				`${SRC}studio-reader.ts`
			)
			const tier = readHatDefs("documentation", "outline")
			assert.equal(tier.classifier?.model, "opus")
			assert.match(tier.classifier?.content ?? "", /STAGE WINS/)
			const path = resolveHatPath("documentation", "outline", "classifier")
			assert.ok(
				path?.includes(
					"/.haiku/studios/documentation/stages/outline/hats/classifier.md",
				),
				`got: ${path}`,
			)
		},
	)
})

test("start_feedback_hat prompt renders the resolved hat path (no literal <studio>)", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("start_feedback_hat")
	assert.ok(builder)
	const out = builder({
		slug: "test-intent",
		studio: "documentation",
		action: {
			dispatches: [
				{
					feedback_id: "FB-001",
					stage: "outline",
					hat: "classifier",
					terminal: false,
				},
			],
		},
	})
	assert.ok(
		!out.includes("<studio>"),
		"FB dispatch must not contain the literal <studio> placeholder anymore",
	)
	assert.ok(
		/Read .*\/hats\/classifier\.md/.test(out),
		`FB dispatch must Read the resolved classifier path. Got: ${out.slice(0, 600)}`,
	)
})
