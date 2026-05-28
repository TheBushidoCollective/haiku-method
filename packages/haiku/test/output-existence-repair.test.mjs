// output-existence-repair.test.mjs
//
// Bug (2026-05-27): a unit declared an output `WorkerDates.test.ts` but the
// real file shipped as `WorkerDates.test.tsx` (it has JSX). The declared
// path was never on disk, yet the intent reached closeout with no gate
// catching it — the SPA surfaced a phantom "declared output isn't on disk"
// and nothing blocked. Root cause: the per-unit terminal-hat existence check
// only validates ONCE at completion, and a whole family of intent-level
// validators was dead since the v4 refactor.
//
// This pins the two-part fix:
//   1. `repairDeclaredOutput` — intelligent near-miss repair: a same-stem
//      sibling differing only in the final extension is the corrected path;
//      ambiguous or absent → null (don't guess).
//   2. `autoRepairOrFileMissingOutputs` — the intent-closeout sweep: rewrites
//      repairable declarations in place, files a deduplicated FB for the
//      rest. Never rewinds.

import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const REPO_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"..",
)
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const { repairDeclaredOutput, readFeedbackFiles } = await import(
	`${SRC}state-tools.ts`
)
const { autoRepairOrFileMissingOutputs } = await import(
	`${SRC}orchestrator/workflow/validate-output-existence-gate.ts`
)

// Each call gets a UNIQUE slug. Every test runs in the SAME process; a fixed
// slug + the engine's cwd-keyed root cache let one test's repaired unit bleed
// into the next (a no-sibling test would read a prior test's `.tsx` unit). A
// per-test slug makes `intentDir(slug)` resolve to exactly this fixture.
let _seedN = 0
function seedIntent(label, { stage = "development", outputs }) {
	const slug = `demo-${label}-${_seedN++}`
	const root = mkdtempSync(join(tmpdir(), `haiku-outrepair-${label}-`))
	execSync("git init -q", { cwd: root })
	execSync("git config user.email t@t && git config user.name t", { cwd: root })
	const intentDir = join(root, ".haiku", "intents", slug)
	mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
	mkdirSync(join(intentDir, "stages", stage, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: slug,
			studio: "software",
			mode: "continuous",
			stages: [stage],
		}),
	)
	writeFileSync(
		join(intentDir, "stages", stage, "units", "unit-01-dates.md"),
		matter.stringify("Spec.\n", {
			title: "dates",
			outputs,
			depends_on: [],
			inputs: [],
		}),
	)
	return { root, intentDir, stage, slug }
}

function writeArtifact(intentDir, stage, relName, body = "x") {
	const p = join(intentDir, "stages", stage, "artifacts", relName)
	mkdirSync(dirname(p), { recursive: true })
	writeFileSync(p, body)
}

function withCwd(root, fn) {
	const orig = process.cwd()
	process.chdir(root)
	try {
		return fn()
	} finally {
		process.chdir(orig)
		rmSync(root, { recursive: true, force: true })
	}
}

const DECLARED = "stages/development/artifacts/WorkerDates.test.ts"

test("repairDeclaredOutput: corrects an extension typo (.test.ts → .test.tsx)", () => {
	const { root, intentDir, stage, slug } = seedIntent("ext-typo", {
		outputs: [DECLARED],
	})
	withCwd(root, () => {
		writeArtifact(intentDir, stage, "WorkerDates.test.tsx", "export {}\n")
		const fixed = repairDeclaredOutput(slug, "unit-01-dates", DECLARED)
		assert.equal(fixed, "stages/development/artifacts/WorkerDates.test.tsx")
	})
})

test("repairDeclaredOutput: returns null when no sibling exists", () => {
	const { root, slug } = seedIntent("no-sibling", { outputs: [DECLARED] })
	withCwd(root, () => {
		assert.equal(repairDeclaredOutput(slug, "unit-01-dates", DECLARED), null)
	})
})

