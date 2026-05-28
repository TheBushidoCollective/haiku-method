#!/usr/bin/env npx tsx
// unit-wave-lease.test.mjs — the per-unit dispatch LEASE (report item C,
// 2026-05-24): a mid-wave `haiku_run_next` must NOT re-dispatch units whose
// hats are already dispatched-and-running.
//
// The bug: a unit terminally advances → its relay is null → the parent calls
// run_next to pick up the next wave. At that tick the OTHER wave units are
// still running their own relays (open iterations), but the cursor's
// `needNextHat` clause re-emitted `start_unit_hat` for them — the pool status
// literally printed `in flight by hat: builder×3` WHILE returning a dispatch
// for those same units. A parent following it double-spawns a second builder
// on the same worktree.
//
// The fix: an open iteration carries a `dispatched_at` lease once its hat is
// dispatched; `needNextHat` skips leased open iters (running), so a mid-wave
// run_next returns the existing mid-wave noop ("wait, then retick"). An open
// iter with NO lease (fresh pre-open / first hat / crash) is still dispatched,
// preserving crash recovery. `recoverStaleLeasedUnits` clears a lease whose
// subagent died (worktree gone, or lease aged past TTL).

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
import {
	initTestRepo,
	makeIntent,
	makeStudio,
	seedVerifiedElaboration,
} from "./_v4-fixtures.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
process.env.CLAUDE_PLUGIN_ROOT = join(resolve(HERE, "..", "..", ".."), "plugin")

