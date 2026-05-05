#!/usr/bin/env npx tsx
// Real-git integration test for the dirty-tree pre-stage commit
// guard added in workflowStartStage. The fake-bin git stub used by
// e2e-intent-flow.test.mjs returns 0 for every git invocation, which
// means the dirty-tree refusal pattern Tara hit on 2026-05-05 never
// fires under that stub. This file plants the exact pattern against
// a real tmpdir git repo and asserts:
//
//   1. After intent_create + select_studio + select_mode, intent.md
//      is committed (the existing best-effort commits land cleanly).
//   2. If we plant uncommitted changes to intent.md AND then drive
//      run_next into start_stage, the pre-stage commit guard catches
//      them and the stage-branch checkout succeeds.
//   3. The stage state.json is written cleanly and the intent has an
//      `active_stage` set — no half-state shape that would force an
//      `intent_reset` recovery.
//
// This is the durable answer to "would my fix actually catch
// Tara's bug under real git semantics" — the previous E2E coverage
// only proved the handler chain didn't crash on a stub.

import assert from "node:assert"
import { execSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { handleOrchestratorTool, setElicitInputHandler, setGateReviewHandlers } =
	await import("../src/orchestrator.ts")
const { _resetIsGitRepoForTests } = await import("../src/state/shared.ts")
const { parseFrontmatter } = await import("../src/state-tools.ts")

let passed = 0
let failed = 0
const origCwd = process.cwd()

async function test(name, fn) {
	try {
		const r = fn()
		if (r && typeof r.then === "function") await r
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}: ${err.message}`)
		if (err.stack) console.log(err.stack)
	}
}

// Shared real-git scaffold. Each test gets a fresh tmpdir with `git init`,
// a committed initial commit, and a studio definition under .haiku/studios/.
function makeRepoWithStudio() {
	const root = mkdtempSync(join(tmpdir(), "haiku-dirty-tree-"))
	const git = (cmd) =>
		execSync(cmd, { cwd: root, stdio: "pipe", encoding: "utf8" }).trim()
	git("git init -b main")
	git("git config user.email test@example.com")
	git("git config user.name Test")
	git("git config commit.gpgsign false")
	git("git commit --allow-empty -m init")

	const studio = "test-studio"
	const stages = ["plan", "build"]
	const studioDir = join(root, ".haiku", "studios", studio)
	mkdirSync(studioDir, { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		`---\nname: ${studio}\ndescription: Real-git dirty-tree recovery test studio\nstages: [${stages.join(", ")}]\n---\n\nA test studio.\n`,
	)
	for (const stage of stages) {
		const stageDir = join(studioDir, "stages", stage)
		mkdirSync(stageDir, { recursive: true })
		writeFileSync(
			join(stageDir, "STAGE.md"),
			`---\nname: ${stage}\nhats: [worker]\nreview: auto\nelaboration: autonomous\n---\n\n${stage} stage.\n`,
		)
	}
	// Commit the studio dir so the working tree starts clean.
	git("git add .haiku")
	git('git commit -m "seed test studio"')

	return {
		root,
		git,
		studio,
		stages,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	}
}

function userPicker(answers) {
	return async ({ requestedSchema }) => {
		const fields = Object.keys(requestedSchema?.properties || {})
		const field = fields[0]
		if (!field) return { action: "decline" }
		const wanted = answers[field]
		const enumOpts = requestedSchema.properties[field].enum || []
		const choice =
			wanted !== undefined ? wanted : enumOpts.length > 0 ? enumOpts[0] : ""
		return { action: "accept", content: { [field]: choice } }
	}
}

function installGateReviewMock() {
	setGateReviewHandlers({
		prepare: async () => ({
			session_id: "dirty-tree-gate-session",
			review_url: "http://test.local/review/dirty-tree",
			use_remote: false,
			reused: false,
			browser_attached: false,
		}),
		await: async () => ({
			decision: "approved",
			feedback: "",
			annotations: {},
		}),
	})
}

async function callOrch(name, args) {
	const result = await handleOrchestratorTool(name, args)
	const responseText = result.content[0].text
	const jsonMatch = responseText.match(/\{[\s\S]*?\}\n\n---/)
	let json
	try {
		json = jsonMatch
			? JSON.parse(jsonMatch[0].replace(/\n\n---$/, ""))
			: JSON.parse(responseText)
	} catch {
		json = { _raw: responseText }
	}
	return { result, json, responseText }
}

function readIntentFm(intentDir) {
	const raw = readFileSync(join(intentDir, "intent.md"), "utf8")
	return parseFrontmatter(raw).data
}

console.log(
	"=== Real-git dirty-tree recovery (workflowStartStage pre-commit guard) ===",
)

await test("intent.md uncommitted at start_stage time is auto-committed before checkout", async () => {
	const { root, git, studio, cleanup } = makeRepoWithStudio()
	try {
		process.chdir(root)
		_resetIsGitRepoForTests()
		installGateReviewMock()
		setElicitInputHandler(userPicker({ studio, mode: "continuous" }))

		// Drive the elicitation chain to the point where the next
		// run_next would emit start_stage.
		const created = await callOrch("haiku_intent_create", {
			title: "Dirty tree real-git",
			description:
				"Plant Tara's exact dirty-tree pattern with a real git repo and prove the pre-stage commit guard catches it.",
			slug: "dirty-tree-real",
		})
		assert.strictEqual(created.json.action, "intent_created")
		const intentDirAbs = join(root, ".haiku", "intents", "dirty-tree-real")

		await callOrch("haiku_run_next", { intent: "dirty-tree-real" })
		await callOrch("haiku_select_studio", { intent: "dirty-tree-real" })
		await callOrch("haiku_run_next", { intent: "dirty-tree-real" })
		await callOrch("haiku_select_mode", { intent: "dirty-tree-real" })

		// Fast-forward past the intent_review gate.
		const intentFile = join(intentDirAbs, "intent.md")
		const fm = readIntentFm(intentDirAbs)
		assert.strictEqual(fm.studio, studio)
		assert.strictEqual(fm.mode, "continuous")
		const raw = readFileSync(intentFile, "utf8")
		writeFileSync(
			intentFile,
			raw.replace(/^---\n/, "---\nintent_reviewed: true\n"),
		)
		git("git add -A")
		git('git commit -m "set intent_reviewed for test"')

		// THE TARA PATTERN: dirty intent.md, uncommitted, then ask
		// run_next to advance into start_stage. Pre-fix, the
		// stage-branch checkout would refuse with "Your local changes
		// to intent.md would be overwritten." Post-fix, the
		// pre-stage commit guard in workflowStartStage commits the
		// dirty file before attempting the checkout.
		const raw2 = readFileSync(intentFile, "utf8")
		writeFileSync(intentFile, `${raw2}\n# DIRTY-TREE-CANARY\n`)
		// Verify the working tree is genuinely dirty BEFORE we
		// drive the workflow forward.
		const statusBefore = git("git status --porcelain")
		assert.ok(
			statusBefore.includes("intent.md"),
			`pre-condition: intent.md must be dirty in the working tree, got status:\n${statusBefore}`,
		)

		const tick = await callOrch("haiku_run_next", {
			intent: "dirty-tree-real",
		})
		assert.strictEqual(
			tick.json.action,
			"start_stage",
			`run_next must produce start_stage, got: ${JSON.stringify(tick.json)}`,
		)

		// Post-condition: the working tree must be clean of any
		// intent.md changes — the pre-stage commit guard should
		// have caught the dirty intent.md and committed it before
		// the stage-branch checkout. `.last_action.json` is an
		// intentionally-uncommitted engine sentinel (written by
		// every tick for the Stop hook) so we filter it out.
		const statusAfter = git("git status --porcelain")
			.split("\n")
			.filter((l) => l && !l.includes(".last_action.json"))
			.join("\n")
		assert.strictEqual(
			statusAfter,
			"",
			`post-condition: no uncommitted intent.md remnants after start_stage. Got:\n${statusAfter}`,
		)
		// And the stage state.json must exist with the normal
		// active+elaborate shape — proves workflowStartStage ran
		// past the guard, not that it bailed early on a still-dirty
		// tree.
		const stagePath = join(intentDirAbs, "stages", "plan", "state.json")
		assert.ok(
			existsSync(stagePath),
			`stage state.json must exist after start_stage: ${stagePath}`,
		)
		const ss = JSON.parse(readFileSync(stagePath, "utf8"))
		assert.strictEqual(ss.status, "active")
		assert.strictEqual(ss.phase, "elaborate")
		// And intent.md must now record active_stage — the missing
		// active_stage is what previously left the intent in the
		// stuck-state cascade.
		const fmAfter = readIntentFm(intentDirAbs)
		assert.strictEqual(fmAfter.active_stage, "plan")
	} finally {
		process.chdir(origCwd)
		_resetIsGitRepoForTests()
		setElicitInputHandler(null)
		setGateReviewHandlers({ prepare: null, await: null })
		cleanup()
	}
})

