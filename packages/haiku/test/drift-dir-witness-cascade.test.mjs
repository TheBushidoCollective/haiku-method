// drift-dir-witness-cascade.test.mjs
//
// Regression for the 2026-05-18 "drift loop" bug's actual root cause:
// when a directory witness's path doesn't resolve at sweep time, the
// pre-fix sweep emitted `input_deletion` for EVERY file in the stored
// inventory — N false-positive events per missing-dir witness, which
// produced N drift FBs per tick that the fix loop closed cosmetically
// only to see N+δ new ones the next tick.
//
// The bundle's evidence (haiku-drift-loop-bug): ~6 new drift FBs per
// tick across 13 ticks, FB numbers ratcheting upward, all closed as
// "file exists on disk — cosmetic drift from v8→v9 migration." Each
// of those 6 FBs was one file inside ONE missing-dir witness whose
// path got mangled in the migration.
//
// The fix: when the dir doesn't resolve, emit ONE `input_deletion`
// for the dir itself, not N for its contents. The engine handler's
// restamp then drops the dir from the witnesses (via
// `buildReviewRecord` → `resolveInputWitnesses` → skip-on-miss) and
// the next sweep is clean.

import assert from "node:assert/strict"
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const SRC = new URL("../src/", import.meta.url).pathname

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

/** Build a tmp intent + stage + unit with a unit that witnesses a
 *  NON-EXISTENT directory in its `reviews.spec.input_witnesses.dirs`.
 *  Simulates the v8→v9 migration state where the dir path is stale. */
function seedIntentWithStaleDirWitness({
	tmp,
	slug,
	stage,
	unit,
	missingDir,
	inventoryFiles,
}) {
	const intentDir = join(tmp, ".haiku", "intents", slug)
	const unitsDir = join(intentDir, "stages", stage, "units")
	mkdirSync(unitsDir, { recursive: true })
	writeFileSync(join(intentDir, "intent.md"), "---\nstudio: software\n---\nbody\n")
	// SHA-256 values must be exactly 64 hex chars or pickInputWitnesses
	// filters them out (legacy / malformed witness guard). Synthesize
	// shape-valid hashes that wouldn't match a real on-disk file.
	const fakeSha = (f) => `${"a".repeat(63)}${f.length % 10}`
	const inventoryYaml = inventoryFiles
		.map((f) => `          ${f}: '${fakeSha(f)}'`)
		.join("\n")
	writeFileSync(
		join(unitsDir, `${unit}.md`),
		[
			"---",
			"inputs: []",
			"started_at: '2026-05-18T14:00:00Z'",
			"reviews:",
			"  spec:",
			"    at: '2026-05-18T15:00:00Z'",
			"    body_sha256: 'unitbodysha'",
			"    input_witnesses:",
			"      files: {}",
			"      dirs:",
			`        ${missingDir}:`,
			inventoryYaml,
			"---",
			"body",
			"",
		].join("\n"),
	)
	return intentDir
}

test("missing dir witness emits ONE deletion event, not N (was the cascade root cause)", async () => {
	const { runDriftSweep } = await import(
		`${SRC}orchestrator/workflow/drift-sweep.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-drift-dir-"))
	try {
		const intentDir = seedIntentWithStaleDirWitness({
			tmp,
			slug: "demo",
			stage: "design",
			unit: "unit-01",
			missingDir: "stages/design/artifacts",
			inventoryFiles: [
				"00-DESIGN-DIRECTION.md",
				"SEMANTIC-TOKENS.md",
				"01-app-shell-spec.md",
				"02-layout-spec.md",
				"03-tokens-spec.md",
				"04-components-spec.md",
			],
		})
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
		})
		const deletionEvents = result.events.filter(
			(e) => e.kind === "input_deletion",
		)
		assert.equal(
			deletionEvents.length,
			1,
			`missing dir witness MUST emit exactly ONE input_deletion event ` +
				`(was ${deletionEvents.length} pre-fix — one per inventory file). ` +
				`events: ${JSON.stringify(deletionEvents.map((e) => e.file))}`,
		)
		assert.equal(
			deletionEvents[0].file,
			"stages/design/artifacts",
			"the single event must reference the dir itself, not a file inside",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("existing dir with missing file inside still emits per-file deletion (control)", async () => {
	// The dir EXISTS; one of the inventory files is missing. Expected:
	// one deletion event for the missing file, not for the dir.
	const { runDriftSweep } = await import(
		`${SRC}orchestrator/workflow/drift-sweep.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-drift-dir-"))
	try {
		const intentDir = seedIntentWithStaleDirWitness({
			tmp,
			slug: "demo",
			stage: "design",
			unit: "unit-01",
			missingDir: "stages/design/artifacts",
			inventoryFiles: ["existing.md", "missing.md"],
		})
		// Create the dir + one of the two files. The other (`missing.md`)
		// is missing. Expected: ONE deletion for missing.md (per-file),
		// not one for the dir.
		const dirAbs = join(intentDir, "stages", "design", "artifacts")
		mkdirSync(dirAbs, { recursive: true })
		writeFileSync(join(dirAbs, "existing.md"), "body")

		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
		})
		const deletionEvents = result.events.filter(
			(e) => e.kind === "input_deletion",
		)
		assert.equal(
			deletionEvents.length,
			1,
			`expected one per-file deletion event; got ${deletionEvents.length}: ` +
				`${JSON.stringify(deletionEvents.map((e) => e.file))}`,
		)
		assert.equal(
			deletionEvents[0].file,
			"stages/design/artifacts/missing.md",
			"event must name the missing file path, not the dir",
		)
	} finally {
		rmSync(tmp, { recursive: true, force: true })
	}
})
