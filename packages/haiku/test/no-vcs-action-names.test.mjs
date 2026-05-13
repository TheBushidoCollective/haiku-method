#!/usr/bin/env npx tsx
// no-vcs-action-names.test.mjs
//
// Pins the workflow principle (2026-05-12):
//
//   "Within the engine, no action can reflect a git or VCS operation,
//    i.e. merge_stage would be invalid."
//
// Action names must describe the workflow intent, not the underlying
// VCS mechanism. `merge_stage` was renamed to `complete_stage` —
// `merge_*` and `branch_*` and similar verbs are forbidden going
// forward.
//
// The static guard here scans two surfaces:
//
//   1. The cursor's `CursorAction` union (cursor.ts) — every variant's
//      `kind` value must NOT be a VCS verb.
//   2. The prompt registry (prompts/index.ts) — every registered
//      action key must NOT be a VCS verb.
//
// A failure here means a future PR snuck a git-named action back into
// the surface. Find a semantic name (what the workflow MEANS at this
// step, not what git does under the hood) and rename.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

// Verbs that describe a VCS / git operation rather than the workflow's
// intent. If any action surfaced by the engine has one of these as a
// substring of its name, the principle is violated.
const FORBIDDEN_VCS_TOKENS = [
	"merge_",
	"_merge",
	"branch_",
	"_branch",
	"checkout_",
	"rebase_",
	"cherry_pick_",
	"push_",
	"pull_",
	"fetch_",
	"clone_",
	"commit_",
	"stash_",
	"reset_",
	"revert_",
	"fast_forward",
]

function readSrc(...parts) {
	const url = new URL(join("..", "src", ...parts), import.meta.url)
	return readFileSync(url, "utf8")
}

test("cursor action union (CursorAction) contains no VCS-verb kinds", () => {
	const src = readSrc("orchestrator", "workflow", "cursor.ts")
	// Match `| { kind: "..."` entries in the discriminated union.
	const re = /\|\s*\{\s*kind:\s*"([^"]+)"/g
	const kinds = []
	let match
	// biome-ignore lint/suspicious/noAssignInExpressions: classic regex-iter pattern
	while ((match = re.exec(src)) !== null) {
		kinds.push(match[1])
	}
	assert.ok(
		kinds.length > 0,
		"CursorAction union must contain at least one variant — the regex may need updating",
	)
	for (const kind of kinds) {
		for (const token of FORBIDDEN_VCS_TOKENS) {
			assert.strictEqual(
				kind.includes(token),
				false,
				`CursorAction kind "${kind}" contains forbidden VCS token "${token}". Workflow actions must describe intent (e.g. "complete_stage"), not VCS mechanism (e.g. "merge_stage"). The implementation under git is the engine's concern, not the action surface.`,
			)
		}
		assert.notStrictEqual(
			kind,
			"merge_stage",
			"CursorAction kind 'merge_stage' was renamed to 'complete_stage' on 2026-05-12 — the action describes the workflow ('stage is done'), not the git merge that happens to back it.",
		)
	}
})

test("prompt registry (prompts/index.ts) contains no VCS-verb action keys", () => {
	const src = readSrc("orchestrator", "prompts", "index.ts")
	// Match `["action_name", action_handler]` registrations in the
	// registry array.
	const re = /\[\s*"([^"]+)"\s*,\s*[A-Za-z_][A-Za-z0-9_]*\s*\]/g
	const actions = []
	let match
	// biome-ignore lint/suspicious/noAssignInExpressions: classic regex-iter pattern
	while ((match = re.exec(src)) !== null) {
		actions.push(match[1])
	}
	assert.ok(
		actions.length > 0,
		"prompt registry must contain at least one action — the regex may need updating",
	)
	for (const action of actions) {
		for (const token of FORBIDDEN_VCS_TOKENS) {
			assert.strictEqual(
				action.includes(token),
				false,
				`Registered action "${action}" contains forbidden VCS token "${token}". Workflow actions must describe intent, not VCS mechanism. See cursor.ts for the canonical semantic names.`,
			)
		}
		assert.notStrictEqual(
			action,
			"merge_stage",
			"Action 'merge_stage' was renamed to 'complete_stage' on 2026-05-12.",
		)
	}
})

test('no source file in src/ emits or registers the literal string "merge_stage" as an action name', () => {
	// Catches the case where a future PR adds a `result = { action:
	// "merge_stage", ... }` synthesis or hand-builds a complete_stage
	// equivalent under the old name. Comments + historical doc
	// references are allowed (they document the rename); only literal
	// emissions in code positions are forbidden. We approximate the
	// check by forbidding the `"merge_stage"` literal in the
	// kind-position or action-position regexes, but allowing the
	// substring inside `//` or `/* */` comments.
	const filesToCheck = [
		readSrc("orchestrator", "workflow", "cursor.ts"),
		readSrc("tools", "orchestrator", "haiku_run_next.ts"),
		readSrc("orchestrator", "workflow", "run-tick.ts"),
	]
	const violatingPatterns = [
		/kind:\s*"merge_stage"/,
		/action:\s*"merge_stage"/,
		/return\s+\{\s*kind:\s*"merge_stage"/,
	]
	for (const src of filesToCheck) {
		for (const pat of violatingPatterns) {
			assert.strictEqual(
				pat.test(src),
				false,
				`A source file emits the literal action name "merge_stage" (pattern ${pat}). Per the 2026-05-12 principle, actions must not be VCS-named. Rename to "complete_stage" (semantic) — the git merge is an implementation detail under the action handler.`,
			)
		}
	}
})
