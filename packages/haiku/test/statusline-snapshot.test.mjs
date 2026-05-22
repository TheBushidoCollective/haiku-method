// statusline-snapshot.test.mjs — the persisted statusline POSITION.
//
// The engine writes the dispatched cursor action to a home-dir snapshot in
// broadcastTick; the status line reads it instead of re-deriving the cursor
// live (which jumps ahead of the agent the moment a tool changes disk
// state). Per-hat/unit bars stay live; only the POSITION is frozen until
// the next tick. Cold start (no snapshot) → live derive.

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

/** Run fn with cwd=repoRoot and HAIKU_PROJECTS_ROOT=an isolated tmp dir,
 *  restoring both after. Keeps snapshot writes out of the real
 *  ~/.haiku/projects (the same env the suite runner sandboxes with). */
async function withRepoHome(repoRoot, fn) {
	const orig = process.cwd()
	const origRoot = process.env.HAIKU_PROJECTS_ROOT
	const root = mkdtempSync(join(tmpdir(), "haiku-projroot-"))
	process.env.HAIKU_PROJECTS_ROOT = root
	process.chdir(repoRoot)
	try {
		return await fn()
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		if (origRoot === undefined) delete process.env.HAIKU_PROJECTS_ROOT
		else process.env.HAIKU_PROJECTS_ROOT = origRoot
		rmSync(root, { recursive: true, force: true })
	}
}

function seedRepo(slug, stage, intentFm = {}) {
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-snap-"))
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "snap",
			studio: "software",
			mode: "continuous",
			stages: [stage],
			...intentFm,
		}),
	)
	return repoRoot
}

test("snapshot round-trips the dispatched action; mismatched/absent → null", async () => {
	const repoRoot = seedRepo("snap-rt", "development")
	await withRepoHome(repoRoot, async () => {
		const { writeStatuslineSnapshot, readStatuslineSnapshot } = await import(
			`${SRC}statusline/snapshot.ts`
		)
		// absent → null
		assert.equal(readStatuslineSnapshot("snap-rt"), null)
		// write then read
		const action = { kind: "start_unit_hat", stage: "development", units: ["unit-01"] }
		writeStatuslineSnapshot("snap-rt", action)
		const got = readStatuslineSnapshot("snap-rt")
		assert.ok(got, "expected a snapshot")
		assert.equal(got.intent, "snap-rt")
		assert.deepEqual(got.action, action)
		// a different intent's read does not see this snapshot
		assert.equal(readStatuslineSnapshot("other-intent"), null)
	})
	rmSync(repoRoot, { recursive: true, force: true })
})

test("resolveStatuslineState renders the SNAPSHOT position, not a live re-derive", async () => {
	if (!HAS_GIT) return
	const slug = "snap-pos"
	const stage = "development"
	const repoRoot = seedRepo(slug, stage)
	await withRepoHome(repoRoot, async () => {
		const { writeStatuslineSnapshot } = await import(`${SRC}statusline/snapshot.ts`)
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)

		// Live derive on this bare intent (no elaboration sealed, no units)
		// would NOT be "execute". Pin a start_unit_hat snapshot and assert the
		// status line honors it — proving the snapshot wins over live derive.
		writeStatuslineSnapshot(slug, {
			kind: "start_unit_hat",
			stage,
			units: ["unit-01"],
		})
		const state = resolveStatuslineState()
		assert.ok(state, "expected a state")
		assert.equal(
			state.phaseKind,
			"execute",
			`snapshot's start_unit_hat must drive the phase; got ${state?.phaseKind}`,
		)
		assert.equal(state.activeStage, stage)
	})
	rmSync(repoRoot, { recursive: true, force: true })
})

