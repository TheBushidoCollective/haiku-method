#!/usr/bin/env npx tsx
// Test suite for the banned-test-shape detection at haiku_unit_write
// time. The workflow engine refuses to persist a unit when its
// quality_gates: declares a trivially-passing pattern:
//
//   1. `! grep ... <path>` where <path> is one of the unit's own
//      declared outputs (asserts zero matches against a file the
//      implementer hasn't written yet — passes until the implementer
//      writes the wrong substring).
//   2. `grep -q "<prose>" <path>` where <path> is the unit's own
//      output AND the literal looks like prose / a status token the
//      implementer would naturally write into their own output to
//      satisfy the gate.
//
// Conservative by design — false positives are worse than false
// negatives. Legitimate uses (greps against stage artifacts, behavior
// tests, etc.) are NOT flagged.

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

const tmp = mkdtempSync(join(tmpdir(), "haiku-gate-val-test-"))
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
	console.log("\n=== haiku_unit_write banned-test-shape detection ===")

	await test("gate that greps for tokens against stage artifacts → write succeeds (legitimate use)", () => {
		const { projDir, slug, stage } = createProject("gv-stage-artifact")
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Implement scope-checker.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
				outputs: ["src/scope-checker.ts"],
				quality_gates: [
					{
						name: "no-banned-tokens-in-stage-artifact",
						command:
							"! grep -r 'TODO' .haiku/intents/test-intent/stages/build/artifacts/",
					},
				],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(
			json.ok,
			true,
			`Expected ok, got ${JSON.stringify(json)}`,
		)
	})

	await test("gate asserting zero matches on the unit's own output → reject with gate_trivially_passes", () => {
		const { projDir, slug, stage } = createProject("gv-zero-on-own-output")
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Implement scope-checker.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
				outputs: ["src/scope-checker.ts"],
				quality_gates: [
					{
						name: "no-todo-in-impl",
						command: "! grep TODO src/scope-checker.ts",
					},
				],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(json.error, "gate_trivially_passes")
		assert.strictEqual(json.gate, "no-todo-in-impl")
		assert.strictEqual(json.pattern, "asserts_zero_matches_on_own_output")
	})

	await test("gate that greps for a prose literal in own output → reject with gate_trivially_passes", () => {
		const { projDir, slug, stage } = createProject("gv-literal-in-own")
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Implement the docs.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
				outputs: ["docs/notes.md"],
				quality_gates: [
					{
						name: "feature-complete-marker",
						command: 'grep -q "feature complete" docs/notes.md',
					},
				],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(json.error, "gate_trivially_passes")
		assert.strictEqual(
			json.pattern,
			"literal_substring_in_self_authored_output",
		)
		assert.strictEqual(json.literal, "feature complete")
	})

	await test("gate that greps a single-word non-prose token in own output → write succeeds (technical literal)", () => {
		const { projDir, slug, stage } = createProject("gv-tech-literal")
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Implement the API.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
				outputs: ["src/api.ts"],
				quality_gates: [
					// Single-word technical literal — not prose. We allow
					// this; agents may legitimately assert the presence
					// of a specific symbol or import.
					{
						name: "exports-default",
						command: 'grep -q "export default" src/api.ts',
					},
				],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(
			json.ok,
			true,
			`Expected ok, got ${JSON.stringify(json)}`,
		)
	})

	await test("unit without a quality_gates field → write succeeds", () => {
		const { projDir, slug, stage } = createProject("gv-no-gates")
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Plan-class unit (no executable gates).",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(json.ok, true)
	})

	await test("gate against an output that's NOT this unit's output → write succeeds", () => {
		const { projDir, slug, stage } = createProject("gv-other-output")
		process.chdir(projDir)
		const result = handleStateTool("haiku_unit_write", {
			intent: slug,
			stage,
			unit: "unit-01-foo",
			body: "Test the upstream config.",
			frontmatter: {
				title: "foo",
				inputs: ["intent.md"],
				outputs: ["src/foo.ts"],
				quality_gates: [
					// Greps a different file (not in this unit's outputs).
					{
						name: "config-has-flag",
						command: 'grep -q "feature-flag-enabled" config/app.yaml',
					},
				],
			},
		})
		const json = JSON.parse(result.content[0].text)
		assert.strictEqual(
			json.ok,
			true,
			`Expected ok, got ${JSON.stringify(json)}`,
		)
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
