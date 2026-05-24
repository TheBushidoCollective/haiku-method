// handoff-baton-tiered.test.mjs
//
// Phase 2: full-chain handoff baton, TIERED not flat (Jason: "visible ≠
// equal weight; the latest message holds the most relevance"). The shared
// renderPriorHandoff (used by both the unit hat loop and the feedback fix
// loop) surfaces the most-recent message as the PRIMARY actionable directive
// and collapses older chain entries into a labeled, lane-disciplined
// BACKGROUND section so a bounced-to hat sees the whole chain without
// treating ten old notes as ten current directives.

import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const { buildPriorRejectBlock } = await import(
	`${SRC}orchestrator/prompts/_helpers.ts`
)

function unitFileWith(iterations) {
	const dir = mkdtempSync(join(tmpdir(), "haiku-baton-"))
	const path = join(dir, "unit.md")
	writeFileSync(path, matter.stringify("# unit\n", { title: "u", iterations }))
	return { dir, path }
}

const t = "2026-05-13T00:00:00Z"

test("most-recent reject is PRIMARY; older handoffs are collapsed BACKGROUND", () => {
	const { dir, path } = unitFileWith([
		{
			hat: "planner",
			completed_at: t,
			result: "advance",
			message: "PLAN-NOTE build X via approach A",
		},
		{
			hat: "builder",
			completed_at: t,
			result: "advance",
			message: "BUILT-NOTE X using A, tests green",
		},
		{
			hat: "reviewer",
			completed_at: t,
			result: "reject",
			message: "REJECT-NOTE criterion 3 still fails",
		},
	])
	try {
		const block = buildPriorRejectBlock(path)
		// PRIMARY = the latest (reviewer reject), framed as the directive.
		assert.match(block, /## Prior rejection — address this before advancing/)
		assert.match(block, /REJECT-NOTE criterion 3 still fails/)
		// BACKGROUND section present + lane-discipline label.
		assert.match(block, /Earlier in this chain — context only/)
		assert.match(
			block,
			/do not jump ahead, re-open settled decisions, or do another hat's job/,
		)
		// Older entries appear as gists in the background.
		assert.match(block, /PLAN-NOTE build X via approach A/)
		assert.match(block, /BUILT-NOTE X using A/)
		// The primary directive must come BEFORE the background.
		assert.ok(
			block.indexOf("REJECT-NOTE") < block.indexOf("Earlier in this chain"),
			"primary directive precedes background",
		)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test("a single prior message renders PRIMARY only (no empty background section)", () => {
	const { dir, path } = unitFileWith([
		{
			hat: "builder",
			completed_at: t,
			result: "advance",
			message: "ONLY-NOTE here is the baton",
		},
	])
	try {
		const block = buildPriorRejectBlock(path)
		assert.match(block, /## Handoff from `builder`/)
		assert.match(block, /ONLY-NOTE here is the baton/)
		assert.doesNotMatch(block, /Earlier in this chain/)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test("no completed messages → empty string (first hat / fresh artifact)", () => {
	const { dir, path } = unitFileWith([
		{ hat: "planner", completed_at: null, result: null },
	])
	try {
		assert.strictEqual(buildPriorRejectBlock(path), "")
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
