// fb-close-restamps-surviving-witnesses.test.mjs
//
// Regression for the 2026-05-18 fix-loop-on-its-own-remediation bug
// (haiku-loop-bug-report, admin-portal-reimagine/design FB-160→161-165).
//
// Root cause: when a fix-loop hat edits the unit body to address a
// finding, the body_sha256 of any still-signed review/approval role
// NOT in `targets.invalidates` is now stale. The next drift sweep
// fires `spec` drift events for each surviving role; the drift handler
// files FBs for each. The fix loop tries to "fix" these self-healed-
// by-design findings, can't make on-disk progress, and `loop_halted`.
//
// Fix: at FB close time, `closeFeedbackPostHook` restamps the
// `body_sha256` on every surviving (i.e., not-invalidated) signed
// slot to the unit's CURRENT body sha. Semantic: "the fix-loop's body
// modification is authoritative; non-invalidated roles re-witness
// against the new body." The next drift sweep sees witness == current
// for those roles → no spurious drift, no FB flood, no loop halt.

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

import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
process.env.CLAUDE_PLUGIN_ROOT = join(REPO_ROOT, "plugin")

async function importHook() {
	return import(`${SRC}feedback-close-hook.ts`)
}

async function importSignSlot() {
	return import(`${SRC}orchestrator/workflow/sign-slot.ts`)
}

function seedUnit({ tmp, slug, stage, unit, body, reviews, approvals }) {
	const intentDir = join(tmp, ".haiku", "intents", slug)
	const unitsDir = join(intentDir, "stages", stage, "units")
	mkdirSync(unitsDir, { recursive: true })
	writeFileSync(
		join(intentDir, "intent.md"),
		"---\nstudio: software\n---\nintent body\n",
	)
	const unitPath = join(unitsDir, `${unit}.md`)
	writeFileSync(
		unitPath,
		matter.stringify(body, { reviews, approvals }),
	)
	return { intentDir, unitPath }
}

test("close-hook restamps surviving roles to current body_sha256 (drift won't re-fire on the fix-loop's own edit)", async () => {
	const { closeFeedbackPostHook } = await importHook()
	const { bodySha256 } = await importSignSlot()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-restamp-"))
	const origCwd = process.cwd()
	process.chdir(tmp)
	try {
		const { intentDir, unitPath } = seedUnit({
			tmp,
			slug: "demo",
			stage: "design",
			unit: "unit-01",
			body: "Updated body — fix-loop added LAYOUT-GRID citation table.",
			reviews: {
				// continuity will be invalidated by the FB's targets.invalidates.
				continuity: {
					at: "2026-05-18T15:00:00Z",
					body_sha256: "deadbeef-stale-from-before-fix-loop-edit",
				},
				// spec and cross-stage-consistency are NOT invalidated — they
				// must get restamped to the current body sha, otherwise drift
				// fires on the next sweep.
				spec: {
					at: "2026-05-18T15:00:00Z",
					body_sha256: "deadbeef-stale-from-before-fix-loop-edit",
				},
				"cross-stage-consistency": {
					at: "2026-05-18T15:00:00Z",
					body_sha256: "deadbeef-stale-from-before-fix-loop-edit",
				},
			},
			approvals: {
				quality_gates: {
					at: "2026-05-18T15:00:00Z",
					body_sha256: "deadbeef-stale-from-before-fix-loop-edit",
				},
			},
		})
		const expectedSha = bodySha256(unitPath)
		assert.ok(expectedSha, "fixture must produce a body sha")

		closeFeedbackPostHook({
			slug: "demo",
			stage: "design",
			feedbackId: "FB-160",
			fbFm: {
				targets: {
					unit: "unit-01",
					invalidates: ["continuity"],
				},
				closed_by: "fix-loop:FB-160:bolt-1",
			},
		})

		const after = matter(readFileSync(unitPath, "utf8")).data
		// continuity was invalidated — should be GONE.
		assert.equal(
			after.reviews?.continuity,
			undefined,
			`continuity was in targets.invalidates — must be deleted from reviews. got: ${JSON.stringify(after.reviews?.continuity)}`,
		)
		// spec was NOT invalidated — must survive AND have body_sha256
		// restamped to the current body.
		assert.equal(
			after.reviews?.spec?.body_sha256,
			expectedSha,
			`spec survived invalidation — its body_sha256 must restamp to current body so the next drift sweep doesn't fire. got: ${JSON.stringify(after.reviews?.spec)}`,
		)
		assert.equal(
			after.reviews?.["cross-stage-consistency"]?.body_sha256,
			expectedSha,
			`cross-stage-consistency must restamp too. got: ${JSON.stringify(after.reviews?.["cross-stage-consistency"])}`,
		)
		// `at` timestamp must be preserved (audit trail intact — the
		// human/agent signed at this time, restamping the witness is
		// engine bookkeeping that doesn't replace the signature).
		assert.equal(
			after.reviews?.spec?.at,
			"2026-05-18T15:00:00Z",
			`spec.at must be preserved (audit trail). got: ${JSON.stringify(after.reviews?.spec)}`,
		)
		// Approval also restamps.
		assert.equal(
			after.approvals?.quality_gates?.body_sha256,
			expectedSha,
			`approval slots also restamp. got: ${JSON.stringify(after.approvals?.quality_gates)}`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("close-hook does NOT restamp invalidated roles (they're already deleted)", async () => {
	// Sanity check: applyFeedbackInvalidations deletes the named roles
	// (step 1). The restamp step (step 2) must skip them — restamping a
	// just-deleted slot would silently revive it under a current witness
	// and the cursor's re-dispatch wouldn't fire.
	const { closeFeedbackPostHook } = await importHook()
	const tmp = mkdtempSync(join(tmpdir(), "haiku-restamp-"))
	const origCwd = process.cwd()
	process.chdir(tmp)
	try {
		const { unitPath } = seedUnit({
			tmp,
			slug: "demo",
			stage: "design",
			unit: "unit-01",
			body: "post-fix body",
			reviews: {
				continuity: { at: "t", body_sha256: "old-sha" },
				spec: { at: "t", body_sha256: "old-sha" },
			},
			approvals: {},
		})
		closeFeedbackPostHook({
			slug: "demo",
			stage: "design",
			feedbackId: "FB-200",
			fbFm: {
				targets: {
					unit: "unit-01",
					invalidates: ["continuity"],
				},
				closed_by: "fix-loop:FB-200:bolt-1",
			},
		})
		const after = matter(readFileSync(unitPath, "utf8")).data
		assert.equal(
			"continuity" in (after.reviews ?? {}),
			false,
			`continuity must be GONE — not silently restamped back into existence. got: ${JSON.stringify(after.reviews)}`,
		)
		assert.ok(
			after.reviews?.spec,
			`spec survived (not in invalidates list). got: ${JSON.stringify(after.reviews?.spec)}`,
		)
	} finally {
		process.chdir(origCwd)
		rmSync(tmp, { recursive: true, force: true })
	}
})
