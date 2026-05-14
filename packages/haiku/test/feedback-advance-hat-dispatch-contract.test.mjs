#!/usr/bin/env npx tsx
// feedback-advance-hat-dispatch-contract.test.mjs — pins the
// `haiku_feedback_advance_hat` response shape after task #30
// (2026-05-13).
//
// Bug: the response carried `next_subagent_dispatch_block: <sidecar
// contents | null>` and a message instructing the agent to "relay it
// verbatim". On re-entry (sidecar missing) the field was null and the
// chain stalled — parent had no block to spawn, next hat never
// dispatched.
//
// Fix (option b — v4 cursor-is-source-of-truth): drop the field and
// the relay-verbatim message. Tell the agent to call `haiku_run_next`
// for the next instruction, matching the contract of
// `haiku_unit_advance_hat`.
//
// This test pins:
//   - `next_subagent_dispatch_block` is NOT in the response payload
//   - the message references `haiku_run_next`, not a relay block
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

test("haiku_feedback_advance_hat response shape: no next_subagent_dispatch_block, message routes to haiku_run_next", async () => {
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
		// next-dispatched-hat. We use the software studio's `review`
		// stage which ships with a fix_hats: sequence.
		const intentDir = join(tmp, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", stage, "feedback"), {
			recursive: true,
		})
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				mode: "continuous",
				plugin_version: "5.0.0",
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
			// Studio doesn't ship a multi-hat fix sequence for this stage.
			// Test is informational; skip.
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
				targets: { unit: null, invalidates: [] },
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

		// Contract assertions for the new response shape.
		assert.strictEqual(
			Object.hasOwn(parsed, "next_subagent_dispatch_block"),
			false,
			`response must NOT include next_subagent_dispatch_block; got keys: ${Object.keys(parsed).join(", ")}`,
		)
		assert.ok(
			!/relay it verbatim|relay.*verbatim|next-hat dispatch block/i.test(
				parsed.message ?? "",
			),
			`message must not reference relay-verbatim; got: ${parsed.message}`,
		)
		assert.ok(
			/haiku_run_next/.test(parsed.message ?? ""),
			`message must route the agent to haiku_run_next; got: ${parsed.message}`,
		)
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
