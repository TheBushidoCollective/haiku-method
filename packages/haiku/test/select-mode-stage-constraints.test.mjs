#!/usr/bin/env npx tsx
// Constraint validation tests for the engine-managed elicitation
// tools `haiku_select_mode` and `haiku_select_stage`. These cover
// the refusal cases that prevent the agent from getting creative
// and bypassing the contract:
//
//   - haiku_select_mode refuses transitions INTO `quick` once the
//     intent has started a stage (would amputate later stages).
//   - haiku_select_mode refuses transitions OUT OF `quick` once
//     the intent has started a stage (would suddenly grow stages).
//   - haiku_select_mode rejects unknown mode option strings.
//   - haiku_select_stage refuses if the intent's mode is not quick
//     (with `mode_not_quick` error code).
//   - haiku_select_stage refuses if a stage has already been set.
//   - haiku_select_stage rejects multi-stage option arrays.
//
// These are exactly the failure modes a "creative" agent would try
// to slip past — every refusal here is load-bearing for the
// engine-controlled chain.

import assert from "node:assert"
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const tmp = mkdtempSync(join(tmpdir(), "haiku-mode-constraints-"))
mkdirSync(join(tmp, "fake-bin"), { recursive: true })
writeFileSync(join(tmp, "fake-bin", "git"), "#!/bin/sh\nexit 0\n")
chmodSync(join(tmp, "fake-bin", "git"), 0o755)
process.env.PATH = `${join(tmp, "fake-bin")}:${process.env.PATH}`

const {
	handleOrchestratorTool,
	setElicitInputHandler: _setElicitInputHandler,
} = await import("../src/orchestrator.ts")
const { parseFrontmatter } = await import("../src/state-tools.ts")

let passed = 0
let failed = 0
const origCwd = process.cwd()

