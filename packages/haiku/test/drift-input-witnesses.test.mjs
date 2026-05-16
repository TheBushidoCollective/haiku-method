// drift-input-witnesses.test.mjs — Coverage for the v9 premise-witness model.
//
// Validates the four behaviors that distinguish v9 drift from prior versions:
//   1. input_mutation fires when a witnessed input file's SHA changes
//   2. input_addition fires when a new file appears inside a witnessed dir
//   3. input_deletion fires when a witnessed input is removed
//   4. cosmetic-close re-stamps the input_witness so the next sweep is clean

import assert from "node:assert/strict"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
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

async function withTempIntent(name, fn) {
	const root = mkdtempSync(join(tmpdir(), `drift-input-${name}-`))
	const intentDir = join(root, ".haiku", "intents", name)
	mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
	mkdirSync(join(intentDir, "stages", "design", "feedback"), {
		recursive: true,
	})
	mkdirSync(join(intentDir, "knowledge"), { recursive: true })
	// Seed an intent.md so the implicit witness has something to hash.
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

async function signUnitWithInputs({
	intentDir,
	unitName,
	inputs,
	body = "Spec body.\n",
}) {
	const { buildReviewRecord } = await import(
		`${SRC}/orchestrator/workflow/sign-slot.ts`
	)
	const unitPath = join(intentDir, "stages", "design", "units", `${unitName}.md`)
	writeFileSync(
		unitPath,
		matter.stringify(body, {
			title: unitName,
			started_at: "2026-05-01T00:00:00Z",
			inputs,
			iterations: [
				{
					hat: "verifier",
					started_at: "2026-05-01T00:00:00Z",
					completed_at: "2026-05-01T00:00:00Z",
					result: "advance",
				},
			],
			reviews: {},
			approvals: {},
			discovery: {},
		}),
	)
	const signed = buildReviewRecord(unitPath, { intentDir, unitInputs: inputs })
	const fm = matter(readFileSync(unitPath, "utf8"))
	writeFileSync(
		unitPath,
		matter.stringify(fm.content, {
			...fm.data,
			reviews: { spec: signed },
		}),
	)
	return unitPath
}

test("input_mutation: witnessed input file SHA changes → drift fires on consumer", async () => {
	await withTempIntent("input-mutation", async ({ intentDir }) => {
		const knowledgePath = join(intentDir, "knowledge", "DISCOVERY.md")
		writeFileSync(
			knowledgePath,
			matter.stringify("Original discovery content.\n", {
				title: "discovery",
			}),
		)
		await signUnitWithInputs({
			intentDir,
			unitName: "unit-01",
			inputs: ["knowledge/DISCOVERY.md"],
		})

		// Mutate the witnessed input.
		writeFileSync(
			knowledgePath,
			matter.stringify("UPDATED discovery content.\n", {
				title: "discovery",
			}),
		)

		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: join(intentDir, "..", "..", ".."),
		})
		const events = result.events.filter((e) => e.kind === "input_mutation")
		assert.ok(
			events.length >= 1,
			`expected input_mutation drift; got ${JSON.stringify(result.events)}`,
		)
		assert.strictEqual(events[0].file, "knowledge/DISCOVERY.md")
		assert.strictEqual(events[0].unit, "unit-01")
		assert.strictEqual(events[0].role, "spec")
	})
})

test("input_addition: new file appears inside a witnessed dir → drift fires", async () => {
	await withTempIntent("input-addition", async ({ intentDir }) => {
		const discoveryDir = join(
			intentDir,
			"stages",
			"research",
			"discovery",
		)
		mkdirSync(discoveryDir, { recursive: true })
		writeFileSync(
			join(discoveryDir, "personas.md"),
			matter.stringify("Personas.\n", { title: "personas" }),
		)
		// Unit witnesses the discovery dir.
		await signUnitWithInputs({
			intentDir,
			unitName: "unit-02",
			inputs: ["stages/research/discovery/"],
		})

		// New file appears in the witnessed dir.
		writeFileSync(
			join(discoveryDir, "competitors.md"),
			matter.stringify("New competitor analysis.\n", { title: "competitors" }),
		)

		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: join(intentDir, "..", "..", ".."),
		})
		const events = result.events.filter((e) => e.kind === "input_addition")
		assert.ok(
			events.length >= 1,
			`expected input_addition drift; got ${JSON.stringify(result.events)}`,
		)
		assert.ok(
			events[0].file.endsWith("competitors.md"),
			`expected file path to reference the new file; got ${events[0].file}`,
		)
	})
})

