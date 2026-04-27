// orchestrator/workflow/side-effects.ts — All workflow-engine state
// mutators. Every function here writes disk (state.json,
// intent.md frontmatter), runs git operations (branch create / merge
// / reap), or both. The workflow handlers in `handlers/` call these
// after deciding what action to emit.
//
// The split from emission keeps the contract clean: handlers are
// (mostly) pure functions that compute an OrchestratorAction from
// disk state; side-effects are the explicit mutation boundary that
// transitions disk state between ticks.
//
// Functions:
//   - workflowStartStage              — enter a stage (branch isolation,
//     pos-0 reset, Guard 1/3, first iteration, frontmatter active_stage)
//   - workflowAdvancePhase            — change a stage's phase
//   - workflowCompleteStage           — mark a stage completed
//   - workflowAdvanceStage            — atomic complete+enter-next
//   - workflowGateAsk                 — enter the gate phase
//   - workflowEnterIntentCompletionReview — set intent.phase = awaiting...
//   - workflowFinalizeStageIntoIntentMain — final-stage merge+reap+switch
//   - completeOrReviewIntent          — terminal completion routing
//     (studio-level review opt-in vs immediate intent_complete)
//   - workflowIntentComplete          — mark intent completed + reap branches

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	branchExists,
	cleanupIntentWorktrees,
	cleanupOrphanedStageBranches,
	createIntentBranch,
	createStageBranch,
	deleteStageBranch,
	ensureOnStageBranch,
	finalizeIntentBranches,
	isBranchMerged,
	isOnStageBranch,
	mergeStageBranchForward,
	mergeStageBranchIntoMain,
	writeOnIntentMain,
} from "../../git-worktree.js"
import type { OrchestratorAction } from "../../orchestrator.js"
import { resolveIntentStages } from "../../orchestrator.js"
import { sealIntentState } from "../../state-integrity.js"
import {
	appendStageIteration,
	closeCurrentStageIteration,
	gitCommitState,
	intentDir,
	isGitRepo,
	parseFrontmatter,
	readJson,
	setFrontmatterField,
	stageStatePath,
	timestamp,
	writeJson,
} from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

/** Find the previous completed stage for branch chaining. */
function findPreviousStage(slug: string, stage: string): string | undefined {
	const intentFile = join(intentDir(slug), "intent.md")
	const intent = readFrontmatter(intentFile)
	const studio = (intent.studio as string) || ""
	const studioStages = resolveIntentStages(intent, studio)
	const idx = studioStages.indexOf(stage)
	return idx > 0 ? studioStages[idx - 1] : undefined
}

/** Enter a stage. Branch isolation first; if it fails (merge conflict)
 *  no state is mutated. Unified topology: every stage runs on its own
 *  branch `haiku/<slug>/<stage>`, and `haiku/<slug>/main` is the
 *  consolidation hub. Stage advance A → B:
 *    1. Ensure main exists.
 *    2. Guard 3 (pre-stage cleanup): delete any merged stage branches
 *       that shouldn't still exist — e.g. a prior stage whose work is
 *       on main but whose branch lingered because an earlier session
 *       crashed.
 *    3. If prev stage branch A exists and isn't merged, merge A → main.
 *    4. Reap A's branch (commits now live on main). Delete remote too.
 *    5. Checkout B: if B's branch already exists (go-back), merge main
 *       forward into it; otherwise create B from main.
 *    6. Guard 1 (entry pos-0 reset): write pos-0 default state.json
 *       onto main for the entered stage via temp worktree.
 *    7. Guard 3 (post-stage cleanup): scan again for orphans that
 *       slipped through the merge-reap cycle.
 *
 *  The intent's `mode` field controls iteration cadence and review
 *  rules but not branching topology — both modes branch per-stage. */
