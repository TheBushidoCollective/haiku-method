// unit-advance-pool-status.test.mjs
//
// Visibility contract for `haiku_unit_advance_hat` / `_reject_hat`:
// the return text must carry (a) a per-unit position line — what hat the
// calling unit moved to and where that sits in the sequence — and (b) a
// stage POOL snapshot (units done / in flight / pending, plus a per-hat
// in-flight tally). This is what the subagent relays to the parent so
// the user can see the wave instead of a bare "advanced to X". It is
// status reporting, NOT mechanics teaching — the relay breadcrumb still
// drives the workflow (`.claude/rules/no-agent-mechanics-teaching.md`).
//
// The pool line must name NO sibling unit IDs (only counts + hat tally),
// so it can't leak a unit name into a return that contractually must not
// relay one (see relay-no-cross-unit-suggest.test.mjs).

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

const AT = "2026-05-20T00:00:00Z"
const ENGINE_REVIEWS = {
	spec: { signed_at: AT, agent: "engine:spec" },
	continuity: { signed_at: AT, agent: "engine:continuity" },
	"cross-stage-consistency": { signed_at: AT, agent: "engine:cross-stage-consistency" },
}

function makeRepo() {
	const dir = mkdtempSync(join(tmpdir(), "haiku-pool-status-"))
	execFileSync("git", ["init", "-q", "-b", "main", dir], { stdio: "ignore" })
	execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir })
	execFileSync("git", ["config", "user.name", "t"], { cwd: dir })
	execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir })
	return dir
}

function seedIntent(repoRoot, slug, stage) {
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "Pool status test",
			studio: "software",
			mode: "autopilot",
			stages: [stage],
		}),
	)
	const repoKnowledge = join(repoRoot, ".haiku", "knowledge")
	mkdirSync(repoKnowledge, { recursive: true })
	writeFileSync(join(repoKnowledge, "THREAT-MODEL.md"), "threat model\n")
	writeFileSync(join(repoKnowledge, "VULN-REPORT.md"), "vuln report\n")
	writeFileSync(
		join(stageDir, "elaboration.md"),
		matter.stringify("elaboration\n", {
			verified_at: AT,
			decompose_verified_at: AT,
		}),
	)
	return { intentDir, stageDir }
}

function commitAndBranch(repoRoot, slug, stage) {
	execFileSync("git", ["add", "-A"], { cwd: repoRoot, stdio: "ignore" })
	execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot, stdio: "ignore" })
	execFileSync("git", ["branch", `haiku/${slug}/main`], { cwd: repoRoot, stdio: "ignore" })
	execFileSync("git", ["checkout", "-q", "-b", `haiku/${slug}/${stage}`], {
		cwd: repoRoot,
		stdio: "ignore",
	})
}

async function withCwd(repoRoot, fn) {
	const orig = process.cwd()
	process.chdir(repoRoot)
	try {
		return await fn()
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
	}
}

test("advance_hat return carries a per-unit position line + stage pool snapshot", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo()
	try {
		const slug = "pool-1"
		const stage = "security"
		const { stageDir } = seedIntent(repoRoot, slug, stage)
		const stageFm = matter(
			readFileSync(
				join(REPO_ROOT, "plugin", "studios", "software", "stages", stage, "STAGE.md"),
				"utf8",
			),
		).data
		const hats = Array.isArray(stageFm.hats) ? stageFm.hats : []
		if (hats.length < 2) {
			console.log(`[pool-status] software/${stage} has <2 hats, skipping`)
			return
		}

		// unit-01-done: every hat advanced → completed.
		const doneIters = hats.map((h) => ({
			hat: h,
			started_at: AT,
			completed_at: AT,
			result: "advance",
		}))
		writeFileSync(
			join(stageDir, "units", "unit-01-done.md"),
			matter.stringify("done\n", {
				title: "unit-01-done",
				started_at: AT,
				inputs: [],
				iterations: doneIters,
				reviews: ENGINE_REVIEWS,
				approvals: {},
			}),
		)
		// unit-02-call: in-flight on hats[0], about to advance to hats[1].
		writeFileSync(
			join(stageDir, "units", "unit-02-call.md"),
			matter.stringify("call\n", {
				title: "unit-02-call",
				started_at: AT,
				inputs: [],
				iterations: [
					{ hat: hats[0], started_at: AT, completed_at: null, result: null },
				],
				reviews: ENGINE_REVIEWS,
				approvals: {},
			}),
		)
		// unit-03-pend: never started → pending.
		writeFileSync(
			join(stageDir, "units", "unit-03-pend.md"),
			matter.stringify("pend\n", {
				title: "unit-03-pend",
				started_at: null,
				inputs: [],
				iterations: [],
				reviews: ENGINE_REVIEWS,
				approvals: {},
			}),
		)
		commitAndBranch(repoRoot, slug, stage)

		const handleStateTool = (await import(`${SRC}state-tools.ts`)).handleStateTool
		const resp = await withCwd(repoRoot, () =>
			handleStateTool("haiku_unit_advance_hat", {
				intent: slug,
				stage,
				unit: "unit-02-call",
			}),
		)
		const text = resp?.content?.[0]?.text ?? ""

		// Per-unit position line: names the calling unit, the hat transition,
		// and the (N/M) position of the new hat in the sequence.
		assert.ok(
			text.includes(`advanced to ${hats[1]}`),
			`expected the advance confirmation; got: ${text.slice(0, 500)}`,
		)
		assert.ok(
			/unit-02-call:.*→.*\(hat 2\/\d+\)/.test(text),
			`expected a per-unit position line with hat N/M; got: ${text.slice(0, 500)}`,
		)
		// Pool snapshot: counts that reflect the real pool. After the advance,
		// unit-01 is done, unit-02 is in flight (on hats[1]), unit-03 pending.
		assert.ok(
			/pool · stage `security`:/.test(text),
			`expected a pool snapshot line; got: ${text.slice(0, 500)}`,
		)
		assert.ok(
			/1\/3 units done/.test(text),
			`pool must report 1/3 done; got: ${text.slice(0, 500)}`,
		)
		assert.ok(
			/1 in flight/.test(text) && /1 pending/.test(text),
			`pool must report 1 in flight · 1 pending; got: ${text.slice(0, 500)}`,
		)
		// Per-hat in-flight tally names the hat the live unit sits on.
		assert.ok(
			new RegExp(`in flight by hat:.*${hats[1]}×1`).test(text),
			`expected per-hat in-flight tally naming ${hats[1]}; got: ${text.slice(0, 500)}`,
		)
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
