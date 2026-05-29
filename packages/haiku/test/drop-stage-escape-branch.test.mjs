// drop-stage-escape-branch.test.mjs
//
// Regression for #22 (reported 2026-05-29): "I moved to the design stage and
// its branch, dropped the stage, was STILL ON THE BRANCH after the fix, and got
// stuck — couldn't rescue off of it." The drop deadlock (plan flip-flop) is
// fixed elsewhere; this pins the CHECKOUT guarantee: after dropping the optional
// stage you're parked on, you must end up OFF that branch, and a follow-up
// run_next must advance — never strand the user on a branch for a stage that no
// longer exists in the plan.
//
// Two paths:
//   1. Clean drop: on haiku/<slug>/design, drop design → checkout lands on
//      intent main, design branch reaped, run_next advances to development.
//   2. Wedged recovery: design already dropped from main's plan but the design
//      branch still exists and is checked out (old-bug leftover / a switch that
//      didn't land). run_next must realign the checkout OFF design.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")
const SRC = new URL("../src/", import.meta.url).pathname

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function git(cwd, ...args) {
	execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] })
}

function intentMd(stages) {
	return `---
title: Drop escape fixture
studio: software
mode: continuous
stages:
${stages.map((s) => `  - ${s}`).join("\n")}
status: active
plugin_version: "10.0.0"
---

Body.
`
}

function seedIntent(tmp, slug, stages) {
	git(tmp, "init", "-q", "-b", "main")
	git(tmp, "config", "user.email", "t@t.co")
	git(tmp, "config", "user.name", "t")
	git(tmp, "config", "commit.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "# test\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "base")
	const intentMain = `haiku/${slug}/main`
	git(tmp, "checkout", "-q", "-b", intentMain)
	const iDir = join(tmp, ".haiku", "intents", slug)
	mkdirSync(iDir, { recursive: true })
	writeFileSync(join(iDir, "intent.md"), intentMd(stages))
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "intent")
	return iDir
}

async function runNext(slug) {
	const { orchestratorToolHandlers } = await import(
		`${SRC}tools/orchestrator/index.ts`
	)
	const tool = orchestratorToolHandlers.get("haiku_run_next")
	return await tool.handle({ intent: slug })
}

test("drop the stage you're parked on → checkout leaves the dropped branch + run_next advances", async () => {
	if (!HAS_GIT) return
	const tmp = mkdtempSync(join(tmpdir(), "haiku-drop-escape-"))
	const slug = "demo-escape"
	seedIntent(tmp, slug, ["design", "development"])
	// Park on the optional stage's own branch — the state the keep-or-drop
	// offer leaves the checkout in.
	git(tmp, "branch", `haiku/${slug}/design`, `haiku/${slug}/main`)
	git(tmp, "checkout", "-q", `haiku/${slug}/design`)

	const prev = process.cwd()
	process.chdir(tmp)
	try {
		const { getCurrentBranch, branchExists } = await import(
			`${SRC}git-worktree.ts`
		)
		assert.equal(getCurrentBranch(), `haiku/${slug}/design`, "start on design")

		const dropTool = (await import(`${SRC}tools/orchestrator/haiku_drop_stage.ts`))
			.default
		await dropTool.handle({ intent: slug, stage: "design" })

		assert.notEqual(
			getCurrentBranch(),
			`haiku/${slug}/design`,
			"after the drop the checkout MUST be off the dropped branch",
		)
		assert.equal(
			branchExists(`haiku/${slug}/design`),
			false,
			"the dropped branch is reaped",
		)

		// A follow-up tick advances rather than getting stuck on the dropped stage.
		const resp = await runNext(slug)
		const txt = resp.content?.[0]?.text ?? ""
		assert.ok(
			!/design/.test(getCurrentBranch()),
			`run_next must not put us back on design; on ${getCurrentBranch()}`,
		)
		assert.doesNotMatch(
			txt,
			/drop_stage|deadlock|loop_aborted/,
			`run_next should advance cleanly, got: ${txt.slice(0, 200)}`,
		)
	} finally {
		process.chdir(prev)
	}
})

test("wedged recovery: design dropped from main but checkout still on the design branch → run_next escapes it", async () => {
	if (!HAS_GIT) return
	const tmp = mkdtempSync(join(tmpdir(), "haiku-drop-wedge-"))
	const slug = "demo-wedge"
	// Intent main's plan ALREADY dropped design (only development remains) —
	// but the design branch still exists and is the checkout. This is the
	// "still on the branch, couldn't rescue off" state.
	seedIntent(tmp, slug, ["development"])
	git(tmp, "branch", `haiku/${slug}/design`, `haiku/${slug}/main`)
	git(tmp, "checkout", "-q", `haiku/${slug}/design`)

	const prev = process.cwd()
	process.chdir(tmp)
	try {
		const { getCurrentBranch } = await import(`${SRC}git-worktree.ts`)
		assert.equal(getCurrentBranch(), `haiku/${slug}/design`, "wedged on design")

		await runNext(slug)

		assert.notEqual(
			getCurrentBranch(),
			`haiku/${slug}/design`,
			"run_next MUST move the checkout off the dropped/dangling design branch",
		)
	} finally {
		process.chdir(prev)
	}
})
