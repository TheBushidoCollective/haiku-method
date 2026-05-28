// clean-tree-gate.test.mjs
//
// Locks the pre-tick clean-tree gate's classifier. The engine no longer
// auto-commits the agent's work under a generic "wip" message — a dirty
// working tree blocks the tick and the agent authors its own commits.
// Only the agent's own work counts: `uncommittedAgentWork()` returns
// changes OUTSIDE the engine's `.haiku/` bookkeeping, so the gate never
// nags the agent to commit engine state churn it doesn't own.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname

function git(cwd, ...args) {
	execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] })
}

function makeRepo() {
	const tmp = mkdtempSync(join(tmpdir(), "haiku-clean-tree-"))
	git(tmp, "init", "-q")
	git(tmp, "config", "user.email", "t@t.t")
	git(tmp, "config", "user.name", "t")
	git(tmp, "config", "commit.gpgsign", "false")
	writeFileSync(join(tmp, "README.md"), "seed\n")
	git(tmp, "add", "-A")
	git(tmp, "commit", "-q", "-m", "seed")
	return tmp
}

test("uncommittedAgentWork: agent code dirty → reported; .haiku churn → excluded", async () => {
	const { uncommittedAgentWork } = await import(`${SRC}git-worktree.ts`)
	const tmp = makeRepo()
	const orig = process.cwd()
	process.chdir(tmp)
	try {
		// Clean tree → nothing.
		assert.deepEqual(uncommittedAgentWork(), [], "clean tree reports nothing")

		// Engine bookkeeping churn under .haiku/ must NOT count.
		mkdirSync(join(tmp, ".haiku", "intents", "demo"), { recursive: true })
		writeFileSync(join(tmp, ".haiku", "intents", "demo", "intent.md"), "x\n")
		assert.deepEqual(
			uncommittedAgentWork(),
			[],
			".haiku/ bookkeeping is the engine's job, excluded from the gate",
		)

		// Agent source work outside .haiku/ MUST count.
		mkdirSync(join(tmp, "src"), { recursive: true })
		writeFileSync(join(tmp, "src", "app.ts"), "export const x = 1\n")
		const dirty = uncommittedAgentWork()
		assert.ok(
			dirty.includes("src/app.ts"),
			`agent work must be flagged, got ${JSON.stringify(dirty)}`,
		)
		assert.ok(
			!dirty.some((f) => f.startsWith(".haiku/")),
			"no .haiku/ paths leak into the agent-work list",
		)

		// After committing everything, the tree is clean again.
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "work")
		assert.deepEqual(uncommittedAgentWork(), [], "committed tree is clean")

		// Regression: a worktree-MODIFIED engine file as the SOLE dirty
		// entry. Its porcelain status is " M" (leading space); the git
		// output is whole-string-trimmed, so the row arrives as "M .haiku/…"
		// — a fixed slice(3) would eat the leading "." and turn ".haiku/"
		// into "haiku/", dodging the exclusion. Must still be excluded.
		writeFileSync(
			join(tmp, ".haiku", "intents", "demo", "intent.md"),
			"changed\n",
		)
		assert.deepEqual(
			uncommittedAgentWork(),
			[],
			"worktree-modified .haiku file (trimmed leading-space porcelain row) stays excluded",
		)
	} finally {
		process.chdir(orig)
		rmSync(tmp, { recursive: true, force: true })
	}
})
