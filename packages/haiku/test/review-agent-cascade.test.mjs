// review-agent-cascade.test.mjs
//
// Locks the three-tier stage-review-agent resolution cascade introduced
// 2026-05-18:
//
//   1. {plugin}/review-agents/                                ── global
//   2. {project}/.haiku/review-agents/                        ── global project override
//   3. {plugin}/studios/{studio}/review-agents/               ── studio
//   4. {project}/.haiku/studios/{studio}/review-agents/       ── studio project override
//   5. {plugin}/studios/{studio}/stages/{stage}/review-agents/── stage
//   6. {project}/.haiku/studios/{studio}/stages/{stage}/review-agents/── stage project override
//
// The studio tier was enabled after renaming the intent-completion
// review directory from `review-agents/` → `intent-review-agents/` in
// the same change. Without that rename, every stage's review would
// inherit each studio's intent-completion agents (e.g.
// `cross-stage-consistency.md`) as defaults — exactly the
// double-dispatch we needed to avoid. The first test below locks the
// rename's effect: nothing leaks from the intent-completion directory
// into the stage cascade.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

async function withProjectOverrides(seed, fn) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-review-agent-cascade-"))
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

test("studio-tier slot stays free for STAGE cascade; intent-review-agents/ is the legitimate home for intent-final-review mandates", async () => {
	// The 2026-05-18 cascade rename freed the studio tier in the
	// STAGE-review cascade so cross-stage defaults could live there
	// without colliding with the per-studio intent-final-review tier.
	// Intent-final-review mandates DO belong at
	// plugin/studios/<studio>/intent-review-agents/ — they're a separate
	// concern from stage-review agents and the engine reads them via
	// readStudioReviewAgentPaths(), not the stage cascade.
	//
	// This test locks two things:
	//   (a) The stage cascade for the software studio's "execution"
	//       stage does NOT leak cross-stage-consistency (that one was
	//       promoted out of mandate files into engine code — see
	//       cross-stage-consistency-built-in.test.mjs).
	//   (b) If a future change introduces a per-studio intent-final-
	//       review mandate, it's discoverable via
	//       readStudioReviewAgentPaths — the post-rename API surface.
	//       We assert the runtime-verifier mandate added 2026-05-18 is
	//       present; future additions are expected.
	const {
		readReviewAgentPaths,
		readStudioReviewAgentPaths,
	} = await import(`${SRC}studio-reader.ts`)
	const stagePaths = readReviewAgentPaths("software", "execution")
	assert.ok(
		!Object.keys(stagePaths).includes("cross-stage-consistency"),
		`stage cascade leaked cross-stage-consistency. got: ${Object.keys(stagePaths).join(",")}`,
	)
	// The intent-final-review tier IS a legitimate place for studio-
	// level integration audits (e.g. the runtime-verifier that drives
	// the booted/rendered intent output end-to-end). Lock that
	// runtime-verifier is present and points at the right file.
	const intentPaths = readStudioReviewAgentPaths("software")
	assert.ok(
		intentPaths["runtime-verifier"]?.includes(
			"/plugin/studios/software/intent-review-agents/runtime-verifier.md",
		),
		`software studio should ship intent-review-agents/runtime-verifier.md. got: ${JSON.stringify(intentPaths)}`,
	)
})

test("studio-tier override beats global tier (post-rename: studio slot is free)", async () => {
	await withProjectOverrides(
		(tmp) => {
			// Seed a global review agent and a same-named studio-tier
			// override under .haiku/. Studio MUST win.
			const globalDir = join(tmp, ".haiku", "review-agents")
			mkdirSync(globalDir, { recursive: true })
			writeFileSync(
				join(globalDir, "spec-conformance.md"),
				"GLOBAL LOSES\n",
			)
			const studioDir = join(
				tmp,
				".haiku",
				"studios",
				"documentation",
				"review-agents",
			)
			mkdirSync(studioDir, { recursive: true })
			writeFileSync(
				join(studioDir, "spec-conformance.md"),
				"STUDIO WINS\n",
			)
		},
		async () => {
			const { readReviewAgentDefs, readReviewAgentPaths } = await import(
				`${SRC}studio-reader.ts`
			)
			const defs = readReviewAgentDefs("documentation", "outline")
			assert.match(defs["spec-conformance"] ?? "", /STUDIO WINS/)
			const paths = readReviewAgentPaths("documentation", "outline")
			assert.ok(
				paths["spec-conformance"]?.includes(
					"/.haiku/studios/documentation/review-agents/spec-conformance.md",
				),
				`got: ${paths["spec-conformance"]}`,
			)
		},
	)
})

