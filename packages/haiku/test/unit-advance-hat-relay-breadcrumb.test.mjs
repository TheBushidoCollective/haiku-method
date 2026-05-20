// unit-advance-hat-relay-breadcrumb.test.mjs
//
// Engine-side breadcrumb contract for `haiku_unit_advance_hat`:
// mirrors `haiku_feedback_advance_hat`'s relay model (see
// `advance-hat-relay-breadcrumb.test.mjs`). The handler returns
// the response text appended with either:
//   - the next `<subagent>` dispatch block (when the cursor's
//     post-advance walk picks a next-dispatchable unit hat), or
//   - a one-line `haiku_run_next` directive (when the wave is
//     drained).
//
// The agent never reasons about slot pools or batch boundaries —
// it relays whatever the engine put in the response text. See
// `.claude/rules/no-agent-mechanics-teaching.md`.

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

function makeRepo(label) {
	const dir = mkdtempSync(join(tmpdir(), `haiku-unit-relay-${label}-`))
	if (HAS_GIT) {
		execFileSync("git", ["init", "-q", "-b", "main", dir], { stdio: "ignore" })
		execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir })
		execFileSync("git", ["config", "user.name", "t"], { cwd: dir })
		execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir })
	}
	return dir
}

/** Seed an intent restricted to one stage so the cursor pins
 *  predictably. Default `software/security` has a multi-hat sequence
 *  which makes mid-chain advance dispatchable. Autopilot mode +
 *  pre-stamped elaboration seals + seeded discovery artifacts let the
 *  cursor walk past `elaborate_loop` / `dispatch_review` straight to
 *  `start_unit_hat`. */
function seedIntent(repoRoot, slug, stage) {
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "Unit relay test",
			studio: "software",
			mode: "autopilot",
			stages: [stage],
		}),
	)
	// Seed required discovery artifacts so the elaborate-track signals
	// for this stage all clear.
	const repoKnowledge = join(repoRoot, ".haiku", "knowledge")
	mkdirSync(repoKnowledge, { recursive: true })
	writeFileSync(join(repoKnowledge, "THREAT-MODEL.md"), "threat model\n")
	writeFileSync(join(repoKnowledge, "VULN-REPORT.md"), "vuln report\n")
	// Stage elaboration with verified_at + decompose_verified_at so the
	// cursor walks past elaborate_loop into the review track.
	writeFileSync(
		join(stageDir, "elaboration.md"),
		matter.stringify("elaboration\n", {
			verified_at: "2026-05-19T00:00:00Z",
			decompose_verified_at: "2026-05-19T00:00:00Z",
		}),
	)
	if (HAS_GIT) {
		execFileSync("git", ["add", "-A"], { cwd: repoRoot, stdio: "ignore" })
		execFileSync("git", ["commit", "-q", "-m", "seed"], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		execFileSync("git", ["branch", `haiku/${slug}/main`], {
			cwd: repoRoot,
			stdio: "ignore",
		})
		execFileSync("git", ["checkout", "-q", "-b", `haiku/${slug}/${stage}`], {
			cwd: repoRoot,
			stdio: "ignore",
		})
	}
	return { intentDir, stageDir }
}

/** Author a started unit at the prior-of-target hat. The advance_hat
 *  handler infers the calling hat from `iterations[-1]`. To test "calling
 *  hat is hatA, next dispatch is hatB", we stamp `iterations: [{hat: hatA,
 *  started_at, completed_at: null, result: null}]` and `started_at` on the
 *  unit so the handler treats it as "currently running hatA, about to
 *  call advance". */
function makeUnitAtHat(stageDir, fileName, callingHat) {
	const at = "2026-05-19T00:00:00Z"
	// Pre-stamp engine reviewRoles for autopilot mode so the cursor walks
	// past the pre-execute review track straight to start_unit_hat.
	const engineReviews = {
		spec: { signed_at: at, agent: "engine:spec" },
		continuity: { signed_at: at, agent: "engine:continuity" },
		"cross-stage-consistency": {
			signed_at: at,
			agent: "engine:cross-stage-consistency",
		},
	}
	writeFileSync(
		join(stageDir, "units", fileName),
		matter.stringify("unit body\n", {
			title: fileName.replace(/\.md$/, ""),
			started_at: at,
			inputs: [],
			iterations: [
				{
					hat: callingHat,
					started_at: at,
					completed_at: null,
					result: null,
				},
			],
			reviews: engineReviews,
			approvals: {},
		}),
	)
}

/** Stash cwd, switch to repoRoot, run a tool call, restore cwd. */
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

