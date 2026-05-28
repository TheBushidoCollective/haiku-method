// template-cascade.test.mjs
//
// Locks the prompt-template cascade introduced 2026-05-18:
//
//   1. test-only `setTemplateOverride` wins over everything (fixtures)
//   2. <cwd>/.haiku/prompts/<canonical>       ── project override
//   3. <pluginRoot>/prompts/<canonical>       ── plugin default
//
// Dev path (real import.meta.url) stays exercised by the existing
// elaborate-prompt + orphan-action-prompts test suites; this one
// focuses on the "@canon:" sentinel form the bundled binary uses.

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = dirname(fileURLToPath(import.meta.url))

async function withFakePluginAndCwd(seed, fn) {
	const origCwd = process.cwd()
	const origPluginRoot = process.env.CLAUDE_PLUGIN_ROOT
	const tmp = mkdtempSync(join(tmpdir(), "haiku-template-cascade-"))
	const fakePluginRoot = join(tmp, "plugin")
	const fakeProjectCwd = join(tmp, "project")
	mkdirSync(join(fakePluginRoot, "prompts"), { recursive: true })
	mkdirSync(join(fakePluginRoot, ".claude-plugin"), { recursive: true })
	writeFileSync(
		join(fakePluginRoot, ".claude-plugin", "plugin.json"),
		JSON.stringify({ name: "haiku", version: "test" }),
	)
	mkdirSync(fakeProjectCwd, { recursive: true })
	process.env.CLAUDE_PLUGIN_ROOT = fakePluginRoot
	process.chdir(fakeProjectCwd)
	// config.ts module-level caches the resolved plugin root on first
	// use; force a re-read so each test sees the fixture path it just
	// set rather than the path that was active during the FIRST test.
	const config = await import(`${SRC}config.ts`)
	config._resetPluginRootForTests()
	try {
		seed({ fakePluginRoot, fakeProjectCwd })
		await fn({ fakePluginRoot, fakeProjectCwd })
	} finally {
		process.chdir(origCwd)
		if (origPluginRoot === undefined) {
			delete process.env.CLAUDE_PLUGIN_ROOT
		} else {
			process.env.CLAUDE_PLUGIN_ROOT = origPluginRoot
		}
		config._resetPluginRootForTests()
		rmSync(tmp, { recursive: true, force: true })
	}
}

test("plugin-tier template resolves when no project override exists", async () => {
	await withFakePluginAndCwd(
		({ fakePluginRoot }) => {
			const dir = join(fakePluginRoot, "prompts", "stage", "example")
			mkdirSync(dir, { recursive: true })
			writeFileSync(join(dir, "template.eta.md"), "PLUGIN BODY\n")
		},
		async () => {
			const mod = await import(`${SRC}orchestrator/prompts/_load-template.ts`)
			mod._clearTemplateCacheForTests()
			const body = mod.loadTemplate("@canon:stage/example")
			assert.equal(body, "PLUGIN BODY\n")
		},
	)
})

test("project-tier override beats plugin-tier (cascade order)", async () => {
	await withFakePluginAndCwd(
		({ fakePluginRoot, fakeProjectCwd }) => {
			const pluginDir = join(fakePluginRoot, "prompts", "stage", "example")
			mkdirSync(pluginDir, { recursive: true })
			writeFileSync(join(pluginDir, "template.eta.md"), "PLUGIN LOSES\n")
			const projectDir = join(
				fakeProjectCwd,
				".haiku",
				"prompts",
				"stage",
				"example",
			)
			mkdirSync(projectDir, { recursive: true })
			writeFileSync(join(projectDir, "template.eta.md"), "PROJECT WINS\n")
		},
		async () => {
			const mod = await import(`${SRC}orchestrator/prompts/_load-template.ts`)
			mod._clearTemplateCacheForTests()
			const body = mod.loadTemplate("@canon:stage/example")
			assert.equal(body, "PROJECT WINS\n")
		},
	)
})

test("named-template argument (subdir form) resolves through cascade", async () => {
	await withFakePluginAndCwd(
		({ fakePluginRoot }) => {
			const dir = join(
				fakePluginRoot,
				"prompts",
				"stage",
				"approve",
				"dispatch_approval",
				"engine-bodies",
			)
			mkdirSync(dir, { recursive: true })
			writeFileSync(join(dir, "spec.eta.md"), "SPEC ROLE BODY\n")
		},
		async () => {
			const mod = await import(`${SRC}orchestrator/prompts/_load-template.ts`)
			mod._clearTemplateCacheForTests()
			const body = mod.loadTemplate(
				"@canon:stage/approve/dispatch_approval",
				"engine-bodies/spec.eta.md",
			)
			assert.equal(body, "SPEC ROLE BODY\n")
		},
	)
})

test("test override beats both tiers", async () => {
	await withFakePluginAndCwd(
		({ fakePluginRoot, fakeProjectCwd }) => {
			const pluginDir = join(fakePluginRoot, "prompts", "stage", "example")
			mkdirSync(pluginDir, { recursive: true })
			writeFileSync(join(pluginDir, "template.eta.md"), "PLUGIN LOSES\n")
			const projectDir = join(
				fakeProjectCwd,
				".haiku",
				"prompts",
				"stage",
				"example",
			)
			mkdirSync(projectDir, { recursive: true })
			writeFileSync(join(projectDir, "template.eta.md"), "PROJECT LOSES\n")
		},
		async () => {
			const mod = await import(`${SRC}orchestrator/prompts/_load-template.ts`)
			mod._clearTemplateCacheForTests()
			mod.clearTemplateOverrides()
			mod.setTemplateOverride(
				"stage/example/template.eta.md",
				"OVERRIDE WINS\n",
			)
			try {
				const body = mod.loadTemplate("@canon:stage/example")
				assert.equal(body, "OVERRIDE WINS\n")
			} finally {
				mod.clearTemplateOverrides()
			}
		},
	)
})

test("missing template throws with both checked paths in the message", async () => {
	await withFakePluginAndCwd(
		() => {
			// seed nothing — neither tier has the template
		},
		async () => {
			const mod = await import(`${SRC}orchestrator/prompts/_load-template.ts`)
			mod._clearTemplateCacheForTests()
			let thrown = null
			try {
				mod.loadTemplate("@canon:does/not/exist")
			} catch (err) {
				thrown = err
			}
			assert.ok(thrown, "expected loadTemplate to throw")
			assert.match(thrown.message, /\.haiku\/prompts\/does\/not\/exist/)
			assert.match(thrown.message, /prompts\/does\/not\/exist/)
		},
	)
})
