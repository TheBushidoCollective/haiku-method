// studio-hat-continuity.test.mjs
//
// Every hat a studio references — in a stage's `hats:`, a stage's
// `fix_hats:`, or the studio-level `fix_hats:` on STUDIO.md — MUST
// resolve to a mandate file on disk through one of the resolution
// cascades. A reference with no backing file is the bug class behind
// fixloop-bug-f4dd5a92 Bug 1: the engine dispatched a `reconciler` hat
// whose mandate the builder couldn't find, so every subagent fell back
// to "no on-disk mandate file resolved" and operated blind.
//
// Resolution tiers exercised here:
//   - Stage `hats:` and stage `fix_hats:` → `resolveHatPath(studio,
//     stage, hat)` (global `plugin/hats/` → studio `hats/` → stage
//     `hats/`). This is where `classifier` / `feedback-assessor`
//     (global) and per-stage hats both land.
//   - Studio-level `fix_hats:` (on STUDIO.md) → `readStudioFixHatPaths`
//     (studio `fix-hats/`). These run against intent-scope feedback;
//     they are NOT stage hats and resolve through a different dir.
//
// The test walks the SHIPPED plugin studios directly off disk — no
// engine state, no intent fixture — so a new studio/stage that
// declares an unbacked hat fails this test the moment it lands.