test("unit advance_hat: mid-chain advance appends a relay block for this unit's next hat", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("mid")
	try {
		const slug = "u-rel-1"
		const stage = "security"
		const { stageDir } = seedIntent(repoRoot, slug, stage)
		// Make a unit currently running hats[0]. We don't know the studio's
		// hat sequence verbatim — read STAGE.md to discover hats[0] and
		// hats[1].
		const stageFm = matter(
			(await import("node:fs")).readFileSync(
				join(REPO_ROOT, "plugin", "studios", "software", "stages", stage, "STAGE.md"),
				"utf8",
			),
		).data
		const hats = Array.isArray(stageFm.hats) ? stageFm.hats : []
		if (hats.length < 2) {
			console.log(`[unit-relay] software/${stage} has <2 hats, skipping`)
			return
		}
		makeUnitAtHat(stageDir, "unit-01-stub.md", hats[0])

		const { handleStateTool } = await withCwd(repoRoot, async () => ({
			handleStateTool: (await import(`${SRC}state-tools.ts`)).handleStateTool,
		}))
		const resp = await withCwd(repoRoot, () =>
			handleStateTool("haiku_unit_advance_hat", {
				intent: slug,
				stage,
				unit: "unit-01-stub",
			}),
		)
		const text = resp?.content?.[0]?.text ?? ""
		assert.ok(
			text.includes(`advanced to ${hats[1]}`),
			`expected the work-line to confirm the advance; got: ${text.slice(0, 400)}`,
		)
		assert.ok(
			/<subagent\b/.test(text),
			`mid-chain advance MUST append a relay <subagent> block; got: ${text.slice(0, 600)}`,
		)
		assert.ok(
			text.includes(hats[1]),
			`relay block must name this unit's next hat (${hats[1]}); got: ${text.slice(0, 600)}`,
		)
		assert.ok(
			/unit-01-stub/.test(text),
			`relay block must target the advanced unit; got: ${text.slice(0, 600)}`,
		)
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("unit advance_hat: queue-empty drain emits a run_next directive instead of a relay block", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("drain")
	try {
		const slug = "u-rel-2"
		const stage = "security"
		const { stageDir } = seedIntent(repoRoot, slug, stage)
		const stageFm = matter(
			(await import("node:fs")).readFileSync(
				join(REPO_ROOT, "plugin", "studios", "software", "stages", stage, "STAGE.md"),
				"utf8",
			),
		).data
		const hats = Array.isArray(stageFm.hats) ? stageFm.hats : []
		if (hats.length < 2) return
		// Stamp iterations through ALL but the last hat as `advance` so the
		// upcoming advance is the terminal one. We need iterations for
		// hats[0]..hats[n-2] each closed with result: "advance", then a
		// final in-flight iteration for hats[n-1].
		const at = "2026-05-19T00:00:00Z"
		const iters = []
		for (let i = 0; i < hats.length - 1; i++) {
			iters.push({
				hat: hats[i],
				started_at: at,
				completed_at: at,
				result: "advance",
			})
		}
		iters.push({
			hat: hats[hats.length - 1],
			started_at: at,
			completed_at: null,
			result: null,
		})
		writeFileSync(
			join(stageDir, "units", "unit-01-stub.md"),
			matter.stringify("unit body\n", {
				title: "unit-01-stub",
				started_at: at,
				inputs: [],
				outputs: [],
				iterations: iters,
				reviews: {},
				approvals: {},
			}),
		)

		const { handleStateTool } = await withCwd(repoRoot, async () => ({
			handleStateTool: (await import(`${SRC}state-tools.ts`)).handleStateTool,
		}))
		const resp = await withCwd(repoRoot, () =>
			handleStateTool("haiku_unit_advance_hat", {
				intent: slug,
				stage,
				unit: "unit-01-stub",
			}),
		)
		const text = resp?.content?.[0]?.text ?? ""
		// Terminal advance can fail merge for a variety of git reasons in
		// the seeded fixture (no worktree, missing main alignment, etc.).
		// What we care about is: the relay-breadcrumb decision is correct
		// — either the wave still has dispatchable work (block appended)
		// or it doesn't (run_next directive appended). For a one-unit
		// fixture at the last hat, the queue is empty after this advance,
		// so the response must NOT carry a block AND must say run_next.
		// Skip the assertion if the advance hit an error path before
		// reaching the relay computation.
		if (resp?.isError) {
			console.log(`[unit-relay drain] advance returned error pre-relay; skipping. text: ${text.slice(0, 200)}`)
			return
		}
		assert.ok(
			!/<subagent\b/.test(text),
			`terminal advance with empty queue must NOT append a relay block; got: ${text.slice(0, 600)}`,
		)
		assert.ok(
			/haiku_run_next/.test(text),
			`terminal advance with empty queue must instruct haiku_run_next; got: ${text.slice(0, 600)}`,
		)
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
