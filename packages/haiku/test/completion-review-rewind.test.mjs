#!/usr/bin/env npx tsx
// Regression coverage for the completion-review rewind path.
//
// Bug repro: an intent's `phase` was set to `awaiting_completion_review`
// while real stages (operations, security) were still incomplete on disk.
// Every subsequent tick routed to the intent-completion handler and the
// `findIncompleteStages` guard returned an error in a loop — the engine
// never got a chance to actually run the missing stages.
//
// Fix: pre-tick detects the stale completion-review marker and rewinds
// status / phase / completion_review_* / active_stage / completed_at
// before derive-state runs. The next tick routes through start_stage
// for the first incomplete stage. `completeOrReviewIntent`'s pre-seal
// guard performs the same rewind when it fires from a fresh approach.

import assert from "node:assert"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const { preTickConsistency } = await import(
	"../src/orchestrator/workflow/pre-tick.ts"
)
const { rewindFromCompletionReview, completeOrReviewIntent } = await import(
	"../src/orchestrator/workflow/side-effects.ts"
)
const { parseFrontmatter } = await import("../src/state-tools.ts")

let passed = 0
let failed = 0

function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ✓ ${name}`)
	} catch (err) {
		failed++
		console.log(`  ✗ ${name}`)
		console.log(`    ${err.message}`)
		if (err.stack)
			console.log(`    ${err.stack.split("\n").slice(1, 4).join("\n    ")}`)
	}
}

function fmLine(k, v) {
	if (v === null || v === undefined) return null
	if (typeof v === "boolean") return `${k}: ${v}`
	if (Array.isArray(v) && v.every((x) => typeof x === "string"))
		return `${k}: [${v.map((x) => `"${x}"`).join(", ")}]`
	if (Array.isArray(v) || (typeof v === "object" && v !== null))
		return `${k}: ${JSON.stringify(v)}`
	return `${k}: "${v}"`
}

function fixture(slug, frontmatter, stages = {}) {
	const root = mkdtempSync(join(tmpdir(), "haiku-rewind-"))
	const haikuRoot = join(root, ".haiku")
	const iDir = join(haikuRoot, "intents", slug)
	mkdirSync(iDir, { recursive: true })

	const lines = ["---"]
	for (const [k, v] of Object.entries(frontmatter)) {
		const ln = fmLine(k, v)
		if (ln !== null) lines.push(ln)
	}
	lines.push("---", "", "# Intent body")
	writeFileSync(join(iDir, "intent.md"), lines.join("\n"))

	for (const [stageName, stageState] of Object.entries(stages)) {
		const sd = join(iDir, "stages", stageName)
		mkdirSync(sd, { recursive: true })
		writeFileSync(join(sd, "state.json"), JSON.stringify(stageState, null, 2))
	}

	const intentFile = join(iDir, "intent.md")
	return {
		haikuRoot,
		intentFile,
		readIntent: () => parseFrontmatter(readFileSync(intentFile, "utf8")).data,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	}
}

function completed(stageName) {
	return {
		stage: stageName,
		status: "completed",
		phase: "gate",
		started_at: "2026-04-28T00:00:00Z",
		completed_at: "2026-04-28T01:00:00Z",
		gate_entered_at: null,
		gate_outcome: "advanced",
	}
}

console.log("=== rewindFromCompletionReview ===")

test("clears phase + completion_review markers + status", () => {
	const { haikuRoot, readIntent, cleanup } = fixture(
		"stuck",
		{
			studio: "software",
			active_stage: "development",
			status: "active",
			intent_reviewed: true,
			phase: "awaiting_completion_review",
			completion_review_dispatched: true,
			completion_review_skipped: true,
			completion_review_entered_at: "2026-04-30T22:34:45Z",
			completed_at: "2026-04-30T22:49:25Z",
		},
		{
			inception: completed("inception"),
			design: completed("design"),
			product: completed("product"),
			development: completed("development"),
		},
	)
	const root = haikuRoot
	// Use the engine's intentDir(slug) by chdir'ing to the tmpdir root —
	// rewindFromCompletionReview reads via intentDir() which expects cwd
	// at the project root containing .haiku/.
	const prevCwd = process.cwd()
	process.chdir(dirname(root))
	try {
		rewindFromCompletionReview("stuck", "operations")
	} finally {
		process.chdir(prevCwd)
	}
	const fm = readIntent()
	assert.strictEqual(fm.status, "active", "status reset to active")
	assert.strictEqual(
		fm.active_stage,
		"operations",
		"active_stage points at first incomplete",
	)
	assert.strictEqual(fm.phase || "", "", "phase cleared")
	assert.strictEqual(fm.completed_at || "", "", "completed_at cleared")
	assert.strictEqual(
		fm.completion_review_entered_at || "",
		"",
		"entered_at cleared",
	)
	assert.strictEqual(
		fm.completion_review_dispatched,
		false,
		"dispatched cleared",
	)
	assert.strictEqual(fm.completion_review_skipped, false, "skipped cleared")
	cleanup()
})

console.log("\n=== pre-tick proactive recovery ===")

test("stale awaiting_completion_review with incomplete stages → rewinds before dispatch", () => {
	const { haikuRoot, readIntent, cleanup } = fixture(
		"stuck",
		{
			studio: "software",
			active_stage: "development",
			status: "active",
			intent_reviewed: true,
			phase: "awaiting_completion_review",
			completion_review_dispatched: true,
			completion_review_skipped: true,
		},
		{
			inception: completed("inception"),
			design: completed("design"),
			product: completed("product"),
			development: completed("development"),
		},
	)
	preTickConsistency("stuck", haikuRoot)
	const fm = readIntent()
	cleanup()
	// preTickConsistency returns null on a silent rewind — the rewind
	// effect is observed on disk, not in the return value.
	assert.strictEqual(fm.status, "active")
	assert.strictEqual(fm.active_stage, "operations")
	assert.strictEqual(fm.phase || "", "")
	assert.strictEqual(fm.completion_review_dispatched, false)
	assert.strictEqual(fm.completion_review_skipped, false)
})

test("awaiting_completion_review with all stages complete → no rewind", () => {
	const { haikuRoot, readIntent, cleanup } = fixture(
		"healthy",
		{
			studio: "software",
			active_stage: "security",
			status: "active",
			intent_reviewed: true,
			phase: "awaiting_completion_review",
			completion_review_dispatched: true,
			completion_review_skipped: true,
		},
		{
			inception: completed("inception"),
			design: completed("design"),
			product: completed("product"),
			development: completed("development"),
			operations: completed("operations"),
			security: completed("security"),
		},
	)
	preTickConsistency("healthy", haikuRoot)
	const fm = readIntent()
	cleanup()
	// Healthy intent — phase + markers should still be intact.
	assert.strictEqual(fm.phase, "awaiting_completion_review", "phase preserved")
	assert.strictEqual(
		fm.completion_review_dispatched,
		true,
		"dispatched preserved",
	)
})

test("active phase (not awaiting_completion_review) → no rewind even with gaps", () => {
	const { haikuRoot, readIntent, cleanup } = fixture(
		"midflight",
		{
			studio: "software",
			active_stage: "development",
			status: "active",
			intent_reviewed: true,
			phase: "execute",
		},
		{
			inception: completed("inception"),
			design: completed("design"),
			product: completed("product"),
			development: {
				stage: "development",
				status: "active",
				phase: "execute",
				started_at: "2026-04-30T00:00:00Z",
			},
		},
	)
	preTickConsistency("midflight", haikuRoot)
	const fm = readIntent()
	cleanup()
	// Mid-flight intent — phase is "execute", not the stale-marker phase.
	// Rewind logic should not touch it.
	assert.strictEqual(fm.phase, "execute", "phase preserved")
	assert.strictEqual(fm.active_stage, "development", "active_stage preserved")
})

console.log("\n=== completeOrReviewIntent guard ===")

test("guard fires + rewinds when incomplete stages exist", () => {
	const { haikuRoot, readIntent, cleanup } = fixture(
		"guarded",
		{
			studio: "software",
			active_stage: "development",
			status: "active",
			intent_reviewed: true,
		},
		{
			inception: completed("inception"),
			design: completed("design"),
			product: completed("product"),
			development: completed("development"),
		},
	)
	const root = haikuRoot
	const prevCwd = process.cwd()
	process.chdir(dirname(root))
	let action
	try {
		action = completeOrReviewIntent("guarded", "software", "test gate pass")
	} finally {
		process.chdir(prevCwd)
	}
	const fm = readIntent()
	cleanup()
	assert.strictEqual(action.action, "error", "guard returns error")
	assert.ok(
		action.message.includes("operations") &&
			action.message.includes("security"),
		"error names the incomplete stages",
	)
	// Rewind should have set active_stage to first incomplete and cleared markers.
	assert.strictEqual(fm.active_stage, "operations", "rewound active_stage")
	assert.strictEqual(fm.phase || "", "", "phase cleared")
})

console.log("")
console.log(`${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
