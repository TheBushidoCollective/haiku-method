// drift-engine-handle-events.test.mjs
//
// Unit coverage for `engineHandleDriftEvents` — the engine-internal
// drift handler that replaced the agent-facing `drift_detected`
// action in 2026-05-17. The handler must:
//
//   1. Restamp the witness on every affected (unit, role) slot so the
//      same drift signal can never re-fire.
//   2. Dedup FB emission by (file, kind) — collapse per-(unit, role)
//      fan-out into ONE FB whose body lists all affected slots.
//   3. Cross-sweep dedup: when an open drift FB exists for the same
//      (file, kind), don't file a second one.
//   4. Restamp regardless of dedup — even when an FB is already open,
//      a fresh shift must update the witness so the FB's close doesn't
//      leave stale witnesses behind.

import assert from "node:assert/strict"
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
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
	const root = mkdtempSync(join(tmpdir(), `drift-engine-${name}-`))
	const intentDir = join(root, ".haiku", "intents", name)
	mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
	mkdirSync(join(intentDir, "stages", "design", "feedback"), {
		recursive: true,
	})
	mkdirSync(join(intentDir, "stages", "design", "artifacts"), {
		recursive: true,
	})
	mkdirSync(join(intentDir, "feedback"), { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("Intent.\n", {
			title: name,
			studio: "software",
			plugin_version: "9.0.0",
		}),
	)
	// writeFeedbackFile resolves intent location via `findHaikuRoot()`
	// which walks up from cwd. chdir into the temp root so the
	// engine-handler's FB writes land where the test can find them.
	const origCwd = process.cwd()
	process.chdir(root)
	try {
		await fn({ root, intentDir })
	} finally {
		process.chdir(origCwd)
		rmSync(root, { recursive: true, force: true })
	}
}

async function authorUnit({ intentDir, name, inputs, body = "Spec.\n" }) {
	const { buildReviewRecord } = await import(
		`${SRC}/orchestrator/workflow/sign-slot.ts`
	)
	const unitPath = join(intentDir, "stages", "design", "units", `${name}.md`)
	writeFileSync(
		unitPath,
		matter.stringify(body, {
			title: name,
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
	// Sign 3 roles — spec, completeness, accessibility — so the
	// fan-out matches the real-world drift scenario where one file
	// change touches multiple witnessed roles.
	const reviews = { spec: signed, completeness: signed, accessibility: signed }
	const fm = matter(readFileSync(unitPath, "utf8"))
	writeFileSync(
		unitPath,
		matter.stringify(fm.content, { ...fm.data, reviews }),
	)
	return unitPath
}

function listFbs(intentDir, stage) {
	const dir = join(intentDir, "stages", stage, "feedback")
	return readdirSync(dir).filter((f) => f.endsWith(".md"))
}

test("engine handler: same (file, kind) across 5 roles → 1 FB, witness restamped on every slot", async () => {
	await withTempIntent("dedup-multi-role", async ({ intentDir }) => {
		const { engineHandleDriftEvents } = await import(
			`${SRC}/orchestrator/workflow/drift-handle-events.ts`
		)
		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const artifactPath = join(
			intentDir,
			"stages",
			"design",
			"artifacts",
			"TOKENS.md",
		)
		writeFileSync(
			artifactPath,
			matter.stringify("v1.\n", { title: "tokens" }),
		)
		await authorUnit({
			intentDir,
			name: "unit-01",
			inputs: ["stages/design/artifacts/TOKENS.md"],
		})

		// Mutate the witnessed artifact (real drift).
		writeFileSync(
			artifactPath,
			matter.stringify("v2.\n", { title: "tokens" }),
		)

		const sweep = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
		})
		// 3 roles each witnessed the same file → 3 events expected.
		assert.equal(sweep.events.length, 3, "expected 3 sweep events (one per role)")

		const summary = engineHandleDriftEvents({
			events: sweep.events,
			intentDir,
			stage: "design",
			slug: "dedup-multi-role",
		})
		assert.equal(summary.groups_total, 1, "3 events on same (file, kind) MUST dedup to 1 group")
		assert.equal(summary.fbs_filed, 1, "exactly 1 FB filed")
		assert.equal(summary.slots_restamped, 3, "every affected slot restamped")
		assert.equal(summary.fbs_dedup_skipped, 0)

		const fbs = listFbs(intentDir, "design")
		assert.equal(fbs.length, 1, "exactly 1 FB on disk")

		// Subsequent sweep must find ZERO events — witnesses restamped.
		const sweep2 = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
		})
		assert.equal(
			sweep2.events.length,
			0,
			`drift MUST NOT re-fire after engine handler restamped witnesses; got: ${JSON.stringify(sweep2.events)}`,
		)
	})
})

