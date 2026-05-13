#!/usr/bin/env npx tsx
// discovery-relocate-misplaced.test.mjs — follow-up regression pin
// for issue #356 (2026-05-13).
//
// PR #355 added the artifact-presence gate to
// `haiku_discovery_complete` so a subagent that writes to the
// wrong path no longer gets `{ ok: true }` back. That fix prevents
// NEW occurrences. The follow-up comment on #356 showed an
// intent (`location-timesheet-summary`) where the wrong-path
// commit had ALREADY landed on a pre-fix engine — the file sat at
// `knowledge/COVERAGE-MAPPING.md` while the template declared
// `product/COVERAGE-MAPPING.md`. The cursor's existence check
// kept re-emitting the Discovery Fan-Out because the expected
// location was empty.
//
// Fix (decompose.ts): when an artifact's declared `outputPath` is
// missing but a same-name file exists at the legacy
// `knowledge/<NAME>.md` location, auto-relocate it. This test
// pins that the relocation:
//
//   1. Moves the file from knowledge/ to the declared location.
//   2. Skips when the legacy file doesn't exist.
//   3. Skips when the declared destination already has a file
//      (no overwrite).
//   4. Skips when the template's declared location IS the legacy
//      knowledge/<NAME>.md path (no self-move).
//
// The test exercises `buildElaboratePromptBody` (which calls into
// the relocation logic on the decompose render path) and asserts
// on the resulting filesystem state.

import assert from "node:assert/strict"
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

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")

function setupIntent({ stage, withLegacyFile, withDeclaredFile }) {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-disc-relocate-"))
	const intentDir = join(tmp, ".haiku", "intents", "test-intent")
	const knowledgeDir = join(intentDir, "knowledge")
	const stageOutputDir = join(intentDir, stage)
	mkdirSync(knowledgeDir, { recursive: true })
	mkdirSync(stageOutputDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test\n", {
			title: "test",
			studio: "software",
			mode: "continuous",
			plugin_version: "5.0.0",
		}),
	)
	const legacyPath = join(knowledgeDir, "COVERAGE-MAPPING.md")
	const declaredPath = join(stageOutputDir, "COVERAGE-MAPPING.md")
	if (withLegacyFile) {
		writeFileSync(legacyPath, "# Legacy COVERAGE-MAPPING\n\nAgent output.\n")
	}
	if (withDeclaredFile) {
		writeFileSync(declaredPath, "# Already in place\n")
	}
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	return { tmp, intentDir, legacyPath, declaredPath }
}

/** Drive the decompose prompt builder — that's where the
 *  relocation logic runs. We don't care about the rendered prompt
 *  text; we just want the filesystem side-effect. */
async function runDecompose({ tmp, intentDir, slug, stage }) {
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { buildElaboratePromptBody } = await import(
			`${REPO_ROOT}/packages/haiku/src/orchestrator/prompts/decompose.ts`
		)
		// Minimal action shape the prompt builder needs.
		const action = { stage, elaboration: "collaborative", iteration: 1 }
		try {
			buildElaboratePromptBody({
				slug,
				studio: "software",
				action,
				dir: intentDir,
			})
		} catch {
			// Prompt body building may throw on missing context; the
			// relocation side-effect runs before any of that, so a
			// throw doesn't invalidate the test. We only assert on
			// the filesystem state after the call.
		}
	} finally {
		process.chdir(orig)
	}
}

test("relocate: knowledge/<NAME>.md → product/<NAME>.md when template declares product path", async () => {
	const { tmp, intentDir, legacyPath, declaredPath } = setupIntent({
		stage: "product",
		withLegacyFile: true,
		withDeclaredFile: false,
	})
	try {
		await runDecompose({
			tmp,
			intentDir,
			slug: "test-intent",
			stage: "product",
		})
		assert.strictEqual(
			existsSync(legacyPath),
			false,
			"legacy file must be removed by the relocation",
		)
		assert.strictEqual(
			existsSync(declaredPath),
			true,
			"declared location must now have the file",
		)
		// Content preserved (it's a rename, not a copy-and-truncate).
		const body = readFileSync(declaredPath, "utf8")
		assert.ok(
			body.includes("Agent output."),
			`relocated file must preserve original content; got: ${body.slice(0, 200)}`,
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("relocate skipped: legacy file doesn't exist (nothing to move)", async () => {
	const { tmp, intentDir, legacyPath, declaredPath } = setupIntent({
		stage: "product",
		withLegacyFile: false,
		withDeclaredFile: false,
	})
	try {
		await runDecompose({
			tmp,
			intentDir,
			slug: "test-intent",
			stage: "product",
		})
		assert.strictEqual(existsSync(legacyPath), false)
		assert.strictEqual(existsSync(declaredPath), false)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("relocate skipped: declared location already has a file (no overwrite)", async () => {
	const { tmp, intentDir, declaredPath } = setupIntent({
		stage: "product",
		withLegacyFile: true,
		withDeclaredFile: true,
	})
	try {
		await runDecompose({
			tmp,
			intentDir,
			slug: "test-intent",
			stage: "product",
		})
		// Both files still exist — the declared-location file is the
		// authoritative one (matches the cursor's existsSync check),
		// the legacy one is dormant and can be cleaned up manually.
		// Critically, the declared file was NOT overwritten.
		assert.strictEqual(existsSync(declaredPath), true)
		assert.strictEqual(
			readFileSync(declaredPath, "utf8"),
			"# Already in place\n",
			"declared-location file must not be overwritten",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("relocate skipped: template's location IS knowledge/<NAME>.md (no self-move)", async () => {
	// When a template legitimately declares
	// `knowledge/<NAME>.md` as its `location:` (some studios use the
	// knowledge dir as the canonical home), the engine must NOT
	// self-move the file. Implementation guards via
	// `legacyPath === a.outputPath`; this test pins that guard.
	//
	// We seed a fake discovery template under the project-local
	// studio overlay that declares `knowledge/DISCOVERY.md` as its
	// output, then run decompose. Expected: the file stays put.
	const tmp = mkdtempSync(join(tmpdir(), "haiku-disc-relocate-self-"))
	const intentDir = join(tmp, ".haiku", "intents", "test-intent")
	const knowledgeDir = join(intentDir, "knowledge")
	const stageDir = join(intentDir, "stages", "inception")
	mkdirSync(knowledgeDir, { recursive: true })
	mkdirSync(stageDir, { recursive: true })
	// Use the real software studio's inception/discovery template
	// (DISCOVERY.md declares `location: .haiku/intents/{intent-slug}/
	// knowledge/DISCOVERY.md` — knowledge/ IS the canonical home).
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test\n", {
			title: "test",
			studio: "software",
			mode: "continuous",
			plugin_version: "5.0.0",
		}),
	)
	const legacyPath = join(knowledgeDir, "DISCOVERY.md")
	writeFileSync(legacyPath, "# Knowledge IS the canonical home\n")
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		await runDecompose({
			tmp,
			intentDir,
			slug: "test-intent",
			stage: "inception",
		})
		// File still exists at its original location (which is also
		// the template's declared location — self-move was
		// correctly skipped).
		assert.strictEqual(
			existsSync(legacyPath),
			true,
			"file must NOT be self-moved when knowledge/<NAME>.md IS the declared location",
		)
		assert.strictEqual(
			readFileSync(legacyPath, "utf8"),
			"# Knowledge IS the canonical home\n",
			"content preserved (no rename happened)",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
