// unit-pool-refill.test.mjs
//
// The unit hat-loop pools the same way the fix-loop does. On a TERMINAL
// advance (a subagent exhausts its unit's hats) the engine refills every
// freed slot in one response — `pickUndispatchedUnitBlocks` picks up to
// `MAX_CONCURRENT_SUBAGENTS − inFlight` COMPLETELY UNSTARTED, deps-ready
// units, claims each (started_at + open leased iteration on the stage
// branch), and relays their first-hat <subagent> blocks. `run_next` only
// fires between waves; `advance_hat` owns within-wave replenishment.
//
// This is the unit analog of `pickUndispatchedFbBlock` — see
// `feedback-wave-dispatch.test.mjs`. The double-pickup the old "defer to
// run_next" model guarded against (admin-portal-reimagine #5) is closed
// by construction: a subagent only self-relays its OWN chain or picks
// UNSTARTED units; the claim removes a unit from the unstarted set under
// `withIntentDispatchLock`, so two concurrent terminal advances can't grab
// the same one. See `.claude/rules/no-agent-mechanics-teaching.md`.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
const REPO_ROOT = resolve(HERE, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

const AT = "2026-05-25T00:00:00Z"
const ENGINE_REVIEWS = {
	spec: { signed_at: AT, agent: "engine:spec" },
	continuity: { signed_at: AT, agent: "engine:continuity" },
	"cross-stage-consistency": {
		signed_at: AT,
		agent: "engine:cross-stage-consistency",
	},
}

/** Stand up a single-stage software intent on its stage branch with a
 *  project-local studio override whose `build` stage has one hat
 *  (`builder`), so a unit's first hat IS its terminal hat. Returns
 *  { repo, slug, stage, intentDir, stageDir }. */
function seedRepo(label) {
	const slug = `pool-${label}-${Math.random().toString(36).slice(2, 8)}`
	const stage = "build"
	const repo = mkdtempSync(join(tmpdir(), `haiku-pool-${label}-`))
	git(repo, "init", "-q", "-b", "main")
	git(repo, "config", "user.email", "t@t")
	git(repo, "config", "user.name", "t")
	git(repo, "config", "commit.gpgsign", "false")

	// Project-local studio override: software / build, hats=[builder].
	const studioDir = join(repo, ".haiku", "studios", "software")
	const sStageDir = join(studioDir, "stages", stage)
	mkdirSync(join(sStageDir, "hats"), { recursive: true })
	writeFileSync(
		join(studioDir, "STUDIO.md"),
		matter.stringify("Test software studio.\n", {
			name: "software",
			description: "Test software studio",
			stages: [stage],
		}),
	)
	writeFileSync(
		join(sStageDir, "STAGE.md"),
		matter.stringify("Test build stage.\n", {
			name: stage,
			description: "Test build stage",
			hats: ["builder"],
			review: "auto",
			inputs: [],
		}),
	)
	writeFileSync(
		join(sStageDir, "hats", "builder.md"),
		matter.stringify("builder mandate.\n", { name: "builder" }),
	)

	const intentDir = join(repo, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "pool test",
			studio: "software",
			mode: "continuous",
			stages: [stage],
			approvals: {},
		}),
	)
	writeFileSync(
		join(stageDir, "elaboration.md"),
		matter.stringify("e\n", {
			verified_at: AT,
			decompose_verified_at: AT,
		}),
	)
	return { repo, slug, stage, intentDir, stageDir }
}

/** A unit at its terminal hat, in flight (about to advance → complete).
 *  Declares + writes an in-scope stage artifact so the completing advance
 *  clears the `unit_outputs_empty` gate. */
function writeTerminalUnit(stageDir, name) {
	const artifactRel = `stages/build/artifacts/out-${name}.md`
	mkdirSync(join(stageDir, "artifacts"), { recursive: true })
	writeFileSync(
		join(stageDir, "artifacts", `out-${name}.md`),
		`# ${name} output\n`,
	)
	writeFileSync(
		join(stageDir, "units", `${name}.md`),
		matter.stringify(`# ${name}\n`, {
			title: name,
			depends_on: [],
			inputs: [],
			outputs: [artifactRel],
			started_at: AT,
			iterations: [
				{ hat: "builder", started_at: AT, completed_at: null, result: null },
			],
			reviews: ENGINE_REVIEWS,
			approvals: {},
		}),
	)
}

