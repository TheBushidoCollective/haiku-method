// drift-post-v9-migration-integration.test.mjs
//
// THE integration test that should have existed before any of the
// "fix drift" commits between v4 and v9. The 2-week runaway loop on
// admin-portal-reimagine surfaced THREE distinct engine bugs that all
// produced the same external symptom (drift fires every tick, fix
// loops can't converge, agent burns hours of compute):
//
//   1. bodySha256 wasn't canonicalized → matter.stringify added a
//      trailing \n that orphaned every witness on the next FM write
//   2. haiku_feedback_reject_hat had no convergence guard → cosmetic
//      drift FBs bounced between classifier and designer until the
//      bolt cap killed them, burning N × MAX_FIX_LOOP_BOLTS dispatches
//   3. witness keys preserved a `.haiku/intents/<slug>/` prefix that
//      neither intent-relative nor primary-repo-relative resolution
//      could match in a linked worktree → input_deletion fired on
//      every (unit, role, file) tuple every tick
//
// None of these would have been caught by the drift unit tests
// (drift-no-false-positives, drift-input-witnesses, drift-scenarios)
// because those use tmp-dir fixtures that pre-normalize everything
// and never exercise the migration + worktree + bad-shape-input
// combination that production intents hit.
//
// This file builds a realistic v8-shape intent (units with bad-shape
// input paths, the worktree-vs-primary repo split, ad-hoc FM writes
// between sweeps), runs the v8→v9 migration, then fires multiple
// drift sweeps and asserts ZERO false-positive events at each step.
// If any future change re-introduces ANY of the three bug shapes, this
// test will fail loudly instead of letting the bug surface in a real
// intent run a week later.

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

/** Set up a realistic v8-shape intent in a linked worktree.
 *  Returns { primaryRoot, worktreeRoot, intentDir, slug }.
 *
 *  Topology (mirrors production):
 *    <primaryRoot>/                  ← bare primary repo
 *    <primaryRoot>/.haiku/           ← present but empty (no intent)
 *    <worktreeRoot>/.haiku/intents/<slug>/  ← intent lives HERE only
 *
 *  Real-world `primaryRepoRoot()` would return <primaryRoot>;
 *  the intent files live in <worktreeRoot>. The runaway loop happens
 *  when sign-time and check-time disagree on which root to anchor against. */
function setupV8IntentInWorktree(name) {
	const primaryRoot = mkdtempSync(join(tmpdir(), `${name}-primary-`))
	const worktreeRoot = mkdtempSync(join(tmpdir(), `${name}-worktree-`))
	// Initialise primary repo with one commit so HEAD is valid.
	git(primaryRoot, "init", "-q", "-b", "main")
	git(primaryRoot, "config", "user.email", "t@t")
	git(primaryRoot, "config", "user.name", "t")
	git(primaryRoot, "config", "commit.gpgsign", "false")
	mkdirSync(join(primaryRoot, ".haiku"), { recursive: true })
	writeFileSync(join(primaryRoot, "README.md"), "primary\n")
	git(primaryRoot, "add", "-A")
	git(primaryRoot, "commit", "-q", "-m", "init")

	// Stand up the intent in the worktree dir (not bothering with a
	// real `git worktree add` since the sweep doesn't shell out to git).
	const slug = name
	const intentDir = join(worktreeRoot, ".haiku", "intents", slug)
	mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
	mkdirSync(join(intentDir, "stages", "design", "artifacts"), {
		recursive: true,
	})
	mkdirSync(join(intentDir, "stages", "design", "feedback"), {
		recursive: true,
	})
	mkdirSync(join(intentDir, "knowledge"), { recursive: true })

	// Intent body (v8 format: plugin_version: 8.0.0)
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("Real intent body.\n", {
			title: "Admin portal reimagine",
			studio: "software",
			mode: "continuous",
			plugin_version: "8.0.0",
		}),
	)
	// Stage artifacts (a fan of the kinds of files admin-portal-reimagine
	// had: spec docs, design tokens, accessibility notes).
	const artifactDir = join(intentDir, "stages", "design", "artifacts")
	for (const f of [
		"SEMANTIC-TOKENS.md",
		"01-app-shell-spec.md",
		"ACCESSIBILITY.md",
	]) {
		writeFileSync(
			join(artifactDir, f),
			matter.stringify(`Body of ${f}.\n`, { title: f }),
		)
	}
	writeFileSync(
		join(intentDir, "stages", "design", "DESIGN-BRIEF.md"),
		matter.stringify("Brief body.\n", { title: "Brief" }),
	)
	return { primaryRoot, worktreeRoot, intentDir, slug }
}

/** Author a unit with v8-shape `inputs:` (bad-prefix paths) and a
 *  signed review against those inputs. Mimics what real unit authors
 *  produced before the prefix-stripping normalization landed. */