const HAS_GIT = (() => {
	try {
		execFileSync("git", ["--version"], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
})()

const STAGE = "design"
const HATS = ["planner", "builder", "verifier"]
const at = "2026-05-24T00:00:00Z"

function git(repoRoot, ...args) {
	return execFileSync("git", ["-C", repoRoot, ...args], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
}

// Write an in-flight unit (planner advanced, builder OPEN) directly into the
// CURRENT working tree (the caller has checked out the stage branch and stays
// there, so engine filesystem reads see it). `leased` toggles the
// dispatched_at lease on the open builder iter.
function writeInFlightUnit(intentDir, unit, { leased }) {
	const open = {
		hat: "builder",
		started_at: at,
		completed_at: null,
		result: null,
	}
	if (leased) open.dispatched_at = at
	const fm = {
		title: unit,
		started_at: at,
		inputs: [],
		iterations: [
			{ hat: "planner", started_at: at, completed_at: at, result: "advance" },
			open,
		],
		reviews: {},
		approvals: {},
	}
	const dir = join(intentDir, "stages", STAGE, "units")
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, `${unit}.md`), matter.stringify(`# ${unit}\n`, fm))
}

async function position(slug, intentDir) {
	const { derivePosition } = await import(
		`${SRC}/orchestrator/workflow/cursor.ts`
	)
	return derivePosition({ slug, intentDir, studio: "test-studio" })
}

// Build the fixture and CHECK OUT THE STAGE BRANCH, staying there: the engine
// reads units/elaboration from the working tree, and the fixtures commit them
// to the stage branch.
function setup(slug) {
	const repoRoot = mkdtempSync(join(tmpdir(), "haiku-lease-"))
	initTestRepo({ repoRoot, slug })
	makeStudio({
		repoRoot,
		studio: "test-studio",
		stages: [{ name: STAGE, hats: HATS, review: "auto" }],
	})
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	makeIntent({ intentDir, slug, studio: "test-studio", mode: "autopilot" })
	seedVerifiedElaboration({ intentDir, stage: STAGE })
	// Stay on the stage branch for the rest of the test (seedVerifiedElaboration
	// committed elaboration.md there and restored us to main).
	git(repoRoot, "checkout", "-q", `haiku/${slug}/${STAGE}`)
	return { repoRoot, intentDir }
}

function commitWorkingTree(repoRoot) {
	try {
		git(repoRoot, "add", "-A")
		git(repoRoot, "commit", "-q", "-m", "test: units")
	} catch {
		/* nothing to commit */
	}
}

test("mid-wave: two leased in-flight units → cursor does NOT re-dispatch them (noop)", async () => {
	if (!HAS_GIT) return
	const slug = "lease-midwave"
	const { repoRoot, intentDir } = setup(slug)
	const orig = process.cwd()
	try {
		process.chdir(repoRoot)
		writeInFlightUnit(intentDir, "unit-01-a", { leased: true })
		writeInFlightUnit(intentDir, "unit-02-b", { leased: true })
		commitWorkingTree(repoRoot)
		const action = (await position(slug, intentDir))?.action ?? null
		// Both units are leased+running → no start_unit_hat naming them; the
		// wave-draining guard returns null (→ mid-wave noop).
		assert.notStrictEqual(
			action?.kind,
			"start_unit_hat",
			`mid-wave run_next must not re-dispatch leased in-flight units; got ${JSON.stringify(action)}`,
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("crash recovery: an UNLEASED open iter IS dispatched, the leased sibling is skipped", async () => {
	if (!HAS_GIT) return
	const slug = "lease-unleased"
	const { repoRoot, intentDir } = setup(slug)
	const orig = process.cwd()
	try {
		process.chdir(repoRoot)
		writeInFlightUnit(intentDir, "unit-01-a", { leased: true })
		writeInFlightUnit(intentDir, "unit-02-b", { leased: false })
		commitWorkingTree(repoRoot)
		const action = (await position(slug, intentDir))?.action ?? null
		assert.ok(action, "expected an action, got null")
		assert.strictEqual(action.kind, "start_unit_hat", `got ${action.kind}`)
		assert.deepStrictEqual(
			action.units,
			["unit-02-b"],
			"only the UNLEASED open unit is (re)dispatched; the leased one is skipped",
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("stampUnitHatLease: stamps the open iter, idempotent, skips hat mismatch", async () => {
	if (!HAS_GIT) return
	const slug = "lease-stamp"
	const { repoRoot, intentDir } = setup(slug)
	const orig = process.cwd()
	try {
		process.chdir(repoRoot)
		writeInFlightUnit(intentDir, "unit-01-a", { leased: false })
		commitWorkingTree(repoRoot)
		const { stampUnitHatLease } = await import(`${SRC}/state-tools.ts`)
		const unitFile = join(intentDir, "stages", STAGE, "units", "unit-01-a.md")
		const read = () => matter(readFileSync(unitFile, "utf8")).data.iterations

		stampUnitHatLease({ slug, stage: STAGE, unit: "unit-01-a", hat: "planner" })
		assert.ok(!read()[1].dispatched_at, "hat mismatch must not stamp")

		stampUnitHatLease({ slug, stage: STAGE, unit: "unit-01-a", hat: "builder" })
		const stamped = read()[1].dispatched_at
		assert.ok(
			typeof stamped === "string" && stamped.length > 0,
			"open builder iter must be leased",
		)

		stampUnitHatLease({ slug, stage: STAGE, unit: "unit-01-a", hat: "builder" })
		assert.strictEqual(read()[1].dispatched_at, stamped, "re-stamp is a no-op")
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("recoverStaleLeasedUnits: clears a leased unit with no worktree; leaves an unleased one", async () => {
	if (!HAS_GIT) return
	const slug = "lease-recover"
	const { repoRoot, intentDir } = setup(slug)
	const orig = process.cwd()
	try {
		process.chdir(repoRoot)
		// unit-01: leased, no worktree on disk → subagent dead → clear.
		writeInFlightUnit(intentDir, "unit-01-a", { leased: true })
		// unit-02: NOT leased → no lease to clear, left alone.
		writeInFlightUnit(intentDir, "unit-02-b", { leased: false })
		commitWorkingTree(repoRoot)
		const { recoverStaleLeasedUnits } = await import(
			`${SRC}/orchestrator/workflow/unit-branch-recovery.ts`
		)
		const res = recoverStaleLeasedUnits(slug, "test-studio")
		assert.deepStrictEqual(
			res.cleared,
			["unit-01-a"],
			"only the leased-but-worktreeless unit is cleared",
		)
		const lease = (u) =>
			matter(
				readFileSync(
					join(intentDir, "stages", STAGE, "units", `${u}.md`),
					"utf8",
				),
			).data.iterations[1].dispatched_at
		assert.ok(!lease("unit-01-a"), "stale lease cleared to null")
		assert.ok(
			!lease("unit-02-b"),
			"unleased unit untouched (never had a lease)",
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
