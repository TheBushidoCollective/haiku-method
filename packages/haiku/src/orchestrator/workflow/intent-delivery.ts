// intent-delivery.ts — "is this intent's work actually delivered?"
//
// The merge-into-default-branch signal that gates the terminal seal. An
// intent is only SEALED (the terminal write-lock — `sealed_at` on
// intent.md) once its `haiku/<slug>/main` hub branch has landed on the
// repo's default branch — merged locally or via a remote PR/MR. Until
// then the cursor holds it in `pending_seal`: every stage is built,
// every approval is signed, the work is done — but the delivery hasn't
// crossed the finish line, so the lifecycle stays open.
//
// This honors "never merge unless asked": the engine NEVER performs the
// merge into the default branch. It only OBSERVES whether the merge has
// happened (by the user, by a merged PR, by branch protection) and seals
// once it has.
//
// Two read modes:
//   - authoritative (default): squash-merge-aware via `isBranchMerged`
//     (local `--is-ancestor` first, then a `gh`/`glab` merged-PR probe).
//     Used by the cursor's terminal gate — the signal that actually
//     writes `sealed_at` must not false-hold a squash-merged delivery.
//   - localOnly: cheap `--is-ancestor` only, no network. Used by the
//     list / current-state DISPLAY paths called per-request/per-intent
//     where a `gh`/`glab` probe per intent would be too costly; a
//     transient `pending_seal` on a squash-merged-but-not-yet-ticked
//     intent is acceptable there (the next authoritative tick seals it).

import {
	branchExists,
	getMainlineBranch,
	isAncestor,
	isBranchMerged,
} from "../../git-worktree.js"
import { isGitRepo } from "../../state/shared.js"

export interface IntentDeliveryState {
	/** True when the merge gate APPLIES: the repo is git-backed, a
	 *  default branch resolves, and the intent has a `haiku/<slug>/main`
	 *  hub branch to land. When false the gate is inapplicable
	 *  (filesystem mode, no resolvable default, or a pre-branch intent)
	 *  and the intent seals immediately, exactly as it did before. */
	applicable: boolean
	/** The resolved default branch name (empty when not applicable). */
	defaultBranch: string
	/** The intent's hub branch — `haiku/<slug>/main`. */
	intentMain: string
	/** True when `intentMain` has landed on `defaultBranch`. Always true
	 *  when `!applicable` so callers can treat "merged" as "free to
	 *  seal" without branching on `applicable`. */
	merged: boolean
}

/** Resolve whether an intent's hub branch has been delivered (merged)
 *  into the repo's default branch. See the module header for the two
 *  read modes. */
export function intentDeliveryState(
	slug: string,
	opts: { localOnly?: boolean } = {},
): IntentDeliveryState {
	const intentMain = `haiku/${slug}/main`
	if (!isGitRepo()) {
		return { applicable: false, defaultBranch: "", intentMain, merged: true }
	}
	const defaultBranch = getMainlineBranch()
	// No resolvable default branch, or the intent never forked a hub
	// branch (filesystem-shaped / pre-branch intent) → the gate is
	// inapplicable; treat as merged so the seal proceeds as before.
	if (!defaultBranch || !branchExists(intentMain)) {
		return { applicable: false, defaultBranch, intentMain, merged: true }
	}
	const merged = opts.localOnly
		? isAncestor(intentMain, defaultBranch) ||
			isAncestor(intentMain, `origin/${defaultBranch}`)
		: isBranchMerged(intentMain, defaultBranch)
	return { applicable: true, defaultBranch, intentMain, merged }
}

/** True when the intent is HELD in pending-seal — the merge gate applies
 *  AND the hub branch hasn't yet landed on the default branch. The
 *  inverse of "free to seal". */
export function isAwaitingMerge(
	slug: string,
	opts: { localOnly?: boolean } = {},
): boolean {
	const d = intentDeliveryState(slug, opts)
	return d.applicable && !d.merged
}