async function authorUnitV8Shape({ intentDir, slug, unitName, inputs }) {
	const { buildReviewRecord } = await import(
		`${SRC}/orchestrator/workflow/sign-slot.ts`
	)
	const unitPath = join(intentDir, "stages", "design", "units", `${unitName}.md`)
	// First write a unit with the inputs declared but no review yet
	writeFileSync(
		unitPath,
		matter.stringify(`Spec for ${unitName}.\n`, {
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
	// Sign the review against the inputs as-declared (the bad-shape
	// versions). buildReviewRecord stamps `body_sha256` + `input_witnesses`.
	const signed = buildReviewRecord(unitPath, { intentDir, unitInputs: inputs })
	const parsed = matter(readFileSync(unitPath, "utf8"))
	writeFileSync(
		unitPath,
		matter.stringify(parsed.content, {
			...parsed.data,
			reviews: { spec: signed, completeness: signed },
		}),
	)
	return unitPath
}

test("post-v9-migration drift sweep: zero false positives across 3 ticks", async () => {
	if (!HAS_GIT) return
	const { primaryRoot, worktreeRoot, intentDir, slug } =
		setupV8IntentInWorktree("integration-zero-drift")
	try {
		// Author three units with the bad-shape input paths that
		// admin-portal-reimagine actually had on disk.
		const badShape = (file) =>
			`.haiku/intents/${slug}/stages/design/artifacts/${file}`
		await authorUnitV8Shape({
			intentDir,
			slug,
			unitName: "unit-04",
			inputs: [
				badShape("SEMANTIC-TOKENS.md"),
				badShape("01-app-shell-spec.md"),
			],
		})
		await authorUnitV8Shape({
			intentDir,
			slug,
			unitName: "unit-06",
			inputs: [badShape("SEMANTIC-TOKENS.md")],
		})
		await authorUnitV8Shape({
			intentDir,
			slug,
			unitName: "unit-11",
			inputs: [badShape("ACCESSIBILITY.md")],
		})

		// Run the v8→v9 migration on the intent. The migration backfills
		// input_witnesses on the signed reviews using the unit's `inputs:`
		// field as-declared — so witnesses get stored under whichever key
		// shape the migration chose. Post-fix, those keys should be
		// canonicalized (no `.haiku/intents/<slug>/` prefix).
		const { v8ToV9 } = await import(
			`${SRC}/orchestrator/migrations/v8-to-v9.ts`
		)
		v8ToV9({ slug, intentDir, repoRoot: worktreeRoot })

		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)

		// Tick 1: immediately post-migration. ZERO events expected.
		// (Pre-fix this was the moment 100+ input_deletion events fired.)
		const t1 = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
			repoRoot: primaryRoot,
		})
		assert.equal(
			t1.events.length,
			0,
			`tick 1 (post-migration): expected zero drift; got ${t1.events.length} events: ${JSON.stringify(t1.events.slice(0, 3))}`,
		)

		// Tick 2: simulate an engine FM write (the kind that happens every
		// tick — bookkeeping fields on intent.md / unit FM). Pre-fix this
		// was the moment bodySha256 normalization re-orphaned witnesses.
		const intentMdPath = join(intentDir, "intent.md")
		const intentParsed = matter(readFileSync(intentMdPath, "utf8"))
		writeFileSync(
			intentMdPath,
			matter.stringify(intentParsed.content, {
				...intentParsed.data,
				_pending_review_dispatches: {},
			}),
		)
		for (const u of ["unit-04", "unit-06", "unit-11"]) {
			const unitPath = join(intentDir, "stages", "design", "units", `${u}.md`)
			const p = matter(readFileSync(unitPath, "utf8"))
			writeFileSync(
				unitPath,
				matter.stringify(p.content, {
					...p.data,
					_tick_stamp: new Date().toISOString(),
				}),
			)
		}
		const t2 = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
			repoRoot: primaryRoot,
		})
		assert.equal(
			t2.events.length,
			0,
			`tick 2 (post-FM-write): expected zero drift; got ${t2.events.length} events: ${JSON.stringify(t2.events.slice(0, 3))}`,
		)

		// Tick 3: third tick with no further mutations — proves the steady
		// state is stable, not just the immediate-post-migration state.
		const t3 = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
			repoRoot: primaryRoot,
		})
		assert.equal(
			t3.events.length,
			0,
			`tick 3 (steady state): expected zero drift; got ${t3.events.length} events: ${JSON.stringify(t3.events.slice(0, 3))}`,
		)
	} finally {
		rmSync(primaryRoot, { recursive: true, force: true })
		rmSync(worktreeRoot, { recursive: true, force: true })
	}
})

test("post-v9-migration drift sweep: REAL drift on artifact body change still fires", async () => {
	// The flip-side guarantee: the false-positive suppression doesn't
	// silently swallow genuine drift. A real out-of-band edit to a
	// witnessed artifact MUST produce an event.
	if (!HAS_GIT) return
	const { primaryRoot, worktreeRoot, intentDir, slug } =
		setupV8IntentInWorktree("integration-real-drift")
	try {
		const badShape = (file) =>
			`.haiku/intents/${slug}/stages/design/artifacts/${file}`
		await authorUnitV8Shape({
			intentDir,
			slug,
			unitName: "unit-04",
			inputs: [badShape("SEMANTIC-TOKENS.md")],
		})
		const { v8ToV9 } = await import(
			`${SRC}/orchestrator/migrations/v8-to-v9.ts`
		)
		v8ToV9({ slug, intentDir, repoRoot: worktreeRoot })

		// Mutate the witnessed artifact body.
		const artifactPath = join(
			intentDir,
			"stages",
			"design",
			"artifacts",
			"SEMANTIC-TOKENS.md",
		)
		writeFileSync(
			artifactPath,
			matter.stringify("UPDATED token definitions.\n", { title: "tokens" }),
		)

		const { runDriftSweep } = await import(
			`${SRC}/orchestrator/workflow/drift-sweep.ts`
		)
		const t = runDriftSweep({
			intentDir,
			stage: "design",
			studio: "software",
			repoRoot: primaryRoot,
		})
		const mutations = t.events.filter((e) => e.kind === "input_mutation")
		assert.ok(
			mutations.length >= 1,
			`real artifact change MUST fire input_mutation drift; got: ${JSON.stringify(t.events)}`,
		)
	} finally {
		rmSync(primaryRoot, { recursive: true, force: true })
		rmSync(worktreeRoot, { recursive: true, force: true })
	}
})