async function test(name, fn) {
	try {
		const r = fn()
		if (r && typeof r.then === "function") await r
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}: ${err.message}`)
		if (err.stack) console.log(err.stack)
	}
}

function makeProject(name) {
	const projDir = join(tmp, name)
	const haikuRoot = join(projDir, ".haiku")
	const studio = "test-studio"
	const stages = ["plan", "build", "ship"]
	mkdirSync(haikuRoot, { recursive: true })
	const studioDir = join(haikuRoot, "studios", studio)
	mkdirSync(studioDir, { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		`---\nname: ${studio}\ndescription: Constraint test studio\nstages: [${stages.join(", ")}]\n---\n\nA test studio.\n`,
	)
	for (const stage of stages) {
		const stageDir = join(studioDir, "stages", stage)
		mkdirSync(stageDir, { recursive: true })
		writeFileSync(
			join(stageDir, "STAGE.md"),
			`---\nname: ${stage}\nhats: [worker]\nreview: auto\nelaboration: autonomous\n---\n\n${stage} stage.\n`,
		)
	}
	return { projDir, studio, stages }
}

function writeIntent(projDir, slug, fm) {
	const iDir = join(projDir, ".haiku", "intents", slug)
	mkdirSync(iDir, { recursive: true })
	const lines = ["---"]
	for (const [k, v] of Object.entries(fm)) {
		if (v == null) continue
		if (typeof v === "boolean") lines.push(`${k}: ${v}`)
		else if (Array.isArray(v))
			lines.push(`${k}: [${v.map((x) => JSON.stringify(x)).join(", ")}]`)
		else lines.push(`${k}: "${v}"`)
	}
	lines.push("---", "", "# Body")
	writeFileSync(join(iDir, "intent.md"), lines.join("\n"))
	return iDir
}

async function callOrch(name, args) {
	const result = await handleOrchestratorTool(name, args)
	const responseText = result.content[0].text
	let json
	try {
		const m = responseText.match(/\{[\s\S]*?\}\n\n---/)
		json = m
			? JSON.parse(m[0].replace(/\n\n---$/, ""))
			: JSON.parse(responseText)
	} catch {
		json = { _raw: responseText }
	}
	return { result, json, responseText }
}

try {
	console.log("=== haiku_select_mode constraints ===")

	await test("refuses to enter `quick` once intent has started a stage", async () => {
		const { projDir, studio } = makeProject("no-enter-quick")
		process.chdir(projDir)
		// Intent already in continuous mode AND already past stage 0.
		writeIntent(projDir, "no-enter-quick", {
			title: "Already started",
			studio,
			mode: "continuous",
			stages: ["plan", "build", "ship"],
			active_stage: "plan",
			status: "active",
			intent_reviewed: true,
		})
		const r = await callOrch("haiku_select_mode", {
			intent: "no-enter-quick",
			options: ["quick"],
		})
		// The tool must refuse — not silently accept the change.
		// Specifically: invalid_mode_options because quick is filtered
		// out of `modesAvailable` once the intent has started.
		assert.strictEqual(
			r.json.error,
			"invalid_mode_options",
			`expected invalid_mode_options, got: ${JSON.stringify(r.json)}`,
		)
		// And intent.md mode must NOT have been updated.
		const fm = parseFrontmatter(
			readFileSync(
				join(projDir, ".haiku", "intents", "no-enter-quick", "intent.md"),
				"utf8",
			),
		).data
		assert.strictEqual(fm.mode, "continuous")
	})

	await test("refuses to leave `quick` once intent has started a stage (no modes reachable)", async () => {
		const { projDir, studio } = makeProject("no-leave-quick")
		process.chdir(projDir)
		writeIntent(projDir, "no-leave-quick", {
			title: "Quick already started",
			studio,
			mode: "quick",
			stages: ["build"],
			active_stage: "build",
			status: "active",
			intent_reviewed: true,
		})
		const r = await callOrch("haiku_select_mode", {
			intent: "no-leave-quick",
			options: ["continuous"],
		})
		// Stronger refusal than `invalid_mode_options`: when an intent
		// is already in quick AND has started, ALL alternative modes
		// are filtered out (each would amputate or grow stages mid-
		// flight). The tool fails fast with `no_modes_available`
		// rather than per-option validation.
		assert.strictEqual(
			r.json.error,
			"no_modes_available",
			`expected no_modes_available, got: ${JSON.stringify(r.json)}`,
		)
		const fm = parseFrontmatter(
			readFileSync(
				join(projDir, ".haiku", "intents", "no-leave-quick", "intent.md"),
				"utf8",
			),
		).data
		assert.strictEqual(fm.mode, "quick")
	})

	await test("rejects unknown mode option string", async () => {
		const { projDir, studio } = makeProject("bad-mode")
		process.chdir(projDir)
		writeIntent(projDir, "bad-mode", {
			title: "Bad mode option",
			studio,
			status: "active",
		})
		const r = await callOrch("haiku_select_mode", {
			intent: "bad-mode",
			options: ["warp-speed"],
		})
		assert.strictEqual(
			r.json.error,
			"invalid_mode_options",
			`expected invalid_mode_options, got: ${JSON.stringify(r.json)}`,
		)
	})

	await test("refuses when studio is not yet selected", async () => {
		const { projDir } = makeProject("no-studio")
		process.chdir(projDir)
		writeIntent(projDir, "no-studio", {
			title: "No studio yet",
			studio: "",
			status: "active",
		})
		const r = await callOrch("haiku_select_mode", { intent: "no-studio" })
		assert.strictEqual(
			r.json.error,
			"studio_not_selected",
			`expected studio_not_selected, got: ${JSON.stringify(r.json)}`,
		)
	})

	console.log("\n=== haiku_select_stage constraints ===")

	await test("refuses if mode is not `quick`", async () => {
		const { projDir, studio } = makeProject("not-quick")
		process.chdir(projDir)
		writeIntent(projDir, "not-quick", {
			title: "Continuous, no stage pick allowed",
			studio,
			mode: "continuous",
			stages: ["plan", "build", "ship"],
			status: "active",
		})
		const r = await callOrch("haiku_select_stage", {
			intent: "not-quick",
			options: ["plan"],
		})
		assert.strictEqual(
			r.json.error,
			"mode_not_quick",
			`expected mode_not_quick, got: ${JSON.stringify(r.json)}`,
		)
	})

	await test("refuses if a stage is already set", async () => {
		const { projDir, studio } = makeProject("stage-set")
		process.chdir(projDir)
		writeIntent(projDir, "stage-set", {
			title: "Stage already pinned",
			studio,
			mode: "quick",
			stages: ["plan"],
			status: "active",
		})
		const r = await callOrch("haiku_select_stage", {
			intent: "stage-set",
			options: ["build"],
		})
		assert.strictEqual(
			r.json.error,
			"stage_already_set",
			`expected stage_already_set, got: ${JSON.stringify(r.json)}`,
		)
	})

	await test("rejects multi-stage option arrays (quick is single-stage)", async () => {
		const { projDir, studio } = makeProject("multi-stage")
		process.chdir(projDir)
		writeIntent(projDir, "multi-stage", {
			title: "Quick, no stages yet, agent tries multiple",
			studio,
			mode: "quick",
			status: "active",
		})
		const r = await callOrch("haiku_select_stage", {
			intent: "multi-stage",
			options: ["plan", "build"],
		})
		assert.strictEqual(
			r.json.error,
			"single_stage_required",
			`expected single_stage_required, got: ${JSON.stringify(r.json)}`,
		)
	})

	await test("auto-selects when single valid option provided", async () => {
		const { projDir, studio } = makeProject("auto-select")
		process.chdir(projDir)
		writeIntent(projDir, "auto-select", {
			title: "Quick auto-select stage",
			studio,
			mode: "quick",
			status: "active",
		})
		const r = await callOrch("haiku_select_stage", {
			intent: "auto-select",
			options: ["build"],
		})
		assert.strictEqual(r.json.action, "stage_selected")
		assert.strictEqual(r.json.stage, "build")
		const fm = parseFrontmatter(
			readFileSync(
				join(projDir, ".haiku", "intents", "auto-select", "intent.md"),
				"utf8",
			),
		).data
		assert.deepStrictEqual(fm.stages, ["build"])
	})

	console.log(`\n${passed} passed, ${failed} failed`)
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(failed > 0 ? 1 : 0)
} catch (err) {
	console.error(`\nFatal: ${err.message}`)
	console.error(err.stack)
	process.chdir(origCwd)
	rmSync(tmp, { recursive: true, force: true })
	process.exit(1)
}
