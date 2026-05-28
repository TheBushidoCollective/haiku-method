// closed-fb-never-dispatched.test.mjs
//
// A closed (terminal) intent-scope feedback item must NEVER be dispatched
// for a fix hat — and the decision must be ORDER-INDEPENDENT, even when a
// reused/duplicated id leaves two files for the same FB (one open, one
// closed). Regression for the 2026-05-20 livelock: the cursor kept
// emitting `start_feedback_hat → FB-001 (builder)` for a CLOSED FB while
// `haiku_feedback_list { closed: false }` returned 0 and
// `haiku_feedback_advance_hat` returned lifecycle_violation. The verified
// re-check read only `matches[0]` (readdir order) and matched the id by
// `startsWith`, so a duplicate flapped between dispatch and skip.

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

const CLOSED_FB = {
	id: "FB-001",
	title: "Two design units double-claim plan-creation flow",
	origin: "agent",
	author: "cross-stage-consistency",
	author_type: "agent",
	created_at: "2026-05-19T15:46:48Z",
	source_ref: null,
	targets: { unit: null, invalidates: [] },
	iterations: [
		{ hat: "reconciler", started_at: "2026-05-19T21:50:34Z", result: "advance", bolt: 1, completed_at: "2026-05-19T21:57:52Z" },
		{ hat: "validator", started_at: "2026-05-19T21:57:52Z", result: "closed", bolt: 1, completed_at: "2026-05-19T23:50:50Z" },
	],
	hat: "validator",
	closed_at: "2026-05-19T23:50:50Z",
}

const OPEN_FB_SAME_ID = {
	id: "FB-001",
	title: "stale duplicate of FB-001 (reused id)",
	origin: "agent",
	author: "cross-stage-consistency",
	author_type: "agent",
	created_at: "2026-05-19T15:46:48Z",
	source_ref: null,
	targets: { unit: null, invalidates: [] },
	iterations: [], // empty → nextHatForUnit would return the first hat
}

async function seed(fbFiles) {
	const slug = "twelve-week-plan-accountability-app"
	const stage = "security"
	const repo = mkdtempSync(join(tmpdir(), "haiku-closedfb-"))
	gitq(repo, "init", "-q", "-b", "main")
	gitq(repo, "config", "user.email", "t@t")
	gitq(repo, "config", "user.name", "t")
	const idir = join(repo, ".haiku", "intents", slug)
	const fbdir = join(idir, "feedback")
	const udir = join(idir, "stages", stage, "units")
	mkdirSync(fbdir, { recursive: true })
	mkdirSync(udir, { recursive: true })
	writeFileSync(
		join(idir, "intent.md"),
		matter.stringify("# t\n", { title: "t", studio: "software", mode: "continuous", stages: [stage] }),
	)
	for (const [name, fm] of fbFiles) {
		writeFileSync(join(fbdir, name), matter.stringify("Body.\n", fm))
	}
	writeFileSync(
		join(udir, "unit-01-x.md"),
		matter.stringify("# u\n", { title: "unit-01-x", inputs: [], outputs: [], iterations: [], reviews: {}, approvals: {} }),
	)
	gitq(repo, "add", "-A")
	gitq(repo, "commit", "-q", "-m", "seed")
	return { repo, slug, idir }
}

async function action(repo, slug, idir) {
	const orig = process.cwd()
	process.chdir(repo)
	try {
		const { derivePosition } = await import(`${SRC}orchestrator/workflow/cursor.ts`)
		return derivePosition({ slug, intentDir: idir, studio: "software" })?.action ?? null
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
	}
}

test("closed intent-scope FB is not dispatched as start_feedback_hat", async () => {
	if (!HAS_GIT) return
	const { repo, slug, idir } = await seed([
		["001-two-design-units-double-claim.md", CLOSED_FB],
	])
	try {
		const a = await action(repo, slug, idir)
		assert.notEqual(
			a?.kind,
			"start_feedback_hat",
			`a closed FB must never be dispatched; got: ${JSON.stringify(a)}`,
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("duplicate FB id (one closed, one open) is treated as terminal — order-independent, no flapping", async () => {
	if (!HAS_GIT) return
	// Both filename orderings: the closed-marker must win regardless of
	// which file readdir lists first.
	for (const order of [
		[["001-closed.md", CLOSED_FB], ["001-open-dupe.md", OPEN_FB_SAME_ID]],
		[["001-open-dupe.md", OPEN_FB_SAME_ID], ["001-closed.md", CLOSED_FB]],
	]) {
		const { repo, slug, idir } = await seed(order)
		try {
			const a = await action(repo, slug, idir)
			assert.notEqual(
				a?.kind,
				"start_feedback_hat",
				`with a closed duplicate present, FB-001 must be treated terminal (order ${order.map((o) => o[0]).join(",")}); got: ${JSON.stringify(a)}`,
			)
		} finally {
			rmSync(repo, { recursive: true, force: true })
		}
	}
})