export function workflowStartStage(slug: string, stage: string): void {
	const intentFile = join(intentDir(slug), "intent.md")

	createIntentBranch(slug)
	cleanupOrphanedStageBranches(slug)

	const prevStage = findPreviousStage(slug, stage)
	const prevStageBranch = prevStage ? `haiku/${slug}/${prevStage}` : ""
	if (
		prevStage &&
		branchExists(prevStageBranch) &&
		!isBranchMerged(prevStageBranch, `haiku/${slug}/main`)
	) {
		const mergeResult = mergeStageBranchIntoMain(slug, prevStage)
		if (!mergeResult.success) {
			throw new Error(
				`Merge of completed stage '${prevStage}' into main failed: ${mergeResult.message}. Resolve conflicts on 'haiku/${slug}/main' manually, then retry.`,
			)
		}
	}

	if (prevStage && branchExists(prevStageBranch)) {
		deleteStageBranch(slug, prevStage)
		try {
			execFileSync("git", ["push", "origin", "--delete", prevStageBranch], {
				stdio: "pipe",
			})
		} catch {
			/* non-fatal */
		}
	}

	// Guard 1: pos-0 reset on main, then mirror locally.
	const posZeroState = {
		stage,
		status: "active",
		phase: "elaborate",
		started_at: timestamp(),
		completed_at: null,
		gate_entered_at: null,
		gate_outcome: null,
		visits: 0,
	}
	const stageStateRelPath = `.haiku/intents/${slug}/stages/${stage}/state.json`
	writeOnIntentMain(
		slug,
		stageStateRelPath,
		`${JSON.stringify(posZeroState, null, 2)}\n`,
		`haiku: reset ${stage} state.json to pos 0 on stage entry (Guard 1)`,
	)

	if (!isOnStageBranch(slug, stage)) {
		const stageBranch = `haiku/${slug}/${stage}`
		if (branchExists(stageBranch) && prevStage) {
			const mergeResult = mergeStageBranchForward(slug, "main", stage)
			if (!mergeResult.success) {
				throw new Error(
					`Merge forward from main to '${stage}' failed: ${mergeResult.message}. Resolve conflicts on branch '${stageBranch}' manually, then retry.`,
				)
			}
		} else {
			createStageBranch(slug, stage)
		}
	}

	const path = stageStatePath(slug, stage)
	writeJson(path, posZeroState)

	appendStageIteration(slug, stage, { trigger: "initial" })

	if (existsSync(intentFile)) {
		setFrontmatterField(intentFile, "active_stage", stage)
	}

	cleanupOrphanedStageBranches(slug)

	emitTelemetry("haiku.stage.started", { intent: slug, stage })
	gitCommitState(`haiku: start stage ${stage}`)
	sealIntentState(slug)
}

export function workflowAdvancePhase(
	slug: string,
	stage: string,
	toPhase: string,
): void {
	const path = stageStatePath(slug, stage)
	const data = readJson(path)
	data.phase = toPhase
	writeJson(path, data)
	emitTelemetry("haiku.stage.phase", { intent: slug, stage, phase: toPhase })
	sealIntentState(slug)
}

export function workflowCompleteStage(
	slug: string,
	stage: string,
	gateOutcome: string,
): void {
	const path = stageStatePath(slug, stage)
	const data = readJson(path)
	data.status = "completed"
	data.completed_at = timestamp()
	data.gate_outcome = gateOutcome
	writeJson(path, data)
	closeCurrentStageIteration(
		slug,
		stage,
		gateOutcome === "advanced" ? "advanced" : "rejected",
	)
	emitTelemetry("haiku.stage.completed", {
		intent: slug,
		stage,
		gate_outcome: gateOutcome,
	})
	gitCommitState(`haiku: complete stage ${stage}`)
	sealIntentState(slug)
}

/** Atomic complete + enter-next. Avoids leaving dirty state on the
 *  completed branch between ticks (which would otherwise force the
 *  next tick's `ensureOnStageBranch` guard onto intent main via an
 *  auto-commit detour, stranding the advance). */
export function workflowAdvanceStage(
	slug: string,
	currentStage: string,
	nextStage: string,
): void {
	workflowCompleteStage(slug, currentStage, "advanced")

	const intentFile = join(intentDir(slug), "intent.md")
	if (existsSync(intentFile)) {
		setFrontmatterField(intentFile, "active_stage", nextStage)
	}

	workflowStartStage(slug, nextStage)

	// Reseal: workflowCompleteStage sealed against active_stage=currentStage,
	// then workflowStartStage rewrote frontmatter again; the prior checksums are
	// stale and verifyIntentState() would false-positive as tampering.
	sealIntentState(slug)
}

export function workflowGateAsk(slug: string, stage: string): void {
	const path = stageStatePath(slug, stage)
	const data = readJson(path)
	data.phase = "gate"
	data.gate_entered_at = timestamp()
	writeJson(path, data)
	emitTelemetry("haiku.gate.entered", { intent: slug, stage })
	sealIntentState(slug)
}

/** Enter the intent-completion-review phase. Stage work is done; the
 *  intent awaits a terminal review before completion. This is the
 *  bookend that prevents a stage-level auto-gate from silently
 *  completing the whole intent. Distinct from the existing
 *  `intent_review` gate_context which fires at the FIRST stage's
 *  elaborate→execute gate to review initial specs; this one fires at
 *  the END after the final stage's gate passes. */
function workflowEnterIntentCompletionReview(slug: string): void {
	const intentFile = join(intentDir(slug), "intent.md")
	if (!existsSync(intentFile)) return
	setFrontmatterField(intentFile, "phase", "awaiting_completion_review")
	setFrontmatterField(intentFile, "completion_review_entered_at", timestamp())
	emitTelemetry("haiku.intent.completion_review_entered", { intent: slug })
	sealIntentState(slug)
}

