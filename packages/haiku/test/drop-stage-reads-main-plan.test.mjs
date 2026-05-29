// Layer 2: haiku_drop_stage must resolve the active stage from the CANONICAL
// plan (intent main's intent.stages), not the current-branch checkout. The
// old-bug divergence parks the checkout on a stage branch whose intent.stages
// already dropped the optional stage — so the current-branch active stage is
// the NEXT stage and the guard refused the drop (`drop_stage_not_active`),
// while haiku_run_next (reading main) kept arriving at the dropped stage.
// Reading main makes the two agree.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const PLUGIN_ROOT = join(process.cwd(), "..", "..", "plugin")

function sh(cmd, args, cwd) {
	return execFileSync(cmd, args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	})
}

function fm(stages) {
	return [
		"---",
		`title: "Test"`,
		"studio: software",
		`stages: [${stages.join(", ")}]`,
		"mode: discrete",
		"status: active",
		"---",
		"",
		"# Test",
		"",
	].join("\n")
}

function setupRepo() {
	const dir = mkdtempSync(join(tmpdir(), "haiku-drop-mainplan-"))
	sh("git", ["init", "-b", "main"], dir)
	sh("git", ["config", "user.email", "t@t.co"], dir)
	sh("git", ["config", "user.name", "t"], dir)
	return dir
}

test("drop resolves active stage from intent main, not the diverged branch", async () => {
	const dir = setupRepo()
	const slug = "release-healthy-signals"
	const iDir = join(dir, ".haiku", "intents", slug)
	mkdirSync(join(iDir, "stages"), { recursive: true })

	// `design` is optional in the software studio. Putting it FIRST in the plan
	// makes it the active, unstarted stage immediately — no upstream stage to
	// complete (the proven shape from drop-stage-lands-on-main). Intent main
	// KEEPS design (the canonical plan the cursor reads).
	writeFileSync(join(iDir, "intent.md"), fm(["design", "product"]))
	sh("git", ["add", "-A"], dir)
	sh("git", ["commit", "-m", "seed main with design"], dir)
	sh("git", ["branch", `haiku/${slug}/main`], dir)

	// Stage branch where the OLD buggy drop landed: design removed from
	// intent.stages on the BRANCH only. Reading this checkout, the active stage
	// is `product` — so the pre-fix guard refused the drop while the cursor
	// (reading main) kept arriving at design. We park the checkout here.
	sh("git", ["branch", `haiku/${slug}/product`], dir)
	sh("git", ["checkout", `haiku/${slug}/product`], dir)
	writeFileSync(join(iDir, "intent.md"), fm(["product"]))
	sh("git", ["add", "-A"], dir)
	sh("git", ["commit", "-m", "old-bug: dropped design on stage branch"], dir)

	const prevCwd = process.cwd()
	const prevPlugin = process.env.CLAUDE_PLUGIN_ROOT
	process.chdir(dir)
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		const mod = await import(
			`../src/tools/orchestrator/haiku_drop_stage.ts?d=${Date.now()}`
		)
		// Parked on the product branch (current-branch active stage is
		// `product`). With the canonical-main read, design IS the active stage,
		// so the drop must be accepted — not `drop_stage_not_active`.
		const res = await mod.default.handle({ intent: slug, stage: "design" })
		const payload = JSON.parse(res.content[0].text)
		assert.equal(
			payload.action,
			"stage_dropped",
			`expected drop accepted; got ${JSON.stringify(payload)}`,
		)
		// And the drop lands on intent main.
		const mainIntent = sh(
			"git",
			["show", `haiku/${slug}/main:.haiku/intents/${slug}/intent.md`],
			dir,
		)
		assert.doesNotMatch(mainIntent, /stages:.*design/)
	} finally {
		process.chdir(prevCwd)
		process.env.CLAUDE_PLUGIN_ROOT = prevPlugin
	}
})
