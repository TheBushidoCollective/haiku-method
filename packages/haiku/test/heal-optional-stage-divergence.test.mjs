// heal-optional-stage-divergence.test.mjs
//
// Layer 3 regression for the optional-stage drop deadlock (release-healthy-
// signals). A pre-2026-05-28 buggy haiku_drop_stage wrote the drop to the
// stage branch but never to intent main, so the cursor (reads main) kept
// re-arriving at a stage the branches had dropped. The pre-tick heal must
// detect that divergence and propagate the drop UP to intent main.
//
// Sets up the diverged state directly — intent main lists
// [inception, design, product], the working tree (a stage-branch checkout)
// lists [inception, product] with design unstarted — and asserts
// healOptionalStageDivergence removes `design` from intent main's plan.
// `design` is optional in the software studio, so it qualifies.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

function git(cwd, ...args) {
	execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] })
}

function intentMd(stages) {
	return `---
title: Test intent
studio: software
mode: discrete
stages: [${stages.join(", ")}]
plugin_version: "10.0.0"
---

Body.
`
}

test("healOptionalStageDivergence propagates a branch drop up to intent main", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-heal-"))
	git(tmp, "init", "-q", "-b", "main")
	git(tmp, "config", "user.email", "t@t.co")
	git(tmp, "config", "user.name", "t")

	const slug = "release-healthy-signals"
	const intentRel = join(".haiku", "intents", slug)
	const intentDirAbs = join(tmp, intentRel)
	mkdirSync(intentDirAbs, { recursive: true })

	// Seed the repo with a base commit so branches can fork.
	writeFileSync(join(tmp, "README.md"), "# test\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "base")

	// Intent main branch: plan still lists the optional `design` stage.
	const intentMain = `haiku/${slug}/main`
	git(tmp, "checkout", "-q", "-b", intentMain)
	writeFileSync(
		join(intentDirAbs, "intent.md"),
		intentMd(["inception", "design", "product"]),
	)
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "intent main with design")

	// Working-tree checkout (a stage branch) already has design dropped.
	writeFileSync(
		join(intentDirAbs, "intent.md"),
		intentMd(["inception", "product"]),
	)
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "stage branch without design")

	// Run the heal from inside the repo (cwd-driven, like a real tick).
	const prevCwd = process.cwd()
	process.chdir(tmp)
	try {
		const { healOptionalStageDivergence } = await import(
			new URL(
				"../src/orchestrator/workflow/heal-optional-stage-divergence.ts",
				import.meta.url,
			).href
		)
		const healed = healOptionalStageDivergence(slug, "software")
		assert.deepEqual(healed, ["design"], "should report design as healed")

		// intent main's plan must no longer list design.
		const mainRaw = execFileSync(
			"git",
			["show", `${intentMain}:${join(intentRel, "intent.md")}`],
			{ cwd: tmp, encoding: "utf8" },
		)
		assert.ok(
			!/stages:.*design/.test(mainRaw),
			"design should be removed from intent main's stages",
		)
		assert.ok(
			/inception/.test(mainRaw) && /product/.test(mainRaw),
			"mandatory stages should remain on intent main",
		)

		// Idempotent: a second run heals nothing.
		const second = healOptionalStageDivergence(slug, "software")
		assert.deepEqual(second, [], "second run is a no-op")
	} finally {
		process.chdir(prevCwd)
	}
})
