// cross-stage-consistency-built-in.test.mjs
//
// Locks the 2026-05-18 promotion of cross-stage-consistency from a
// per-studio mandate file into the engine. Before this change:
//
//   - 24 studios shipped `plugin/studios/<studio>/intent-review-agents/
//     cross-stage-consistency.md` (22 byte-identical + 2 outliers)
//   - The cursor's intent-level walk was hardcoded to
//     `["spec", "continuity", "user"]` — it NEVER appended studio
//     review agents to the role list
//   - Net effect: the mandate files were loaded by
//     `readStudioReviewAgentPaths` for diagram generation only, and the
//     cross-stage check never actually ran at intent completion
//
// The promotion does two things at once:
//
//   1. Adds `cross-stage-consistency` to the cursor's `intentRoles`
//      so the check actually fires.
//   2. Inlines the mandate body in `intent_review/index.ts` as a peer
//      of the existing `spec` and `continuity` built-ins — generic
//      enough to apply to every studio, no per-studio mandate file.
//
// These tests lock both invariants so the check can't silently regress.

import assert from "node:assert/strict"
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

const SRC = new URL("../src/", import.meta.url).pathname

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

/** Build a minimal-but-valid intent dir where every stage in the
 *  studio's STUDIO.md `stages:` list has been merged. The cursor's
 *  intent-level walk fires only when `activeStage` is null, which
 *  happens when every stage's `status: completed` is stamped in the
 *  intent FM. */
function seedCompletedIntent(root, slug, studio, stages) {
	const intentDir = join(root, ".haiku", "intents", slug)
	mkdirSync(intentDir, { recursive: true })
	const stagesYaml = stages.map((s) => `  - ${s}`).join("\n")
	const stageStatusYaml = stages
		.map((s) => `  ${s}: { status: completed }`)
		.join("\n")
	writeFileSync(
		join(intentDir, "intent.md"),
		[
			"---",
			`slug: ${slug}`,
			`studio: ${studio}`,
			"status: active",
			"mode: continuous",
			"stages:",
			stagesYaml,
			"stage_status:",
			stageStatusYaml,
			"approvals: {}",
			"---",
			"# Intent body",
			"",
		].join("\n"),
	)
	for (const s of stages) {
		const sd = join(intentDir, "stages", s)
		mkdirSync(sd, { recursive: true })
		writeFileSync(join(sd, "state.json"), JSON.stringify({ status: "completed" }))
	}
	return intentDir
}