test("input_deletion: witnessed input file removed → drift fires", async () => {
	await withTempIntent("input-deletion", async ({ intentDir }) => {
		const knowledgePath = join(intentDir, "knowledge", "PERSONAS.md")
		writeFileSync(
			knowledgePath,
			matter.stringify("Personas content.\n", { title: "personas" }),
		)
		await signUnitWithInputs({
			intentDir,
			unitName: "unit-03",
			inputs: ["knowledge/PERSONAS.md"],
		})

		// Delete the witnessed input.
		rmSync(knowledgePath, { force: true })

		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: join(intentDir, "..", "..", ".."),
		})
		const events = result.events.filter((e) => e.kind === "input_deletion")
		assert.ok(
			events.length >= 1,
			`expected input_deletion drift; got ${JSON.stringify(result.events)}`,
		)
		assert.strictEqual(events[0].file, "knowledge/PERSONAS.md")
	})
})

test("cosmetic close re-stamps the witness — next sweep is clean", async () => {
	await withTempIntent("cosmetic-close", async ({ intentDir }) => {
		const knowledgePath = join(intentDir, "knowledge", "DISCOVERY.md")
		writeFileSync(
			knowledgePath,
			matter.stringify("Original.\n", { title: "discovery" }),
		)
		const unitPath = await signUnitWithInputs({
			intentDir,
			unitName: "unit-04",
			inputs: ["knowledge/DISCOVERY.md"],
		})

		// Mutate the input — drift now fires.
		writeFileSync(
			knowledgePath,
			matter.stringify("UPDATED.\n", { title: "discovery" }),
		)

		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		let result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: join(intentDir, "..", "..", ".."),
		})
		assert.ok(
			result.events.some((e) => e.kind === "input_mutation"),
			"sanity: pre-close sweep must fire input_mutation drift",
		)

		// Simulate cosmetic close: rebuild every signed review's witness
		// against current state (this is what the FB close hook does for
		// drift-origin FBs — see feedback-close-hook.ts).
		const { buildReviewRecord } = await import(
			`${SRC}/orchestrator/workflow/sign-slot.ts`
		)
		const fm = matter(readFileSync(unitPath, "utf8"))
		const data = fm.data
		const reviews = data.reviews
		const unitInputs = data.inputs
		for (const role of Object.keys(reviews)) {
			reviews[role] = buildReviewRecord(unitPath, {
				intentDir,
				unitInputs,
			})
		}
		writeFileSync(
			unitPath,
			matter.stringify(fm.content, { ...data, reviews }),
		)

		// Next sweep: witness now matches current state → no drift.
		result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: join(intentDir, "..", "..", ".."),
		})
		assert.strictEqual(
			result.events.length,
			0,
			`cosmetic-close re-stamp must clear drift; got: ${JSON.stringify(result.events)}`,
		)
	})
})

test("intent.md is an IMPLICIT witnessed input on every unit review", async () => {
	await withTempIntent("implicit-intent", async ({ intentDir }) => {
		// Unit declares no inputs — but intent.md should still be witnessed.
		await signUnitWithInputs({
			intentDir,
			unitName: "unit-05",
			inputs: [],
		})

		// Mutate intent.md body.
		const intentPath = join(intentDir, "intent.md")
		const fm = matter(readFileSync(intentPath, "utf8"))
		writeFileSync(
			intentPath,
			matter.stringify("UPDATED intent body.\n", fm.data),
		)

		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: join(intentDir, "..", "..", ".."),
		})
		const events = result.events.filter(
			(e) => e.kind === "input_mutation" && e.file === "intent.md",
		)
		assert.ok(
			events.length >= 1,
			`expected drift on implicit intent.md witness; got: ${JSON.stringify(result.events)}`,
		)
	})
})
