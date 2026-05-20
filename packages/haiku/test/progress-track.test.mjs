// progress-track.test.mjs
//
// The granular cursor-action progress track that drives the status-line
// bar. Pins: (1) the ordered milestone list matches the cursor's walk
// (elaborate → per-role review → execute → per-role approval →
// observations); (2) each milestone's done-ness is read from the same
// on-disk stamps the cursor reads; (3) the active step is the first
// not-done one, in cursor order. Autopilot mode is used so the role
// lists are the deterministic engine set (no studio-configured agents,
// no user gate) — review = [spec, continuity, cross-stage-consistency],
// approval = those + quality_gates.
//
// The security stage is used because its terminal hat (`blue-team`) and
// single required discovery artifact (`.haiku/knowledge/THREAT-MODEL.md`)
// are stable. Discovery location resolves against `process.cwd()`, so
// each derivation runs with cwd switched into the fixture repo.

import assert from "node:assert/strict"
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

const AT = "2026-05-19T00:00:00Z"
const STAMP = { at: AT }
const STAGE = "security"
const TERMINAL_HAT = "blue-team" // last in security's hats[]

function seedStage(repo, slug, { units = [], elaboration = null, discovery = true } = {}) {
	const intentDir = join(repo, ".haiku", "intents", slug)
	const stageDir = join(intentDir, "stages", STAGE)
	mkdirSync(join(stageDir, "units"), { recursive: true })
	mkdirSync(join(stageDir, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "track test",
			studio: "software",
			mode: "autopilot",
			stages: [STAGE],
		}),
	)
	if (discovery) {
		// The one REQUIRED discovery artifact for security — resolved
		// against cwd, so it lives at repo/.haiku/knowledge/.
		mkdirSync(join(repo, ".haiku", "knowledge"), { recursive: true })
		writeFileSync(join(repo, ".haiku", "knowledge", "THREAT-MODEL.md"), "tm\n")
	}
	if (elaboration) {
		writeFileSync(join(stageDir, "elaboration.md"), matter.stringify("e\n", elaboration))
	}
	for (const u of units) {
		writeFileSync(
			join(stageDir, "units", `${u.name}.md`),
			matter.stringify("unit\n", u.fm),
		)
	}
	return intentDir
}

async function track(repo, slug) {
	const orig = process.cwd()
	process.chdir(repo)
	try {
		const { deriveProgressTrack } = await import(
			`${SRC}orchestrator/workflow/progress-track.ts`
		)
		return deriveProgressTrack({
			slug,
			studio: "software",
			intentDir: join(repo, ".haiku", "intents", slug),
			intentMode: "autopilot",
		})
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
	}
}

test("track order matches the cursor walk: elaborate → reviews → execute → approvals → observations", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-track-order-"))
	try {
		const slug = "t-order"
		seedStage(repo, slug, {
			elaboration: { verified_at: AT, decompose_verified_at: AT },
			units: [{ name: "unit-01", fm: { title: "u", inputs: [], iterations: [] } }],
		})
		const t = await track(repo, slug)
		const keys = t.steps.map((s) => s.key)
		assert.deepEqual(keys, [
			"elaborate",
			"review:spec",
			"review:continuity",
			"review:cross-stage-consistency",
			"execute",
			"approve:spec",
			"approve:continuity",
			"approve:cross-stage-consistency",
			"approve:quality_gates",
			"observations",
		])
		assert.ok(
			keys.indexOf("review:spec") < keys.indexOf("execute"),
			"pre-execute review must precede execute in the track",
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("fresh stage (no discovery, no units): elaborate is the active step", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-track-fresh-"))
	try {
		const slug = "t-fresh"
		seedStage(repo, slug, { discovery: false })
		const t = await track(repo, slug)
		assert.equal(t.steps[0].key, "elaborate")
		assert.equal(t.steps[0].status, "active")
		assert.equal(t.index, 0)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("units exist, reviews unstamped: first review role is active (not execute)", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-track-review-"))
	try {
		const slug = "t-review"
		seedStage(repo, slug, {
			elaboration: { verified_at: AT, decompose_verified_at: AT },
			units: [{ name: "unit-01", fm: { title: "u", inputs: [], iterations: [] } }],
		})
		const t = await track(repo, slug)
		const active = t.steps[t.index]
		assert.equal(
			active.key,
			"review:spec",
			"with units present but no reviews stamped, spec REVIEW is active — execute must not jump ahead",
		)
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("reviews stamped, hats mid-flight: execute is active", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-track-exec-"))
	try {
		const slug = "t-exec"
		const reviews = {
			spec: STAMP,
			continuity: STAMP,
			"cross-stage-consistency": STAMP,
		}
		seedStage(repo, slug, {
			elaboration: { verified_at: AT, decompose_verified_at: AT },
			units: [
				{
					name: "unit-01",
					fm: {
						title: "u",
						inputs: [],
						started_at: AT,
						reviews,
						// Non-terminal hat advanced; terminal hat still pending.
						iterations: [
							{ hat: "threat-modeler", started_at: AT, completed_at: AT, result: "advance" },
						],
					},
				},
			],
		})
		const t = await track(repo, slug)
		assert.equal(t.steps[t.index].key, "execute")
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})

test("hats done, approvals partial: the missing approval role is active", async () => {
	const repo = mkdtempSync(join(tmpdir(), "haiku-track-approve-"))
	try {
		const slug = "t-approve"
		const reviews = {
			spec: STAMP,
			continuity: STAMP,
			"cross-stage-consistency": STAMP,
		}
		// spec approval signed, continuity missing → approve:continuity active.
		const approvals = { spec: STAMP }
		seedStage(repo, slug, {
			elaboration: { verified_at: AT, decompose_verified_at: AT },
			units: [
				{
					name: "unit-01",
					fm: {
						title: "u",
						inputs: [],
						started_at: AT,
						reviews,
						approvals,
						// Terminal hat reached → execute done.
						iterations: [
							{ hat: "threat-modeler", started_at: AT, completed_at: AT, result: "advance" },
							{ hat: TERMINAL_HAT, started_at: AT, completed_at: AT, result: "advance" },
						],
					},
				},
			],
		})
		const t = await track(repo, slug)
		const active = t.steps[t.index]
		assert.equal(active.key, "approve:continuity")
		assert.equal(t.steps.find((s) => s.key === "execute").status, "done")
		assert.equal(t.steps.find((s) => s.key === "approve:spec").status, "done")
	} finally {
		rmSync(repo, { recursive: true, force: true })
	}
})
