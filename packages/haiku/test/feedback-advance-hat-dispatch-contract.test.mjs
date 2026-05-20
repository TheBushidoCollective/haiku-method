#!/usr/bin/env npx tsx
// feedback-advance-hat-dispatch-contract.test.mjs — pins the
// `haiku_feedback_advance_hat` response shape.
//
// History:
//   - Task #30 (2026-05-13): removed a sidecar-backed
//     `next_subagent_dispatch_block` field that broke on re-entry
//     when the sidecar file went missing. Response routed agents to
//     `haiku_run_next` instead.
//   - 2026-05-19: restored `next_subagent_dispatch_block` via an
//     inline build (no sidecar; the engine walks the cursor under
//     `withIntentDispatchLock` and renders the next dispatch block
//     using the same code path as the cursor's dispatch prompt
//     builder). The field is now:
//       - a `<subagent prompt_file="...">` string when there's a next
//         dispatchable item — message tells the agent to relay verbatim.
//       - null when the queue is empty / wave done — message routes to
//         `haiku_run_next` (or terminate if siblings are mid-chain).
//
// Engine-bug-30 regression intent (the "never claim a block we didn't
// emit" check) is preserved: the test asserts the message + the field
// agree — if the message promises a relay, the field must be a real
// string; if the field is null, the message must NOT mention relay.
//
// This test pins:
//   - `next_subagent_dispatch_block` IS in the response (string or null)
//   - the message agrees with the field (relay-when-present,
//     haiku_run_next-when-absent)
//   - `next_dispatched_hat` is still present (informational)

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
const REPO_ROOT = resolve(HERE, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")

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

test("haiku_feedback_advance_hat response shape: next_subagent_dispatch_block and message agree", async () => {
	if (!HAS_GIT) return
	const slug = "test-fb-advance-contract"
	const stage = "design"
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-advance-"))
	const orig = process.cwd()
	try {
		git(tmp, "init", "-q", "-b", "main")
		git(tmp, "config", "user.email", "test@haiku")
		git(tmp, "config", "user.name", "haiku-test")
		git(tmp, "config", "commit.gpgsign", "false")
		writeFileSync(join(tmp, "README.md"), "# test\n")
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "init")
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/main`)
		git(tmp, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		// Seed an intent with a single FB on a stage whose fix_hats list
		// is long enough that advancing one hat leaves a known
		// next-dispatched-hat. We use the software studio's `design`
		// stage which ships with a fix_hats: sequence.
		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "feedback"), {
			recursive: true,
		})
		mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				mode: "continuous",
				plugin_version: "5.0.0",
				stages: [stage],
			}),
		)
		// Wave-ready unit so findCurrentStage pins on `design`.
		writeFileSync(
			join(intentDir, "stages", stage, "units", "unit-01-stub.md"),
			matter.stringify("stub\n", {
				title: "stub",
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)

		// Load STAGE.md to discover the live fix_hats list. We don't
		// hardcode hat names — the studio config evolves; we just need
		// at least two hats so an advance has a non-null next-dispatched.
		const stageMdPath = join(
			PLUGIN_ROOT,
			"studios",
			"software",
			"stages",
			stage,
			"STAGE.md",
		)
		const stageMd = (await import("node:fs")).readFileSync(stageMdPath, "utf8")
		const stageFm = matter(stageMd).data
		const fixHats = Array.isArray(stageFm.fix_hats) ? stageFm.fix_hats : []
		if (fixHats.length < 2) {
			console.log(
				`[fb-advance-contract] software/${stage} has fewer than 2 fix_hats (${fixHats.length}). Skipping advance contract test.`,
			)
			return
		}
		// Seed the FB at the FIRST hat so advance bumps to the second.
		const fbId = 1
		writeFileSync(
			join(intentDir, "stages", stage, "feedback", "001-test-fb.md"),
			matter.stringify("Test finding body.\n", {
				id: "FB-001",
				title: "test finding",
				status: "pending",
				origin: "agent",
				author: "test",
				stage,
				hat: fixHats[0], // last-advanced was hat[0]; next caller is hat[1]
				bolt: 1,
				created_at: "2026-05-13T00:00:00Z",
				triaged_at: "2026-05-13T00:00:00Z",
				iterations: [],
				reviews: {},
				approvals: {},
				targets: { unit: "unit-01-stub", invalidates: [] },
			}),
		)
		git(tmp, "add", "-A")
		git(tmp, "commit", "-q", "-m", "seed fb")

		process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT
		process.chdir(tmp)
		const { handleStateTool } = await import(`${SRC}/state-tools.ts`)
		const resp = handleStateTool("haiku_feedback_advance_hat", {
			intent: slug,
			stage,
			feedback_id: fbId,
		})
		const text = resp.content?.[0]?.text ?? ""
		const parsed = (() => {
			try {
				return JSON.parse(text)
			} catch {
				return null
			}
		})()
		assert.ok(parsed, `response must be JSON; got: ${text.slice(0, 200)}`)

		// Contract assertions for the 2026-05-19 response shape.
		assert.strictEqual(
			Object.hasOwn(parsed, "next_subagent_dispatch_block"),
			true,
			`response must include next_subagent_dispatch_block; got keys: ${Object.keys(parsed).join(", ")}`,
		)
		const block = parsed.next_subagent_dispatch_block
		const message = parsed.message ?? ""
		if (block === null) {
			assert.ok(
				/haiku_run_next|terminate/i.test(message),
				`when block is null, message must route to haiku_run_next or instruct termination; got: ${message}`,
			)
			assert.ok(
				!/relay.*verbatim|next-hat dispatch block/i.test(message),
				`when block is null, message must NOT promise a relay; got: ${message}`,
			)
		} else {
			assert.strictEqual(
				typeof block,
				"string",
				`when present, next_subagent_dispatch_block must be a string; got: ${typeof block}`,
			)
			assert.ok(
				block.length > 0,
				"when present, next_subagent_dispatch_block must be non-empty",
			)
			assert.ok(
				/relay.*verbatim|next_subagent_dispatch_block/i.test(message),
				`when block is set, message must direct the agent to relay; got: ${message}`,
			)
		}
		// next_dispatched_hat stays as informational.
		assert.strictEqual(
			typeof parsed.next_dispatched_hat === "string" ||
				parsed.next_dispatched_hat === null,
			true,
			`next_dispatched_hat must be string-or-null; got: ${typeof parsed.next_dispatched_hat}`,
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(tmp, { recursive: true, force: true })
	}
})