/** Merge the just-completed final stage's branch into intent main,
 *  reap the stage branch (local + remote), and switch the current
 *  checkout to intent main.
 *
 *  Mirror of the prev-stage merge+reap that workflowStartStage runs
 *  on every non-final transition. There's no next stage to trigger
 *  that merge when the final stage completes — without this, the
 *  primary worktree stays parked on the dead stage branch, intent
 *  main misses the final stage's commits, and intent-completion work
 *  runs on stale state.
 *
 *  Best-effort: merge conflicts don't throw. The completion-review
 *  phase still opens so a human can diagnose + reconcile manually
 *  rather than blocking the intent forever on an unresolved merge. */
function workflowFinalizeStageIntoIntentMain(
	slug: string,
	stage: string,
): void {
	if (!isGitRepo()) return
	if (!stage) return
	const stageBranch = `haiku/${slug}/${stage}`
	const intentMain = `haiku/${slug}/main`

	if (branchExists(stageBranch) && !isBranchMerged(stageBranch, intentMain)) {
		const mergeResult = mergeStageBranchIntoMain(slug, stage)
		if (!mergeResult.success) {
			console.error(
				`[workflowFinalizeStageIntoIntentMain] merge ${stageBranch}→${intentMain} failed: ${mergeResult.message}.\nIntent-completion review will still open; resolve the merge manually before approving the final gate.\nRecovery paths for the stage branch if the reap below loses it before you can merge:\n  - \`git reflog show ${stageBranch}\` — the branch's tip is still in reflog until gc runs (default 90 days).\n  - \`origin/${stageBranch}\` — if the branch was pushed, the remote tracking ref still has the tip.\n  - \`git fsck --lost-found\` — catches dangling commits even after the branch ref is deleted.`,
			)
		}
	}

	if (branchExists(stageBranch)) {
		deleteStageBranch(slug, stage)
		try {
			execFileSync("git", ["push", "origin", "--delete", stageBranch], {
				stdio: "pipe",
			})
		} catch {
			/* non-fatal: offline, no push perms, or branch already gone */
		}
	}

	ensureOnStageBranch(slug, undefined)
}

/** Shared completion path used by every gate-pass site that used to
 *  call workflowIntentComplete + return intent_complete directly.
 *  Returns the correct action for the current opt-in/opt-out state:
 *    - skip_intent_completion_review = true → fire intent_complete
 *    - otherwise → enter completion-review phase, open a gate_review
 *
 *  This decouples stage-gate approval from intent completion. Stages
 *  approving (auto or otherwise) must NEVER by themselves mark an
 *  intent completed — the terminal review is a separate, explicit
 *  step. */
export function completeOrReviewIntent(
	slug: string,
	studio: string,
	sourceMessage: string,
): OrchestratorAction {
	const intentFile = join(intentDir(slug), "intent.md")
	const intent = existsSync(intentFile) ? readFrontmatter(intentFile) : {}
	// Opt-OUT default: studio-level intent-completion review is on.
	// Authors disable per-intent with intent_completion_review: false.
	const reviewOnCompletion = intent.intent_completion_review !== false

	const finalStage =
		typeof intent.active_stage === "string"
			? (intent.active_stage as string)
			: ""
	if (finalStage) {
		workflowFinalizeStageIntoIntentMain(slug, finalStage)
	}

	if (!reviewOnCompletion) {
		workflowIntentComplete(slug)
		return {
			action: "intent_complete",
			intent: slug,
			studio,
			message: sourceMessage,
		}
	}
	workflowEnterIntentCompletionReview(slug)
	return {
		action: "advance_phase",
		intent: slug,
		stage: null,
		from_phase: (intent.phase as string) || "active",
		to_phase: "awaiting_completion_review",
		message: `${sourceMessage} All stages passed — entering intent-completion review phase. Call \`haiku_run_next { intent: "${slug}" }\` to dispatch studio-level review agents (if any) and the final gate.`,
	}
}

/** Mark intent completed and fan the last stage (and any unmerged
 *  prior stages) into intent main, checkout intent main, reap every
 *  merged stage branch so the intent lands on a single clean ref. */
export function workflowIntentComplete(slug: string): void {
	const intentFile = join(intentDir(slug), "intent.md")
	if (existsSync(intentFile)) {
		setFrontmatterField(intentFile, "status", "completed")
		setFrontmatterField(intentFile, "completed_at", timestamp())
	}
	emitTelemetry("haiku.intent.completed", { intent: slug })
	gitCommitState(`haiku: complete intent ${slug}`)

	const intent = existsSync(intentFile) ? readFrontmatter(intentFile) : {}
	const studio = (intent.studio as string) || ""
	const stages = studio ? resolveIntentStages(intent, studio) : []
	if (stages.length > 0) {
		const finalized = finalizeIntentBranches(slug, stages)
		if (!finalized.success) {
			console.error(
				`[haiku] finalizeIntentBranches warning for ${slug}: ${finalized.message}`,
			)
		}
	}
	cleanupIntentWorktrees(slug)
	sealIntentState(slug)
}
