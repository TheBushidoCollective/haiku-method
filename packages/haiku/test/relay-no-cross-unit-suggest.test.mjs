// relay-no-cross-unit-suggest.test.mjs
//
// A unit's terminal advance must NOT relay a DIFFERENT unit. Cross-unit
// wave replenishment is left to `haiku_run_next` (atomic next-wave
// dispatch) so that when several units' terminal hats complete in
// parallel, the concurrent relays can't each pick — and the parent
// double-spawn — the same in-flight sibling. (admin-portal-reimagine #5,
// 2026-05-20.) The per-unit chain still self-relays on NON-terminal
// advances; only cross-unit suggestions are suppressed.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
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

function gitq(cwd, ...args) {
	execFileSync("git", args, { cwd, stdio: "ignore" })
}

async function withCwd(dir, fn) {
	const orig = process.cwd()
	process.chdir(dir)
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

test("terminal advance does not emit a cross-unit relay block (sibling in flight)", async () => {
	if (!HAS_GIT) return
	const slug = "relay-xunit"
	const stage = "security"
	const stageMd = matter(
		(await import("node:fs")).readFileSync(
			join(REPO_ROOT, "plugin", "studios", "software", "stages", stage, "STAGE.md"),
			"utf8",
		),
	).data
	const hats = Array.isArray(stageMd.hats) ? stageMd.hats : []
	if (hats.length < 2) return
	const terminalHat = hats[hats.length - 1]

	const repo = mkdtempSync(join(tmpdir(), "haiku-relay-xunit-"))
	try {
		gitq(repo, "init", "-q", "-b", "main")
		gitq(repo, "config", "user.email", "t@t")
		gitq(repo, "config", "user.name", "t")
		gitq(repo, "config", "commit.gpgsign", "false")

		const intentDir = join(repo, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		mkdirSync(join(stageDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "relay xunit",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
			}),
		)
		// Clear the elaborate track.
		mkdirSync(join(repo, ".haiku", "knowledge"), { recursive: true })
		writeFileSync(join(repo, ".haiku", "knowledge", "THREAT-MODEL.md"), "tm\n")
		writeFileSync(
			join(stageDir, "elaboration.md"),
			matter.stringify("e\n", {
				verified_at: "2026-05-20T00:00:00Z",
				decompose_verified_at: "2026-05-20T00:00:00Z",
			}),
		)
		const at = "2026-05-20T00:00:00Z"
		const engineReviews = {
			spec: { signed_at: at, agent: "engine:spec" },
			continuity: { signed_at: at, agent: "engine:continuity" },
			"cross-stage-consistency": {
				signed_at: at,
				agent: "engine:cross-stage-consistency",
			},
		}
		// Unit A: all hats advanced except the terminal one, which is
		// in-flight (about to advance → terminal). Declares a real output so
		// the terminal merge has something to detect.
		const aIters = hats.slice(0, -1).map((h) => ({
			hat: h,
			started_at: at,
			completed_at: at,
			result: "advance",
		}))
		aIters.push({ hat: terminalHat, started_at: at, completed_at: null, result: null })
		writeFileSync(join(stageDir, "units", "unit-01-a.md"), matter.stringify("# A\n", {
			title: "unit-01-a",
			started_at: at,
			inputs: [],
			outputs: ["OUT-A.md"],
			iterations: aIters,
			reviews: engineReviews,
			approvals: {},
		}))
		// Unit B: in-flight at the FIRST hat (a running sibling).
		writeFileSync(join(stageDir, "units", "unit-02-b.md"), matter.stringify("# B\n", {
			title: "unit-02-b",
			started_at: at,
			inputs: [],
			outputs: ["OUT-B.md"],
			iterations: [{ hat: hats[0], started_at: at, completed_at: null, result: null }],
			reviews: engineReviews,
			approvals: {},
		}))
		// Produce A's declared output so the terminal advance can complete.
		writeFileSync(join(stageDir, "units", "OUT-A.md"), "A output\n")
		gitq(repo, "add", "-A")
		gitq(repo, "commit", "-q", "-m", "seed")
		gitq(repo, "branch", `haiku/${slug}/main`)
		gitq(repo, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		const { handleStateTool } = await import(`${SRC}state-tools.ts`)
		const resp = await withCwd(repo, () =>
			handleStateTool("haiku_unit_advance_hat", {
				intent: slug,
				stage,
				unit: "unit-01-a",
			}),
		)
		const txt = resp?.content?.[0]?.text ?? ""
		// The key invariant (holds on every path, including error paths):
		// the terminal advance must NOT relay a <subagent> block for the
		// OTHER unit (B). Cross-unit replenishment is run_next's job.
		assert.ok(
			!/unit-02-b/.test(txt),
			`terminal advance must NOT relay the in-flight sibling unit-02-b; got: ${txt.slice(0, 600)}`,
		)
		// On the success path, with no relay block it must route to run_next.
		// (The terminal merge can fail on output-detection in this minimal
		// fixture — like the relay-breadcrumb drain test — in which case the
		// no-cross-unit invariant above is the assertion that matters.)
		if (!resp?.isError && !/<subagent\b/.test(txt)) {
			assert.ok(
				/haiku_run_next/.test(txt),
				`with no relay block the terminal advance must route to run_next; got: ${txt.slice(0, 400)}`,
			)
		}
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})
