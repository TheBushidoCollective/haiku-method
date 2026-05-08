#!/usr/bin/env npx tsx
// post-merge-remigration.test.mjs — Bug E coverage.
//
// Scenario: an intent's main is on v3 (or has v3 unit/feedback files),
// the stage branch was migrated to v4, the merge brings v3 cruft back
// into the tree. intent.md says plugin_version=4.0.0 (the v4 stage's
// version won the merge), but unit/feedback files carry v3-deprecated
// fields. Without the post-merge re-migration check, runWorkflowTick's
// `sourceMajor !== targetMajor` gate would short-circuit the migrator
// and the v3 cruft would sit forever — the cursor would interpret v3
// `status: completed` units as in-flight, re-emit the wrong actions,
// and the workflow would stall.
//
// Two tests:
//   1. `hasV3CruftInIntent` detects v3-shape unit fields in an
//      otherwise-migrated tree.
//   2. `runWorkflowTick` re-migrates the cruft on next tick (forces the
//      v0→4.0.0 edge) and the resulting unit has v4-shape fields.

import assert from "node:assert"
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import matter from "gray-matter"

import { hasV3CruftInIntent } from "../src/orchestrator/migrations/v0-to-v4.ts"

function readFm(path) {
	return matter(readFileSync(path, "utf8")).data
}

/**
 * Build an intent whose intent.md is already v4 (plugin_version
 * stamped, deprecated fields stripped) but whose first unit still
 * carries v3-deprecated fields like `status: completed`, `hat`, and
 * `bolt`. This is the post-merge state the user can hit if a stage
 * branch's v4 intent.md merges over main's v4 intent.md while main's
 * v3 unit files come back through.
 */
function makePostMergeCruftIntent() {
	const root = mkdtempSync(join(tmpdir(), "haiku-bug-e-"))
	const intentDir = join(root, ".haiku", "intents", "test-cruft")
	mkdirSync(intentDir, { recursive: true })
	mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })

	// v4-shape intent.md (already migrated by stage branch).
	writeFileSync(
		join(intentDir, "intent.md"),
		matter.stringify("# test\n", {
			title: "test",
			studio: "software",
			mode: "continuous",
			plugin_version: "4.0.0",
			approvals: {},
			sealed_at: null,
			started_at: null,
		}),
	)

	// v3-shape unit (came back through merge from main's pre-migration
	// state). status / hat / bolt / hat_started_at are all in
	// DEPRECATED_UNIT_FIELDS.
	writeFileSync(
		join(intentDir, "stages", "design", "units", "unit-01-foo.md"),
		matter.stringify("# unit-01-foo\n", {
			title: "foo",
			status: "completed",
			hat: "verifier",
			bolt: 2,
			hat_started_at: "2026-04-01T00:00:00Z",
			completed_at: "2026-04-01T01:00:00Z",
			outputs: ["stages/design/foo.md"],
		}),
	)

	return { root, intentDir }
}

