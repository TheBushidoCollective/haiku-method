// advance-hat-relay-breadcrumb.test.mjs
//
// Engine-side breadcrumb contract for `haiku_feedback_advance_hat`:
// the response carries the next dispatchable subagent block (or null +
// terminal/run_next message). The agent never reasons about slot pools
// or batch boundaries — it relays whatever the engine put in the
// response. See `.claude/rules/no-agent-mechanics-teaching.md`.
//
// Three outcomes per advance:
//   - relay: queue has a dispatchable next hat (this chain's next OR
//     another chain ready). next_subagent_dispatch_block is set.
//   - noop:  queue empty, other chains still in-flight. block is null,
//     message says terminate.
//   - run_next: queue empty, no in-flight. block is null, message
//     instructs the subagent to call haiku_run_next.
//
// Plus race safety: two concurrent terminal advances under the
// intent-dispatch lock cannot relay the same block twice — the first
// one's pick stamps a pending iteration on the target FB, the second
// one's walk sees the FB as in-flight and picks a different item (or
// noop / run_next).

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
	const dir = mkdtempSync(join(tmpdir(), `haiku-advance-relay-${label}-`))
	if (HAS_GIT) {
		execFileSync("git", ["init", "-q", "-b", "main", dir], { stdio: "ignore" })
		execFileSync("git", ["config", "user.email", "t@t"], { cwd: dir })
		execFileSync("git", ["config", "user.name", "t"], { cwd: dir })
		execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir })
	}
	return dir
}

