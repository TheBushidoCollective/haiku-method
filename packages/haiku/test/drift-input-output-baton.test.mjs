// drift-input-output-baton.test.mjs
//
// A file the CURRENT stage produces (a discovery/output `location:` or a
// unit `outputs:` entry) must NOT fire `input_mutation` drift when it's
// also witnessed as an input — it's the loop's own output evolving, not
// external/upstream drift. Regression for the 2026-05-20
// drift-input-output-loop report: the design stage's `designer-prep` hats
// append per-unit sections to `knowledge/DESIGN-SYSTEM-ANCHOR.md` and
// `knowledge/DESIGN-TOKENS.md` (both design discovery `location:` files),
// which are ALSO drift-witnessed inputs for the pre-execute review slots.
// Every append changed the whole-file hash and re-fired drift against
// every witnessing slot — an input==output cycle that never converges
// (six findings on two files, one misclassified as a "material deletion"
// against a pure 393-insertion append).
//
// Control: a NON-produced upstream input that mutates must still fire
// drift (external mutation is real drift).

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
process.env.CLAUDE_PLUGIN_ROOT = join(HERE, "..", "..", "..", "plugin")

async function withIntent(name, fn) {
	const root = mkdtempSync(join(tmpdir(), `drift-baton-${name}-`))
	const intentDir = join(root, ".haiku", "intents", name)
	mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
	mkdirSync(join(intentDir, "knowledge"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("Intent body.\n", {
			title: "x",
			studio: "software",
			mode: "continuous",
			plugin_version: "9.0.0",
		}),
	)
	try {
		await fn({ root, intentDir })
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
}

async function signUnitWithInput(intentDir, unitName, inputRel) {
	const { buildReviewRecord } = await import(
		`${SRC}/orchestrator/workflow/sign-slot.ts`
	)
	const unitPath = join(intentDir, "stages", "design", "units", `${unitName}.md`)
	writeFileSync(
		unitPath,
		matter.stringify("Spec body.\n", {
			title: unitName,
			started_at: "2026-05-01T00:00:00Z",
			inputs: [inputRel],
			iterations: [
				{ hat: "verifier", started_at: "2026-05-01T00:00:00Z", completed_at: "2026-05-01T00:00:00Z", result: "advance" },
			],
			reviews: {},
			approvals: {},
			discovery: {},
		}),
	)
	const signed = buildReviewRecord(unitPath, { intentDir, unitInputs: [inputRel] })
	const fm = matter(readFileSync(unitPath, "utf8"))
	writeFileSync(
		unitPath,
		matter.stringify(fm.content, { ...fm.data, reviews: { spec: signed } }),
	)
	return unitPath
}

async function sweep(intentDir) {
	const { runDriftSweep } = await import(`${SRC}/orchestrator/workflow/drift-sweep.ts`)
	return runDriftSweep({
		intentDir,
		stage: "design",
		studio: "software",
		repoRoot: join(intentDir, "..", "..", ".."),
	})
}

test("stage-produced baton (design discovery location) does NOT fire input_mutation when appended in-loop", async () => {
	await withIntent("baton", async ({ intentDir }) => {
		// DESIGN-SYSTEM-ANCHOR.md is a design-stage discovery `location:`
		// (knowledge/DESIGN-SYSTEM-ANCHOR.md) AND a witnessed input.
		const baton = join(intentDir, "knowledge", "DESIGN-SYSTEM-ANCHOR.md")
		writeFileSync(baton, matter.stringify("# Anchor\n\n## Section 1\n", { title: "anchor" }))
		await signUnitWithInput(intentDir, "unit-01", "knowledge/DESIGN-SYSTEM-ANCHOR.md")

		// A designer-prep hat appends Section 2 (additive, in-loop write).
		writeFileSync(
			baton,
			matter.stringify("# Anchor\n\n## Section 1\n\n## Section 2 (appended by designer-prep unit-02)\n", { title: "anchor" }),
		)

		const result = await sweep(intentDir)
		const mut = result.events.filter(
			(e) => e.kind === "input_mutation" && e.file === "knowledge/DESIGN-SYSTEM-ANCHOR.md",
		)
		assert.equal(
			mut.length,
			0,
			`a stage-produced baton must NOT fire input_mutation on an in-loop append; got: ${JSON.stringify(result.events)}`,
		)
	})
})

test("non-produced upstream input STILL fires input_mutation (external drift is real)", async () => {
	await withIntent("upstream", async ({ intentDir }) => {
		// Not a design discovery location and not a unit output → external.
		const upstream = join(intentDir, "knowledge", "UPSTREAM-CONTRACT.md")
		writeFileSync(upstream, matter.stringify("Original contract.\n", { title: "c" }))
		await signUnitWithInput(intentDir, "unit-01", "knowledge/UPSTREAM-CONTRACT.md")

		writeFileSync(upstream, matter.stringify("MUTATED contract.\n", { title: "c" }))

		const result = await sweep(intentDir)
		const mut = result.events.filter(
			(e) => e.kind === "input_mutation" && e.file === "knowledge/UPSTREAM-CONTRACT.md",
		)
		assert.ok(
			mut.length >= 1,
			`external input mutation must still fire drift; got: ${JSON.stringify(result.events)}`,
		)
	})
})

test("unit-output baton (declared in outputs:) is also exempt from input_mutation", async () => {
	await withIntent("unit-out", async ({ intentDir }) => {
		const shared = join(intentDir, "knowledge", "SHARED-BATON.md")
		writeFileSync(shared, matter.stringify("v1\n", { title: "s" }))
		// unit-02 declares the shared file as an OUTPUT.
		const u2 = join(intentDir, "stages", "design", "units", "unit-02.md")
		writeFileSync(
			u2,
			matter.stringify("Spec.\n", {
				title: "unit-02",
				started_at: "2026-05-01T00:00:00Z",
				inputs: [],
				outputs: ["knowledge/SHARED-BATON.md"],
				iterations: [{ hat: "verifier", started_at: "2026-05-01T00:00:00Z", completed_at: "2026-05-01T00:00:00Z", result: "advance" }],
				reviews: {},
				approvals: {},
				discovery: {},
			}),
		)
		// unit-01 witnesses it as input.
		await signUnitWithInput(intentDir, "unit-01", "knowledge/SHARED-BATON.md")
		// unit-02 writes it (in-loop output).
		writeFileSync(shared, matter.stringify("v1\nv2 appended\n", { title: "s" }))

		const result = await sweep(intentDir)
		const mut = result.events.filter(
			(e) => e.kind === "input_mutation" && e.file === "knowledge/SHARED-BATON.md",
		)
		assert.equal(mut.length, 0, `a unit-output baton must NOT fire input_mutation; got: ${JSON.stringify(result.events)}`)
	})
})