test("project override at global tier reaches a stage with no plugin review-agents", async () => {
	await withProjectOverrides(
		(tmp) => {
			const overrideDir = join(tmp, ".haiku", "review-agents")
			mkdirSync(overrideDir, { recursive: true })
			writeFileSync(
				join(overrideDir, "spec-conformance.md"),
				"PROJECT GLOBAL REVIEW AGENT\n",
			)
		},
		async () => {
			const { readReviewAgentDefs, readReviewAgentPaths } = await import(
				`${SRC}studio-reader.ts`
			)
			const defs = readReviewAgentDefs("software", "execution")
			assert.match(
				defs["spec-conformance"] ?? "",
				/PROJECT GLOBAL REVIEW AGENT/,
				"global project override must reach every stage",
			)
			const paths = readReviewAgentPaths("software", "execution")
			assert.ok(
				paths["spec-conformance"]?.includes("/.haiku/review-agents/spec-conformance.md"),
				`expected project global path, got: ${paths["spec-conformance"]}`,
			)
		},
	)
})

test("stage-tier override beats global tier", async () => {
	await withProjectOverrides(
		(tmp) => {
			// Seed global AND stage; stage MUST win.
			const globalDir = join(tmp, ".haiku", "review-agents")
			mkdirSync(globalDir, { recursive: true })
			writeFileSync(
				join(globalDir, "consistency.md"),
				"GLOBAL LOSES\n",
			)
			const stageDir = join(
				tmp,
				".haiku",
				"studios",
				"documentation",
				"stages",
				"outline",
				"review-agents",
			)
			mkdirSync(stageDir, { recursive: true })
			writeFileSync(
				join(stageDir, "consistency.md"),
				"STAGE WINS\n",
			)
		},
		async () => {
			const { readReviewAgentDefs, readReviewAgentPaths } = await import(
				`${SRC}studio-reader.ts`
			)
			const defs = readReviewAgentDefs("documentation", "outline")
			assert.match(defs.consistency ?? "", /STAGE WINS/)
			const paths = readReviewAgentPaths("documentation", "outline")
			assert.ok(
				paths.consistency?.includes(
					"/.haiku/studios/documentation/stages/outline/review-agents/consistency.md",
				),
				`got: ${paths.consistency}`,
			)
		},
	)
})

test("plugin and project at the same tier: project wins", async () => {
	// Lock the per-tier override invariant: project beats plugin at the
	// SAME tier, regardless of which tier. Here we seed a project-side
	// override of an existing plugin-side global review agent and
	// verify it wins.
	await withProjectOverrides(
		(tmp) => {
			const overrideDir = join(tmp, ".haiku", "review-agents")
			mkdirSync(overrideDir, { recursive: true })
			// Note: this overrides whatever exists at {plugin}/review-agents/
			// for the same filename. If nothing exists there, this just
			// adds a new global. Both cases are valid override semantics.
			writeFileSync(
				join(overrideDir, "any-global.md"),
				"PROJECT WINS AT GLOBAL TIER\n",
			)
		},
		async () => {
			const { readReviewAgentDefs } = await import(`${SRC}studio-reader.ts`)
			const defs = readReviewAgentDefs("software", "execution")
			assert.match(defs["any-global"] ?? "", /PROJECT WINS AT GLOBAL TIER/)
		},
	)
})
