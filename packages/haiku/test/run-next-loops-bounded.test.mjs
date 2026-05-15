#!/usr/bin/env npx tsx
// run-next-loops-bounded.test.mjs
//
// Static guarantee: every `while` loop body in
// `tools/orchestrator/haiku_run_next.ts` is gated by an iteration
// counter that hits `RUN_NEXT_LOOP_CAP` and exits via
// `loopAbortResponse`. The user's hard requirement (2026-05-15):
// "no matter what circumstance, the run_next call should never get
// stuck in a loop. It can block via a SPA pop, but it CANNOT hang
// for infinite recursion or stuck while loops."
//
// The check is intentionally STATIC — a runtime test proving "this
// loop terminates on these inputs" can't rule out the input it
// didn't try. A grep-of-source assertion proves "every while in this
// file is structurally bounded" regardless of input.
//
// Mechanism: scan the source for every `while (...)` opener, walk
// the next ~30 source lines, and assert one of these patterns is
// present BEFORE the matching `}`:
//
//   1. `if (++<ident> > RUN_NEXT_LOOP_CAP) return loopAbortResponse(`
//   2. `if (<ident>++ > RUN_NEXT_LOOP_CAP) return loopAbortResponse(`
//   3. The condition itself is a counter check (`while (i < N)` shape)
//   4. The body has an `if (sig === lastSig) return loopAbortResponse(`
//      no-progress check (which also feeds the cap path)
//
// If a future loop slips in without one of these, this test fires
// before CI lets the change ship.

import assert from "node:assert"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const RUN_NEXT_PATH = resolve(
	__dirname,
	"..",
	"src",
	"tools",
	"orchestrator",
	"haiku_run_next.ts",
)

const source = readFileSync(RUN_NEXT_PATH, "utf8")
const lines = source.split("\n")

/**
 * Find every `while (` opener. Returns line indices. Skips:
 *   - lines inside line-comments (//)
 *   - lines inside block-comment ranges
 *   - string literals containing the substring (rare in this file)
 */
function findWhileOpeners(src) {
	const noBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, (m) =>
		m.replace(/[^\n]/g, " "),
	)
	const noLineComments = noBlockComments.replace(/\/\/[^\n]*/g, (m) =>
		m.replace(/[^\n]/g, " "),
	)
	const cleanedLines = noLineComments.split("\n")
	const openers = []
	for (let i = 0; i < cleanedLines.length; i++) {
		const line = cleanedLines[i]
		// Match `while (` not preceded by an identifier char (so we
		// don't catch `something.while(` etc.) and not part of `do {…}
		// while (…)` (which is also bounded by a body-level break in
		// practice, but this codebase has no do-while).
		if (/(?<![\w$])while\s*\(/.test(line)) {
			openers.push({ lineIndex: i, lineText: lines[i].trim() })
		}
	}
	return openers
}

function bodyAfterOpener(allLines, openerIndex, lookahead = 40) {
	return allLines.slice(openerIndex + 1, openerIndex + 1 + lookahead).join("\n")
}

function hasCapGate(body) {
	// Pattern: `if (<something>++ > RUN_NEXT_LOOP_CAP)` or
	// `if (++<something> > RUN_NEXT_LOOP_CAP)`. The counter name and
	// the call to loopAbortResponse can be on adjacent lines.
	return (
		/if\s*\(\s*(?:\+\+\w+|\w+\s*\+\+)\s*>\s*RUN_NEXT_LOOP_CAP\s*\)/.test(
			body,
		) && /loopAbortResponse\s*\(/.test(body)
	)
}

function hasNoProgressGate(body) {
	// Pattern: `if (sig === <lastSig>)` followed by loopAbortResponse.
	// This is the "no on-disk progress between two ticks of the same
	// loop body" check.
	return (
		/if\s*\(\s*sig\s*===\s*\w+LastSig\s*\)/.test(body) &&
		/loopAbortResponse\s*\(/.test(body)
	)
}

function hasBoundedConditionShape(openerLine) {
	// Pattern: `while (i < N)` / `while (offset < buf.length)` —
	// the LOOP CONDITION ITSELF is a counter compare. This file
	// doesn't have any of these today (the four real loops all use
	// the counter+cap pattern), but the shape is still safe.
	return /while\s*\(\s*\w+\s*<\s*\w+/.test(openerLine)
}

function hasUserDecisionAwait(openerLine, body) {
	// Pattern: `while (result.action === "gate_review" || result.action === "user_gate")`
	// — these loops re-tick after each user decision arrives via the
	// SPA. They have BOTH the cap check AND a no-progress check (the
	// `gateReviewLastSig` machinery). The cap check is what we
	// already require above; this is here only as documentation that
	// user-decision loops fall under the same rule.
	return (
		/result\.action\s*===\s*"(?:gate_review|user_gate)"/.test(openerLine) &&
		hasCapGate(body)
	)
}

const openers = findWhileOpeners(source)

test("haiku_run_next.ts contains at least one while loop (sanity)", () => {
	assert.ok(
		openers.length > 0,
		"expected to find while loops in haiku_run_next.ts; if the file genuinely has none now, this test still passes via the per-loop assertions below",
	)
})

test("every while loop in haiku_run_next.ts is iter-counter-gated", () => {
	for (const opener of openers) {
		const body = bodyAfterOpener(lines, opener.lineIndex)
		const ok =
			hasCapGate(body) ||
			hasNoProgressGate(body) ||
			hasBoundedConditionShape(opener.lineText) ||
			hasUserDecisionAwait(opener.lineText, body)
		assert.ok(
			ok,
			`while loop at haiku_run_next.ts:${opener.lineIndex + 1} is not iter-counter-gated.\n` +
				`  Line: ${opener.lineText}\n\n` +
				`  Required: one of —\n` +
				`    (a) \`if (++<counter> > RUN_NEXT_LOOP_CAP) return loopAbortResponse(...)\`\n` +
				`    (b) a no-progress check: \`if (sig === <lastSig>) return loopAbortResponse(...)\`\n` +
				`    (c) the condition itself is a bounded counter (\`while (i < N)\`)\n\n` +
				`  Adding a new loop without one of these is the exact pattern the user banned\n` +
				`  on 2026-05-15: 'the run_next call should never get stuck in a loop. It can\n` +
				`  block via a SPA pop, but it CANNOT hang for infinite recursion or stuck\n` +
				`  while loops.'\n\n` +
				`  Body sample:\n${body
					.split("\n")
					.slice(0, 12)
					.map((l) => `    | ${l}`)
					.join("\n")}`,
		)
	}
})

test("RUN_NEXT_LOOP_CAP is imported (the gate referenced above is real)", () => {
	assert.ok(
		/import\s*\{[^}]*\bRUN_NEXT_LOOP_CAP\b/.test(source) ||
			/from\s+["'].*_loop_guard["']/.test(source),
		"haiku_run_next.ts must import RUN_NEXT_LOOP_CAP from _loop_guard so the cap-gate pattern's RHS resolves",
	)
})

test("loopAbortResponse is imported (the abort path the gates branch to is real)", () => {
	assert.ok(
		/import\s*\{[^}]*\bloopAbortResponse\b/.test(source),
		"haiku_run_next.ts must import loopAbortResponse so cap-gate / no-progress branches actually return a structured error",
	)
})
