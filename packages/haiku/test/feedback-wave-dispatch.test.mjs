// feedback-wave-dispatch.test.mjs
//
// The cursor's Track B batches every open FB ready for its next fix
// hat into ONE `start_feedback_hat` action, with one dispatch entry
// per FB (potentially different stages, different hats). Dedup rule:
// at most one entry per `targets.unit` — same-target FBs serialize
// across ticks to avoid racing the close hook's
// `applyFeedbackInvalidations` FM write. Intent-scope / null-target
// FBs don't race and batch unconditionally.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")

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

async function withWaveRepo(name, fn) {
	if (!HAS_GIT) return
	const root = mkdtempSync(join(tmpdir(), `fb-wave-${name}-`))
	const orig = process.cwd()
	process.chdir(root)
	try {
		git(root, "init", "-q", "-b", "main")
		git(root, "config", "user.email", "t@t")
		git(root, "config", "user.name", "t")
		git(root, "config", "commit.gpgsign", "false")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		const slug = name
		const intentDir = join(root, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
		mkdirSync(join(intentDir, "stages", "design", "feedback"), {
			recursive: true,
		})
		mkdirSync(join(intentDir, "feedback"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("intent.\n", {
				title: name,
				studio: "software",
				mode: "continuous",
				plugin_version: "9.0.0",
				stages: ["design"],
				approvals: {},
			}),
		)
		// Project-local studio override with a fix_hats sequence we can
		// pin against.
		const studioDir = join(root, ".haiku", "studios", "software")
		const stageDir = join(studioDir, "stages", "design")
		mkdirSync(stageDir, { recursive: true })
		writeFileSync(
			join(studioDir, "STUDIO.md"),
			matter.stringify("Test software studio.\n", {
				name: "software",
				description: "Test software studio",
				stages: ["design"],
			}),
		)
		writeFileSync(
			join(stageDir, "STAGE.md"),
			matter.stringify("Test design stage.\n", {
				name: "design",
				description: "Test design stage",
				hats: ["builder", "verifier"],
				fix_hats: ["classifier", "feedback-assessor"],
				review: "ask",
				elaboration: "collaborative",
				inputs: [],
			}),
		)
		// Hat md stubs so readHatDefs doesn't trip.
		mkdirSync(join(stageDir, "hats"), { recursive: true })
		for (const hat of ["builder", "verifier", "classifier", "feedback-assessor"]) {
			writeFileSync(
				join(stageDir, "hats", `${hat}.md`),
				matter.stringify(`${hat} mandate.\n`, { name: hat }),
			)
		}
		await fn({ root, intentDir, slug })
	} finally {
		process.chdir(orig)
		rmSync(root, { recursive: true, force: true })
	}
}

function writeFb(intentDir, num, opts) {
	const dir = opts.stageScope === null
		? join(intentDir, "feedback")
		: join(intentDir, "stages", opts.stageScope, "feedback")
	const nn = String(num).padStart(3, "0")
	const path = join(dir, `${nn}-${opts.title.toLowerCase().replace(/\s+/g, "-")}.md`)
	writeFileSync(
		path,
		matter.stringify(opts.body ?? "FB body.\n", {
			title: opts.title,
			status: "pending",
			origin: opts.origin ?? "agent",
			author: opts.author ?? "agent",
			author_type: opts.authorType ?? "agent",
			created_at: "2026-05-18T00:00:00Z",
			iteration: 0,
			visit: 0,
			source_ref: null,
			closed_by: null,
			bolt: 0,
			triaged_at: "2026-05-18T00:00:00Z",
			resolution: null,
			replies: [],
			targets: {
				unit: opts.targetUnit ?? null,
				invalidates: opts.targetInvalidates ?? [],
			},
		}),
	)
}

test("wave: 3 FBs on 3 different units batch into 1 action with 3 dispatches", async () => {
	await withWaveRepo("3-units-one-batch", async ({ intentDir, slug }) => {
		writeFb(intentDir, 1, {
			stageScope: "design",
			title: "FB on unit-01",
			targetUnit: "unit-01",
		})
		writeFb(intentDir, 2, {
			stageScope: "design",
			title: "FB on unit-02",
			targetUnit: "unit-02",
		})
		writeFb(intentDir, 3, {
			stageScope: "design",
			title: "FB on unit-03",
			targetUnit: "unit-03",
		})
		const cursor = await import(
			`${SRC}/orchestrator/workflow/cursor.ts`
		)
		const { walkFeedbackTrack } = cursor.__testOnly
		const action = walkFeedbackTrack({
			intentDir,
			studio: "software",
			currentStage: "design",
			intent: { studio: "software", stages: ["design"] },
		})
		assert.ok(action, "expected a Track B action")
		assert.equal(action.kind, "start_feedback_hat")
		assert.equal(
			action.dispatches.length,
			3,
			`expected 3 dispatches in batch; got: ${JSON.stringify(action.dispatches)}`,
		)
		const ids = action.dispatches.map((d) => d.feedback_id).sort()
		assert.deepEqual(ids, ["FB-001", "FB-002", "FB-003"])
		// All three are on stage design with the first fix_hat (classifier).
		for (const d of action.dispatches) {
			assert.equal(d.stage, "design")
			assert.equal(d.hat, "classifier")
		}
		void slug
	})
})

test("wave: 2 FBs on the SAME target unit dedup — only one in this batch", async () => {
	await withWaveRepo("same-unit-dedup", async ({ intentDir, slug }) => {
		writeFb(intentDir, 1, {
			stageScope: "design",
			title: "first FB on unit-01",
			targetUnit: "unit-01",
		})
		writeFb(intentDir, 2, {
			stageScope: "design",
			title: "second FB on unit-01",
			targetUnit: "unit-01",
		})
		writeFb(intentDir, 3, {
			stageScope: "design",
			title: "FB on unit-02",
			targetUnit: "unit-02",
		})
		const cursor = await import(
			`${SRC}/orchestrator/workflow/cursor.ts`
		)
		const { walkFeedbackTrack } = cursor.__testOnly
		const action = walkFeedbackTrack({
			intentDir,
			studio: "software",
			currentStage: "design",
			intent: { studio: "software", stages: ["design"] },
		})
		assert.ok(action, "expected a Track B action")
		assert.equal(action.kind, "start_feedback_hat")
		// FB-001 (unit-01) + FB-003 (unit-02) batch; FB-002 (also unit-01)
		// is held back for the next tick — same target_unit as FB-001.
		assert.equal(
			action.dispatches.length,
			2,
			`expected 2 dispatches (FB-002 dedup'd away); got: ${JSON.stringify(action.dispatches)}`,
		)
		const ids = action.dispatches.map((d) => d.feedback_id).sort()
		assert.deepEqual(ids, ["FB-001", "FB-003"])
		void slug
	})
})

test("wave: two files sharing one FB number dedup to a single dispatch (fixloop-bug-f4dd5a92 Bug 3)", async () => {
	await withWaveRepo("same-id-dedup", async ({ intentDir, slug }) => {
		// Numbering collision: two distinct feedback files both prefixed
		// `001-`. `nextActionForFeedback` derives the same FB-001 id for
		// both, and since both are null-target the target_unit dedup does
		// NOT catch them — the pre-fix walk emitted FB-001 TWICE, spawning
		// two subagents racing on one body. (The original report was
		// intent-scope; stage-scope exercises the same dedup with the
		// fixture's stage-level fix_hats.)
		const dir = join(intentDir, "stages", "design", "feedback")
		for (const title of ["first collision", "second collision"]) {
			const path = join(
				dir,
				`001-${title.replace(/\s+/g, "-")}.md`,
			)
			writeFileSync(
				path,
				matter.stringify("FB body.\n", {
					title,
					status: "pending",
					origin: "adversarial-review",
					author: "agent",
					author_type: "agent",
					created_at: "2026-05-18T00:00:00Z",
					triaged_at: "2026-05-18T00:00:00Z",
					targets: { unit: null, invalidates: [] },
				}),
			)
		}
		const cursor = await import(`${SRC}/orchestrator/workflow/cursor.ts`)
		const { walkFeedbackTrack } = cursor.__testOnly
		const action = walkFeedbackTrack({
			intentDir,
			studio: "software",
			currentStage: "design",
			intent: { studio: "software", stages: ["design"] },
		})
		assert.ok(action, "expected a Track B action")
		assert.equal(action.kind, "start_feedback_hat")
		const fb001Count = action.dispatches.filter(
			(d) => d.feedback_id === "FB-001",
		).length
		assert.equal(
			fb001Count,
			1,
			`FB-001 MUST appear at most once per batch; got ${fb001Count}: ${JSON.stringify(action.dispatches)}`,
		)
		void slug
	})
})

test("wave: intent-scope / null-target FBs batch together unconditionally", async () => {
	await withWaveRepo("null-target-batch", async ({ intentDir, slug }) => {
		// 3 FBs all with null target_unit — no per-unit FM write, no
		// race, all batch in one action.
		for (let i = 1; i <= 3; i++) {
			writeFb(intentDir, i, {
				stageScope: "design",
				title: `null-target FB ${i}`,
				targetUnit: null,
			})
		}
		const cursor = await import(
			`${SRC}/orchestrator/workflow/cursor.ts`
		)
		const { walkFeedbackTrack } = cursor.__testOnly
		const action = walkFeedbackTrack({
			intentDir,
			studio: "software",
			currentStage: "design",
			intent: { studio: "software", stages: ["design"] },
		})
		assert.ok(action, "expected a Track B action")
		assert.equal(action.kind, "start_feedback_hat")
		assert.equal(
			action.dispatches.length,
			3,
			`null-target FBs MUST NOT dedup; got: ${JSON.stringify(action.dispatches)}`,
		)
		void slug
	})
})

test("wave: legacy shadow fields populated from dispatches[0] for back-compat", async () => {
	await withWaveRepo("legacy-shadow-fields", async ({ intentDir, slug }) => {
		writeFb(intentDir, 1, {
			stageScope: "design",
			title: "FB on unit-01",
			targetUnit: "unit-01",
		})
		const cursor = await import(
			`${SRC}/orchestrator/workflow/cursor.ts`
		)
		const { walkFeedbackTrack } = cursor.__testOnly
		const action = walkFeedbackTrack({
			intentDir,
			studio: "software",
			currentStage: "design",
			intent: { studio: "software", stages: ["design"] },
		})
		assert.ok(action)
		// Top-level back-compat fields mirror dispatches[0].
		assert.equal(action.stage, "design")
		assert.equal(action.hat, "classifier")
		assert.deepEqual(action.feedback_ids, ["FB-001"])
		assert.equal(action.terminal, false)
		void slug
	})
})
