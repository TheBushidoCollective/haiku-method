// relay-self-chain-ahead-of-sibling.test.mjs
//
// A unit's NON-terminal advance must relay ITS OWN next hat even when a
// sibling unit is still on an EARLIER hat. The cursor's needNextHat clause
// dispatches one hat-group per tick (smallest hat-index first), so a unit
// that just advanced product→specification while siblings sit on product is
// absent from the cursor's `start_unit_hat.units`. Pre-2026-05-21 the relay
// gated on that list and returned null for the advancing unit, so its
// subagent parked ("holding haiku_run_next until the others return") and the
// pool drained hat-by-hat. The relay now computes the calling unit's own
// next hat directly, so each unit flows straight through its chain and the
// slot stays busy.
//
// Reported 2026-05-21 (automated-starlink-rental-platform/product): 9 units
// each advanced one hat then all held. Complements
// relay-no-cross-unit-suggest.test.mjs — that one guards "don't relay a
// SIBLING"; this one guards "DO relay SELF, regardless of sibling position".

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

test("non-terminal advance relays the calling unit's own next hat past a lagging sibling", async () => {
	if (!HAS_GIT) return
	const slug = "relay-self-ahead"
	// product stage hats: [product, specification, validator] — 3 hats, so
	// the advance lands on a MID-chain hat (specification) with work still
	// ahead, and the lagging sibling stays on the first hat (product).
	const stage = "product"
	const stageMd = matter(
		(await import("node:fs")).readFileSync(
			join(REPO_ROOT, "plugin", "studios", "software", "stages", stage, "STAGE.md"),
			"utf8",
		),
	).data
	const hats = Array.isArray(stageMd.hats) ? stageMd.hats : []
	if (hats.length < 3) return
	const firstHat = hats[0]
	const secondHat = hats[1]

	const repo = mkdtempSync(join(tmpdir(), "haiku-relay-self-ahead-"))
	try {
		gitq(repo, "init", "-q", "-b", "main")
		gitq(repo, "config", "user.email", "t@t")
		gitq(repo, "config", "user.name", "t")
		gitq(repo, "config", "commit.gpgsign", "false")

		const intentDir = join(repo, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		mkdirSync(join(stageDir, "units"), { recursive: true })
		mkdirSync(join(stageDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("body\n", {
				title: "relay self ahead",
				studio: "software",
				mode: "autopilot",
				stages: [stage],
			}),
		)
		writeFileSync(
			join(stageDir, "elaboration.md"),
			matter.stringify("e\n", {
				verified_at: "2026-05-20T00:00:00Z",
				decompose_verified_at: "2026-05-20T00:00:00Z",
			}),
		)
		const at = "2026-05-20T00:00:00Z"
		const engineReviews = {
			spec: { signed_at: at, agent: "engine:spec" },
			continuity: { signed_at: at, agent: "engine:continuity" },
			"cross-stage-consistency": {
				signed_at: at,
				agent: "engine:cross-stage-consistency",
			},
		}
		// Calling unit A: in-flight, OPEN on the FIRST hat. Advancing it lands
		// on the second hat (mid-chain). Empty outputs so the output-existence
		// gate is skipped in this minimal fixture.
		writeFileSync(
			join(stageDir, "units", "unit-01-a.md"),
			matter.stringify("# A\n", {
				title: "unit-01-a",
				started_at: at,
				inputs: [],
				outputs: [],
				iterations: [
					{ hat: firstHat, started_at: at, completed_at: null, result: null },
				],
				reviews: engineReviews,
				approvals: {},
			}),
		)
		// Sibling B: in-flight, still OPEN on the FIRST hat. After A advances,
		// the cursor's smallest-hat-index group is [B] (firstHat) — A is NOT
		// in it. The pre-fix relay returned null for A here.
		writeFileSync(
			join(stageDir, "units", "unit-02-b.md"),
			matter.stringify("# B\n", {
				title: "unit-02-b",
				started_at: at,
				inputs: [],
				outputs: [],
				iterations: [
					{ hat: firstHat, started_at: at, completed_at: null, result: null },
				],
				reviews: engineReviews,
				approvals: {},
			}),
		)
		gitq(repo, "add", "-A")
		gitq(repo, "commit", "-q", "-m", "seed")
		gitq(repo, "branch", `haiku/${slug}/main`)
		gitq(repo, "checkout", "-q", "-b", `haiku/${slug}/${stage}`)

		const { handleStateTool } = await import(`${SRC}state-tools.ts`)
		const resp = await withCwd(repo, () =>
			handleStateTool("haiku_unit_advance_hat", {
				intent: slug,
				stage,
				unit: "unit-01-a",
			}),
		)
		assert.ok(!resp?.isError, `advance should succeed; got: ${JSON.stringify(resp)?.slice(0, 400)}`)
		const txt = resp?.content?.[0]?.text ?? ""

		// The fix: the relay carries the CALLING unit's own next hat.
		assert.match(
			txt,
			/Wave still has work/,
			`mid-chain advance must relay the next hat (non-null), not park; got: ${txt.slice(0, 600)}`,
		)
		assert.ok(
			/unit-01-a/.test(txt) && new RegExp(`hat \`?${secondHat}\`?`).test(txt),
			`relay must dispatch unit-01-a's own next hat (${secondHat}); got: ${txt.slice(0, 600)}`,
		)
		// Still must NOT relay the lagging sibling (2026-05-20 invariant).
		assert.ok(
			!/unit-02-b/.test(txt),
			`must NOT relay the lagging sibling unit-02-b; got: ${txt.slice(0, 600)}`,
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})
