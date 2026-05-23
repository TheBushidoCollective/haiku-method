#!/usr/bin/env npx tsx
// build-stage-quality-gates.test.mjs — Option 2: build-class producing units
// must DECLARE a `quality_gates:` field (presence, not substance), enforced at
// `haiku_unit_write` only. Knowledge stages (the default) are untouched, and
// nothing already in flight is revalidated — the rule lives solely in
// validateUnitFrontmatter, which runs only on the pending-only write path.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

const BODY = "# Unit\n\nImplement the widget service and its contract tests so the public API is exercised end to end.\n\n## Completion Criteria\n\n- The service responds and the contract test passes.\n"

// ── Part A: validateUnitFrontmatter unit-level rule ──────────────────────────

test("validateUnitFrontmatter: build stage + outputs + NO quality_gates field → rejected", async () => {
	const { validateUnitFrontmatter } = await import(`${SRC}/state-tools.ts`)
	const r = validateUnitFrontmatter(
		{ title: "t", inputs: ["product/SPEC.md"], outputs: ["src/widget.ts"] },
		{ intent: "i", stage: "development", unit: "unit-001-x", siblingUnits: ["unit-001-x"], stageProduces: "build" },
	)
	assert.equal(r.valid, false, "should be invalid")
	assert.ok(
		r.errors.some((e) => e.startsWith("build_unit_missing_quality_gates")),
		`expected build_unit_missing_quality_gates; got ${JSON.stringify(r.errors)}`,
	)
})

test("validateUnitFrontmatter: build stage + outputs + explicit quality_gates: [] → allowed", async () => {
	const { validateUnitFrontmatter } = await import(`${SRC}/state-tools.ts`)
	const r = validateUnitFrontmatter(
		{ title: "t", outputs: ["src/widget.ts"], quality_gates: [] },
		{ intent: "i", stage: "development", unit: "unit-001-x", siblingUnits: ["unit-001-x"], stageProduces: "build" },
	)
	assert.equal(r.valid, true, `explicit [] is a deliberate choice and must pass; got ${JSON.stringify(r)}`)
})

test("validateUnitFrontmatter: build stage + outputs + real gates → allowed", async () => {
	const { validateUnitFrontmatter } = await import(`${SRC}/state-tools.ts`)
	const r = validateUnitFrontmatter(
		{ title: "t", outputs: ["src/widget.ts"], quality_gates: [{ name: "tests", command: "true" }] },
		{ intent: "i", stage: "development", unit: "unit-001-x", siblingUnits: ["unit-001-x"], stageProduces: "build" },
	)
	assert.equal(r.valid, true, `got ${JSON.stringify(r)}`)
})

test("validateUnitFrontmatter: build stage + NO outputs → exempt (output-less unit is valid)", async () => {
	const { validateUnitFrontmatter } = await import(`${SRC}/state-tools.ts`)
	const r = validateUnitFrontmatter(
		{ title: "t", inputs: ["product/SPEC.md"] },
		{ intent: "i", stage: "development", unit: "unit-001-x", siblingUnits: ["unit-001-x"], stageProduces: "build" },
	)
	assert.equal(r.valid, true, `output-less unit must be exempt; got ${JSON.stringify(r)}`)
})

test("validateUnitFrontmatter: knowledge stage + outputs + NO gates → allowed (no requirement)", async () => {
	const { validateUnitFrontmatter } = await import(`${SRC}/state-tools.ts`)
	const r = validateUnitFrontmatter(
		{ title: "t", outputs: ["product/ACCEPTANCE-CRITERIA.md"] },
		{ intent: "i", stage: "product", unit: "unit-001-x", siblingUnits: ["unit-001-x"], stageProduces: "knowledge" },
	)
	assert.equal(r.valid, true, `knowledge stage must not require gates; got ${JSON.stringify(r)}`)
})

test("validateUnitFrontmatter: stageProduces absent → lenient (no requirement)", async () => {
	const { validateUnitFrontmatter } = await import(`${SRC}/state-tools.ts`)
	const r = validateUnitFrontmatter(
		{ title: "t", outputs: ["src/widget.ts"] },
		{ intent: "i", stage: "development", unit: "unit-001-x", siblingUnits: ["unit-001-x"] },
	)
	assert.equal(r.valid, true, `absent stageProduces must default lenient; got ${JSON.stringify(r)}`)
})

