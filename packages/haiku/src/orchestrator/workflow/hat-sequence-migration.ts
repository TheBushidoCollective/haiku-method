// orchestrator/workflow/hat-sequence-migration.ts — reconcile UNIT and
// FEEDBACK iterations so they only ever name a hat that (1) is declared in
// the stage's settings for that entity and (2) actually resolves to a hat
// file in the cascade.
//
// The rule (set with Jason): an iteration's `hat` is valid only if it is the
// right KIND of hat for the entity AND a file exists for it:
//   - UNIT iterations    → the stage's `hats:` (plan-do-verify rotation).
//   - STAGE feedback      → the stage's `fix_hats:` (the fix loop).
//   - INTENT feedback     → the studio's `fix_hats:` (intent-completion loop).
// "hats are for units, fix hats are for feedback/fix loops" — a unit must
// never carry a fix hat (e.g. `feedback-assessor`) and a feedback item must
// never carry a unit rotation hat. The file-existence half catches a hat
// named in settings that has no mandate file in the resolution path (a studio
// misconfiguration or a hat removed by a reshape).
//
// Policy: TRIM each entity's iterations to entries whose hat is valid. The
// consequence falls out of `deriveUnitStatus` / the cursor automatically:
//   - terminal in-sequence advance preserved → reads loop-complete.
//   - nothing valid advanced → trimmed to empty → derives pending → re-runs
//     cleanly under the current sequence.
// Findings the removed hats filed survive as feedback files, so trimming the
// iteration ENTRIES loses no work — only references to invalid hats. Iteration
// entries with no `hat` field are structurally normal and kept.
//
// Idempotent. Runs pre-cursor in run-tick. No git/worktree side effects —
// pure on-disk FM reconciliation.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { intentDir } from "../../state-tools.js"
import {
	readStudioFixHatPaths,
	resolveFixHatPath,
	resolveHatPath,
} from "../../studio-reader.js"
import {
	resolveStageFixHats,
	resolveStageHats,
	resolveStudioFixHats,
} from "../studio.js"

type IterEntry = { hat?: unknown } & Record<string, unknown>

/** Hats valid on a UNIT's iterations: the stage's `hats:` rotation, keeping
 *  only those that resolve to a hat file in the cascade. */
function validUnitHats(studio: string, stage: string): Set<string> {
	return new Set(
		resolveStageHats(studio, stage).filter(
			(h) => resolveHatPath(studio, stage, h) !== null,
		),
	)
}

/** Hats valid on a STAGE-scope feedback item's iterations: the stage's
 *  `fix_hats:`, keeping only those that resolve to a (fix-)hat file. */
function validStageFixHats(studio: string, stage: string): Set<string> {
	return new Set(
		resolveStageFixHats(studio, stage).filter(
			(h) => resolveFixHatPath(studio, stage, h) !== null,
		),
	)
}

/** Hats valid on an INTENT-scope feedback item's iterations: the studio's
 *  `fix_hats:`, keeping only those with a studio fix-hat mandate file. */
function validStudioFixHats(studio: string): Set<string> {
	const paths = readStudioFixHatPaths(studio)
	return new Set(resolveStudioFixHats(studio).filter((h) => paths[h] != null))
}

/** Trim one FM file's `iterations[]` to entries whose `hat` is in `valid`
 *  (hat-absent entries are kept — they're structurally normal). Returns true
 *  when it rewrote the file. Clones before mutating so gray-matter's
 *  content-keyed parse cache isn't poisoned for later reads. */
function trimIterations(path: string, valid: Set<string>): boolean {
	let parsed: { data: Record<string, unknown>; content: string }
	try {
		parsed = matter(readFileSync(path, "utf8"))
	} catch {
		return false
	}
	const iters = Array.isArray(parsed.data.iterations)
		? (parsed.data.iterations as IterEntry[])
		: []
	if (iters.length === 0) return false
	const isInvalid = (it: IterEntry) =>
		typeof it?.hat === "string" && !valid.has(it.hat)
	if (!iters.some(isInvalid)) return false
	const trimmed = iters.filter((it) => !isInvalid(it))
	const data = structuredClone(parsed.data)
	data.iterations = trimmed
	writeFileSync(path, matter.stringify(parsed.content, data))
	return true
}

/** Trim every `*.md` in `dir` against `valid`, recording `${label}/<name>` for
 *  each file changed. No-op when the dir is absent. */
function reconcileDir(
	dir: string,
	valid: Set<string>,
	label: string,
	reconciled: string[],
): void {
	if (!existsSync(dir)) return
	for (const file of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
		if (trimIterations(join(dir, file), valid)) {
			reconciled.push(`${label}/${file.replace(/\.md$/, "")}`)
		}
	}
}

export function reconcileOrphanedHatSequences(slug: string): {
	reconciled: string[]
} {
	const reconciled: string[] = []
	const iDir = intentDir(slug)
	const intentFile = join(iDir, "intent.md")
	if (!existsSync(intentFile)) return { reconciled }

	let stages: string[] = []
	let studio = ""
	try {
		const { data } = matter(readFileSync(intentFile, "utf8"))
		stages = Array.isArray(data.stages) ? (data.stages as string[]) : []
		studio = typeof data.studio === "string" ? data.studio : ""
	} catch {
		return { reconciled }
	}
	if (!studio) return { reconciled }

	for (const stage of stages) {
		// Units run the stage `hats:` rotation.
		reconcileDir(
			join(iDir, "stages", stage, "units"),
			validUnitHats(studio, stage),
			stage,
			reconciled,
		)
		// Stage-scope feedback runs the stage `fix_hats:` loop.
		reconcileDir(
			join(iDir, "stages", stage, "feedback"),
			validStageFixHats(studio, stage),
			`${stage}/feedback`,
			reconciled,
		)
	}

	// Intent-scope feedback runs the studio `fix_hats:` loop.
	reconcileDir(
		join(iDir, "feedback"),
		validStudioFixHats(studio),
		"feedback",
		reconciled,
	)

	return { reconciled }
}
