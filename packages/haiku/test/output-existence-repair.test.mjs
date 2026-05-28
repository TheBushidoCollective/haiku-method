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
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

const { repairDeclaredOutput, readFeedbackFiles } = await import(
	`${SRC}state-tools.ts`
)
const { autoRepairOrFileMissingOutputs } = await import(
	`${SRC}orchestrator/workflow/validate-output-existence-gate.ts`
)

/** A throwaway git repo with one intent + one stage, cwd set to its root so
 *  the cwd-driven resolvers (`intentDir`, `primaryRepoRoot`) anchor here. */
function seedIntent(label, { stage = "development", outputs }) {
	const root = mkdtempSync(join(tmpdir(), `haiku-outrepair-${label}-`))
	execSync("git init -q", { cwd: root })
	execSync("git config user.email t@t && git config user.name t", { cwd: root })
	const intentDir = join(root, ".haiku", "intents", "demo")
	mkdirSync(join(intentDir, "stages", stage, "units"), { recursive: true })
	mkdirSync(join(intentDir, "stages", stage, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("body\n", {
			title: "demo",
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
	return { root, intentDir, stage }
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
	const { root, intentDir, stage } = seedIntent("ext-typo", {
		outputs: [DECLARED],
	})
	withCwd(root, () => {
		writeArtifact(intentDir, stage, "WorkerDates.test.tsx", "export {}\n")
		const fixed = repairDeclaredOutput("demo", "unit-01-dates", DECLARED)
		assert.equal(fixed, "stages/development/artifacts/WorkerDates.test.tsx")
	})
})

test("repairDeclaredOutput: returns null when no sibling exists", () => {
	const { root } = seedIntent("no-sibling", { outputs: [DECLARED] })
	withCwd(root, () => {
		assert.equal(repairDeclaredOutput("demo", "unit-01-dates", DECLARED), null)
	})
})

test("repairDeclaredOutput: returns null when the match is ambiguous", () => {
	const { root, intentDir, stage } = seedIntent("ambiguous", {
		outputs: [DECLARED],
	})
	withCwd(root, () => {
		// Two same-stem siblings → don't guess.
		writeArtifact(intentDir, stage, "WorkerDates.test.tsx", "a\n")
		writeArtifact(intentDir, stage, "WorkerDates.test.js", "b\n")
		assert.equal(repairDeclaredOutput("demo", "unit-01-dates", DECLARED), null)
	})
})

test("repairDeclaredOutput: returns null for an extension-less declaration", () => {
	const decl = "stages/development/artifacts/NOTES"
	const { root, intentDir, stage } = seedIntent("no-ext", { outputs: [decl] })
	withCwd(root, () => {
		writeArtifact(intentDir, stage, "NOTES.md", "n\n")
		assert.equal(repairDeclaredOutput("demo", "unit-01-dates", decl), null)
	})
})

test("closeout sweep: repairs a near-miss in place, files no FB", () => {
	const { root, intentDir, stage } = seedIntent("sweep-repair", {
		outputs: [DECLARED],
	})
	withCwd(root, () => {
		writeArtifact(intentDir, stage, "WorkerDates.test.tsx", "export {}\n")
		const res = autoRepairOrFileMissingOutputs("demo", "software", [stage])
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
	const { root, stage } = seedIntent("sweep-fb", { outputs: [DECLARED] })
	withCwd(root, () => {
		// No sibling — unrepairable.
		const first = autoRepairOrFileMissingOutputs("demo", "software", [stage])
		assert.equal(first.repaired.length, 0)
		assert.equal(first.filed.length, 1, "one FB filed")
		const fbs = readFeedbackFiles("demo", stage)
		const mine = fbs.filter(
			(f) =>
				typeof f.source_ref === "string" &&
				f.source_ref.startsWith("missing-output:"),
		)
		assert.equal(mine.length, 1)
		assert.equal(mine[0].severity, "high")
		// Second run dedups — no new FB.
		const second = autoRepairOrFileMissingOutputs("demo", "software", [stage])
		assert.equal(second.filed.length, 0, "dedup: nothing filed on re-run")
		assert.equal(second.skipped.length, 1, "covered by the open FB")
	})
})