test("hasV3CruftInIntent detects v3 unit fields in a v4-stamped intent", () => {
	const { root, intentDir } = makePostMergeCruftIntent()
	try {
		const cruft = hasV3CruftInIntent(intentDir)
		assert.strictEqual(
			cruft,
			true,
			"a v3 unit's `status: completed` should be detected as cruft",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("hasV3CruftInIntent returns false for a fully-migrated tree", () => {
	const root = mkdtempSync(join(tmpdir(), "haiku-bug-e-clean-"))
	const intentDir = join(root, ".haiku", "intents", "test-clean")
	try {
		mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				mode: "continuous",
				plugin_version: "4.0.0",
				approvals: {},
				sealed_at: null,
				started_at: null,
			}),
		)
		writeFileSync(
			join(intentDir, "stages", "design", "units", "unit-01-foo.md"),
			matter.stringify("# unit-01-foo\n", {
				title: "foo",
				outputs: ["stages/design/foo.md"],
				iterations: [],
				discovery: {},
				reviews: {},
				approvals: {},
			}),
		)
		const cruft = hasV3CruftInIntent(intentDir)
		assert.strictEqual(
			cruft,
			false,
			"a clean v4 tree should not be flagged as cruft",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("hasV3CruftInIntent returns false for a v4 FB carrying live status / triaged_at / bolt / closed_by / resolution", () => {
	// Regression: a previous version of this helper checked the first
	// FB file per stage against DEPRECATED_FB_FIELDS. But v4's
	// writeFeedbackFile writes status/bolt/triaged_at/closed_by/
	// resolution to every new FB (the names overlap v3's vocabulary
	// but the values stay live in v4). The naive check fired on every
	// v4 intent with feedback → forced re-migration → migrateFeedbackFile's
	// strip() clobbered triaged_at (looping the triage gate) and
	// closed_by (losing closure attribution). The FB sentinel was
	// removed; this test pins the contract so it doesn't come back.
	const root = mkdtempSync(join(tmpdir(), "haiku-bug-e-fb-"))
	const intentDir = join(root, ".haiku", "intents", "test-fb")
	try {
		mkdirSync(join(intentDir, "stages", "design", "feedback"), {
			recursive: true,
		})
		mkdirSync(join(intentDir, "stages", "design", "units"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				mode: "continuous",
				plugin_version: "4.0.0",
			}),
		)
		// v4-shape unit (no v3 fields).
		writeFileSync(
			join(intentDir, "stages", "design", "units", "unit-01-foo.md"),
			matter.stringify("# unit-01-foo\n", {
				title: "foo",
				outputs: ["stages/design/foo.md"],
				iterations: [],
				discovery: {},
				reviews: {},
				approvals: {},
			}),
		)
		// v4-shape FB with the field names that overlap v3 vocabulary.
		// Mirrors the exact shape `writeFeedbackFile` produces at
		// state-tools.ts:5017.
		writeFileSync(
			join(intentDir, "stages", "design", "feedback", "01-fb.md"),
			matter.stringify("# fb body\n", {
				title: "test fb",
				status: "pending",
				origin: "user-chat",
				author: "user",
				author_type: "human",
				created_at: "2026-05-08T00:00:00Z",
				iteration: 0,
				visit: 0,
				source_ref: null,
				closed_by: null,
				bolt: 0,
				triaged_at: "2026-05-08T00:00:00Z",
				resolution: null,
				replies: [],
			}),
		)
		const cruft = hasV3CruftInIntent(intentDir)
		assert.strictEqual(
			cruft,
			false,
			"a v4 FB carrying live status/triaged_at/bolt/closed_by/resolution must NOT be flagged as v3 cruft — these are v4 field names too",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("hasV3CruftInIntent detects v3 state.json with status field", () => {
	const root = mkdtempSync(join(tmpdir(), "haiku-bug-e-state-"))
	const intentDir = join(root, ".haiku", "intents", "test-state")
	try {
		mkdirSync(join(intentDir, "stages", "design"), { recursive: true })
		writeFileSync(
			join(intentDir, "intent.md"),
			matter.stringify("# test\n", {
				title: "test",
				studio: "software",
				plugin_version: "4.0.0",
			}),
		)
		// v3-shape state.json that came back through merge.
		writeFileSync(
			join(intentDir, "stages", "design", "state.json"),
			JSON.stringify({ phase: "execute", status: "completed" }),
		)
		const cruft = hasV3CruftInIntent(intentDir)
		assert.strictEqual(
			cruft,
			true,
			"a v3 state.json with `status: completed` should be detected",
		)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test("re-migration on cruft cleans up the v3 unit fields", async () => {
	const { root, intentDir } = makePostMergeCruftIntent()
	try {
		const { __testOnly } = await import(
			"../src/orchestrator/migrations/v0-to-v4.ts"
		)
		// Simulate run-tick's forced re-migration: pass "0" as
		// effectiveSourceVersion to fire the v0→4.0.0 edge.
		__testOnly.v0ToV4({ intentDir, repoRoot: root })

		const fm = readFm(
			join(intentDir, "stages", "design", "units", "unit-01-foo.md"),
		)
		// v3-deprecated fields gone.
		assert.strictEqual(fm.status, undefined)
		assert.strictEqual(fm.hat, undefined)
		assert.strictEqual(fm.bolt, undefined)
		assert.strictEqual(fm.hat_started_at, undefined)
		assert.strictEqual(fm.completed_at, undefined)
		// approvals.user backfilled (was status: completed).
		assert.ok(fm.approvals?.user, "approvals.user should be backfilled")
		assert.strictEqual(fm.approvals.user.migrated, true)
		// outputs preserved.
		assert.deepStrictEqual(fm.outputs, ["stages/design/foo.md"])
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})
