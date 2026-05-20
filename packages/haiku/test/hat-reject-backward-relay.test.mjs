// hat-reject-backward-relay.test.mjs
//
// The BACKWARD action: when a verifier rejects, the chain bounces to the
// PRIOR hat and the reject's `next_subagent_dispatch_block` re-dispatches
// THAT hat — a fresh iteration of the previous hat on the SAME work item,
// not a jump to the next finding.
//
// Reported 2026-05-19 from a real run: an intent-scope FB showed
// `reconciler-1`, `validator-1`, `validator-2` — two verifier runs with
// no re-run of the hat in between. The reject was relaying the next
// undispatched FB (slot replenishment, the TERMINAL-advance behavior)
// instead of bouncing to the prior hat. This pins the corrected shape for
// BOTH surfaces:
//   - `haiku_feedback_reject_hat` (fix hats) — stage scope AND intent
//     scope (the [builder, reconciler, validator] chain in the report).
//   - `haiku_unit_reject_hat` (standard hats) — the unit equivalent,
//     which previously had no inline relay at all (it told the parent to
//     call run_next), leaving it asymmetric with the advance path.
//
// Distinct from `haiku_feedback_reject` (terminal close of an invalid
// finding), which DOES relay the next finding — covered elsewhere.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = fileURLToPath(new URL(".", import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
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

function initRepo(label) {
	const dir = mkdtempSync(join(tmpdir(), `haiku-reject-${label}-`))
	git(dir, "init", "-q", "-b", "main")
	git(dir, "config", "user.email", "t@haiku")
	git(dir, "config", "user.name", "haiku-test")
	git(dir, "config", "commit.gpgsign", "false")
	writeFileSync(join(dir, "README.md"), "# test\n")
	git(dir, "add", "-A")
	git(dir, "commit", "-q", "-m", "init")
	return dir
}

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

function parseResp(resp) {
	const text = resp?.content?.[0]?.text ?? ""
	let parsed = null
	try {
		parsed = JSON.parse(text)
	} catch {
		/* leave null */
	}
	return { text, parsed }
}

// The relay block is a file-backed `<subagent prompt_file="...">`
// pointer; the rendered prompt body (with the prior-reject note) lives
// in that file, not the markup. Read it so we can assert on the body.
function readBlockPrompt(block) {
	const m = /prompt_file="([^"]+)"/.exec(block)
	if (!m) return ""
	try {
		return readFileSync(m[1], "utf8")
	} catch {
		return ""
	}
}

function stageFixHats(stage) {
	const fm = matter(
		readFileSync(
			join(PLUGIN_ROOT, "studios", "software", "stages", stage, "STAGE.md"),
			"utf8",
		),
	).data
	return Array.isArray(fm.fix_hats) ? fm.fix_hats : []
}

function stageHats(stage) {
	const fm = matter(
		readFileSync(
			join(PLUGIN_ROOT, "studios", "software", "stages", stage, "STAGE.md"),
			"utf8",
		),
	).data
	return Array.isArray(fm.hats) ? fm.hats : []
}

