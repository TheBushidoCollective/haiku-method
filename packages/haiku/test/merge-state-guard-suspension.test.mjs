// merge-state-guard-suspension.test.mjs
//
// While the worktree is mid-merge (intent-main → stage carrying forward
// intent-completion closures), the internal MCP write tools suspend their
// lifecycle / ownership / branch-enforcement preventions so the conflict
// can be resolved through the schema-safe tools — but schema validation
// STAYS on. Outside a merge, the same preventions are enforced as normal.
//
// This is the root fix for the FB-001-style deadlock: a conflict in
// engine-owned feedback YAML (open-vs-closed) used to be unresolvable
// (the lifecycle guard refused to rewrite a closed FB AND the PreToolUse
// hook blocked raw edits), so the stage branch never picked up the
// closure and the cursor re-dispatched the closed FB forever.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
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

function git(cwd, ...args) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim()
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

function getText(resp) {
	return resp?.content?.[0]?.text ?? ""
}

test("isMergeInProgress reflects MERGE_HEAD; closed-FB write is gated outside merge, allowed during", async () => {
	if (!HAS_GIT) return
	const slug = "merge-suspend"
	const stage = "security"
	const repo = mkdtempSync(join(tmpdir(), "haiku-merge-suspend-"))
	try {
		git(repo, "init", "-q", "-b", "main")
		git(repo, "config", "user.email", "t@haiku")
		git(repo, "config", "user.name", "haiku-test")
		git(repo, "config", "commit.gpgsign", "false")
		writeFileSync(join(repo, "README.md"), "# t\n")
		git(repo, "add", "-A")
		git(repo, "commit", "-q", "-m", "init")
		git(repo, "checkout", "-q", "-b", `haiku/${slug}/main`)

		const intentDir = join(repo, ".haiku", "intents", slug)
		const fbDir = join(intentDir, "feedback")
		mkdirSync(fbDir, { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# t\n", {
				title: "t",
				studio: "software",
				mode: "continuous",
				stages: [stage],
			}),
		)
		// A CLOSED intent-scope feedback (terminal — normally immutable).
		const fbFile = join(fbDir, "001-finding.md")
		writeFileSync(
			fbFile,
			matter.stringify("Original body.\n", {
				id: "FB-001",
				title: "finding",
				status: "closed",
				origin: "studio-review",
				author: "cross-stage-consistency",
				created_at: "2026-05-19T00:00:00Z",
				closed_at: "2026-05-19T23:50:50Z",
				iterations: [],
			}),
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-q", "-m", "seed closed fb")

		const { handleStateTool } = await import(`${SRC}state-tools.ts`)
		const { isMergeInProgress } = await import(`${SRC}git-worktree.ts`)

		// ── Outside a merge: rewriting a closed FB is a lifecycle violation.
		await withCwd(repo, () => {
			assert.equal(isMergeInProgress(), false, "no merge yet")
			const resp = handleStateTool("haiku_feedback_write", {
				intent: slug,
				feedback_id: 1,
				body: "Attempted rewrite outside merge.",
			})
			const parsed = JSON.parse(getText(resp))
			assert.equal(
				parsed.error,
				"lifecycle_violation",
				`closed FB must be immutable outside a merge; got: ${getText(resp).slice(0, 200)}`,
			)
		})

		// ── Induce a real MERGE_HEAD: branch that conflicts on the FB file.
		git(repo, "checkout", "-q", "-b", "conflict-branch", `haiku/${slug}/main`)
		writeFileSync(
			fbFile,
			matter.stringify("Body edited on conflict-branch.\n", {
				id: "FB-001",
				title: "finding",
				status: "closed",
				origin: "studio-review",
				author: "cross-stage-consistency",
				created_at: "2026-05-19T00:00:00Z",
				closed_at: "2026-05-19T23:50:50Z",
				iterations: [],
			}),
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-q", "-m", "edit fb on conflict-branch")
		git(repo, "checkout", "-q", `haiku/${slug}/main`)
		writeFileSync(
			fbFile,
			matter.stringify("Body edited on main.\n", {
				id: "FB-001",
				title: "finding",
				status: "closed",
				origin: "studio-review",
				author: "cross-stage-consistency",
				created_at: "2026-05-19T00:00:00Z",
				closed_at: "2026-05-19T23:50:50Z",
				iterations: [],
			}),
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-q", "-m", "edit fb on main")
		// This merge conflicts on the FB file → leaves MERGE_HEAD.
		let mergeConflicted = false
		try {
			git(repo, "merge", "conflict-branch", "--no-edit")
		} catch {
			mergeConflicted = true
		}
		assert.ok(mergeConflicted, "merge should conflict on the FB file")
		assert.ok(existsSync(join(repo, ".git", "MERGE_HEAD")), "MERGE_HEAD present")

		// ── During the merge: the lifecycle prevention is suspended, so the
		// schema-safe FB write tool can resolve the conflicted file.
		await withCwd(repo, () => {
			assert.equal(isMergeInProgress(), true, "merge in progress")
			const resp = handleStateTool("haiku_feedback_write", {
				intent: slug,
				feedback_id: 1,
				body: "Resolved body written during merge.",
			})
			const parsed = JSON.parse(getText(resp))
			assert.notEqual(
				parsed.error,
				"lifecycle_violation",
				`during a merge the closed-FB lifecycle guard must be suspended; got: ${getText(resp).slice(0, 200)}`,
			)
			assert.ok(parsed.ok, `write should succeed during merge; got: ${getText(resp).slice(0, 200)}`)
			// Schema still holds — the file parses with valid frontmatter.
			const fm = matter(readFileSync(fbFile, "utf8"))
			assert.equal(fm.data.id, "FB-001", "FM preserved + valid after merge-state write")
			assert.match(fm.content, /Resolved body written during merge/)
		})
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})
