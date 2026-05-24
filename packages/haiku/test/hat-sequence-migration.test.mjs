// hat-sequence-migration.test.mjs
//
// Phase 4: reconcile units whose iterations name a hat the stage's sequence
// no longer has (the security reshape dropped red-team/blue-team from the
// per-unit loop, stranding the live admin-portal-reimagine unit-006 capped at
// blue-team). Policy: trim iterations to the unit's current hat set so the
// cursor reads loop-complete (terminal verify advanced) or pending (nothing
// in-sequence advanced) correctly. Findings survive as FBs.

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

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..", "src")
const PLUGIN_ROOT = join(resolve(HERE, "..", "..", ".."), "plugin")
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT

const t = "2026-05-13T00:00:00Z"
const adv = (hat) => ({
	hat,
	started_at: t,
	completed_at: t,
	result: "advance",
})
const open = (hat) => ({ hat, started_at: t, completed_at: null, result: null })

function setup(units) {
	const slug = "mig-test"
	const tmp = mkdtempSync(join(tmpdir(), "haiku-hatmig-"))
	const iDir = join(tmp, ".haiku", "intents", slug)
	const unitsDir = join(iDir, "stages", "security", "units")
	mkdirSync(unitsDir, { recursive: true })
	writeFileSync(
		join(iDir, "intent.md"),
		matter.stringify("# t\n", {
			title: "t",
			studio: "software",
			mode: "continuous",
			stages: ["security"],
		}),
	)
	for (const [name, iterations] of Object.entries(units)) {
		writeFileSync(
			join(unitsDir, `${name}.md`),
			matter.stringify(`# ${name}\n`, { title: name, iterations }),
		)
	}
	return { slug, tmp, unitsDir }
}

function itersOf(unitsDir, name) {
	return matter(readFileSync(join(unitsDir, `${name}.md`), "utf8")).data
		.iterations
}

test("trims orphan-hat iterations; loop-complete unit keeps its in-sequence tail", async () => {
	// real software/security hats are now [threat-modeler, security-engineer,
	// security-reviewer] — red-team/blue-team are orphans after the reshape.
	const { slug, tmp, unitsDir } = setup({
		// unit-006 shape: verify advanced, then the now-removed red/blue tail.
		"unit-06-capped": [
			adv("threat-modeler"),
			adv("security-engineer"),
			adv("security-reviewer"),
			adv("red-team"),
			open("blue-team"),
		],
		// nothing in-sequence advanced — all orphan.
		"unit-09-allorphan": [adv("red-team"), open("blue-team")],
		// clean — no orphan, must be untouched (idempotent).
		"unit-02-clean": [
			adv("threat-modeler"),
			adv("security-engineer"),
			open("security-reviewer"),
		],
	})
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { reconcileOrphanedHatSequences } = await import(
			`${SRC}/orchestrator/workflow/hat-sequence-migration.ts`
		)
		const { deriveUnitStatus } = await import(`${SRC}/state-tools.ts`)
		const res = reconcileOrphanedHatSequences(slug)

		assert.deepStrictEqual(
			res.reconciled.sort(),
			["security/unit-06-capped", "security/unit-09-allorphan"],
			"only the two units with orphan hats are reconciled",
		)

		// unit-06: red/blue trimmed, terminal verify advance preserved.
		const capped = itersOf(unitsDir, "unit-06-capped")
		assert.deepStrictEqual(
			capped.map((i) => i.hat),
			["threat-modeler", "security-engineer", "security-reviewer"],
			"orphan red/blue entries trimmed; plan-do-verify tail intact",
		)
		assert.strictEqual(
			capped[capped.length - 1].result,
			"advance",
			"ends at the verify advance (loop-complete)",
		)

		// unit-09: all orphan → trimmed to empty → derives pending.
		const allorphan = itersOf(unitsDir, "unit-09-allorphan")
		assert.strictEqual(
			allorphan.length,
			0,
			"all-orphan iterations trimmed to empty",
		)
		assert.strictEqual(
			deriveUnitStatus({ iterations: allorphan }),
			"pending",
			"a fully-orphaned unit resets to pending",
		)

		// unit-02: untouched.
		assert.strictEqual(
			itersOf(unitsDir, "unit-02-clean").length,
			3,
			"clean unit untouched",
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(tmp, { recursive: true, force: true })
	}
})

test("no orphan hats → no-op (idempotent)", async () => {
	const { slug, tmp, unitsDir } = setup({
		"unit-01": [adv("threat-modeler"), open("security-engineer")],
	})
	const orig = process.cwd()
	try {
		process.chdir(tmp)
		const { reconcileOrphanedHatSequences } = await import(
			`${SRC}/orchestrator/workflow/hat-sequence-migration.ts`
		)
		const res = reconcileOrphanedHatSequences(slug)
		assert.deepStrictEqual(res.reconciled, [], "nothing reconciled")
		assert.strictEqual(
			itersOf(unitsDir, "unit-01").length,
			2,
			"iterations untouched",
		)
	} finally {
		try {
			process.chdir(orig)
		} catch {
			process.chdir(tmpdir())
		}
		rmSync(tmp, { recursive: true, force: true })
	}
})
