// quality-gates-corrective-exemption.test.mjs
//
// A unit ships with a broken quality-gate command (wrong workspace name,
// bad path, wrong invocation). The gate fails forever; no code change
// fixes it. The agent MUST be able to repair the gate command via
// `haiku_unit_set { field: "quality_gates" }` even after the unit has
// started its first hat or completed — `quality_gates` and `outputs` are
// the two CORRECTIVE-exempt fields (they change how the unit is verified
// / what it declares producing, not the forward-only work itself). Every
// OTHER field stays forward-only-immutable once the unit is active.
//
// Locks the exemption against regression. (The engine permits this; the
// real-world block was an auto-mode permission classifier, not the FM
// check — this test guarantees the FM check itself never becomes the
// blocker.)

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

const AT = "2026-05-20T00:00:00Z"
const ITERS = {
	pending: [],
	active: [{ hat: "builder", started_at: AT, completed_at: null, result: null }],
	completed: [
		{ hat: "builder", started_at: AT, completed_at: AT, result: "advance" },
		{ hat: "reviewer", started_at: AT, completed_at: AT, result: "advance" },
	],
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

function getJson(resp) {
	try {
		return JSON.parse(resp?.content?.[0]?.text ?? "")
	} catch {
		return {}
	}
}

async function seedUnit(stateName) {
	const slug = `qg-${stateName}`
	const stage = "development"
	const unit = "unit-01-x"
	const repo = mkdtempSync(join(tmpdir(), `haiku-qg-${stateName}-`))
	gitq(repo, "init", "-q", "-b", "main")
	gitq(repo, "config", "user.email", "t@t")
	gitq(repo, "config", "user.name", "t")
	const idir = join(repo, ".haiku", "intents", slug)
	const udir = join(idir, "stages", stage, "units")
	mkdirSync(udir, { recursive: true })
	writeFileSync(
		join(idir, "intent.md"),
		matter.stringify("# t\n", { title: "t", studio: "software", mode: "continuous", stages: [stage] }),
	)
	const fm = {
		title: unit,
		inputs: [],
		outputs: ["OUT.md"],
		quality_gates: [{ name: "g", command: "yarn workspace @gigsmart/admin typecheck" }],
		reviews: {},
		approvals: {},
	}
	if (stateName !== "pending") fm.started_at = AT
	fm.iterations = ITERS[stateName]
	writeFileSync(join(udir, `${unit}.md`), matter.stringify("# x\n", fm))
	gitq(repo, "add", "-A")
	gitq(repo, "commit", "-q", "-m", "seed")
	return { repo, slug, stage, unit, udir }
}

for (const stateName of ["pending", "active", "completed"]) {
	test(`quality_gates + outputs are writeable via unit_set when unit is ${stateName}`, async () => {
		if (!HAS_GIT) return
		const { repo, slug, stage, unit, udir } = await seedUnit(stateName)
		try {
			const { handleStateTool } = await import(`${SRC}state-tools.ts`)
			await withCwd(repo, () => {
				// Fix the broken gate command (wrong workspace → real one).
				const rGate = handleStateTool("haiku_unit_set", {
					intent: slug,
					stage,
					unit,
					field: "quality_gates",
					value: [{ name: "g", command: "yarn workspace @gigsmart/web-admin typecheck" }],
				})
				assert.ok(
					!rGate.isError,
					`quality_gates must be writeable when ${stateName}; got: ${rGate.content?.[0]?.text?.slice(0, 200)}`,
				)
				// Fix a missed output path too (the other corrective field).
				const rOut = handleStateTool("haiku_unit_set", {
					intent: slug,
					stage,
					unit,
					field: "outputs",
					value: ["libraries/atorasu/molecules/SignalPill/SignalPill.tsx"],
				})
				assert.ok(
					!rOut.isError,
					`outputs must be writeable when ${stateName}; got: ${rOut.content?.[0]?.text?.slice(0, 200)}`,
				)
				// The correction landed on disk.
				const fm = matter(readFileSync(join(udir, `${unit}.md`), "utf8")).data
				assert.match(fm.quality_gates[0].command, /web-admin/, "gate command corrected on disk")
				assert.match(fm.outputs[0], /molecules\/SignalPill/, "output corrected on disk")

				// Forward-only check: a NON-corrective field (inputs) must
				// still be immutable once active/completed.
				const rInputs = handleStateTool("haiku_unit_set", {
					intent: slug,
					stage,
					unit,
					field: "inputs",
					value: ["something/new.md"],
				})
				if (stateName === "pending") {
					assert.ok(!rInputs.isError, "inputs writeable while pending")
				} else {
					assert.equal(
						getJson(rInputs).error,
						"lifecycle_violation",
						`inputs must stay forward-only-immutable when ${stateName}`,
					)
				}
			})
		} finally {
			rmSync(repo, { recursive: true, force: true })
		}
	})
}

// End-to-end: the read→modify→write corrective merge that haiku_unit_get
// unlocks. A multi-gate active unit (one broken gate command, like the
// 2026-05-20 churn report's unit-09) is repaired by READING the current
// quality_gates array, fixing only the broken entry, and writing it back
// — the other gates MUST survive. Without the read path, unit_set would
// clobber the gates whose commands the agent can't see.
test("read→fix-one→write-back repairs a single gate without clobbering the others (churn fix)", async () => {
	if (!HAS_GIT) return
	const slug = "qg-merge"
	const stage = "development"
	const unit = "unit-09-x"
	const repo = mkdtempSync(join(tmpdir(), "haiku-qg-merge-"))
	try {
		gitq(repo, "init", "-q", "-b", "main")
		gitq(repo, "config", "user.email", "t@t")
		gitq(repo, "config", "user.name", "t")
		const idir = join(repo, ".haiku", "intents", slug)
		const udir = join(idir, "stages", stage, "units")
		mkdirSync(udir, { recursive: true })
		writeFileSync(
			join(idir, "intent.md"),
			matter.stringify("# t\n", { title: "t", studio: "software", mode: "continuous", stages: [stage] }),
		)
		const gates = [
			{ name: "fixes-present", command: "grep -q 'timingSafeEqual' src/server/routes/quarters-routes.ts" },
			{ name: "reconciliation-addendum-present", command: "test -f docs/RECON.md", dir: "ops/x" },
			{ name: "auth-regression-test", command: "yarn jest auth" },
		]
		writeFileSync(
			join(udir, `${unit}.md`),
			matter.stringify("# u\n", {
				title: unit,
				inputs: [],
				outputs: [],
				quality_gates: gates,
				started_at: AT, // ACTIVE
				iterations: ITERS.active,
				reviews: {},
				approvals: {},
			}),
		)
		gitq(repo, "add", "-A")
		gitq(repo, "commit", "-q", "-m", "seed")

		const { handleStateTool } = await import(`${SRC}state-tools.ts`)
		await withCwd(repo, () => {
			// READ the current gates.
			const got = handleStateTool("haiku_unit_get", {
				intent: slug,
				stage,
				unit,
				field: "quality_gates",
			})
			const current = JSON.parse(got.content[0].text).value
			assert.equal(current.length, 3, "read returns all three gates")

			// FIX only the broken gate's path; preserve the rest verbatim.
			const merged = current.map((g) =>
				g.name === "fixes-present"
					? { ...g, command: "grep -q 'timingSafeEqual' src/server/middleware/require-auth-or-internal-token.ts" }
					: g,
			)
			const wrote = handleStateTool("haiku_unit_set", {
				intent: slug,
				stage,
				unit,
				field: "quality_gates",
				value: merged,
			})
			assert.ok(!wrote.isError, `write-back must succeed on active unit; got: ${wrote.content?.[0]?.text?.slice(0, 200)}`)

			// VERIFY all three gates survive, only the one path changed.
			const after = JSON.parse(
				handleStateTool("haiku_unit_get", { intent: slug, stage, unit, field: "quality_gates" }).content[0].text,
			).value
			assert.equal(after.length, 3, "all three gates preserved (not clobbered)")
			assert.match(after.find((g) => g.name === "fixes-present").command, /require-auth-or-internal-token/)
			assert.equal(after.find((g) => g.name === "auth-regression-test").command, "yarn jest auth")
			assert.equal(after.find((g) => g.name === "reconciliation-addendum-present").dir, "ops/x")
		})
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})
