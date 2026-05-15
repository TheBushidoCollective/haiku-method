// stage-merge-runs-migration.test.mjs — Bug #31 coverage.
//
// Scenario: a stage branch's v4-migrated tree gets merged into intent
// main, which still carries v3-shape unit/feedback files from before
// the migration. Without an inline post-merge migration sweep, the v3
// cruft surfaces only on the NEXT `haiku_run_next` tick — and during
// that one-tick gap the cursor walks a half-migrated tree.
//
// Pinned behavior:
//   - `mergeStageBranchIntoMain` runs the v0→v4 migrator if
//     `hasV3CruftInIntent` detects post-merge cruft.
//   - The migrator's writes are committed so the working tree on intent
//     main is clean immediately after the merge returns.
//   - The success message names what happened ("post-merge
//     re-migration cleaned up …") so operators see it in the orchestrator
//     log without an extra tick.

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
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")

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

function readFm(p) {
	return matter(readFileSync(p, "utf8")).data
}

async function withRepo(slug, fn) {
	const root = mkdtempSync(join(tmpdir(), "stage-merge-mig-"))
	const orig = process.cwd()
	process.chdir(root)
	try {
		git(root, "init", "-q", "-b", "main")
		git(root, "config", "user.email", "t@t")
		git(root, "config", "user.name", "t")
		git(root, "config", "commit.gpgsign", "false")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		// Seed an intent dir on main. The v3 unit lives here so the
		// merge brings it back if the stage branch doesn't carry an
		// updated copy.
		const intentDir = join(root, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
		await fn({ root, intentDir, slug })
	} finally {
		process.chdir(orig)
		rmSync(root, { recursive: true, force: true })
	}
}

test("mergeStageBranchIntoMain re-runs v0→v4 migrator when post-merge tree has v3 cruft", async () => {
	if (!HAS_GIT) return
	await withRepo("post-merge-mig", async ({ root, intentDir, slug }) => {
		// 1. Write a v3-shape unit file on the default branch (`main` —
		//    simulating intent main's pre-migration state) and commit.
		const v3UnitPath = join(
			intentDir,
			"stages",
			"design",
			"units",
			"unit-01-foo.md",
		)
		writeFileSync(
			v3UnitPath,
			matter.stringify("# u1\n", {
				title: "foo",
				status: "completed", // v3 vocabulary
				hat: "verifier", // v3 vocabulary
				bolt: 2, // v3 vocabulary
				hat_started_at: "2026-04-01T00:00:00Z",
				completed_at: "2026-04-01T01:00:00Z",
				outputs: ["stages/design/foo.md"],
			}),
		)
		// Stamp the intent.md as v4 — the "stage branch migrated this
		// during a prior tick, but the units came back through the
		// merge on intent main" scenario.
		const intentMdPath = join(intentDir, "intent.md")
		writeFileSync(
			intentMdPath,
			matter.stringify("# x\n", {
				title: "x",
				studio: "software",
				mode: "continuous",
				plugin_version: "4.0.0",
				approvals: {},
				sealed_at: null,
				started_at: null,
			}),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "seed: v3 unit on intent main")

		// 2. Create the intent main branch + stage branch in haiku's
		//    naming convention. The merge function expects
		//    `haiku/{slug}/main` and `haiku/{slug}/{stage}`.
		const mainBranch = `haiku/${slug}/main`
		const stageBranch = `haiku/${slug}/design`
		git(root, "branch", mainBranch)
		git(root, "checkout", "-q", mainBranch)
		// On intent main, branch the stage off it.
		git(root, "branch", stageBranch)
		git(root, "checkout", "-q", stageBranch)

		// 3. On the stage branch, write a new unit (so the stage has
		//    distinct content from intent main — otherwise the merge is
		//    a no-op and our post-merge sweep doesn't fire).
		const newUnitPath = join(
			intentDir,
			"stages",
			"design",
			"units",
			"unit-02-bar.md",
		)
		writeFileSync(
			newUnitPath,
			matter.stringify("# u2\n", {
				title: "bar",
				outputs: ["stages/design/bar.md"],
				started_at: null,
				iterations: [],
				reviews: {},
				approvals: {},
				discovery: {},
			}),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "stage: new v4 unit")

		// 4. Go back to a neutral branch so the merge function exercises
		//    the worktree-on-branch path.
		git(root, "checkout", "-q", "main")

		// 5. Run the merge.
		const { mergeStageBranchIntoMain } = await import(`${SRC}/git-worktree.ts`)
		const result = mergeStageBranchIntoMain(slug, "design")

		// 6. Assert: merge succeeded AND the success message names the
		//    post-merge migration.
		assert.equal(result.success, true, `merge failed: ${result.message}`)
		assert.match(
			result.message,
			/post-merge re-migration/,
			`success message should name the post-merge migration; got: ${result.message}`,
		)

		// 7. Switch primary onto main branch to inspect the merged
		//    tree. The post-merge migration commits via `git` in the
		//    cwd, which was the primary worktree.
		git(root, "checkout", "-q", mainBranch)
		const mergedV3 = readFm(v3UnitPath)
		// v3-deprecated fields stripped.
		assert.equal(mergedV3.status, undefined, "status should be stripped")
		assert.equal(mergedV3.hat, undefined, "hat should be stripped")
		assert.equal(mergedV3.bolt, undefined, "bolt should be stripped")
		assert.equal(
			mergedV3.hat_started_at,
			undefined,
			"hat_started_at should be stripped",
		)
		// approvals.user backfilled (was status: completed).
		assert.ok(
			mergedV3.approvals?.user,
			"approvals.user should be backfilled by the migrator",
		)
		// outputs preserved.
		assert.deepEqual(mergedV3.outputs, ["stages/design/foo.md"])

		// 8. The migrator's writes were committed — working tree must
		//    be clean.
		const statusOut = git(root, "status", "--porcelain")
		assert.equal(
			statusOut,
			"",
			`working tree should be clean after post-merge migration commit; got: ${statusOut}`,
		)
	})
})

test("mergeStageBranchIntoMain returns clean success message when no cruft", async () => {
	if (!HAS_GIT) return
	await withRepo("no-cruft", async ({ root, intentDir, slug }) => {
		// Both intent main and stage branch start with clean v4 units —
		// no cruft for the migrator to find.
		const unit1 = join(intentDir, "stages", "design", "units", "unit-01.md")
		writeFileSync(
			unit1,
			matter.stringify("# u1\n", {
				title: "u1",
				outputs: [],
				started_at: null,
				iterations: [],
				reviews: {},
				approvals: {},
				discovery: {},
			}),
		)
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# x\n", {
				title: "x",
				studio: "software",
				mode: "continuous",
				plugin_version: "4.0.0",
				approvals: {},
				sealed_at: null,
				started_at: null,
			}),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "seed clean v4")

		const mainBranch = `haiku/${slug}/main`
		const stageBranch = `haiku/${slug}/design`
		git(root, "branch", mainBranch)
		git(root, "checkout", "-q", mainBranch)
		git(root, "branch", stageBranch)
		git(root, "checkout", "-q", stageBranch)

		// Add a new v4 unit on the stage so the merge has substance.
		const unit2 = join(intentDir, "stages", "design", "units", "unit-02.md")
		writeFileSync(
			unit2,
			matter.stringify("# u2\n", {
				title: "u2",
				outputs: [],
				started_at: null,
				iterations: [],
				reviews: {},
				approvals: {},
				discovery: {},
			}),
		)
		git(root, "add", "-A")
		git(root, "commit", "-q", "-m", "stage: v4 unit 2")

		git(root, "checkout", "-q", "main")

		const { mergeStageBranchIntoMain } = await import(`${SRC}/git-worktree.ts`)
		const result = mergeStageBranchIntoMain(slug, "design")
		assert.equal(result.success, true)
		// No mention of post-merge migration when there's nothing to
		// re-migrate — keeps the operator log focused.
		assert.doesNotMatch(
			result.message,
			/post-merge re-migration/,
			`clean merge must not mention re-migration; got: ${result.message}`,
		)
	})
})