await test("the canary text from the dirty edit lands in git history (proof the pre-stage commit captured it)", async () => {
	const { root, git, studio, cleanup } = makeRepoWithStudio()
	try {
		process.chdir(root)
		_resetIsGitRepoForTests()
		installGateReviewMock()
		setElicitInputHandler(userPicker({ studio, mode: "continuous" }))

		await callOrch("haiku_intent_create", {
			title: "Dirty tree captured in commit",
			description:
				"Verify the dirty edit isn't dropped — it should land in a real commit on the intent main branch.",
			slug: "dirty-canary",
		})
		const intentDirAbs = join(root, ".haiku", "intents", "dirty-canary")

		await callOrch("haiku_run_next", { intent: "dirty-canary" })
		await callOrch("haiku_select_studio", { intent: "dirty-canary" })
		await callOrch("haiku_run_next", { intent: "dirty-canary" })
		await callOrch("haiku_select_mode", { intent: "dirty-canary" })

		const intentFile = join(intentDirAbs, "intent.md")
		const raw = readFileSync(intentFile, "utf8")
		writeFileSync(
			intentFile,
			raw.replace(/^---\n/, "---\nintent_reviewed: true\n"),
		)
		git("git add -A")
		git('git commit -m "set intent_reviewed for test"')

		const canary = "DIRTY-EDIT-CANARY-text-must-land-in-history"
		const raw2 = readFileSync(intentFile, "utf8")
		writeFileSync(intentFile, `${raw2}\n${canary}\n`)

		const tick = await callOrch("haiku_run_next", {
			intent: "dirty-canary",
		})
		assert.strictEqual(tick.json.action, "start_stage")

		// The canary text should now appear in a commit on the
		// intent main branch (or wherever the pre-stage commit
		// landed). If the dirty edit was silently dropped instead
		// of committed, we'd never find it in git log.
		const log = git(
			"git log --all --pretty=format:%H -p -S 'DIRTY-EDIT-CANARY-text-must-land-in-history'",
		)
		assert.ok(
			log.length > 0,
			"canary text must appear in git history — the dirty edit was either dropped or never committed",
		)
	} finally {
		process.chdir(origCwd)
		_resetIsGitRepoForTests()
		setElicitInputHandler(null)
		setGateReviewHandlers({ prepare: null, await: null })
		cleanup()
	}
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
