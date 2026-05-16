// drift-self-clear-on-open-fb.test.mjs — Bug #29 coverage.
//
// Scenario: drift is detected on a file, the agent files an FB about
// it, but the FB's `source_ref` doesn't exactly match the
// `drift:<kind>:<file>` shape the dedup index expects. Without the
// path-based fallback, the cursor keeps emitting `drift_detected` on
// every tick even though the agent has already responded — observed in
// production 2026-05-12 on `SEMANTIC-TOKENS.md` (12 consecutive ticks).
//
// Pinned behavior:
//   1. Exact source_ref match still suppresses (fast path).
//   2. Source_ref with wrong KIND but right FILE suppresses (path
//      fallback).
//   3. Source_ref missing entirely but FB body mentions the file
//      basename suppresses (body fallback).
//   4. Closed FB does NOT suppress — drift can re-arm after close.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
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

async function withRepo(slug, fn) {
	const root = mkdtempSync(join(tmpdir(), "drift-self-clear-"))
	const orig = process.cwd()
	process.chdir(root)
	try {
		git(root, "init", "-q", "-b", "main")
		git(root, "config", "user.email", "t@t")
		git(root, "config", "user.name", "t")
		git(root, "config", "commit.gpgsign", "false")
		git(root, "commit", "--allow-empty", "-q", "-m", "init")
		const intentDir = join(root, ".haiku", "intents", slug)
		mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
		mkdirSync(join(intentDir, "stages", "design", "feedback"), {
			recursive: true,
		})
		mkdirSync(join(intentDir, "stages", "design", "artifacts"), {
			recursive: true,
		})
		await fn({ root, intentDir, slug })
	} finally {
		process.chdir(orig)
		rmSync(root, { recursive: true, force: true })
	}
}

/** Build a unit with a signed review that witnesses the unit body.
 *  Then mutate the body out-of-band to trip spec drift. Returns the
 *  (unit, fileRel) pair so callers can reference the drifted file in
 *  their source_ref / body assertions.
 *
 *  Premise-witness model: output mutation isn't drift. The dedup
 *  behavior we're testing here lives on spec drift (and equivalently
 *  on input_mutation / input_addition / input_deletion). Using spec
 *  drift keeps the dedup test surface narrow and self-contained — no
 *  need for cross-unit input wiring. */
async function seedUnitWithDriftedSpec({ intentDir, root, unitBasename }) {
	const { buildReviewRecord } = await import(
		`${SRC}/orchestrator/workflow/sign-slot.ts`
	)
	// Seed an intent.md so tools that resolve the intent dir find it.
	const intentMdPath = join(intentDir, "intent.md")
	writeFileSync(
		intentMdPath,
		matter.stringify("# x\n", {
			title: "x",
			studio: "software",
			mode: "continuous",
			plugin_version: "4.0.0",
		}),
	)
	const unitPath = join(
		intentDir,
		"stages",
		"design",
		"units",
		`${unitBasename}.md`,
	)
	// Write initial unit body + frontmatter.
	writeFileSync(
		unitPath,
		matter.stringify("# u1\n\nInitial spec body content.\n", {
			title: "u1",
			started_at: "2026-05-01T00:00:00Z",
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
	// Sign the review witnessing the current body.
	const signed = buildReviewRecord(unitPath)
	const currentFm = matter(readFileSync(unitPath, "utf8"))
	writeFileSync(
		unitPath,
		matter.stringify(currentFm.content, {
			...currentFm.data,
			reviews: { spec: signed },
		}),
	)
	git(root, "add", "-A")
	git(root, "commit", "-q", "-m", "seed: unit + signed review")
	// Now drift the unit body. Sweep should detect spec drift.
	const reloaded = matter(readFileSync(unitPath, "utf8"))
	writeFileSync(
		unitPath,
		matter.stringify(
			"# u1\n\nDRIFTED body content (out-of-band edit).\n",
			reloaded.data,
		),
	)
	git(root, "add", "-A")
	git(root, "commit", "-q", "-m", "drift: out-of-band body edit")
	const fileRel = `stages/design/units/${unitBasename}.md`
	return { unitPath, fileRel }
}

test("drift sweep emits drift_detected when no FB filed", async () => {
	if (!HAS_GIT) return
	await withRepo("baseline", async ({ root, intentDir }) => {
		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		await seedUnitWithDriftedSpec({
			intentDir,
			root,
			unitBasename: "unit-01",
		})
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: root,
		})
		assert.equal(
			result.events.length,
			1,
			`expected one drift event, got ${JSON.stringify(result.events)}`,
		)
		assert.equal(result.events[0].kind, "spec")
	})
})

test("drift sweep suppresses re-emission when FB has matching source_ref (exact)", async () => {
	if (!HAS_GIT) return
	await withRepo("exact-match", async ({ root, intentDir }) => {
		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const { fileRel } = await seedUnitWithDriftedSpec({
			intentDir,
			root,
			unitBasename: "unit-01",
		})
		// File an FB with the canonical source_ref shape.
		const fbPath = join(
			intentDir,
			"stages",
			"design",
			"feedback",
			"01-drift.md",
		)
		writeFileSync(
			fbPath,
			matter.stringify("Out-of-band edit on the design tokens.\n", {
				title: "drift on SEMANTIC-TOKENS",
				origin: "drift",
				author: "drift-sweep",
				author_type: "agent",
				created_at: "2026-05-12T00:00:00Z",
				source_ref: `drift:spec:${fileRel}`,
				closed_at: null,
				iterations: [],
			}),
		)
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: root,
		})
		assert.equal(
			result.events.length,
			0,
			`expected dedup to suppress drift, got events: ${JSON.stringify(result.events)}`,
		)
	})
})