test("repairDeclaredOutput: returns null when the match is ambiguous", () => {
	const { root, intentDir, stage, slug } = seedIntent("ambiguous", {
		outputs: [DECLARED],
	})
	withCwd(root, () => {
		// Two same-stem siblings → don't guess.
		writeArtifact(intentDir, stage, "WorkerDates.test.tsx", "a\n")
		writeArtifact(intentDir, stage, "WorkerDates.test.js", "b\n")
		assert.equal(repairDeclaredOutput(slug, "unit-01-dates", DECLARED), null)
	})
})

test("repairDeclaredOutput: returns null for an extension-less declaration", () => {
	const decl = "stages/development/artifacts/NOTES"
	const { root, intentDir, stage, slug } = seedIntent("no-ext", {
		outputs: [decl],
	})
	withCwd(root, () => {
		writeArtifact(intentDir, stage, "NOTES.md", "n\n")
		assert.equal(repairDeclaredOutput(slug, "unit-01-dates", decl), null)
	})
})

test("closeout sweep: repairs a near-miss in place, files no FB", () => {
	const { root, intentDir, stage, slug } = seedIntent("sweep-repair", {
		outputs: [DECLARED],
	})
	withCwd(root, () => {
		writeArtifact(intentDir, stage, "WorkerDates.test.tsx", "export {}\n")
		const res = autoRepairOrFileMissingOutputs(slug, [stage])
		assert.equal(res.repaired.length, 1, "one declaration repaired")
		assert.equal(res.filed.length, 0, "no FB filed for a repairable typo")
		// The unit FM now points at the real file.
		const fm = matter(
			readFileSync(
				join(intentDir, "stages", stage, "units", "unit-01-dates.md"),
				"utf8",
			),
		).data
		assert.deepEqual(fm.outputs, [
			"stages/development/artifacts/WorkerDates.test.tsx",
		])
	})
})

test("closeout sweep: files a deduplicated FB for an unrepairable missing output", () => {
	const { root, stage, slug } = seedIntent("sweep-fb", { outputs: [DECLARED] })
	withCwd(root, () => {
		// No sibling — unrepairable.
		const first = autoRepairOrFileMissingOutputs(slug, [stage])
		assert.equal(first.repaired.length, 0)
		assert.equal(first.filed.length, 1, "one FB filed")
		const fbs = readFeedbackFiles(slug, stage)
		const mine = fbs.filter(
			(f) =>
				typeof f.source_ref === "string" &&
				f.source_ref.startsWith("missing-output:"),
		)
		assert.equal(mine.length, 1)
		assert.equal(mine[0].severity, "high")
		// Second run dedups — no new FB.
		const second = autoRepairOrFileMissingOutputs(slug, [stage])
		assert.equal(second.filed.length, 0, "dedup: nothing filed on re-run")
		assert.equal(second.skipped.length, 1, "covered by the open FB")
	})
})

test("closeout sweep: a non_actionable-closed FB suppresses re-file (no infinite loop)", () => {
	// The fix loop can close a missing-output FB as `non_actionable` — the
	// output is intentionally absent and accepted. That close sets BOTH
	// `status: non_actionable` and `closed_at`. The dedup must still treat
	// it as covering the ref; otherwise every closeout tick re-files, the
	// fix loop re-closes it non_actionable, and it loops forever.
	const { root, intentDir, stage, slug } = seedIntent("na-dedup", {
		outputs: [DECLARED],
	})
	withCwd(root, () => {
		// readFeedbackFiles requires `NN-slug.md`; status is DERIVED from
		// `resolution` + `closed_at` (the `status:` FM field was dropped in v8).
		writeFileSync(
			join(intentDir, "stages", stage, "feedback", "01-missing-output.md"),
			matter.stringify("body\n", {
				title: "missing output",
				resolution: "non_actionable",
				closed_at: new Date().toISOString(),
				source_ref: `missing-output:unit-01-dates:${DECLARED}`,
				origin: "agent",
			}),
		)
		const res = autoRepairOrFileMissingOutputs(slug, [stage])
		assert.equal(
			res.filed.length,
			0,
			"non_actionable-settled: must not re-file",
		)
		assert.equal(res.skipped.length, 1, "counted as settled/skipped")
	})
})
