// quality-gate-defer-to-ci.test.mjs
//
// A quality gate that the local fix loop can't make pass (no local API,
// worktree dep/codegen mismatch — admin-portal-reimagine #1/#4) must NOT
// wedge the stage forever. After GATE_DEFER_AFTER_ATTEMPTS engine gate FBs
// still leave it red, dispatch_quality_gates DEFERS the gate to CI: it
// stamps approvals.quality_gates as deferred (so the cursor passes the
// gate and the stage advances), records the deferred gate on the unit,
// closes the open gate FBs, and files NO new blocking FB. CI re-runs the
// gate on the PR and is authoritative.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
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

function writeGateFb(fbDir, num, unit) {
	writeFileSync(
		join(fbDir, `${String(num).padStart(2, "0")}-quality-gates-failure.md`),
		matter.stringify("Prior gate failure.\n", {
			id: `FB-${String(num).padStart(3, "0")}`,
			title: `quality_gates failure on ${unit}`,
			status: "pending",
			origin: "agent",
			author: "engine",
			author_type: "system",
			source_ref: `unit:${unit}`,
			created_at: "2026-05-20T00:00:00Z",
			triaged_at: "2026-05-20T00:00:00Z",
			targets: { unit, invalidates: ["quality_gates"] },
			iterations: [],
		}),
	)
}

