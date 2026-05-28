// Layer 2: haiku_drop_stage must resolve the active stage from the CANONICAL
// plan (intent main's intent.stages), not the current-branch checkout. The
// old-bug divergence parks the checkout on a stage branch whose intent.stages
// already dropped the optional stage — so the current-branch active stage is
// the NEXT stage and the guard refused the drop (`drop_stage_not_active`),
// while haiku_run_next (reading main) kept arriving at the dropped stage.
// Reading main makes the two agree.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
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

	// Intent main lists design (the canonical, still-present plan).
	writeFileSync(
		join(iDir, "intent.md"),
		fm(["inception", "design", "product", "development"]),
	)
	// inception is complete everywhere so the cursor (reading main) arrives at
	// design — the optional unstarted stage.
	const incDir = join(iDir, "stages", "inception")
	mkdirSync(incDir, { recursive: true })
	writeFileSync(join(incDir, "gate.md"), "signed\n")
	sh("git", ["add", "-A"], dir)
	sh("git", ["commit", "-m", "seed main"], dir)
	sh("git", ["branch", "haiku/release-healthy-signals/main"], dir)

	// Stage branch where the OLD buggy drop landed: design already removed
	// from intent.stages → reading this branch, active stage is `product`.
	sh("git", ["branch", "haiku/release-healthy-signals/design"], dir)
	sh("git", ["checkout", "haiku/release-healthy-signals/design"], dir)
	writeFileSync(
		join(iDir, "intent.md"),
		fm(["inception", "product", "development"]),
	)
	sh("git", ["add", "-A"], dir)
	sh("git", ["commit", "-m", "old-bug: dropped design on branch"], dir)

	const prevCwd = process.cwd()
	const prevPlugin = process.env.CLAUDE_PLUGIN_ROOT
	process.chdir(dir)
	process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
	try {
		const mod = await import(
			`../src/tools/orchestrator/haiku_drop_stage.ts?d=${Date.now()}`
		)
		// Checkout is parked on the design branch (current-branch active stage
		// is `product`). With the canonical-main read, design IS the active
		// stage, so the drop must be accepted — not `drop_stage_not_active`.
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
			[
				"show",
				"haiku/release-healthy-signals/main:.haiku/intents/release-healthy-signals/intent.md",
			],
			dir,
		)
		assert.doesNotMatch(mainIntent, /stages:.*design/)
	} finally {
		process.chdir(prevCwd)
		process.env.CLAUDE_PLUGIN_ROOT = prevPlugin
	}
})