// The engine body is no longer inlined into the prompt string — the
// instruction-file refactor (2026-05-20) materializes it to a snapshot
// under the intent's `prompts/intent/refs/engine-body/<role>.md` and the
// subagent prompt references it. Follow the chain to the body content:
// builder output (parent) → `<subagent prompt_file="...">` → that file's
// `**Read** \`<ref>\`` → the materialized engine-body content.
function resolveEngineBodyContent(out) {
	const promptFile = out.match(/prompt_file="([^"]+)"/)
	assert.ok(
		promptFile,
		`builder output must emit a file-backed subagent dispatch (engine-built-in resolution), not the generic placeholder. got: ${out.slice(0, 500)}`,
	)
	const subagentPrompt = readFileSync(promptFile[1], "utf8")
	const ref = subagentPrompt.match(/\*\*Read\*\*\s+`([^`]+)`/)
	assert.ok(
		ref,
		`subagent prompt must reference a materialized mandate. got: ${subagentPrompt.slice(0, 500)}`,
	)
	return readFileSync(ref[1], "utf8")
}

test("intent_review materializes the cross-stage-consistency engine body", async () => {
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("intent_review")
	assert.ok(builder, "intent_review prompt builder must be registered")
	const out = builder({
		slug: "demo-intent",
		studio: "software",
		action: { kind: "intent_review", role: "cross-stage-consistency" },
	})
	assert.ok(
		/cross-stage-consistency|cross stage consistency/i.test(out),
		`prompt must name the role. got: ${out.slice(0, 500)}`,
	)
	// Engine-built-in resolves to a file-backed dispatch, NOT the generic
	// "no studio-configured mandate" / "audit the intent for the X
	// standard" fallback placeholder.
	assert.ok(
		!/no studio-configured mandate|audit the intent for the/i.test(out),
		"must not fall through to the generic placeholder",
	)
	const body = resolveEngineBodyContent(out)
	assert.ok(
		/internally consistent/i.test(body),
		"engine body must include the consistency check",
	)
	assert.ok(
		/upstream stages specified/.test(body),
		"engine body must include the upstream-alignment check",
	)
	assert.ok(
		/MUST NOT|must not/i.test(body) ||
			/Anti-patterns|anti-patterns/.test(body),
		"engine body must include the anti-patterns block",
	)
})

test("intent_review for a never-cross-stage-shipping studio still gets the engine body (no studio mandate fallthrough)", async () => {
	// Pick a studio that no longer has any intent-review-agents/ dir
	// (post-promotion: all of them). The prompt builder must use the
	// engine body, not a "no mandate file" placeholder.
	const { actionPromptBuilders } = await import(
		`${SRC}orchestrator/prompts/index.ts`
	)
	const builder = actionPromptBuilders.get("intent_review")
	const out = builder({
		slug: "demo-intent",
		studio: "hwdev",
		action: { kind: "intent_review", role: "cross-stage-consistency" },
	})
	const body = resolveEngineBodyContent(out)
	assert.ok(
		/internally consistent/i.test(body),
		"hwdev (which used to ship a custom mandate) must now get the engine body",
	)
})

test("cursor's intent-level walk includes cross-stage-consistency role", async () => {
	// Black-box check: drive cursor.computeAction with a fully-merged
	// intent and assert it returns an `intent_review { role: ... }` for
	// cross-stage-consistency at some point in the walk. This locks the
	// role into the hardcoded `intentRoles` list — without the new
	// entry, the check goes silent again.
	const cursor = await import(`${SRC}orchestrator/workflow/cursor.ts`)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-cross-stage-cursor-"))
	const origCwd = process.cwd()
	process.chdir(tmp)
	try {
		const intentDir = seedCompletedIntent(tmp, "demo", "software", [
			"inception",
		])
		// computeAction is the cursor's top-level — walk it until we see
		// cross-stage-consistency in the role list. We sign earlier roles
		// (spec, continuity) by stamping their approvals to advance the
		// walk past them, since we only care that cross-stage is reachable.
		// Behavioral lock against the real `intentReviewRoles` helper (the
		// single source of truth for the intent-level walk, shared by the
		// cursor and the progress track). cross-stage-consistency MUST be
		// present in BOTH the autopilot and non-autopilot role lists —
		// without it the intent-completion review goes silent on the
		// cross-stage check. (Pre-2026-05-19 this scraped an inline ternary
		// in cursor.ts; that ternary was extracted into `intentReviewRoles`,
		// so we now assert the function's output directly.)
		assert.ok(
			cursor.intentReviewRoles("autopilot").includes("cross-stage-consistency"),
			"intentReviewRoles(autopilot) MUST include cross-stage-consistency",
		)
		assert.ok(
			cursor.intentReviewRoles("continuous").includes("cross-stage-consistency"),
			"intentReviewRoles(continuous) MUST include cross-stage-consistency",
		)
		// The terminal human `user` gate is the always-on final-feedback
		// checkpoint — it MUST be the last role in EVERY mode, autopilot
		// included (2026-05-26: autopilot previously dropped it and sealed
		// unattended with no final-feedback window).
		for (const m of ["autopilot", "continuous", "discrete", "quick"]) {
			const roles = cursor.intentReviewRoles(m)
			assert.strictEqual(
				roles[roles.length - 1],
				"user",
				`intentReviewRoles(${m}) MUST end with the terminal user gate`,
			)
		}
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})

// The 2026-05-18 promotion above only rescued cross-stage-consistency by
// inlining it as an engine role — it did NOT restore the general "append
// studio intent-review agents to the walk" behavior. So runtime-verifier
// (and any other `intent-review-agents/*.md`) silently stopped firing at
// intent completion even though the docs + runtime-verification doctrine
// claim it runs. This locks the general restore: studio agents follow the
// engine roles, deduped against the engine base, before the `user` gate.
test("intentReviewRoles appends studio intent-review agents (deduped, before user)", async () => {
	const cursor = await import(`${SRC}orchestrator/workflow/cursor.ts`)
	const roles = cursor.intentReviewRoles("continuous", [
		"cross-stage-consistency", // already an engine role — must not double
		"delivery-verifier",
		"runtime-verifier",
	])

	// Engine roles still lead.
	assert.deepEqual(
		roles.slice(0, 3),
		["spec", "continuity", "cross-stage-consistency"],
		"engine roles must lead the intent-completion walk",
	)
	// Studio agents are present and the engine-role duplicate was dropped.
	assert.equal(
		roles.filter((r) => r === "cross-stage-consistency").length,
		1,
		"a studio file shadowing an engine role must not double-walk",
	)
	assert.ok(
		roles.includes("delivery-verifier") && roles.includes("runtime-verifier"),
		"studio intent-review agents MUST be walked",
	)
	// `user` is terminal; studio agents come before it.
	assert.equal(roles[roles.length - 1], "user", "user gate is terminal")
	assert.ok(
		roles.indexOf("delivery-verifier") < roles.indexOf("user"),
		"studio agents run before the human gate",
	)

	// Autopilot keeps the studio agents (the delivery gate still matters
	// with no human watching) AND — as of 2026-05-26 — keeps the terminal
	// user gate: the final intent gate is the always-on final-feedback
	// checkpoint, sacred in every mode. (Previously autopilot dropped it
	// and sealed unattended.)
	const auto = cursor.intentReviewRoles("autopilot", ["delivery-verifier"])
	assert.ok(
		auto.includes("delivery-verifier"),
		"autopilot MUST still run intent-completion verifiers",
	)
	assert.strictEqual(
		auto[auto.length - 1],
		"user",
		"autopilot MUST keep the terminal user gate (final-feedback checkpoint)",
	)
	assert.ok(
		auto.indexOf("delivery-verifier") < auto.indexOf("user"),
		"studio agents still run before the human gate in autopilot",
	)
})