test("resolveStatuslineState falls back to live derive when no snapshot (cold start)", async () => {
	if (!HAS_GIT) return
	const slug = "snap-cold"
	const stage = "development"
	const repoRoot = seedRepo(slug, stage)
	await withRepoHome(repoRoot, async () => {
		const { resolveStatuslineState } = await import(`${SRC}statusline/state.ts`)
		// No snapshot written → must still produce a state via live derive
		// (a bare intent resolves to an elaborate/setup phase, not null-crash).
		const state = resolveStatuslineState()
		assert.ok(state, "cold start must still derive a state")
		assert.equal(state.intent, slug)
	})
	rmSync(repoRoot, { recursive: true, force: true })
})

test("a real workflow tick persists the dispatched position (broadcastTick → snapshot)", async () => {
	if (!HAS_GIT) return
	const slug = "snap-tick"
	const stage = "security"
	const AT = "2026-05-20T00:00:00Z"
	// Reviews must be COMPLETE for the seeded wave to dispatch start_unit_hat
	// (execute). Autopilot keeps the studio review agents, so stamp every
	// review role the cursor walks for this stage — derive them so the
	// fixture can't drift from the studio config.
	const { stageRoleLists } = await import(
		`${SRC}orchestrator/workflow/cursor.ts`
	)
	const ER = Object.fromEntries(
		stageRoleLists("software", stage, "autopilot").reviewRoles.map((r) => [
			r,
			{ signed_at: AT, agent: "e" },
		]),
	)
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-snap-tick-"))
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "snap tick",
			studio: "software",
			mode: "autopilot",
			stages: [stage],
		}),
	)
	const kn = join(repoRoot, ".haiku", "knowledge")
	mkdirSync(kn, { recursive: true })
	writeFileSync(join(kn, "THREAT-MODEL.md"), "x\n")
	writeFileSync(join(kn, "VULN-REPORT.md"), "x\n")
	writeFileSync(
		join(stageDir, "elaboration.md"),
		matter.stringify("e\n", { verified_at: AT, decompose_verified_at: AT }),
	)
	// Seed the pre-execute BRIEF so the cursor walks past the brief step to
	// the seeded wave dispatch (reviews are pre-signed below).
	writeFileSync(join(stageDir, "BRIEF.md"), "# Brief\n")
	writeFileSync(
		join(stageDir, "units", "unit-01-a.md"),
		matter.stringify("a\n", {
			title: "unit-01-a",
			started_at: null,
			inputs: [],
			iterations: [],
			reviews: ER,
			approvals: {},
		}),
	)
	const git = (...a) => execFileSync("git", a, { cwd: repoRoot, stdio: "ignore" })
	git("init", "-q", "-b", "main")
	git("config", "user.email", "t@t")
	git("config", "user.name", "t")
	git("config", "commit.gpgsign", "false")
	git("add", "-A")
	git("commit", "-q", "-m", "seed")
	git("branch", `haiku/${slug}/main`)
	git("checkout", "-q", "-b", `haiku/${slug}/${stage}`)

	await withRepoHome(repoRoot, async () => {
		const { runWorkflowTick } = await import(`${SRC}orchestrator/workflow/run-tick.ts`)
		const { readStatuslineSnapshot } = await import(`${SRC}statusline/snapshot.ts`)
		// First tick migrates the v0 fixture (returns a `migrated` action, no
		// cursor position). The migration is idempotent, so the second tick
		// walks the cursor and dispatches the real position.
		runWorkflowTick(slug)
		const result = runWorkflowTick(slug)
		assert.ok(result, "tick should produce a result")
		assert.ok(result.position.action, "second tick should dispatch a cursor action")
		const snap = readStatuslineSnapshot(slug)
		assert.ok(snap, "the tick must persist a statusline snapshot")
		assert.equal(snap.intent, slug)
		// The snapshot carries exactly the cursor action the tick dispatched.
		assert.equal(snap.action?.kind, result.position.action.kind)
		assert.equal(
			snap.action?.kind,
			"start_unit_hat",
			`expected the seeded wave to dispatch start_unit_hat; got ${snap.action?.kind}`,
		)
	})
	rmSync(repoRoot, { recursive: true, force: true })
})