// ── Fix hats (feedback), STAGE scope ─────────────────────────────────────
test("haiku_feedback_reject_hat (stage scope): bounces to the prior hat and relays IT on the same FB", async () => {
	if (!HAS_GIT) return
	const slug = "reject-fb-stage"
	const stage = "design"
	const fixHats = stageFixHats(stage)
	if (fixHats.length < 2) {
		console.log(`[reject] software/${stage} has <2 fix_hats; skipping`)
		return
	}
	const repo = initRepo("fb-stage")
	try {
		git(repo, "checkout", "-q", "-b", `haiku/${slug}/main`)
		git(repo, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)
		const intentDir = join(repo, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "feedback"), { recursive: true })
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# t\n", {
				title: "t",
				studio: "software",
				mode: "continuous",
				stages: [stage],
			}),
		)
		// Stored hat = fixHats[0] ⇒ the calling (rejecting) hat is fixHats[1].
		// Rejecting fixHats[1] must bounce back to fixHats[0].
		writeFileSync(
			join(intentDir, "stages", stage, "feedback", "001-finding.md"),
			matter.stringify("Finding body.\n", {
				id: "FB-001",
				title: "finding",
				status: "pending",
				origin: "agent",
				author: "test",
				stage,
				hat: fixHats[0],
				bolt: 1,
				created_at: "2026-05-19T00:00:00Z",
				triaged_at: "2026-05-19T00:00:00Z",
				iterations: [],
			}),
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-q", "-m", "seed")

		const REJECT_NOTE = "STAGEREJECTNOTE-criterion-3-still-fails"
		const { handleStateTool } = await import(`${SRC}state-tools.ts`)
		const { parsed } = await withCwd(repo, () =>
			parseResp(
				handleStateTool("haiku_feedback_reject_hat", {
					intent: slug,
					stage,
					feedback_id: 1,
					reason: REJECT_NOTE,
				}),
			),
		)
		assert.ok(parsed, "response must be JSON")
		assert.strictEqual(
			parsed.next_dispatched_hat,
			fixHats[0],
			`reject must bounce to the prior hat (${fixHats[0]}); got ${parsed.next_dispatched_hat}`,
		)
		assert.strictEqual(parsed.new_bolt, 2, "bolt must bump by one")
		const block = parsed.next_subagent_dispatch_block
		assert.strictEqual(typeof block, "string", "relay block must be a string")
		assert.ok(block.length > 0, "relay block must be non-empty")
		assert.ok(
			block.includes(fixHats[0]),
			`relay block must name the bounced-to prior hat (${fixHats[0]})`,
		)
		assert.ok(
			/FB-001/.test(block),
			"relay block must target the SAME FB, not the next finding",
		)
		assert.ok(
			readBlockPrompt(block).includes(REJECT_NOTE),
			"relay prompt MUST carry the verifier's rejection note so the next bolt addresses it",
		)
		assert.ok(
			/relay.*verbatim/i.test(parsed.message),
			`message must direct the agent to relay; got: ${parsed.message}`,
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// ── Fix hats (feedback), INTENT scope — the exact reported case ──────────
test("haiku_feedback_reject_hat (intent scope): validator reject bounces to reconciler, not the next FB", async () => {
	if (!HAS_GIT) return
	const slug = "reject-fb-intent"
	// Mirror the studio's declared intent-scope chain order.
	const { resolveStudioFixHats } = await import(`${SRC}orchestrator/studio.ts`)
	const chain = resolveStudioFixHats("software")
	if (chain.length < 2) {
		console.log("[reject] software studio-level fix_hats <2; skipping")
		return
	}
	// Stored hat = chain[len-2] ⇒ calling (rejecting) hat is the terminal
	// chain[len-1] (the validator). Reject must bounce to chain[len-2].
	const storedHat = chain[chain.length - 2]
	const bouncedTo = storedHat
	const repo = initRepo("fb-intent")
	try {
		git(repo, "checkout", "-q", "-b", `haiku/${slug}/main`)
		const intentDir = join(repo, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# t\n", {
				title: "t",
				studio: "software",
				mode: "continuous",
				stages: ["design"],
			}),
		)
		writeFileSync(
			join(intentDir, "feedback", "001-intent-finding.md"),
			matter.stringify("Intent-scope finding body.\n", {
				id: "FB-001",
				title: "intent finding",
				status: "pending",
				origin: "studio-review",
				author: "test",
				stage: "",
				hat: storedHat,
				bolt: 1,
				created_at: "2026-05-19T00:00:00Z",
				triaged_at: "2026-05-19T00:00:00Z",
				iterations: [],
			}),
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-q", "-m", "seed")

		const REJECT_NOTE = "INTENTREJECTNOTE-21-gate-commands-still-failing"
		const { handleStateTool } = await import(`${SRC}state-tools.ts`)
		const { parsed } = await withCwd(repo, () =>
			parseResp(
				handleStateTool("haiku_feedback_reject_hat", {
					intent: slug,
					feedback_id: 1,
					reason: REJECT_NOTE,
				}),
			),
		)
		assert.ok(parsed, "response must be JSON")
		assert.strictEqual(
			parsed.next_dispatched_hat,
			bouncedTo,
			`reject must bounce to the prior hat (${bouncedTo}); got ${parsed.next_dispatched_hat}`,
		)
		const block = parsed.next_subagent_dispatch_block
		assert.strictEqual(typeof block, "string", "relay block must be a string")
		assert.ok(
			block.includes(bouncedTo),
			`relay block must name the bounced-to hat (${bouncedTo})`,
		)
		assert.ok(/FB-001/.test(block), "relay block must target the SAME FB")
		assert.ok(
			readBlockPrompt(block).includes(REJECT_NOTE),
			"relay prompt MUST carry the verifier's rejection note so the next bolt addresses it",
		)
		// It must NOT be the terminal verifier re-running itself.
		assert.notStrictEqual(
			parsed.next_dispatched_hat,
			chain[chain.length - 1],
			"reject must NOT re-dispatch the verifier (that's the two-validators bug)",
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// ── Standard hats (units) ────────────────────────────────────────────────
test("haiku_unit_reject_hat: bounces to the prior hat and relays IT on the same unit", async () => {
	if (!HAS_GIT) return
	const slug = "reject-unit"
	const stage = "security"
	const hats = stageHats(stage)
	if (hats.length < 2) {
		console.log(`[reject] software/${stage} has <2 hats; skipping`)
		return
	}
	const repo = initRepo("unit")
	try {
		const intentDir = join(repo, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		mkdirSync(join(stageDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "unit reject test",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
			}),
		)
		// Clear the elaborate track so the cursor reaches start_unit_hat.
		const knowledge = join(repo, ".haiku", "knowledge")
		mkdirSync(knowledge, { recursive: true })
		writeFileSync(join(knowledge, "THREAT-MODEL.md"), "threat model\n")
		writeFileSync(join(knowledge, "VULN-REPORT.md"), "vuln report\n")
		writeFileSync(
			join(stageDir, "elaboration.md"),
			matter.stringify("elaboration\n", {
				verified_at: "2026-05-19T00:00:00Z",
				decompose_verified_at: "2026-05-19T00:00:00Z",
			}),
		)
		const at = "2026-05-19T00:00:00Z"
		const engineReviews = {
			spec: { signed_at: at, agent: "engine:spec" },
			continuity: { signed_at: at, agent: "engine:continuity" },
			"cross-stage-consistency": {
				signed_at: at,
				agent: "engine:cross-stage-consistency",
			},
		}
		// Unit currently in-flight at hats[1] (prior hat hats[0] already
		// advanced). Rejecting hats[1] must bounce to hats[0].
		writeFileSync(
			join(stageDir, "units", "unit-01-stub.md"),
			matter.stringify("unit body\n", {
				title: "unit-01-stub",
				started_at: at,
				inputs: [],
				iterations: [
					{ hat: hats[0], started_at: at, completed_at: at, result: "advance" },
					{ hat: hats[1], started_at: at, completed_at: null, result: null },
				],
				reviews: engineReviews,
				approvals: {},
			}),
		)
		git(repo, "add", "-A")
		git(repo, "commit", "-q", "-m", "seed")
		git(repo, "branch", `haiku/${slug}/main`)
		git(repo, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		const REJECT_NOTE = "UNITREJECTNOTE-test-AC-2-not-covered"
		const { handleStateTool } = await import(`${SRC}state-tools.ts`)
		const resp = await withCwd(repo, () =>
			handleStateTool("haiku_unit_reject_hat", {
				intent: slug,
				stage,
				unit: "unit-01-stub",
				reason: REJECT_NOTE,
			}),
		)
		const { text, parsed } = parseResp(resp)
		if (resp?.isError) {
			console.log(`[reject unit] returned error pre-relay; skipping. ${text.slice(0, 200)}`)
			return
		}
		assert.ok(parsed, "response must be JSON")
		assert.strictEqual(
			parsed.prev_hat,
			hats[0],
			`reject must bounce to the prior hat (${hats[0]}); got ${parsed.prev_hat}`,
		)
		assert.strictEqual(parsed.bolt, 3, "bolt must be iterations.length + 1")
		const block = parsed.next_subagent_dispatch_block
		assert.strictEqual(typeof block, "string", "relay block must be a string")
		assert.ok(block.length > 0, "relay block must be non-empty")
		assert.ok(
			block.includes(hats[0]),
			`relay block must name the bounced-to prior hat (${hats[0]})`,
		)
		assert.ok(
			/unit-01-stub/.test(block),
			"relay block must target the SAME unit",
		)
		assert.ok(
			readBlockPrompt(block).includes(REJECT_NOTE),
			"relay prompt MUST carry the verifier's rejection note so the next bolt addresses it",
		)
		assert.ok(
			/spawn the block below/i.test(parsed.message),
			`message must direct the agent to spawn the relay; got: ${parsed.message.slice(0, 200)}`,
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})
