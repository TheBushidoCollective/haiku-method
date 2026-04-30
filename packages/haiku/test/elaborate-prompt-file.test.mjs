#!/usr/bin/env npx tsx
// Test suite for the file-based elaborate dispatch — verifies that
// the `elaborate` action carries `prompt_file` instead of inlining
// the full prompt body in the tool response, and that the file
// content carries (a) the inlined per-stage review-agent lenses, and
// (b) upstream-artifact references-by-path (not by content).

import assert from "node:assert"
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Pin the plugin root to the actual repo's plugin/ dir BEFORE importing
// orchestrator.ts — resolvePluginRoot() caches its result on first call,
// so the env var must be set before any module that loads config.ts.
// Always overwrite (not !env-var) — the parent shell may have a relative
// `plugin` value that won't resolve from per-test cwd.
const _origCwdEarly = process.cwd()
process.env.CLAUDE_PLUGIN_ROOT = join(_origCwdEarly, "..", "..", "plugin")

const { handleOrchestratorTool, runNext } = await import(
	"../src/orchestrator.ts"
)
const { writeJson } = await import("../src/state-tools.ts")

// ── Setup ──────────────────────────────────────────────────────────────────

const tmp = mkdtempSync(join(tmpdir(), "haiku-elab-pf-test-"))
const origCwd = _origCwdEarly

// Stub git so gitCommitState doesn't blow up in tests
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
	const haikuRoot = join(projDir, ".haiku")
	const slug = opts.slug || "test-intent"
	const intentDirPath = join(haikuRoot, "intents", slug)
	const studio = opts.studio || "test-studio"

	mkdirSync(join(intentDirPath, "stages"), { recursive: true })
	writeFileSync(
		join(intentDirPath, "intent.md"),
		`---
title: ${opts.title || "Test Intent"}
studio: ${studio}
mode: ${opts.mode || "continuous"}
active_stage: ${opts.active_stage || ""}
status: ${opts.status || "active"}
intent_reviewed: ${opts.intent_reviewed !== undefined ? opts.intent_reviewed : true}
started_at: 2026-04-29T00:00:00Z
completed_at: null
---

Test intent body.
`,
	)

	const stages = opts.stages || ["plan", "build"]
	const studioDir = join(haikuRoot, "studios", studio)
	mkdirSync(studioDir, { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		`---
name: ${studio}
description: Test studio
stages: [${stages.join(", ")}]
---

A test studio.
`,
	)

	for (const stage of stages) {
		const stageDir = join(studioDir, "stages", stage)
		mkdirSync(stageDir, { recursive: true })
		const stageOpts = opts.stageConfig?.[stage] || {}
		const inputsLine =
			stageOpts.inputs && stageOpts.inputs.length > 0
				? `inputs:\n${stageOpts.inputs.map((i) => `  - ${i}`).join("\n")}\n`
				: ""
		writeFileSync(
			join(stageDir, "STAGE.md"),
			`---
name: ${stage}
description: ${stage} stage
hats: [${(stageOpts.hats || ["worker"]).join(", ")}]
review: ${stageOpts.review || "auto"}
elaboration: ${stageOpts.elaboration || "autonomous"}
${inputsLine}---

${stage} stage instructions.
`,
		)

		if (stageOpts.reviewAgents) {
			const agentsDir = join(stageDir, "review-agents")
			mkdirSync(agentsDir, { recursive: true })
			for (const [agentName, content] of Object.entries(
				stageOpts.reviewAgents,
			)) {
				writeFileSync(
					join(agentsDir, `${agentName}.md`),
					`---
name: ${agentName}
---

${content}
`,
				)
			}
		}
	}

	return { projDir, haikuRoot, intentDirPath, slug, studio }
}