test("engine handler: cross-sweep dedup — open FB for (file, kind) suppresses new FB on next tick", async () => {
	await withTempIntent("dedup-cross-sweep", async ({ intentDir }) => {
		const { engineHandleDriftEvents } = await import(
			`${SRC}/orchestrator/workflow/drift-handle-events.ts`
		)
		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const artifactPath = join(
			intentDir,
			"stages",
			"design",
			"artifacts",
			"TOKENS.md",
		)
		writeFileSync(
			artifactPath,
			matter.stringify("v1.\n", { title: "tokens" }),
		)
		await authorUnit({
			intentDir,
			name: "unit-01",
			inputs: ["stages/design/artifacts/TOKENS.md"],
		})

		// Tick 1: file changes once. Engine emits 1 FB, restamps to SHA2.
		writeFileSync(
			artifactPath,
			matter.stringify("v2.\n", { title: "tokens" }),
		)
		const s1 = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
		})
		engineHandleDriftEvents({
			events: s1.events,
			intentDir,
			stage: "design",
			slug: "dedup-cross-sweep",
		})
		assert.equal(listFbs(intentDir, "design").length, 1, "after tick 1, 1 FB on disk")

		// Tick 2: file changes AGAIN before the FB is closed. Engine
		// must restamp witness to SHA3 but NOT file a second FB —
		// existing open FB matches on (file, kind).
		writeFileSync(
			artifactPath,
			matter.stringify("v3.\n", { title: "tokens" }),
		)
		const s2 = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
		})
		// All 3 roles still drift (witnesses were restamped to SHA2 in
		// tick 1, now current is SHA3).
		assert.equal(s2.events.length, 3, "3 events on second shift")
		const summary2 = engineHandleDriftEvents({
			events: s2.events,
			intentDir,
			stage: "design",
			slug: "dedup-cross-sweep",
		})
		assert.equal(summary2.fbs_filed, 0, "open FB exists → no new FB")
		assert.equal(summary2.fbs_dedup_skipped, 1, "dedup must skip this group")
		assert.equal(summary2.slots_restamped, 3, "restamp runs unconditionally")
		assert.equal(listFbs(intentDir, "design").length, 1, "still 1 FB on disk")

		// Tick 3: no further mutations. Witnesses == current (SHA3),
		// sweep finds nothing.
		const s3 = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
		})
		assert.equal(
			s3.events.length,
			0,
			`tick 3 (witnesses match current after restamp): expected 0 events; got: ${JSON.stringify(s3.events)}`,
		)
	})
})

test("engine handler: emitted FB carries origin=drift, author=engine, default targets.invalidates=[]", async () => {
	await withTempIntent("fb-shape", async ({ intentDir }) => {
		const { engineHandleDriftEvents } = await import(
			`${SRC}/orchestrator/workflow/drift-handle-events.ts`
		)
		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const artifactPath = join(
			intentDir,
			"stages",
			"design",
			"artifacts",
			"TOKENS.md",
		)
		writeFileSync(
			artifactPath,
			matter.stringify("v1.\n", { title: "tokens" }),
		)
		await authorUnit({
			intentDir,
			name: "unit-01",
			inputs: ["stages/design/artifacts/TOKENS.md"],
		})
		writeFileSync(
			artifactPath,
			matter.stringify("v2.\n", { title: "tokens" }),
		)
		const sweep = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
		})
		engineHandleDriftEvents({
			events: sweep.events,
			intentDir,
			stage: "design",
			slug: "fb-shape",
		})
		const fbs = listFbs(intentDir, "design")
		assert.equal(fbs.length, 1)
		const fbPath = join(intentDir, "stages", "design", "feedback", fbs[0])
		const fm = matter(readFileSync(fbPath, "utf8")).data
		assert.equal(fm.origin, "drift")
		assert.equal(fm.author, "engine")
		assert.equal(fm.author_type, "system")
		assert.ok(
			/^drift:input_mutation:.+:[0-9a-f]{64}$/.test(fm.source_ref),
			`source_ref must be drift:<kind>:<file>:<sha>; got: ${fm.source_ref}`,
		)
		assert.deepEqual(
			fm.targets.invalidates,
			[],
			"engine-emitted drift FBs default to empty invalidates (cosmetic-by-default)",
		)
		assert.ok(
			typeof fm.triaged_at === "string" && fm.triaged_at.length > 0,
			"engine-emitted FBs auto-triage",
		)
	})
})
