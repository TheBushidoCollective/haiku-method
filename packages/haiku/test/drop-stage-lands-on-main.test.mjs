// drop-stage-lands-on-main.test.mjs
//
// Regression for "haiku next hangs after a stage is dropped".
//
// The keep-or-drop offer parks the checkout on the optional stage's OWN
// branch (the cursor's post-action branch switch). `haiku_drop_stage` used
// to commit the `intent.stages` edit to whatever branch was checked out —
// i.e. that doomed stage branch. But every future stage branch forks from
// intent main (`git branch <stage> <main>`), and the per-tick sync only
// flows main → stage, so intent main never saw the drop: the next stage
// forked from a main that still listed the dropped stage, `findCurrentStage`
// flip-flopped dropped ⇆ next every tick, and the deadlock detector halted
// the loop (the "hang").
//
// The fix lands the drop on intent main and reaps the orphan stage branch.
// This test proves both, plus that the cursor advances cleanly afterward.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname
const __dirname = dirname(fileURLToPath(import.meta.url))
// Point studio resolution at the repo's plugin dir — the test chdirs into a
// temp repo, so cwd-relative studio lookup wouldn't find `software` otherwise.
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

function git(cwd, ...args) {
	execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] })
}

function parseToolJson(res) {
	return JSON.parse(res.content[0].text)
}

test("haiku_drop_stage lands the drop on intent main and reaps the stage branch", async () => {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-drop-stage-"))
	git(tmp, "init", "-q")
	git(tmp, "config", "user.email", "t@t.t")
	git(tmp, "config", "user.name", "t")
	git(tmp, "config", "commit.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "seed\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "seed")

	const slug = "demo-drop"
	// Build intent main with an intent whose plan reaches the optional
	// `design` stage first (design is `optional: true` in the software
	// studio; `development` after it is mandatory). No units / elaboration →
	// `findCurrentStage` returns `design` and the drop guards all pass.
	git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
	const iDir = join(tmp, ".haiku", "intents", slug)
	mkdirSync(iDir, { recursive: true })
	writeFileSync(
		join(iDir, "intent.md"),
		[
			"---",
			"studio: software",
			"mode: continuous",
			"stages:",
			"  - design",
			"  - development",
			"title: demo drop",
			"status: active",
			"---",
			"",
			"Drop-stage regression fixture.",
			"",
		].join("\n"),
	)
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "intent")

	// Fork the optional stage's branch from main and park the checkout on it
	// — exactly the state the post-cursor branch switch leaves us in when the
	// keep-or-drop offer is handed to the agent.
	git(tmp, "branch", `haiku/${slug}/design`, `haiku/${slug}/main`)
	git(tmp, "checkout", "-q", `haiku/${slug}/design`)

	const orig = process.cwd()
	process.chdir(tmp)
	try {
		const { getCurrentBranch, branchExists } = await import(
			`${SRC}git-worktree.ts`
		)
		const { findCurrentStage } = await import(
			`${SRC}orchestrator/workflow/cursor.ts`
		)
		// Sanity: we really are parked on the doomed stage branch, and the
		// cursor sees `design` as active.
		assert.equal(getCurrentBranch(), `haiku/${slug}/design`)
		assert.equal(findCurrentStage(slug, "software"), "design")

		const dropTool = (await import(`${SRC}tools/orchestrator/haiku_drop_stage.ts`))
			.default
		const res = parseToolJson(await dropTool.handle({ intent: slug, stage: "design" }))
		assert.equal(res.action, "stage_dropped", `unexpected: ${JSON.stringify(res)}`)
		assert.deepEqual(res.stages, ["development"])

		// 1. The drop landed on intent MAIN (the fork source), and the
		//    checkout was moved back there.
		assert.equal(
			getCurrentBranch(),
			`haiku/${slug}/main`,
			"drop must leave the checkout on intent main",
		)
		const mainIntent = execFileSync(
			"git",
			["show", `haiku/${slug}/main:.haiku/intents/${slug}/intent.md`],
			{ cwd: tmp, encoding: "utf8" },
		)
		assert.match(
			mainIntent,
			/stages:\s*\n\s*-\s*development\s*\n/,
			"intent main's plan must drop `design` and keep `development`",
		)
		assert.ok(
			!/-\s*design/.test(mainIntent),
			"`design` must be gone from intent main's plan",
		)

		// 2. The orphan stage branch is reaped — it can no longer reassert the
		//    stale plan through a downstream sync.
		assert.equal(
			branchExists(`haiku/${slug}/design`),
			false,
			"the dropped stage's branch must be deleted",
		)

		// 3. The cursor advances to the next stage with no oscillation: from
		//    intent main (which now carries the drop) `findCurrentStage`
		//    returns `development`, never `design`.
		assert.equal(
			findCurrentStage(slug, "software"),
			"development",
			"cursor must advance to the next stage, not flip back to the dropped one",
		)
	} finally {
		process.chdir(orig)
	}
})
