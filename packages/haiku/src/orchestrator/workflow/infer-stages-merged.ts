// orchestrator/workflow/infer-stages-merged.ts — Recover the
// `stages_merged` list on intent.md from git history when the
// migrator's primary signal (per-stage `state.json` status) is
// missing or unreliable.
//
// Why this exists: the v0→v4 migrator stamps `stages_merged` from
// each stage's v3 `state.json` content at the moment migration runs.
// Two failure modes leave the stamp empty even when the stage is
// actually done:
//
//   1. **Clobbered status**: v3's "create FB after stage completion"
//      path rewrote `state.json` from `status: "completed"` back to
//      `"active"`. The migrator reads HEAD's state.json and misses
//      the prior completion signal.
//   2. **Branch deleted post-merge**: v3 sometimes deleted stage
//      branches after merging into intent main. The migrator's
//      state.json check misses these too (no stage dir, nothing to
//      read), and the cursor's `git --is-ancestor` check fails
//      because the branch ref is gone.
//
// The cursor's `firstUnmergedStage` consults `stages_merged` as a
// definitive override, so back-filling it from git history fully
// recovers the cursor's stage walk.
//
// **Stable v3 commit-message signals** that this module greps for:
//   - `haiku: complete stage <name>`  — stage's gate passed
//   - `haiku: merge stage <name> into main`  — stage branch landed
//
// Both are emitted by the v3 workflow engine and live in commit
// messages, which git history preserves regardless of how state.json
// was later edited. As long as either signal is present anywhere in
// the intent's main-branch ancestry, the stage is merged.

import { isGitRepo } from "../../state-tools.js"
import { tryRun } from "./git-utils.js"

/**
 * Walk `git log haiku/<slug>/main` (or `origin/...` when local is
 * absent), collect commit subjects, and return the set of stages
 * that match either of the v3 completion-message patterns.
 *
 * Filtered to `configuredStages` so a renamed/forked studio doesn't
 * pollute the result with stages the current studio doesn't declare.
 */
export function inferStagesMergedFromGit(
	slug: string,
	configuredStages: string[],
): string[] {
	if (!isGitRepo()) return []
	if (configuredStages.length === 0) return []
	const branch = `haiku/${slug}/main`
	const tryRefs = [branch, `origin/${branch}`]
	let log = ""
	for (const ref of tryRefs) {
		log = tryRun(["git", "log", "--format=%s", ref])
		if (log) break
	}
	if (!log) return []
	const completePattern = /^haiku:\s+complete\s+stage\s+(\S+)/
	const mergePattern = /^haiku:\s+merge\s+stage\s+(\S+)\s+into\s+main/
	const merged = new Set<string>()
	for (const line of log.split("\n")) {
		const trimmed = line.trim()
		const completeMatch = completePattern.exec(trimmed)
		if (completeMatch && configuredStages.includes(completeMatch[1])) {
			merged.add(completeMatch[1])
			continue
		}
		const mergeMatch = mergePattern.exec(trimmed)
		if (mergeMatch && configuredStages.includes(mergeMatch[1])) {
			merged.add(mergeMatch[1])
		}
	}
	return Array.from(merged)
}

/**
 * Idempotent merge of git-inferred stages into the existing
 * `stages_merged` list. Pure function — caller writes the result back
 * to intent.md if it differs from the input.
 */
export function reconcileStagesMerged(
	existing: string[],
	inferred: string[],
): { value: string[]; changed: boolean } {
	const existingSet = new Set(existing)
	let changed = false
	for (const stage of inferred) {
		if (!existingSet.has(stage)) {
			existingSet.add(stage)
			changed = true
		}
	}
	if (!changed) return { value: existing, changed: false }
	return { value: Array.from(existingSet), changed: true }
}
