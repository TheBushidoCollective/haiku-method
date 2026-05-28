// validate-unit-inputs-gate.test.mjs
//
// Read-time half of the unit-014 fix (admin-portal-reimagine
// 2026-05-19). The write-time validator in `haiku_unit_write` stops new
// units with unit-name `inputs:`; this pre-tick gate covers units
// ALREADY on disk by auto-filing a deduplicated feedback so the
// malformed spec surfaces for repair instead of wedging the cursor.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
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

function seed(repoRoot, slug, stage, inputs) {
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "Input gate test",
			studio: "software",
			mode: "continuous",
			stages: [stage],
		}),
	)
	// Wave-ready unit (no started_at) so findCurrentStage pins the stage.
	writeFileSync(
		join(stageDir, "units", "unit-014-comparative-dashboard.md"),
		matter.stringify("unit body\n", {
			title: "comparative dashboard",
			inputs,
			iterations: [],
			reviews: {},
			approvals: {},
		}),
	)
	return { intentDir, stageDir }
}

test("read-time gate files a deduplicated FB for a unit-name input, then no-ops", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-input-gate-"))
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const slug = "input-gate"
		const stage = "security"
		const { intentDir, stageDir } = seed(repoRoot, slug, stage, [
			"unit-005-graphql-entity-quick-view",
			"product/ACCEPTANCE-CRITERIA.md",
		])
		const { autoFileMalformedUnitInputs } = await import(
			`${SRC}orchestrator/workflow/validate-unit-inputs-gate.ts`
		)
		const fbDir = join(stageDir, "feedback")

		// First pass: files one FB targeting the malformed unit.
		const r1 = autoFileMalformedUnitInputs(slug, intentDir, "software")
		assert.deepEqual(
			r1.filed,
			["unit-014-comparative-dashboard"],
			`expected one filed FB; got ${JSON.stringify(r1)}`,
		)
		const fbsAfter1 = readdirSync(fbDir).filter((f) => f.endsWith(".md"))
		assert.equal(fbsAfter1.length, 1, "exactly one FB should be on disk")
		const fbFm = matter(readFileSync(join(fbDir, fbsAfter1[0]), "utf8")).data
		assert.equal(fbFm.source_ref, "malformed-inputs:unit-014-comparative-dashboard")
		assert.equal(fbFm.targets.unit, "unit-014-comparative-dashboard")

		// Second pass: dedup — no new FB, unit reported as skipped.
		const r2 = autoFileMalformedUnitInputs(slug, intentDir, "software")
		assert.deepEqual(r2.filed, [], "second pass must not file a duplicate FB")
		assert.deepEqual(r2.skipped, ["unit-014-comparative-dashboard"])
		const fbsAfter2 = readdirSync(fbDir).filter((f) => f.endsWith(".md"))
		assert.equal(fbsAfter2.length, 1, "still exactly one FB after the dedup pass")
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("read-time gate is silent for a unit with proper file-path inputs", async () => {
	if (!HAS_GIT) return
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-input-gate-ok-"))
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const slug = "input-gate-ok"
		const stage = "security"
		const { intentDir, stageDir } = seed(repoRoot, slug, stage, [
			"product/ACCEPTANCE-CRITERIA.md",
			"intent.md",
		])
		const { autoFileMalformedUnitInputs } = await import(
			`${SRC}orchestrator/workflow/validate-unit-inputs-gate.ts`
		)
		const r = autoFileMalformedUnitInputs(slug, intentDir, "software")
		assert.deepEqual(r.filed, [], "file-path inputs must not trigger a finding")
		const fbDir = join(stageDir, "feedback")
		const fbs = readdirSync(fbDir).filter((f) => f.endsWith(".md"))
		assert.equal(fbs.length, 0, "no FB should be filed for valid inputs")
	} finally {
		process.chdir(origCwd)
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
