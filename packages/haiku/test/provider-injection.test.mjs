// provider-injection.test.mjs
//
// Provider-injection wave (2026-05-19). Covers:
//
// 1. Provider loader resolves configured providers, respects always_on,
//    skips unconfigured providers.
// 2. `splices_into:` drives which prompt phases pick up each provider.
// 3. `external_refs:` is accepted on intent + unit frontmatter (TypeBox
//    + AJV gate).

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = fileURLToPath(new URL(".", import.meta.url))
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

function makeRepo(label, { git = true } = {}) {
	const dir = mkdtempSync(join(tmpdir(), `haiku-provider-${label}-`))
	if (HAS_GIT && git) {
		execFileSync("git", ["init", "-q", "-b", "main", dir], { stdio: "ignore" })
	}
	const haikuDir = join(dir, ".haiku")
	mkdirSync(join(haikuDir, "intents", "demo"), { recursive: true })
	return { dir, haikuDir, intentDir: join(haikuDir, "intents", "demo") }
}

function writeSettings(haikuDir, providers) {
	const lines = ["providers:"]
	for (const [k, v] of Object.entries(providers)) {
		lines.push(`  ${k}:`)
		for (const [kk, vv] of Object.entries(v)) lines.push(`    ${kk}: ${vv}`)
	}
	writeFileSync(join(haikuDir, "settings.yml"), `${lines.join("\n")}\n`)
}

test("listActiveProviders: returns only configured + always-on providers", async () => {
	const { dir, haikuDir, intentDir } = makeRepo("active")
	const origCwd = process.cwd()
	process.chdir(dir)
	try {
		writeSettings(haikuDir, {
			ticketing: { type: "jira" },
			spec: { type: "confluence" },
		})
		const mod = await import(`${SRC}orchestrator/prompts/_provider-loader.ts`)
		const active = mod.listActiveProviders(intentDir)
		const kinds = active.map((p) => p.kind).sort()
		// git is always_on, so it should be present even without
		// explicit config. ticketing + spec are explicitly configured.
		// knowledge + design are NOT configured, so should NOT appear.
		assert.deepStrictEqual(
			kinds,
			["git", "spec", "ticketing"],
			`got: ${kinds.join(", ")}`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(dir, { recursive: true, force: true })
	}
})

test("providersForSplicePoint: filters by phase", async () => {
	const { dir, haikuDir, intentDir } = makeRepo("splice")
	const origCwd = process.cwd()
	process.chdir(dir)
	try {
		writeSettings(haikuDir, {
			ticketing: { type: "jira" },
			spec: { type: "confluence" },
		})
		const mod = await import(`${SRC}orchestrator/prompts/_provider-loader.ts`)
		const elabKinds = mod
			.providersForSplicePoint("elaborate", intentDir)
			.map((p) => p.kind)
			.sort()
		// elaborate splices git (always-on), spec (source), ticketing
		// (workflow). All three declare elaborate in splices_into.
		assert.deepStrictEqual(elabKinds, ["git", "spec", "ticketing"])

		const executeKinds = mod
			.providersForSplicePoint("execute", intentDir)
			.map((p) => p.kind)
			.sort()
		// execute: git + ticketing (workflow providers). spec is source
		// → only elaborate. design / knowledge not configured.
		assert.deepStrictEqual(executeKinds, ["git", "ticketing"])

		const sealKinds = mod
			.providersForSplicePoint("seal_intent", intentDir)
			.map((p) => p.kind)
			.sort()
		assert.deepStrictEqual(sealKinds, ["git", "ticketing"])

		const completeKinds = mod
			.providersForSplicePoint("complete_stage", intentDir)
			.map((p) => p.kind)
			.sort()
		// Only ticketing splices into complete_stage. git's contract
		// doesn't (commit/push happens engine-side, no agent action).
		assert.deepStrictEqual(completeKinds, ["ticketing"])
	} finally {
		process.chdir(origCwd)
		rmSync(dir, { recursive: true, force: true })
	}
})

test("listActiveProviders: no settings → only always-on (git)", async () => {
	const { dir, intentDir } = makeRepo("noconfig")
	const origCwd = process.cwd()
	process.chdir(dir)
	try {
		// No settings.yml at all.
		const sharedMod = await import(`${SRC}state/shared.ts`)
		sharedMod._resetIsGitRepoForTests()
		const mod = await import(`${SRC}orchestrator/prompts/_provider-loader.ts`)
		const kinds = mod.listActiveProviders(intentDir).map((p) => p.kind)
		assert.deepStrictEqual(kinds, ["git"])
	} finally {
		process.chdir(origCwd)
		rmSync(dir, { recursive: true, force: true })
	}
})

test("listActiveProviders: NO git repo → git NOT included even though always_on", async () => {
	const { dir, intentDir } = makeRepo("nogit", { git: false })
	const origCwd = process.cwd()
	process.chdir(dir)
	try {
		// Clear the cached isGitRepo result so the loader sees the
		// non-git environment we just constructed.
		const sharedMod = await import(`${SRC}state/shared.ts`)
		sharedMod._resetIsGitRepoForTests()
		const mod = await import(`${SRC}orchestrator/prompts/_provider-loader.ts`)
		const kinds = mod.listActiveProviders(intentDir).map((p) => p.kind)
		// No settings, no git repo → no providers active.
		assert.deepStrictEqual(
			kinds,
			[],
			`git provider should not appear outside a git repo (got: ${kinds.join(", ")})`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(dir, { recursive: true, force: true })
	}
})

test("intent frontmatter accepts external_refs", async () => {
	const { validateIntentFrontmatterSchema } = await import(
		`${SRC}state/schemas/intent.ts`
	)
	const ok = validateIntentFrontmatterSchema({
		title: "Demo intent",
		external_refs: {
			ticket_epic: "PROJ-42",
			spec_prd: "https://confluence.example/x",
		},
	})
	assert.strictEqual(ok, true)
})

test("unit frontmatter accepts external_refs", async () => {
	const { validateUnitFrontmatterSchema } = await import(
		`${SRC}state/schemas/unit.ts`
	)
	const ok = validateUnitFrontmatterSchema({
		title: "demo unit",
		external_refs: {
			ticket: "PROJ-43",
			design_ref: "figma://abc#node=1:2",
		},
	})
	assert.strictEqual(ok, true)
})

test("external_refs rejects non-string values", async () => {
	const { validateUnitFrontmatterSchema } = await import(
		`${SRC}state/schemas/unit.ts`
	)
	const ok = validateUnitFrontmatterSchema({
		title: "bad unit",
		external_refs: { ticket: 42 }, // number, should fail
	})
	assert.strictEqual(ok, false)
})