/** A completely unstarted unit (started_at null, zero iterations). */
function writeUnstartedUnit(stageDir, name, opts = {}) {
	writeFileSync(
		join(stageDir, "units", `${name}.md`),
		matter.stringify(`# ${name}\n`, {
			title: name,
			depends_on: opts.dependsOn ?? [],
			inputs: opts.inputs ?? [],
			outputs: [],
			started_at: null,
			iterations: [],
			reviews: ENGINE_REVIEWS,
			approvals: {},
		}),
	)
}

/** A completed unit (terminal advance on the last hat). */
function writeCompleteUnit(stageDir, name) {
	writeFileSync(
		join(stageDir, "units", `${name}.md`),
		matter.stringify(`# ${name}\n`, {
			title: name,
			depends_on: [],
			inputs: [],
			outputs: [],
			started_at: AT,
			iterations: [
				{ hat: "builder", started_at: AT, completed_at: AT, result: "advance" },
			],
			reviews: ENGINE_REVIEWS,
			approvals: {},
		}),
	)
}

function commitOnStageBranch({ repo, slug, stage }) {
	git(repo, "add", "-A")
	git(repo, "commit", "-q", "-m", "seed")
	git(repo, "branch", `haiku/${slug}/main`)
	git(repo, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)
}

function withCwd(repo, fn) {
	const orig = process.cwd()
	process.chdir(repo)
	try {
		return fn()
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
	}
}

// These tests seed throwaway git repos and drive the engine, which resolves
// .haiku paths from the global process.cwd(). node's test runner interleaves
// async test bodies, so two bodies' seed→advance windows overlap and corrupt
// each other's repos. Serialize every body end-to-end through one promise
// chain — equivalent to running them one at a time, which is provably clean.
let _serialChain = Promise.resolve()
function serialTest(name, body) {
	test(name, async () => {
		const run = _serialChain.then(body)
		_serialChain = run.then(
			() => undefined,
			() => undefined,
		)
		return run
	})
}

function unitFm(stageDir, name) {
	return matter(readFileSync(join(stageDir, "units", `${name}.md`), "utf8"))
		.data
}

// ── Picker-level: multi-fill, cap, DAG, inputs ──────────────────────

serialTest(
	"picker: fills all freed slots with deps-ready unstarted units",
	async () => {
		if (!HAS_GIT) return
		const env = seedRepo("multifill")
		try {
			writeCompleteUnit(env.stageDir, "unit-01-done")
			writeUnstartedUnit(env.stageDir, "unit-02-a")
			writeUnstartedUnit(env.stageDir, "unit-03-b")
			commitOnStageBranch(env)
			const { pickUndispatchedUnitBlocks } = await import(
				`${SRC}/state-tools.ts`
			)
			const blocks = await withCwd(env.repo, () =>
				pickUndispatchedUnitBlocks(env.slug, "software", 10),
			)
			assert.equal(
				blocks.length,
				2,
				`expected 2 refill blocks; got ${blocks.length}`,
			)
			const joined = blocks.join("\n")
			assert.ok(/unit-02-a/.test(joined), "block names unit-02-a")
			assert.ok(/unit-03-b/.test(joined), "block names unit-03-b")
			// Both picked units are now CLAIMED: started_at set + one open
			// leased iteration on the first hat.
			for (const name of ["unit-02-a", "unit-03-b"]) {
				const fm = unitFm(env.stageDir, name)
				assert.ok(fm.started_at, `${name} should be claimed (started_at set)`)
				const iters = fm.iterations
				assert.equal(iters.length, 1, `${name} has one open iteration`)
				assert.equal(iters[0].hat, "builder")
				assert.equal(iters[0].result, null, `${name} iteration is open`)
				assert.ok(iters[0].dispatched_at, `${name} iteration is leased`)
			}
		} finally {
			rmSync(env.repo, { recursive: true, force: true })
		}
	},
)