function seedSoftwareIntent(repoRoot, slug, stage) {
	const intentDir = join(repoRoot, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", stage)
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	mkdirSync(join(stageDir, "units"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "Relay test",
			studio: "software",
			mode: "continuous",
			stages: ["security"],
		}),
	)
	// Target unit so FB invalidation has somewhere to land. No
	// `started_at` so `isUnitComplete` treats this as a wave-ready
	// pending unit — the cursor pins here and `findCurrentStage`
	// returns the stage. If we set started_at + empty iterations +
	// no outputs, isUnitComplete classifies the unit as a v3-migrated
	// placeholder and reports the stage complete, which makes
	// findCurrentStage return null and the relay-breadcrumb walk
	// never starts.
	writeFileSync(
		join(stageDir, "units", "unit-01-stub.md"),
		matter.stringify("unit\n", {
			title: "stub",
			iterations: [],
			reviews: {},
			approvals: {},
		}),
	)
	// Initial commit + intent + stage branches so enforceStageBranch in
	// advance_hat can hop to the right branch instead of failing on a
	// nonexistent `main`.
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

/** Author an open FB with no iterations (ready to dispatch first hat). */
function makeFb(stageDir, id, slugTitle) {
	const num = String(id).padStart(3, "0")
	writeFileSync(
		join(stageDir, "feedback", `${num}-${slugTitle}.md`),
		matter.stringify("body\n", {
			title: slugTitle,
			origin: "adversarial-review",
			author: "agent",
			author_type: "agent",
			created_at: "2026-05-19T00:00:00Z",
			triaged_at: "2026-05-19T00:00:00Z",
			status: "pending",
			targets: { unit: "unit-01-stub", invalidates: [] },
			iterations: [],
		}),
	)
}

import { readdirSync as _readdirSync } from "node:fs"

/** Prep an FB to represent "the calling hat just finished its work".
 *  The advance_hat handler infers the calling hat from `fm.hat` (the
 *  PRIOR finisher's hat — the caller is the next one in fix_hats).
 *  For "classifier just finished", fm.hat must be empty/unset.
 *  For "feedback-assessor just finished", fm.hat must be the hat
 *  before it (security-engineer). */
function primeForCallingHat(stageDir, fbNum, callingHat, fixHats) {
	const file = _readdirSync(join(stageDir, "feedback")).find((f) =>
		f.startsWith(String(fbNum).padStart(3, "0")),
	)
	const fbPath = join(stageDir, "feedback", file)
	const parsed = matter(readFileSync(fbPath, "utf8"))
	const fm = parsed.data
	const callingIdx = fixHats.indexOf(callingHat)
	fm.hat = callingIdx > 0 ? fixHats[callingIdx - 1] : ""
	writeFileSync(fbPath, matter.stringify(parsed.content || "body\n", fm))
}

/** Run advance_hat for a given FB+hat and return the parsed response. */
async function callAdvance(repoRoot, slug, stage, fbId, callingHat, fixHats, opts = {}) {
	const origCwd = process.cwd()
	process.chdir(repoRoot)
	try {
		const stageDir = join(repoRoot, ".haiku", "intents", slug, "stages", stage)
		primeForCallingHat(stageDir, fbId, callingHat, fixHats)
		const { handleStateTool } = await import(`${SRC}state-tools.ts`)
		const args = {
			intent: slug,
			stage,
			feedback_id: fbId,
		}
		if (opts.reply) args.reply = opts.reply
		const result = await handleStateTool("haiku_feedback_advance_hat", args)
		const text = result?.content?.[0]?.text ?? ""
		return JSON.parse(text)
	} finally {
		process.chdir(origCwd)
	}
}

const SECURITY_FIX_HATS = ["classifier", "security-engineer", "feedback-assessor"]

test("advance_hat: non-terminal advance returns a relay block for this chain's next hat", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("relay-next")
	try {
		const slug = "rel-1"
		const stage = "security"
		const { stageDir } = seedSoftwareIntent(repoRoot, slug, stage)
		makeFb(stageDir, 1, "fb-one")
		// Software/security's fix_hats: [classifier, security-engineer, feedback-assessor].
		// Advance classifier → should relay security-engineer for FB-001.
		const resp = await callAdvance(
			repoRoot,
			slug,
			stage,
			1,
			"classifier",
			SECURITY_FIX_HATS,
		)
		assert.equal(resp.ok, true)
		assert.equal(resp.closed, false)
		assert.ok(
			typeof resp.next_subagent_dispatch_block === "string" &&
				resp.next_subagent_dispatch_block.length > 0,
			`expected next_subagent_dispatch_block; got: ${JSON.stringify(resp).slice(0, 400)}`,
		)
		assert.ok(
			/security-engineer/.test(resp.next_subagent_dispatch_block),
			`dispatch block must name the next hat in this chain; got: ${resp.next_subagent_dispatch_block.slice(0, 200)}`,
		)
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("advance_hat: non-terminal advance continues THIS chain, not the lowest-numbered FB (fixloop-bug-f4dd5a92 Bug 2)", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("relay-thischain")
	try {
		const slug = "rel-thischain"
		const stage = "security"
		const { stageDir } = seedSoftwareIntent(repoRoot, slug, stage)
		// Two open FBs, both sitting at the FIRST hat (classifier). The
		// pre-fix relay walked the global queue and returned dispatches[0]
		// = FB-001 classifier for EVERY advance — so advancing FB-002's
		// classifier wrongly relayed FB-001's classifier (duplicate
		// first-hat fan-out, no chain ever reached its second hat).
		makeFb(stageDir, 1, "fb-one")
		makeFb(stageDir, 2, "fb-two")
		// Advance FB-002's classifier. Relay MUST be FB-002's
		// security-engineer (this chain's next hat), NOT FB-001 anything.
		const resp = await callAdvance(
			repoRoot,
			slug,
			stage,
			2,
			"classifier",
			SECURITY_FIX_HATS,
		)
		assert.equal(resp.ok, true)
		assert.equal(resp.closed, false)
		assert.ok(
			typeof resp.next_subagent_dispatch_block === "string" &&
				resp.next_subagent_dispatch_block.length > 0,
			`expected a relay block; got: ${JSON.stringify(resp).slice(0, 400)}`,
		)
		assert.ok(
			/FB-002/.test(resp.next_subagent_dispatch_block),
			`relay must continue FB-002's OWN chain, not jump to FB-001; got: ${resp.next_subagent_dispatch_block.slice(0, 300)}`,
		)
		assert.ok(
			/security-engineer/.test(resp.next_subagent_dispatch_block),
			`relay must name FB-002's next hat (security-engineer); got: ${resp.next_subagent_dispatch_block.slice(0, 300)}`,
		)
		assert.ok(
			!/FB-001/.test(resp.next_subagent_dispatch_block),
			`relay must NOT point at FB-001 (the lowest-numbered FB) on a non-terminal advance; got: ${resp.next_subagent_dispatch_block.slice(0, 300)}`,
		)
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("advance_hat: queue-empty + no in-flight → null block + run_next message", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("run-next")
	try {
		const slug = "rel-2"
		const stage = "security"
		const { stageDir } = seedSoftwareIntent(repoRoot, slug, stage)
		makeFb(stageDir, 1, "only-fb")
		// Closing the only open FB via its terminal hat. Queue is empty
		// after close → expect null block + run_next message.
		const resp = await callAdvance(
			repoRoot,
			slug,
			stage,
			1,
			"feedback-assessor",
			SECURITY_FIX_HATS,
			{ reply: "resolved" },
		)
		assert.equal(resp.ok, true)
		assert.equal(resp.closed, true)
		assert.equal(resp.next_subagent_dispatch_block, null)
		assert.ok(
			/haiku_run_next/.test(resp.message),
			`message should instruct run_next; got: ${resp.message}`,
		)
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("advance_hat: closing this chain while another FB is open returns the other's first hat", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("replenish")
	try {
		const slug = "rel-3"
		const stage = "security"
		const { stageDir } = seedSoftwareIntent(repoRoot, slug, stage)
		makeFb(stageDir, 1, "fb-one")
		makeFb(stageDir, 2, "fb-two")

		// Close FB-001 (terminal). FB-002 is unstarted — engine should
		// pick it for the freed slot and emit its first hat (classifier).
		const resp = await callAdvance(
			repoRoot,
			slug,
			stage,
			1,
			"feedback-assessor",
			SECURITY_FIX_HATS,
			{ reply: "done" },
		)
		assert.equal(resp.ok, true)
		assert.equal(resp.closed, true)
		assert.ok(
			typeof resp.next_subagent_dispatch_block === "string" &&
				resp.next_subagent_dispatch_block.length > 0,
			`freed slot should pull FB-002's first hat into a relay block; got: ${JSON.stringify(resp).slice(0, 400)}`,
		)
		assert.ok(
			/FB-002/.test(resp.next_subagent_dispatch_block),
			`relay block should target FB-002 (the unstarted queued FB); got: ${resp.next_subagent_dispatch_block.slice(0, 200)}`,
		)
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("advance_hat: race safety — concurrent terminal advances don't double-pick the same FB", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("race")
	try {
		const slug = "rel-race"
		const stage = "security"
		const { stageDir } = seedSoftwareIntent(repoRoot, slug, stage)
		// Three FBs. Two are about to fire their terminal advance; the
		// third is unstarted. Both terminal-advance calls happen
		// concurrently — only ONE should relay FB-003's first hat.
		makeFb(stageDir, 1, "fb-one")
		makeFb(stageDir, 2, "fb-two")
		makeFb(stageDir, 3, "fb-three")
		primeForCallingHat(stageDir, 1, "feedback-assessor", SECURITY_FIX_HATS)
		primeForCallingHat(stageDir, 2, "feedback-assessor", SECURITY_FIX_HATS)

		const origCwd = process.cwd()
		process.chdir(repoRoot)
		try {
			const { handleStateTool } = await import(`${SRC}state-tools.ts`)
			// withIntentDispatchLock (mkdir-based) serializes the
			// walk-and-claim step. Whichever wins picks FB-003 and stamps
			// a pending claim; the other's walk sees FB-003 as in-flight
			// and falls through to noop / run_next.
			const [respA, respB] = await Promise.all([
				handleStateTool("haiku_feedback_advance_hat", {
					intent: slug,
					stage,
					feedback_id: 1,
					reply: "done",
				}),
				handleStateTool("haiku_feedback_advance_hat", {
					intent: slug,
					stage,
					feedback_id: 2,
					reply: "done",
				}),
			])
			const parsedA = JSON.parse(respA.content[0].text)
			const parsedB = JSON.parse(respB.content[0].text)
			const blocks = [
				parsedA.next_subagent_dispatch_block,
				parsedB.next_subagent_dispatch_block,
			].filter(Boolean)
			const fb3Hits = blocks.filter((b) => /FB-003/.test(b)).length
			assert.equal(
				fb3Hits,
				1,
				`exactly one of the concurrent advances should pick FB-003; got ${fb3Hits} (A: ${(parsedA.next_subagent_dispatch_block || "").slice(0, 80)}, B: ${(parsedB.next_subagent_dispatch_block || "").slice(0, 80)})`,
			)
		} finally {
			process.chdir(origCwd)
		}
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})

test("stampDispatchClaim is idempotent — re-stamp on same hat is a noop", async () => {
	if (!HAS_GIT) return
	const repoRoot = makeRepo("claim-idem")
	try {
		const slug = "rel-claim"
		const stage = "security"
		const { stageDir } = seedSoftwareIntent(repoRoot, slug, stage)
		makeFb(stageDir, 1, "fb-claim")

		const origCwd = process.cwd()
		process.chdir(repoRoot)
		try {
			const { stampDispatchClaim } = await import(`${SRC}state-tools.ts`)
			stampDispatchClaim({
				slug,
				stage,
				feedbackId: "FB-001",
				hat: "classifier",
			})
			stampDispatchClaim({
				slug,
				stage,
				feedbackId: "FB-001",
				hat: "classifier",
			})
			const fs = await import("node:fs")
			const fbPath = join(
				stageDir,
				"feedback",
				fs.readdirSync(join(stageDir, "feedback")).find((f) => f.startsWith("001")),
			)
			const fm = matter(readFileSync(fbPath, "utf8")).data
			const claims = fm.iterations.filter(
				(it) =>
					it.hat === "classifier" &&
					(it.result === null || it.result === undefined),
			)
			assert.equal(
				claims.length,
				1,
				`only one pending claim for classifier expected; got ${claims.length}`,
			)
		} finally {
			process.chdir(origCwd)
		}
	} finally {
		rmSync(repoRoot, { recursive: true, force: true })
	}
})