test("dispatch_quality_gates defers a non-convergent gate to CI after the attempt threshold", async () => {
	if (!HAS_GIT) return
	const slug = "gate-defer"
	const stage = "development"
	const unit = "unit-01-x"
	const repo = mkdtempSync(join(tmpdir(), "haiku-gate-defer-"))
	try {
		gitq(repo, "init", "-q", "-b", "main")
		gitq(repo, "config", "user.email", "t@t")
		gitq(repo, "config", "user.name", "t")

		const intentDir = join(repo, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		const unitsDir = join(stageDir, "units")
		const fbDir = join(stageDir, "feedback")
		mkdirSync(unitsDir, { recursive: true })
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
		// Unit with a gate that ALWAYS fails (simulates an env-unfixable gate).
		writeFileSync(
			join(unitsDir, `${unit}.md`),
			matter.stringify("# x\n", {
				title: unit,
				inputs: [],
				outputs: [],
				quality_gates: [{ name: "always-red", command: "exit 7" }],
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)
		// Two prior engine gate FBs already on disk (the fix loop already
		// tried) → this dispatch is the one that should DEFER.
		writeGateFb(fbDir, 1, unit)
		writeGateFb(fbDir, 2, unit)
		gitq(repo, "add", "-A")
		gitq(repo, "commit", "-q", "-m", "seed")

		const mod = await import(
			`${SRC}tools/orchestrator/haiku_dispatch_quality_gates.ts`
		)
		const tool = mod.default
		const resp = await withCwd(repo, () =>
			tool.handle({ intent: slug, stage, units: [unit], scope: "stage" }),
		)
		const parsed = JSON.parse(resp.content[0].text)

		// Deferred, not re-filed.
		assert.equal(
			parsed.deferred?.length,
			1,
			`expected 1 deferred unit; got: ${resp.content[0].text}`,
		)
		assert.equal(parsed.deferred[0].unit, unit)

		// Approval stamped deferred → cursor will pass the gate.
		const unitFm = matter(
			readFileSync(join(unitsDir, `${unit}.md`), "utf8"),
		).data
		assert.ok(
			unitFm.approvals?.quality_gates,
			"quality_gates approval must be stamped",
		)
		assert.equal(
			unitFm.approvals.quality_gates.deferred_to_ci,
			true,
			"approval must be marked deferred_to_ci",
		)
		assert.ok(
			Array.isArray(unitFm.deferred_gates) && unitFm.deferred_gates.length >= 1,
			"deferred_gates must be recorded on the unit",
		)

		// No NEW blocking gate FB filed; the prior open ones are closed.
		const fbFiles = readdirSync(fbDir).filter((f) => f.endsWith(".md"))
		for (const f of fbFiles) {
			const fm = matter(readFileSync(join(fbDir, f), "utf8")).data
			if (fm.author === "engine" && fm.source_ref === `unit:${unit}`) {
				assert.equal(
					fm.status,
					"closed",
					`prior gate FB ${f} must be closed on deferral; got status=${fm.status}`,
				)
				assert.equal(
					fm.resolution,
					"deferred",
					`gate FB ${f} must resolve as deferred`,
				)
			}
		}
		// Exactly the two seeded FBs — none added.
		assert.equal(
			fbFiles.length,
			2,
			`no new FB should be filed on deferral; got ${fbFiles.length}`,
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("dispatch_quality_gates still files a blocking FB before the threshold", async () => {
	if (!HAS_GIT) return
	const slug = "gate-defer-early"
	const stage = "development"
	const unit = "unit-01-y"
	const repo = mkdtempSync(join(tmpdir(), "haiku-gate-early-"))
	try {
		gitq(repo, "init", "-q", "-b", "main")
		gitq(repo, "config", "user.email", "t@t")
		gitq(repo, "config", "user.name", "t")
		const intentDir = join(repo, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		const unitsDir = join(stageDir, "units")
		const fbDir = join(stageDir, "feedback")
		mkdirSync(unitsDir, { recursive: true })
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
		writeFileSync(
			join(unitsDir, `${unit}.md`),
			matter.stringify("# y\n", {
				title: unit,
				inputs: [],
				outputs: [],
				quality_gates: [{ name: "always-red", command: "exit 3" }],
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)
		gitq(repo, "add", "-A")
		gitq(repo, "commit", "-q", "-m", "seed")

		const mod = await import(
			`${SRC}tools/orchestrator/haiku_dispatch_quality_gates.ts`
		)
		const resp = await withCwd(repo, () =>
			mod.default.handle({
				intent: slug,
				stage,
				units: [unit],
				scope: "stage",
			}),
		)
		const parsed = JSON.parse(resp.content[0].text)
		// First failure (no prior FBs): file a blocking FB, do NOT defer.
		assert.equal(
			parsed.deferred?.length ?? 0,
			0,
			"must not defer on the first attempt",
		)
		assert.equal(parsed.failures.length, 1, "must report the failure")
		const fbFiles = readdirSync(fbDir).filter((f) => f.endsWith(".md"))
		assert.equal(
			fbFiles.length,
			1,
			"a blocking gate FB must be filed on the first failure",
		)
		const unitFm = matter(
			readFileSync(join(unitsDir, `${unit}.md`), "utf8"),
		).data
		assert.ok(
			!unitFm.approvals?.quality_gates,
			"approval must NOT be stamped on the first failure",
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

// Seed an engine gate FB under an explicit source_ref (per-gate key).
function writeGateFbRef(fbDir, num, unit, sourceRef, gateName) {
	writeFileSync(
		join(fbDir, `${String(num).padStart(2, "0")}-quality-gates-failure.md`),
		matter.stringify("Prior gate failure.\n", {
			id: `FB-${String(num).padStart(3, "0")}`,
			title: `quality_gates failure on ${unit} (${gateName})`,
			status: "pending",
			origin: "agent",
			author: "engine",
			author_type: "system",
			source_ref: sourceRef,
			created_at: "2026-05-20T00:00:00Z",
			triaged_at: "2026-05-20T00:00:00Z",
			targets: { unit, invalidates: ["quality_gates"] },
			iterations: [],
		}),
	)
}

test("BUG-1: deferral is PER GATE — a freshly-red gate gets its own budget, not the unit's accumulated count", async () => {
	if (!HAS_GIT) return
	const slug = "gate-per-gate"
	const stage = "development"
	const unit = "unit-01-z"
	const repo = mkdtempSync(join(tmpdir(), "haiku-gate-pergate-"))
	try {
		gitq(repo, "init", "-q", "-b", "main")
		gitq(repo, "config", "user.email", "t@t")
		gitq(repo, "config", "user.name", "t")
		const intentDir = join(repo, ".haiku", "intents", slug)
		const stageDir = join(intentDir, "stages", stage)
		const unitsDir = join(stageDir, "units")
		const fbDir = join(stageDir, "feedback")
		mkdirSync(unitsDir, { recursive: true })
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
		// Two failing gates. `gate-a` already exhausted its per-gate budget
		// (2 prior FBs keyed `unit:<slug>:gate-a`); `gate-b` is freshly red
		// (zero prior). Pre-fix, gate-b would inherit the unit's accumulated
		// count and defer on its FIRST failure. Per-gate, gate-b re-files.
		writeFileSync(
			join(unitsDir, `${unit}.md`),
			matter.stringify("# z\n", {
				title: unit,
				inputs: [],
				outputs: [],
				quality_gates: [
					{ name: "gate-a", command: "exit 1" },
					{ name: "gate-b", command: "exit 1" },
				],
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)
		writeGateFbRef(fbDir, 1, unit, `unit:${unit}:gate-a`, "gate-a")
		writeGateFbRef(fbDir, 2, unit, `unit:${unit}:gate-a`, "gate-a")
		gitq(repo, "add", "-A")
		gitq(repo, "commit", "-q", "-m", "seed")

		const mod = await import(
			`${SRC}tools/orchestrator/haiku_dispatch_quality_gates.ts`
		)
		const resp = await withCwd(repo, () =>
			mod.default.handle({
				intent: slug,
				stage,
				units: [unit],
				scope: "stage",
			}),
		)
		const parsed = JSON.parse(resp.content[0].text)

		// gate-a deferred (its own budget exhausted); gate-b NOT deferred.
		const deferredGates = parsed.deferred?.[0]?.gates ?? []
		assert.ok(
			deferredGates.includes("gate-a"),
			`gate-a must defer; got ${JSON.stringify(parsed.deferred)}`,
		)
		assert.ok(
			!deferredGates.includes("gate-b"),
			"gate-b must NOT defer — it had its own fresh budget",
		)

		// gate-b re-filed under its OWN per-gate source_ref.
		const fbFiles = readdirSync(fbDir).filter((f) => f.endsWith(".md"))
		const refs = fbFiles.map(
			(f) => matter(readFileSync(join(fbDir, f), "utf8")).data.source_ref,
		)
		assert.ok(
			refs.includes(`unit:${unit}:gate-b`),
			`a per-gate FB for gate-b must be filed; refs: ${JSON.stringify(refs)}`,
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("BUG-2: a gate named in intent.md skip_gates is excluded from the intent-scope union", async () => {
	if (!HAS_GIT) return
	const slug = "gate-skip"
	const stage = "development"
	const unit = "unit-01-skip"
	const repo = mkdtempSync(join(tmpdir(), "haiku-gate-skip-"))
	try {
		gitq(repo, "init", "-q", "-b", "main")
		gitq(repo, "config", "user.email", "t@t")
		gitq(repo, "config", "user.name", "t")
		const intentDir = join(repo, ".haiku", "intents", slug)
		const unitsDir = join(intentDir, "stages", stage, "units")
		mkdirSync(unitsDir, { recursive: true })
		// `stale-path-gate` would always fail (relocated code), but it's named
		// in skip_gates → excluded from the intent-scope union → the intent
		// can seal instead of re-emitting an unfixable gate every dispatch.
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# t\n", {
				title: "t",
				studio: "software",
				mode: "continuous",
				stages: [stage],
				skip_gates: ["stale-path-gate"],
			}),
		)
		writeFileSync(
			join(unitsDir, `${unit}.md`),
			matter.stringify("# skip\n", {
				title: unit,
				inputs: [],
				outputs: [],
				quality_gates: [{ name: "stale-path-gate", command: "exit 1" }],
				iterations: [],
				reviews: {},
				approvals: {},
			}),
		)
		gitq(repo, "add", "-A")
		gitq(repo, "commit", "-q", "-m", "seed")

		const mod = await import(
			`${SRC}tools/orchestrator/haiku_dispatch_quality_gates.ts`
		)
		const resp = await withCwd(repo, () =>
			mod.default.handle({ intent: slug, scope: "intent" }),
		)
		const parsed = JSON.parse(resp.content[0].text)
		// The skipped gate is not in the union, so no failure is reported for it.
		const failedGateNames = (parsed.failures ?? []).flatMap((f) =>
			(f.failures ?? []).map((g) => g.name),
		)
		assert.ok(
			!failedGateNames.includes("stale-path-gate"),
			`skip_gates gate must be excluded; failures: ${resp.content[0].text}`,
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("BUG-3: unitOutputExists treats a 0-byte file as NON-existent", async () => {
	if (!HAS_GIT) return
	const slug = "zero-byte"
	const unit = "unit-01-empty"
	const repo = mkdtempSync(join(tmpdir(), "haiku-zerobyte-"))
	const orig = process.cwd()
	try {
		gitq(repo, "init", "-q", "-b", "main")
		gitq(repo, "config", "user.email", "t@t")
		gitq(repo, "config", "user.name", "t")
		const intentDir = join(repo, ".haiku", "intents", slug)
		mkdirSync(intentDir, { recursive: true })
		writeFileSync(join(intentDir, "empty.md"), "") // 0-byte
		writeFileSync(join(intentDir, "real.md"), "content\n") // non-empty
		process.chdir(repo)
		const { unitOutputExists, _resetIsGitRepoForTests } = await import(
			`${SRC}state-tools.ts`
		)
		_resetIsGitRepoForTests()
		assert.equal(
			unitOutputExists(slug, unit, "empty.md"),
			false,
			"a 0-byte output must read as non-existent (BUG-3)",
		)
		assert.equal(
			unitOutputExists(slug, unit, "real.md"),
			true,
			"a non-empty output must read as present",
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(repo, { recursive: true, force: true })
	}
})
