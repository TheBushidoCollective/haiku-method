// orchestrator/workflow/fix-chain-merge-gate.ts — pre-tick completion of
// pending fix-chain worktree merges.
//
// A fix-chain's hat loop runs its code corrections on its own branch
// `haiku/<slug>/fix-<scope>-<FB>` in a worktree; the terminal close
// (`haiku_feedback_advance_hat` on the last fix-hat) merges that branch into
// the base (stage branch, or intent main) under `withStageLock`. On a CLEAN
// merge the worktree is reaped inline and nothing reaches this gate. On a
// CONFLICT `mergeFixChainWorktree` leaves the merge in-progress in the
// worktree (markers for the agent to resolve) and the close handler hands back
// an `integrate_fix_chains` action. The agent resolves + commits in the
// worktree and re-ticks.
//
// THIS gate is what completes the merge on that re-tick: for every
// advance-CLOSED FB whose fix-chain worktree still exists, it re-calls
// `mergeFixChainWorktree` (which sees `MERGE_HEAD`, commits the resolution,
// and forward-merges into the base). If the agent hasn't finished resolving
// (markers remain), the merge returns `isConflict` again and we re-surface
// `integrate_fix_chains`. Rejected FBs are skipped — their code is discarded
// by the reject handler's `cleanupFixChainWorktree`, not merged.
//
// This is a pre-tick gate (NOT the cursor — it reads git + drives merges,
// which Rule 1 forbids the cursor from doing). It runs before the cursor walk
// so a stage can't advance with a fix-chain's code still stranded in its
// worktree. No-op in filesystem mode and for the simulation-shaped state the
// e2e fixtures produce (FBs closed by direct iteration writes never created a
// fix-chain worktree).

import { existsSync, readdirSync, readFileSync } from "node:fs"
import {
	fixChainWorktreePath,
	mergeFixChainWorktree,
} from "../../git-worktree.js"
import { withStageLock } from "../../locks.js"
import {
	deriveFeedbackStatus,
	feedbackDir,
	formatFeedbackId,
	intentDir,
	isGitRepo,
	parseFrontmatter,
} from "../../state-tools.js"
import type { OrchestratorAction } from "../../orchestrator.js"
import { resolveIntentStages } from "../studio.js"

interface PendingFixMerge {
	feedbackId: string
	scope: string
	worktree: string
	conflictFiles: string[]
}

/** Complete any pending fix-chain worktree merges left mid-conflict by a prior
 *  terminal close. Returns an `integrate_fix_chains` action when one or more
 *  chains still have unresolved conflict markers (the agent must resolve them
 *  in the worktree, commit, and re-tick); null when nothing is pending or all
 *  pending merges completed this tick. */
export function completePendingFixChainMerges(
	slug: string,
	studio: string,
): { action: OrchestratorAction | null } {
	if (!isGitRepo()) return { action: null }
	const stillPending: PendingFixMerge[] = []
	try {
		const iDir = intentDir(slug)
		const intentMd = `${iDir}/intent.md`
		if (!existsSync(intentMd)) return { action: null }
		const intentFm = parseFrontmatter(readFileSync(intentMd, "utf8")).data
		// Stage-scoped fix-chains live under each stage's feedback/ dir; the
		// intent-completion fix loop's chains live under the intent-scope
		// feedback/ dir (scope === "intent"). Walk both.
		const scopes = [...resolveIntentStages(intentFm, studio), ""]
		for (const stage of scopes) {
			const scope = stage || "intent"
			const fbDir = feedbackDir(slug, stage)
			if (!existsSync(fbDir)) continue
			for (const f of readdirSync(fbDir).filter((n) => n.endsWith(".md"))) {
				let fm: Record<string, unknown>
				try {
					fm = parseFrontmatter(readFileSync(`${fbDir}/${f}`, "utf8")).data
				} catch {
					continue
				}
				// Only advance-CLOSED chains get merged. Open chains are still
				// in their fix loop; rejected chains had their code discarded.
				if (deriveFeedbackStatus(fm) !== "closed") continue
				// FB files are named `<zero-padded-num>-<slug>.md`; canonicalize
				// the leading number to the `FB-NNN` id the worktree path uses.
				const num = Number.parseInt(f.match(/^(\d+)/)?.[1] ?? "", 10)
				if (!Number.isFinite(num) || num <= 0) continue
				const feedbackId = formatFeedbackId(num)
				const worktree = fixChainWorktreePath(slug, scope, feedbackId)
				// No surviving worktree → the close handler's inline merge already
				// reaped it (clean merge). Nothing to complete.
				if (!existsSync(worktree)) continue
				const merge = withStageLock(slug, scope, () =>
					mergeFixChainWorktree(slug, scope, feedbackId),
				)
				if (!merge.success) {
					stillPending.push({
						feedbackId,
						scope,
						worktree,
						conflictFiles: merge.conflictFiles ?? [],
					})
				}
			}
		}
	} catch {
		// Best-effort — a failure here must not wedge the tick. The next tick
		// retries; a genuinely broken merge surfaces via the close handler.
		return { action: null }
	}

	if (stillPending.length === 0) return { action: null }
	const list = stillPending.map((p) => p.feedbackId).join(", ")
	const scope = stillPending[0].scope
	return {
		action: {
			action: "integrate_fix_chains",
			intent: slug,
			scope,
			items: stillPending.map((p) => ({ feedback_id: p.feedbackId })),
			message:
				`${stillPending.length} fix-chain merge(s) still have unresolved conflicts: ${list}. ` +
				stillPending
					.map(
						(p) =>
							`For ${p.feedbackId}: resolve the conflicted file(s) in ${p.worktree} (${p.conflictFiles.join(", ") || "see git status"}), \`git add\` them, \`git commit\` to complete the in-worktree merge.`,
					)
					.join(" ") +
				` Then call \`haiku_run_next { intent: "${slug}" }\` — the engine forward-merges each resolved chain into its base branch on the next tick.`,
		} as OrchestratorAction,
	}
}