import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const SRC = new URL("../src/", import.meta.url).pathname
const TEST_DIR = fileURLToPath(new URL(".", import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, "..", "..", "..")
const PLUGIN_ROOT = join(REPO_ROOT, "plugin")
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT

const STUDIOS_DIR = join(PLUGIN_ROOT, "studios")

function readFm(path) {
	return matter(readFileSync(path, "utf8")).data
}

function listDirs(dir) {
	try {
		return readdirSync(dir).filter((e) => {
			try {
				return statSync(join(dir, e)).isDirectory()
			} catch {
				return false
			}
		})
	} catch {
		return []
	}
}

const studios = listDirs(STUDIOS_DIR)
assert.ok(studios.length > 0, `expected studios under ${STUDIOS_DIR}`)

test("every stage hat + stage fix_hat resolves to a mandate file", async () => {
	const { resolveHatPath } = await import(`${SRC}studio-reader.ts`)
	const misses = []
	for (const studio of studios) {
		const stagesDir = join(STUDIOS_DIR, studio, "stages")
		for (const stage of listDirs(stagesDir)) {
			const stageMd = join(stagesDir, stage, "STAGE.md")
			let fm
			try {
				fm = readFm(stageMd)
			} catch {
				continue // no STAGE.md — not a real stage dir
			}
			const hatNames = [
				...(Array.isArray(fm.hats) ? fm.hats : []),
				...(Array.isArray(fm.fix_hats) ? fm.fix_hats : []),
			]
			for (const hat of hatNames) {
				if (typeof hat !== "string" || hat.length === 0) continue
				const path = resolveHatPath(studio, stage, hat)
				if (!path) {
					misses.push(`${studio}/${stage}: hat \`${hat}\` resolves to nothing`)
				}
			}
		}
	}
	assert.equal(
		misses.length,
		0,
		`unbacked stage hats:\n${misses.join("\n")}`,
	)
})

test("every studio-level fix_hat resolves to a studio fix-hat mandate file", async () => {
	const { readStudioFixHatPaths } = await import(`${SRC}studio-reader.ts`)
	const misses = []
	for (const studio of studios) {
		const studioMd = join(STUDIOS_DIR, studio, "STUDIO.md")
		let fm
		try {
			fm = readFm(studioMd)
		} catch {
			continue
		}
		const fixHats = Array.isArray(fm.fix_hats) ? fm.fix_hats : []
		if (fixHats.length === 0) continue
		const paths = readStudioFixHatPaths(studio)
		for (const hat of fixHats) {
			if (typeof hat !== "string" || hat.length === 0) continue
			if (!paths[hat]) {
				misses.push(
					`${studio}: studio-level fix_hat \`${hat}\` has no file in studios/${studio}/fix-hats/`,
				)
			}
		}
	}
	assert.equal(
		misses.length,
		0,
		`unbacked studio fix_hats:\n${misses.join("\n")}`,
	)
})

// A fix_hats chain that resolves a finding by landing a real change
// MUST contain at least one implementer. A chain made ENTIRELY of
// triager/verifier/reconciler hats can never close a code-level finding
// → the fixer reports "fixed" without touching files, the verifier
// re-rejects, and the loop churns until the bolt cap halts it. This is
// exactly the `software` studio's intent-scope `[reconciler, validator]`
// gap (2026-05-19): no implementer, so FB-001 (21 failing quality-gate
// commands) could never close.
//
// The denylist is SCOPE-AWARE because `validator` is an overloaded name:
//   - At INTENT scope (studio `fix-hats/`), `validator` is the pure
//     terminal verifier — `MUST NOT edit any file`. So a studio chain
//     of only {classifier, validator, feedback-assessor, reconciler} has
//     no implementer.
//   - At STAGE scope, `validator` is frequently the domain WORKER (e.g.
//     data-pipeline/validation and migration/validation, where it builds
//     the data-quality test suite / writes reconciliation evidence — it
//     lands artifacts). So `validator` is NOT a non-implementer there.
// `classifier`, `feedback-assessor`, and `reconciler` are non-implementers
// at every scope.
const INTENT_NON_IMPLEMENTERS = new Set([
	"classifier",
	"validator",
	"feedback-assessor",
	"reconciler",
])
const STAGE_NON_IMPLEMENTERS = new Set([
	"classifier",
	"feedback-assessor",
	"reconciler",
])

function chainHasImplementer(hats, denylist) {
	return hats.some(
		(h) => typeof h === "string" && h.length > 0 && !denylist.has(h),
	)
}

test("every studio-level fix_hats chain contains an implementer hat", async () => {
	const misses = []
	for (const studio of studios) {
		const studioMd = join(STUDIOS_DIR, studio, "STUDIO.md")
		let fm
		try {
			fm = readFm(studioMd)
		} catch {
			continue
		}
		const fixHats = Array.isArray(fm.fix_hats) ? fm.fix_hats : []
		if (fixHats.length === 0) continue
		if (!chainHasImplementer(fixHats, INTENT_NON_IMPLEMENTERS)) {
			misses.push(
				`${studio}: studio-level fix_hats [${fixHats.join(", ")}] has no implementer — every hat is a triager/verifier/reconciler, so no finding can ever close`,
			)
		}
	}
	assert.equal(
		misses.length,
		0,
		`fix_hats chains with no implementer:\n${misses.join("\n")}`,
	)
})

test("every stage fix_hats chain contains an implementer hat", async () => {
	const misses = []
	for (const studio of studios) {
		const stagesDir = join(STUDIOS_DIR, studio, "stages")
		for (const stage of listDirs(stagesDir)) {
			const stageMd = join(stagesDir, stage, "STAGE.md")
			let fm
			try {
				fm = readFm(stageMd)
			} catch {
				continue
			}
			const fixHats = Array.isArray(fm.fix_hats) ? fm.fix_hats : []
			if (fixHats.length === 0) continue
			if (!chainHasImplementer(fixHats, STAGE_NON_IMPLEMENTERS)) {
				misses.push(
					`${studio}/${stage}: fix_hats [${fixHats.join(", ")}] has no implementer — every hat is a triager/verifier/reconciler, so no finding can ever close`,
				)
			}
		}
	}
	assert.equal(
		misses.length,
		0,
		`stage fix_hats chains with no implementer:\n${misses.join("\n")}`,
	)
})

test("every stage review-agent + intent-review-agent resolves to a mandate file", async () => {
	const { resolveReviewAgentPath } = await import(`${SRC}studio-reader.ts`)
	const misses = []
	for (const studio of studios) {
		const stagesDir = join(STUDIOS_DIR, studio, "stages")
		for (const stage of listDirs(stagesDir)) {
			const stageMd = join(stagesDir, stage, "STAGE.md")
			let fm
			try {
				fm = readFm(stageMd)
			} catch {
				continue
			}
			const agents = Array.isArray(fm.review_agents) ? fm.review_agents : []
			for (const agent of agents) {
				if (typeof agent !== "string" || agent.length === 0) continue
				const path = resolveReviewAgentPath(studio, stage, agent)
				if (!path) {
					misses.push(
						`${studio}/${stage}: review-agent \`${agent}\` resolves to nothing`,
					)
				}
			}
		}
	}
	assert.equal(
		misses.length,
		0,
		`unbacked stage review-agents:\n${misses.join("\n")}`,
	)
})