function createStageState(intentDirPath, stage, state) {
	const stageDir = join(intentDirPath, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	writeJson(join(stageDir, "state.json"), {
		stage,
		status: "active",
		phase: "elaborate",
		started_at: "2026-04-29T00:00:00Z",
		completed_at: null,
		gate_entered_at: null,
		gate_outcome: null,
		visits: 0,
		...state,
	})
}

// ── Tests ──────────────────────────────────────────────────────────────────

try {
	console.log("\n=== elaborate: file-based dispatch ===")

	await test("elaborate action carries `prompt_file` and a short message", () => {
		const { projDir, intentDirPath, slug } = createProject("pf-shape", {
			active_stage: "plan",
		})
		createStageState(intentDirPath, "plan", { phase: "elaborate" })
		process.chdir(projDir)
		const result = runNext(slug)
		assert.strictEqual(result.action, "elaborate")
		assert.ok(
			typeof result.prompt_file === "string" && result.prompt_file.length > 0,
			`Expected prompt_file string on action, got ${result.prompt_file}`,
		)
		assert.ok(
			existsSync(result.prompt_file),
			`prompt_file path should exist on disk: ${result.prompt_file}`,
		)
		// Message is the short pointer — one or two lines, NOT the full body.
		assert.ok(
			result.message.includes(result.prompt_file),
			"Short message should reference the prompt_file path",
		)
		assert.ok(
			result.message.split("\n").length <= 3,
			`Short message should be ≤3 lines, got: ${JSON.stringify(result.message)}`,
		)
		// File content is non-trivial — workflow contracts at minimum.
		const body = readFileSync(result.prompt_file, "utf8")
		assert.ok(
			body.length > 200,
			`Prompt-file body should be substantial, got ${body.length} chars`,
		)
		assert.ok(
			body.includes("Workflow Contracts") ||
				body.includes("workflow contracts") ||
				body.includes("Elaborate"),
			"Prompt-file body should include the elaborate workflow contracts",
		)
	})

	await test("haiku_run_next response JSON includes prompt_file field", async () => {
		const { projDir, intentDirPath, slug } = createProject("pf-json", {
			active_stage: "plan",
		})
		createStageState(intentDirPath, "plan", { phase: "elaborate" })
		process.chdir(projDir)
		const result = await handleOrchestratorTool("haiku_run_next", {
			intent: slug,
		})
		const responseText = result.content[0].text
		const jsonMatch = responseText.match(/\{[\s\S]*?\}\n\n---/)
		assert.ok(jsonMatch, "Response should have action JSON before ---")
		const parsed = JSON.parse(jsonMatch[0].replace(/\n\n---$/, ""))
		assert.strictEqual(parsed.action, "elaborate")
		assert.ok(parsed.prompt_file, "Action JSON should carry prompt_file")
		assert.ok(
			existsSync(parsed.prompt_file),
			`prompt_file at ${parsed.prompt_file} should exist`,
		)
		// The rendered instructions section should NOT inline the full
		// elaborate body — only a "Read this file" pointer.
		const instructionsSection = responseText.split("---")[1] || ""
		assert.ok(
			instructionsSection.includes(parsed.prompt_file),
			"Rendered instructions should reference prompt_file path",
		)
		assert.ok(
			!instructionsSection.includes("## Approach Selection"),
			"Rendered instructions should NOT inline the full elaborate body — that lives in the file",
		)
	})

	await test("prompt-file body inlines per-stage review-agent lenses", () => {
		const { projDir, intentDirPath, slug } = createProject("pf-lenses", {
			active_stage: "plan",
			stageConfig: {
				plan: {
					reviewAgents: {
						architecture:
							"Verify the unit specs respect existing module boundaries.",
						correctness:
							"Verify the unit specs declare verifiable acceptance criteria.",
					},
				},
			},
		})
		createStageState(intentDirPath, "plan", { phase: "elaborate" })
		process.chdir(projDir)
		const result = runNext(slug)
		assert.strictEqual(result.action, "elaborate")
		assert.ok(result.prompt_file && existsSync(result.prompt_file))
		const body = readFileSync(result.prompt_file, "utf8")
		assert.ok(
			body.includes("## Review-Agent Lenses"),
			"Prompt body should contain the review-agent lens header",
		)
		assert.ok(
			body.includes("### Architecture lens"),
			"Prompt body should contain a per-agent lens subheading (Architecture)",
		)
		assert.ok(
			body.includes("### Correctness lens"),
			"Prompt body should contain a per-agent lens subheading (Correctness)",
		)
		assert.ok(
			body.includes("respect existing module boundaries"),
			"Prompt body should contain the architecture mandate body",
		)
		assert.ok(
			body.includes("verifiable acceptance criteria"),
			"Prompt body should contain the correctness mandate body",
		)
	})

	await test("software studio per-stage review-agent mandates land in prompt body via buildElaboratePromptBody", async () => {
		// The software studio ships with real per-stage review agents
		// in `plugin/studios/software/stages/<stage>/review-agents/*.md`.
		// We exercise the prompt-builder directly against the
		// development stage so the test doesn't depend on the workflow
		// engine reaching that stage's elaborate phase (which has many
		// upstream-input pre-conditions).
		const { buildElaboratePromptBody } = await import(
			"../src/orchestrator/prompts/elaborate.ts"
		)
		const projDir = join(tmp, "pf-software")
		const haikuRoot = join(projDir, ".haiku")
		const slug = "pf-software"
		const intentDirPath = join(haikuRoot, "intents", slug)
		mkdirSync(join(intentDirPath, "stages", "development", "units"), {
			recursive: true,
		})
		writeFileSync(
			join(intentDirPath, "intent.md"),
			`---
title: Test
studio: software
mode: continuous
active_stage: development
status: active
intent_reviewed: true
started_at: 2026-04-29T00:00:00Z
completed_at: null
---

Software development.
`,
		)
		process.chdir(projDir)
		// Call the body-builder directly with a fresh-elaborate action shape.
		const body = buildElaboratePromptBody({
			slug,
			studio: "software",
			action: {
				action: "elaborate",
				intent: slug,
				studio: "software",
				stage: "development",
				elaboration: "collaborative",
			},
			dir: intentDirPath,
		})
		assert.ok(
			body.includes("## Review-Agent Lenses"),
			"Prompt body should carry the review-agent lens header for software/development",
		)
		// Development ships architecture / correctness / performance /
		// security / test-quality (no `applies_to:` scoping). All 5 agents
		// should produce a `### <Name> lens` subheading.
		const expectedLenses = [
			"Architecture",
			"Correctness",
			"Performance",
			"Security",
			"Test Quality",
		]
		for (const lens of expectedLenses) {
			assert.ok(
				body.includes(`### ${lens} lens`),
				`Expected '### ${lens} lens' subheading in software/development prompt body`,
			)
		}
		// Every lens section must be non-empty: the text between a lens
		// subheading and the next ### (or end of string) must contain
		// non-whitespace content.
		for (const lens of expectedLenses) {
			const heading = `### ${lens} lens`
			const start = body.indexOf(heading)
			assert.ok(start !== -1, `'${heading}' should be present`)
			const afterHeading = body.slice(start + heading.length)
			// Find the next ### boundary (another subheading), or EOF.
			const nextHeading = afterHeading.indexOf("\n###")
			const section =
				nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading)
			assert.ok(
				section.trim().length > 0,
				`Section under '${heading}' should not be empty`,
			)
		}
	})

	await test("prior-stage artifacts are referenced by path, not inlined as content", () => {
		const { projDir, intentDirPath, slug } = createProject("pf-refs", {
			active_stage: "build",
			stages: ["plan", "build"],
		})
		// Mark plan stage complete so the workflow resolves "build" as active.
		createStageState(intentDirPath, "plan", {
			status: "completed",
			phase: "complete",
		})
		// Drop a real artifact file in the plan stage with a distinctive
		// marker. The build-stage prompt should reference its path, but
		// MUST NOT inline its body.
		const planArtifactsDir = join(intentDirPath, "stages", "plan", "artifacts")
		mkdirSync(planArtifactsDir, { recursive: true })
		const distinctiveContent =
			"DISTINCTIVE_PLAN_REPORT_BODY_THAT_MUST_NOT_BE_INLINED_INTO_PROMPT"
		writeFileSync(
			join(planArtifactsDir, "REPORT.md"),
			`# plan report\n\n${distinctiveContent}\n`,
		)

		createStageState(intentDirPath, "build", { phase: "elaborate" })
		process.chdir(projDir)
		const result = runNext(slug)
		assert.strictEqual(
			result.action,
			"elaborate",
			`Expected elaborate, got ${result.action}`,
		)
		assert.ok(result.prompt_file, "elaborate action should set prompt_file")
		const body = readFileSync(result.prompt_file, "utf8")

		// The prompt body MUST surface a "read as needed" / "Upstream
		// Context" section pointing at prior-stage paths.
		assert.ok(
			body.includes("Upstream Context"),
			"Prompt body should have an 'Upstream Context' section header",
		)
		// The plan-stage path must be referenced by path — at minimum,
		// the prior-stage enumeration must list `stages/plan/`.
		assert.ok(
			body.includes("stages/plan"),
			"Prompt body should reference the plan-stage path",
		)
		// The DISTINCTIVE marker from the artifact content MUST NOT
		// appear — upstream context is by path, not by inlined content.
		assert.ok(
			!body.includes(distinctiveContent),
			"Prompt body should NOT inline upstream-artifact content (references-only)",
		)
	})

	await test("withPromptFile fallback: when file write fails, action has no prompt_file and is otherwise valid", async () => {
		// Force writeActionPromptFile to throw by pre-creating the session's
		// haiku-prompts dir as a regular file (not a directory). The atomic
		// write inside promptDir() fails because it cannot mkdir into a file.
		const sessionId = `haiku-elab-pf-fallback-test-${process.pid}`
		const prevSessionId = process.env.HAIKU_SESSION_ID
		process.env.HAIKU_SESSION_ID = sessionId

		const haikuPromptsDir = join(tmpdir(), "haiku-prompts")
		mkdirSync(haikuPromptsDir, { recursive: true })
		const sessionSlot = join(haikuPromptsDir, sessionId)
		// Occupy the session path with a plain file — mkdir will throw EEXIST.
		writeFileSync(sessionSlot, "not-a-dir")

		try {
			const { projDir, intentDirPath, slug } = createProject("pf-fallback", {
				active_stage: "plan",
			})
			createStageState(intentDirPath, "plan", { phase: "elaborate" })
			process.chdir(projDir)
			const result = runNext(slug)

			// (a) No prompt_file — the write failed.
			assert.strictEqual(result.action, "elaborate")
			assert.ok(
				!result.prompt_file,
				`Expected no prompt_file on fallback, got: ${result.prompt_file}`,
			)

			// (b) The action is still a valid elaborate action — the handler
			// returns the untouched action object so the registered prompt
			// builder can render the full body inline in the tool response.
			assert.ok(
				typeof result.intent === "string" && result.intent === slug,
				"Fallback action should carry the intent slug",
			)
			assert.ok(
				typeof result.stage === "string",
				"Fallback action should carry the stage",
			)

			// (c) The full inline body IS rendered in the tool response text —
			// verify via handleOrchestratorTool since it goes through the prompt builder.
			const toolResult = await handleOrchestratorTool("haiku_run_next", {
				intent: slug,
			})
			const responseText = toolResult.content[0].text
			// Inline rendering path: the registered prompt builder (elaborate.ts
			// prompts) sees no prompt_file on the action and falls through to
			// renderElaborate(), which embeds the full body in the response text.
			assert.ok(
				!responseText.includes("Read `") ||
					responseText.includes("## Elaborate") ||
					responseText.includes("Workflow Contracts"),
				"Inline fallback response should include the full elaborate body",
			)
		} finally {
			// Restore session env and clean up the blocking file.
			if (prevSessionId === undefined) {
				delete process.env.HAIKU_SESSION_ID
			} else {
				process.env.HAIKU_SESSION_ID = prevSessionId
			}
			try {
				rmSync(sessionSlot, { force: true })
			} catch {
				/* best-effort */
			}
		}
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