serialTest(
	"picker: respects maxFill (never exceeds the freed-slot budget)",
	async () => {
		if (!HAS_GIT) return
		const env = seedRepo("cap")
		try {
			writeCompleteUnit(env.stageDir, "unit-01-done")
			writeUnstartedUnit(env.stageDir, "unit-02-a")
			writeUnstartedUnit(env.stageDir, "unit-03-b")
			commitOnStageBranch(env)
			const { pickUndispatchedUnitBlocks } = await import(
				`${SRC}/state-tools.ts`
			)
			const blocks = await withCwd(env.repo, () =>
				pickUndispatchedUnitBlocks(env.slug, "software", 1),
			)
			assert.equal(blocks.length, 1, `maxFill=1 must yield exactly 1 block`)
			// Only the first (sort order) is claimed; the second stays unstarted.
			assert.ok(
				unitFm(env.stageDir, "unit-02-a").started_at,
				"first is claimed",
			)
			assert.equal(
				unitFm(env.stageDir, "unit-03-b").started_at,
				null,
				"second stays unstarted (slot budget exhausted)",
			)
		} finally {
			rmSync(env.repo, { recursive: true, force: true })
		}
	},
)

serialTest(
	"picker: DAG gate — only picks units whose depends_on are complete",
	async () => {
		if (!HAS_GIT) return
		const env = seedRepo("dag")
		try {
			writeCompleteUnit(env.stageDir, "unit-01-done")
			// Ready: depends only on the completed unit.
			writeUnstartedUnit(env.stageDir, "unit-02-ready", {
				dependsOn: ["unit-01-done"],
			})
			// Blocked: depends on a unit that never completed.
			writeUnstartedUnit(env.stageDir, "unit-03-blocked", {
				dependsOn: ["unit-99-never"],
			})
			commitOnStageBranch(env)
			const { pickUndispatchedUnitBlocks } = await import(
				`${SRC}/state-tools.ts`
			)
			const blocks = await withCwd(env.repo, () =>
				pickUndispatchedUnitBlocks(env.slug, "software", 10),
			)
			assert.equal(blocks.length, 1, "only the deps-ready unit is picked")
			assert.ok(/unit-02-ready/.test(blocks[0]), "picked the ready unit")
			assert.equal(
				unitFm(env.stageDir, "unit-03-blocked").started_at,
				null,
				"blocked unit is NOT claimed",
			)
		} finally {
			rmSync(env.repo, { recursive: true, force: true })
		}
	},
)

serialTest(
	"picker: inputs gate — skips a unit whose declared input does not exist",
	async () => {
		if (!HAS_GIT) return
		const env = seedRepo("inputs")
		try {
			writeCompleteUnit(env.stageDir, "unit-01-done")
			writeUnstartedUnit(env.stageDir, "unit-02-missing", {
				inputs: [".haiku/intents/does-not-exist.md"],
			})
			commitOnStageBranch(env)
			const { pickUndispatchedUnitBlocks } = await import(
				`${SRC}/state-tools.ts`
			)
			const blocks = await withCwd(env.repo, () =>
				pickUndispatchedUnitBlocks(env.slug, "software", 10),
			)
			assert.equal(blocks.length, 0, "a unit with a missing input is skipped")
			assert.equal(
				unitFm(env.stageDir, "unit-02-missing").started_at,
				null,
				"skipped unit is NOT claimed",
			)
		} finally {
			rmSync(env.repo, { recursive: true, force: true })
		}
	},
)

// ── End-to-end through haiku_unit_advance_hat ───────────────────────

