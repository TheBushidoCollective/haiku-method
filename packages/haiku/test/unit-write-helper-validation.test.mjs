#!/usr/bin/env npx tsx
// Test suite for the helper-grep proof at haiku_unit_write time.
//
// When the unit body cites a specific existing helper at a specific
// path (e.g. "use the existing `foo` in `path/to/file.ts`"), the
// workflow engine verifies the path exists AND the identifier appears in
// that file. Vague mentions ("use existing helpers") fall through —
// only structured citations are validated.

import assert from "node:assert"
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const _origCwdEarly = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = join(_origCwdEarly, "..", "..", "plugin")

const { handleStateTool } = await import("../src/state-tools.ts")

const tmp = mkdtempSync(join(tmpdir(), "haiku-helper-val-test-"))
const origCwd = _origCwdEarly

mkdirSync(join(tmp, "fake-bin"), { recursive: true })
writeFileSync(join(tmp, "fake-bin", "git"), "#!/bin/sh\nexit 0\n")
chmodSync(join(tmp, "fake-bin", "git"), 0o755)
process.env.PATH = `${join(tmp, "fake-bin")}:${process.env.PATH}`

let passed = 0
let failed = 0

async function test(name, fn) {
	try {
		const result = fn()
		if (result && typeof result.then === "function") await result
		passed++
		console.log(`  ✓ ${name}`)
	} catch (e) {
		failed++
		console.log(`  ✗ ${name}: ${e.message}`)
		if (e.stack) console.log(e.stack)
	}
}

function createProject(name, opts = {}) {
	const projDir = join(tmp, name)
	const slug = opts.slug || "test-intent"
	const studio = opts.studio || "test-studio"
	const stage = opts.stage || "build"
	const haikuRoot = join(projDir, ".haiku")
	const intentDirPath = join(haikuRoot, "intents", slug)
	mkdirSync(join(intentDirPath, "stages", stage, "units"), { recursive: true })

	writeFileSync(
		join(intentDirPath, "intent.md"),
		`---
title: Test
studio: ${studio}
mode: continuous
active_stage: ${stage}
status: active
intent_reviewed: true
started_at: 2026-04-29T00:00:00Z
completed_at: null
---

Test.
`,
	)

	const studioDir = join(haikuRoot, "studios", studio)
	mkdirSync(studioDir, { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		`---
name: ${studio}
description: Test
stages: [${stage}]
---

Test.
`,
	)
	const stageDir = join(studioDir, "stages", stage)
	mkdirSync(stageDir, { recursive: true })
	writeFileSync(
		join(stageDir, "STAGE.md"),
		`---
name: ${stage}
description: ${stage}
hats: [coder]
review: auto
elaboration: autonomous
---

${stage} body.
`,
	)
	mkdirSync(join(stageDir, "hats"), { recursive: true })
	writeFileSync(
		join(stageDir, "hats", "coder.md"),
		`---
name: coder
---

Coder.
`,
	)

	return { projDir, intentDirPath, slug, studio, stage }
}

try {
	console.log("\n=== haiku_unit_write helper-grep validation ===")

	await test("unit citing a real helper at a real path → write succeeds", () => {
		const { projDir, slug, stage } = createProject("hv-real")
		// Plant a real helper file at the cited path.
		mkdirSync(join(projDir, "src", "lib"), { recursive: true })
		writeFileSync(
			join(projDir, "src", "lib", "math.ts"),
			`export function addNumbers(a: number, b: number): number {\n  return a + b\n}\n`,
		)
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Use the existing `addNumbers` in `src/lib/math.ts` to combine inputs.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(
			json.ok,
			true,
			`expected ok, got ${JSON.stringify(json)}`,
		)
	})

	await test("unit citing a helper that does not exist at the cited path → reject", () => {
		const { projDir, slug, stage } = createProject("hv-bad-path")
		// No helper file planted.
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Use the existing `addNumbers` in `src/lib/missing.ts` to combine inputs.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(json.error, "cited_helper_not_found")
		assert.strictEqual(json.path, "src/lib/missing.ts")
		assert.strictEqual(json.identifier, "addNumbers")
	})

	await test("unit citing helper at real path but identifier missing → reject", () => {
		const { projDir, slug, stage } = createProject("hv-bad-id")
		mkdirSync(join(projDir, "src", "lib"), { recursive: true })
		writeFileSync(
			join(projDir, "src", "lib", "math.ts"),
			`export function addNumbers(a: number, b: number): number {\n  return a + b\n}\n`,
		)
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Use the existing `multiplyMatrices` in `src/lib/math.ts` to combine inputs.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(json.error, "cited_helper_not_found")
		assert.strictEqual(json.identifier, "multiplyMatrices")
		assert.strictEqual(json.reason, "identifier_missing_in_path")
	})

	await test("unit with vague helper reference (no path) → write succeeds", () => {
		const { projDir, slug, stage } = createProject("hv-vague")
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Use existing helpers wherever possible. Prefer the project's idiomatic style.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(
			json.ok,
			true,
			`vague helper mentions should not trigger validation, got ${JSON.stringify(json)}`,
		)
	})

	await test("unit with no helper citations at all → write succeeds", () => {
		const { projDir, slug, stage } = createProject("hv-no-citation")
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Implement the new endpoint per spec. Write tests covering all branches.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(json.ok, true)
	})

	console.log(`\n${passed} passed, ${failed} failed`)
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(failed > 0 ? 1 : 0)
} catch (e) {
	console.error(`\nFatal: ${e.message}`)
	console.error(e.stack)
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(1)
}