// ── Part B: end-to-end through haiku_unit_write (produces resolved from STAGE.md) ──

function seedIntent(repo, slug, stage) {
	const intentDir = join(repo, ".haiku", "intents", slug)
	mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test\n", {
			title: "test",
			studio: "software",
			mode: "continuous",
			plugin_version: "9.0.0",
			stages: [stage],
		}),
	)
	return intentDir
}

async function withRepo(fn) {
	const repo = mkdtempSync(join(tmpdir(), "haiku-bsg-"))
	const orig = process.cwd()
	git(repo, "init", "-q", "-b", "main")
	git(repo, "config", "user.email", "test@haiku")
	git(repo, "config", "user.name", "haiku-test")
	git(repo, "config", "commit.gpgsign", "false")
	writeFileSync(join(repo, "README.md"), "# t\n")
	git(repo, "add", "-A")
	git(repo, "commit", "-q", "-m", "init")
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	process.chdir(repo)
	const { _resetIsGitRepoForTests, handleStateTool } = await import(`${SRC}/state-tools.ts`)
	_resetIsGitRepoForTests()
	try {
		await fn(repo, handleStateTool)
	} finally {
		process.chdir(orig)
		_resetIsGitRepoForTests()
		rmSync(repo, { recursive: true, force: true })
	}
}

function parseResp(resp) {
	const text = resp.content?.[0]?.text ?? ""
	try {
		return JSON.parse(text)
	} catch {
		return { _raw: text }
	}
}

test("haiku_unit_write: build stage (software/development) rejects a producing unit with no quality_gates field", async () => {
	if (!HAS_GIT) return
	await withRepo(async (_repo, handleStateTool) => {
		seedIntent(_repo, "bsg-build", "development")
		const resp = handleStateTool("haiku_unit_write", {
			intent: "bsg-build",
			stage: "development",
			unit: "unit-001-widget",
			body: BODY,
			frontmatter: { title: "Widget", inputs: ["product/SPEC.md"], outputs: ["src/widget.ts"] },
		})
		const parsed = parseResp(resp)
		assert.ok(resp.isError, `write should be rejected; got ${JSON.stringify(parsed).slice(0, 300)}`)
		assert.equal(parsed.error, "frontmatter_validation_failed")
		assert.ok(
			(parsed.errors || []).some((e) => e.startsWith("build_unit_missing_quality_gates")),
			`expected build_unit_missing_quality_gates; got ${JSON.stringify(parsed.errors)}`,
		)
	})
})

test("haiku_unit_write: build stage accepts the same unit once quality_gates: [] is declared", async () => {
	if (!HAS_GIT) return
	await withRepo(async (_repo, handleStateTool) => {
		seedIntent(_repo, "bsg-build-ok", "development")
		const resp = handleStateTool("haiku_unit_write", {
			intent: "bsg-build-ok",
			stage: "development",
			unit: "unit-001-widget",
			body: BODY,
			frontmatter: { title: "Widget", inputs: ["product/SPEC.md"], outputs: ["src/widget.ts"], quality_gates: [] },
		})
		const parsed = parseResp(resp)
		assert.ok(!resp.isError, `explicit [] should pass; got ${JSON.stringify(parsed).slice(0, 300)}`)
	})
})

test("haiku_unit_write: knowledge stage (software/product) allows a producing unit with no gates", async () => {
	if (!HAS_GIT) return
	await withRepo(async (_repo, handleStateTool) => {
		seedIntent(_repo, "bsg-knowledge", "product")
		const resp = handleStateTool("haiku_unit_write", {
			intent: "bsg-knowledge",
			stage: "product",
			unit: "unit-001-spec",
			body: BODY,
			frontmatter: { title: "Spec", inputs: ["knowledge/DISCOVERY.md"], outputs: ["product/ACCEPTANCE-CRITERIA.md"] },
		})
		const parsed = parseResp(resp)
		assert.ok(!resp.isError, `knowledge stage must not require gates; got ${JSON.stringify(parsed).slice(0, 300)}`)
	})
})