test("drift sweep suppresses re-emission when FB source_ref has wrong KIND but right file (path fallback)", async () => {
	if (!HAS_GIT) return
	await withRepo("wrong-kind", async ({ root, intentDir }) => {
		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const { fileRel } = await seedUnitWithDriftedSpec({
			intentDir,
			root,
			unitBasename: "unit-01",
		})
		// File an FB with the WRONG kind classification — the agent
		// guessed "spec" but the drift was on an "output". The path
		// fallback should still suppress.
		const fbPath = join(
			intentDir,
			"stages",
			"design",
			"feedback",
			"01-drift.md",
		)
		writeFileSync(
			fbPath,
			matter.stringify("Out-of-band edit.\n", {
				title: "drift on SEMANTIC-TOKENS",
				origin: "drift",
				author: "drift-sweep",
				author_type: "agent",
				created_at: "2026-05-12T00:00:00Z",
				source_ref: `drift:input_mutation:${fileRel}`, // WRONG KIND (but path matches)
				closed_at: null,
				iterations: [],
			}),
		)
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: root,
		})
		assert.equal(
			result.events.length,
			0,
			`path-based dedup must suppress drift even when kind mismatches, got events: ${JSON.stringify(result.events)}`,
		)
	})
})

test("drift sweep suppresses re-emission when FB body mentions the file basename (body fallback)", async () => {
	if (!HAS_GIT) return
	await withRepo("body-mention", async ({ root, intentDir }) => {
		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		await seedUnitWithDriftedSpec({
			intentDir,
			root,
			unitBasename: "unit-01",
		})
		// File an FB with NO source_ref but body mentions the file.
		const fbPath = join(
			intentDir,
			"stages",
			"design",
			"feedback",
			"01-drift.md",
		)
		writeFileSync(
			fbPath,
			matter.stringify(
				"The agent edited unit-01.md out-of-band; we should review.\n",
				{
					title: "drift",
					origin: "drift",
					author: "drift-sweep",
					author_type: "agent",
					created_at: "2026-05-12T00:00:00Z",
					closed_at: null,
					iterations: [],
				},
			),
		)
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: root,
		})
		assert.equal(
			result.events.length,
			0,
			`body-based dedup must suppress drift when basename appears in body, got events: ${JSON.stringify(result.events)}`,
		)
	})
})

test("drift sweep re-arms after FB is closed", async () => {
	if (!HAS_GIT) return
	await withRepo("re-arm", async ({ root, intentDir }) => {
		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const { fileRel } = await seedUnitWithDriftedSpec({
			intentDir,
			root,
			unitBasename: "unit-01",
		})
		// File a CLOSED FB. Sweep should still emit drift.
		const fbPath = join(
			intentDir,
			"stages",
			"design",
			"feedback",
			"01-drift.md",
		)
		writeFileSync(
			fbPath,
			matter.stringify("Closed drift FB.\n", {
				title: "drift",
				origin: "drift",
				author: "drift-sweep",
				author_type: "agent",
				created_at: "2026-05-12T00:00:00Z",
				closed_at: "2026-05-12T01:00:00Z",
				source_ref: `drift:spec:${fileRel}`,
				iterations: [],
			}),
		)
		const result = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "test",
			repoRoot: root,
		})
		// New drift (since FB closure) should re-emit. The drift on the
		// output is still present and the closure means the dedup
		// expires.
		assert.equal(
			result.events.length,
			1,
			`closed FB must not block drift re-arm; got events: ${JSON.stringify(result.events)}`,
		)
	})
})

// (v9 removed `haiku_baseline_init`. The premise-witness model has no
// baseline.json — witnesses live on the signed slot's FM, and there's
// no out-of-band "establish" path. The recovery role this tool used to
// play is now covered by cosmetic-close re-stamp on a drift FB, which
// is tested in drift-input-witnesses.test.mjs.)
