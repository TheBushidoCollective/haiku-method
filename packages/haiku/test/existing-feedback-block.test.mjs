// existing-feedback-block.test.mjs
//
// Locks `buildExistingFeedbackBlock` — the dedupe context the engine hands
// every review / approval / intent-review subagent so they don't re-raise a
// finding the engine is already tracking (or a human/agent already decided).

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const SRC = new URL("../src/", import.meta.url).pathname

function seedFeedback(root, slug, stage, num, fm, body) {
	const dir = stage
		? join(root, ".haiku", "intents", slug, "stages", stage, "feedback")
		: join(root, ".haiku", "intents", slug, "feedback")
	mkdirSync(dir, { recursive: true })
	const frontmatter = Object.entries(fm)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join("\n")
	const padded = String(num).padStart(2, "0")
	writeFileSync(
		join(dir, `${padded}-${fm.title.toLowerCase().replace(/\W+/g, "-")}.md`),
		`---\n${frontmatter}\n---\n\n${body}\n`,
	)
}

test("buildExistingFeedbackBlock: empty when no feedback on record", async () => {
	const { buildExistingFeedbackBlock } = await import(
		`${SRC}orchestrator/prompts/_helpers.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-block-"))
	const origCwd = process.cwd()
	try {
		mkdirSync(join(tmp, ".haiku", "intents", "demo"), { recursive: true })
		process.chdir(tmp)
		assert.strictEqual(buildExistingFeedbackBlock("demo", "development"), "")
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("buildExistingFeedbackBlock: lists stage + intent-scope findings with dedupe instruction", async () => {
	const { buildExistingFeedbackBlock } = await import(
		`${SRC}orchestrator/prompts/_helpers.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-block-"))
	const origCwd = process.cwd()
	try {
		// A stage-scoped review finding + an intent-scope studio finding.
		seedFeedback(
			tmp,
			"demo",
			"development",
			1,
			{
				title: "Missing null guard",
				origin: "adversarial-review",
				author: "reviewer",
				created_at: "2026-05-22T00:00:00Z",
			},
			"The handler dereferences `user` before the auth check.",
		)
		seedFeedback(
			tmp,
			"demo",
			"",
			2,
			{
				title: "Cross-stage drift",
				origin: "studio-review",
				author: "cross-stage-consistency",
				created_at: "2026-05-22T00:00:00Z",
			},
			"The product spec promises a feature the build never wires up.",
		)
		process.chdir(tmp)

		const block = buildExistingFeedbackBlock("demo", "development")
		// Header + dedupe instruction present.
		assert.match(block, /do NOT re-raise/i)
		assert.match(block, /do NOT file a duplicate/i)
		// Both findings listed with id + status + origin + scope tag.
		assert.match(
			block,
			/`FB-001`.*adversarial-review.*stage.*Missing null guard/,
		)
		assert.match(block, /`FB-002`.*studio-review.*intent.*Cross-stage drift/)
		// A gist of the body comes through.
		assert.match(block, /dereferences/)
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})

function seedDecision(root, slug, stage, entry) {
	const dir = join(root, ".haiku", "intents", slug, "stages", stage)
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, "decisions.jsonl"), `${JSON.stringify(entry)}\n`, {
		flag: "a",
	})
}

test("buildDecisionsBlock: empty when no decisions on record", async () => {
	const { buildDecisionsBlock } = await import(
		`${SRC}orchestrator/prompts/_helpers.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-dec-block-"))
	const origCwd = process.cwd()
	try {
		mkdirSync(join(tmp, ".haiku", "intents", "demo", "stages", "development"), {
			recursive: true,
		})
		process.chdir(tmp)
		assert.strictEqual(buildDecisionsBlock("demo"), "")
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("buildDecisionsBlock: surfaces recorded decisions across stages so lenses don't re-litigate (BUG-5)", async () => {
	const { buildDecisionsBlock } = await import(
		`${SRC}orchestrator/prompts/_helpers.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-dec-block-"))
	const origCwd = process.cwd()
	try {
		// The owner ruled on overage rounding in the development stage; a
		// development-stage lens (or any lens) must see it and stop
		// re-flagging the ceil/round contradiction every review round.
		seedDecision(tmp, "demo", "development", {
			decision: "overage rounding: ceil vs round across AC and DATA-CONTRACTS",
			options: ["ceil()", "round()"],
			choice: "ceil()",
			source: "user",
			rationale:
				"AC-CRON-05 is authoritative; DATA-CONTRACTS divergence flagged for upstream reconciliation.",
			recorded_at: "2026-05-23T00:00:00Z",
		})
		process.chdir(tmp)

		const block = buildDecisionsBlock("demo")
		assert.match(block, /do NOT re-litigate/i)
		assert.match(block, /overage rounding/)
		assert.match(block, /ceil\(\)/)
		assert.match(block, /authoritative/)
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("buildExistingFeedbackBlock: intent walk (no stage) lists only intent-scope", async () => {
	const { buildExistingFeedbackBlock } = await import(
		`${SRC}orchestrator/prompts/_helpers.ts`
	)
	const tmp = mkdtempSync(join(tmpdir(), "haiku-fb-block-"))
	const origCwd = process.cwd()
	try {
		seedFeedback(
			tmp,
			"demo",
			"development",
			1,
			{ title: "Stage only", origin: "adversarial-review", author: "r" },
			"stage-scoped",
		)
		seedFeedback(
			tmp,
			"demo",
			"",
			2,
			{ title: "Intent level", origin: "studio-review", author: "r" },
			"intent-scoped",
		)
		process.chdir(tmp)

		const block = buildExistingFeedbackBlock("demo", "")
		assert.match(block, /`FB-002`.*Intent level/)
		assert.ok(
			!block.includes("Stage only"),
			`intent walk must not pull stage-scoped findings. got:\n${block}`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})