serialTest(
	"advance_hat terminal: relays refill blocks for unstarted siblings",
	async () => {
		if (!HAS_GIT) return
		const env = seedRepo("e2e")
		try {
			writeTerminalUnit(env.stageDir, "unit-01-a")
			writeUnstartedUnit(env.stageDir, "unit-02-b")
			writeUnstartedUnit(env.stageDir, "unit-03-c")
			commitOnStageBranch(env)
			const { handleStateTool } = await import(`${SRC}/state-tools.ts`)
			const resp = await withCwd(env.repo, () =>
				handleStateTool("haiku_unit_advance_hat", {
					message: `built-${env.slug}`,
					intent: env.slug,
					stage: env.stage,
					unit: "unit-01-a",
				}),
			)
			const txt = resp?.content?.[0]?.text ?? ""
			assert.ok(
				!resp?.isError,
				`advance should succeed; got: ${txt.slice(0, 400)}`,
			)
			// Refill blocks for the two unstarted siblings are relayed inline.
			assert.ok(
				/<subagent\b/.test(txt),
				`expected refill <subagent> blocks; got: ${txt.slice(0, 600)}`,
			)
			assert.ok(/unit-02-b/.test(txt), "relays unit-02-b")
			assert.ok(/unit-03-c/.test(txt), "relays unit-03-c")
			// Within-wave refill is NOT a run_next — that's between-waves only.
			assert.ok(
				!/haiku_run_next/.test(txt),
				`terminal advance that refilled slots must NOT route to run_next; got: ${txt.slice(0, 400)}`,
			)
			// Both siblings are claimed on disk.
			assert.ok(
				unitFm(env.stageDir, "unit-02-b").started_at,
				"unit-02-b claimed",
			)
			assert.ok(
				unitFm(env.stageDir, "unit-03-c").started_at,
				"unit-03-c claimed",
			)
		} finally {
			rmSync(env.repo, { recursive: true, force: true })
		}
	},
)

// The terminal-advance branch chooses between three outcomes off two
// signals: `pickUndispatchedUnitBlocks` (refill) and `countInFlightUnits`
// (the in-flight sibling count). The refill→relay wiring is proven by the
// e2e test above; these two assert the OTHER two outcomes' decision inputs
// directly, without a second terminal merge (the test harness can't run two
// successful unit merges against different throwaway repos in one process —
// the engine's cwd/worktree state is built for one repo per process).

serialTest(
	"decision: in-flight sibling + nothing unstarted → terminate (no refill, inFlight>0)",
	async () => {
		if (!HAS_GIT) return
		const env = seedRepo("siblings")
		try {
			writeCompleteUnit(env.stageDir, "unit-01-a")
			// A running sibling: started, open leased iteration.
			writeFileSync(
				join(env.stageDir, "units", "unit-02-b.md"),
				matter.stringify("# unit-02-b\n", {
					title: "unit-02-b",
					depends_on: [],
					inputs: [],
					outputs: [],
					started_at: AT,
					iterations: [
						{
							hat: "builder",
							started_at: AT,
							completed_at: null,
							result: null,
							dispatched_at: AT,
						},
					],
					reviews: ENGINE_REVIEWS,
					approvals: {},
				}),
			)
			commitOnStageBranch(env)
			const { pickUndispatchedUnitBlocks, countInFlightUnits } = await import(
				`${SRC}/state-tools.ts`
			)
			const { blocks, inFlight } = await withCwd(env.repo, () => ({
				blocks: pickUndispatchedUnitBlocks(env.slug, "software", 10),
				inFlight: countInFlightUnits(env.slug, env.stage, "unit-01-a"),
			}))
			// No unstarted units → nothing to refill; a sibling is still running
			// → the wave is NOT done. The handler maps (blocks empty, inFlight>0)
			// to "terminate; do NOT call run_next."
			assert.equal(blocks.length, 0, "no refill (nothing unstarted)")
			assert.equal(inFlight, 1, "the running sibling is counted in flight")
		} finally {
			rmSync(env.repo, { recursive: true, force: true })
		}
	},
)

serialTest(
	"decision: last unit done, nothing left → run_next (no refill, inFlight==0)",
	async () => {
		if (!HAS_GIT) return
		const env = seedRepo("drain")
		try {
			writeCompleteUnit(env.stageDir, "unit-01-a")
			commitOnStageBranch(env)
			const { pickUndispatchedUnitBlocks, countInFlightUnits } = await import(
				`${SRC}/state-tools.ts`
			)
			const { blocks, inFlight } = await withCwd(env.repo, () => ({
				blocks: pickUndispatchedUnitBlocks(env.slug, "software", 10),
				inFlight: countInFlightUnits(env.slug, env.stage, "unit-01-a"),
			}))
			// Nothing unstarted, nothing in flight → the wave is fully drained.
			// The handler maps (blocks empty, inFlight==0) to "call run_next" —
			// the only place run_next fires, between waves.
			assert.equal(blocks.length, 0, "no refill (nothing unstarted)")
			assert.equal(inFlight, 0, "no in-flight siblings — pool drained")
		} finally {
			rmSync(env.repo, { recursive: true, force: true })
		}
	},
)
