// tools/orchestrator/haiku_run_next.ts — The workflow driver. Sole tool
// agents call to advance the H·AI·K·U lifecycle.
//
// Flow per call:
//   1. Auto-resolve `intent` when omitted (current branch → sole
//      active intent → error).
//   2. Validate we're on the intent branch.
//   3. Stage-branch enforcement (align checkout to active stage so
//      writes land on the right branch).
//   4. Optional external_review_url write (records URL on the
//      blocked stage's state.json for approval polling).
//   5. Drive `runNext(slug)` — the canonical workflow tick.
//   6. Telemetry + session log.
//   7. Per-action processing:
//      - external_review_requested: append the "where did you submit"
//        prompt to the message.
//      - gate_review: open the review UI, block, process the
//        decision (approved → workflowAdvancePhase/Stage/Complete or
//        completeOrReviewIntent; external_review → mark blocked;
//        revisit_action short-circuit; otherwise persist feedback
//        files and route by gate context).
//      - safe_intent_repair: try the embedded repair agent; if it
//        succeeds, re-run runNext for the real next action.
//      - everything else: enrich + render and return.
//
// Output shape: JSON action body + "---" separator + per-action
// prompt instructions (rendered by buildRunInstructions, harness-
// adapted by adaptInstructions).

import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
	ensureOnStageBranch,
	fetchOrigin,
	getCurrentBranch,
	hasNoMergeDebt,
	pushStageBranch,
	reconcileIntentBranches,
	syncBranchDownstream,
} from "../../git-worktree.js"
import { adaptInstructions } from "../../harness-instructions.js"
import {
	findCurrentStage,
	isStageComplete,
} from "../../orchestrator/workflow/cursor.js"
import { runWorkflowTick } from "../../orchestrator/workflow/run-tick.js"
import type { OrchestratorAction as OrchestratorActionType } from "../../orchestrator.js"
import {
	buildGuardResponse,
	buildRunInstructions,
	enrichActionWithPreview,
	getPrepareGateReview,
	type OrchestratorAction,
} from "../../orchestrator.js"

/** Single-source dispatch: one workflow tick → one action. Handles
 *  the intent-not-found and registry-gap cases inline.
 *
 *  Disk-only cursor model: `runWorkflowTick` walks files under the
 *  current working tree. Pre-tick branch reconciliation has already
 *  merged main into the current branch and aligned the working tree
 *  to the cursor's named stage, so the walk's disk view IS the
 *  authoritative state. No hint, no second walk, no branch dance. */
function dispatchOrchestratorAction(slug: string): OrchestratorActionType {
	const tick = runWorkflowTick(slug)
	if (tick?.action) return tick.action
	if (!tick) {
		return { action: "error", message: `Intent '${slug}' not found` }
	}
	return {
		action: "error",
		message: `runWorkflowTick produced no action for intent '${slug}' (track: ${tick.position.track}). The cursor is mid-wave or sealed — wait for outstanding subagents and retick.`,
	}
}

/** Returns the current branch name, or "" if not in a git repo or the
 *  command fails. Used by the pre-tick "is my branch the cursor's
 *  named stage?" disagreement check. */
function _safeCurrentBranchHere(): string {
	try {
		return execFileSync("git", ["branch", "--show-current"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim()
	} catch {
		return ""
	}
}

// Loop-guard helpers live in a sibling module so tests can import them
// without dragging in the circular `index.ts` ↔ `orchestrator.ts` chain
// this file is part of.
import {
	actionSignature,
	loopAbortResponse,
	RUN_NEXT_LOOP_CAP,
} from "./_loop_guard.js"

/**
 * Extract the orchestrator action name from a haiku_await_gate
 * response. The await tool renders its result as `<json>\n\n---\n\n<instructions>`
 * — the JSON head carries `action: "<name>"`. Used by haiku_run_next's
 * inline gate-review path to decide whether to re-tick (advance cases)
 * or surface the await response directly (terminal / changes-requested
 * / external-review cases).
 */
function extractActionFromAwaitResponse(response: {
	content?: Array<{ type: string; text?: string }>
}): string | null {
	for (const block of response.content ?? []) {
		if (block.type !== "text" || typeof block.text !== "string") continue
		const headEnd = block.text.indexOf("\n\n---")
		const head = headEnd >= 0 ? block.text.slice(0, headEnd) : block.text
		const trimmed = head.trim()
		if (!trimmed.startsWith("{")) continue
		try {
			const parsed = JSON.parse(trimmed) as { action?: unknown }
			if (typeof parsed.action === "string") return parsed.action
		} catch {
			/* not JSON — keep scanning */
		}
	}
	return null
}

/**
 * Run the SPA picker for studio / mode / stage selection in response
 * to a tick that emitted `select_*`. Dispatches by name to the matching
 * orchestrator tool handler — same code path the user-explicit
 * `/haiku:change-mode` skill takes, but invoked engine-side so the
 * agent never sees the prompt-to-call. The handler does the picker +
 * frontmatter write + telemetry; we discard its rendered response and
 * just signal "ok / not ok" back to the dispatch loop.
 */
async function runSelectionPicker(
	actionName: string,
	slug: string,
	signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; message: string }> {
	const { orchestratorToolHandlers } = await import("./index.js")
	// Cursor actions are bare names (`select_studio`); handler map keys are
	// the MCP tool names (`haiku_select_studio`). The mapping is fixed so
	// agents never see either form — the picker is engine-driven inline.
	const toolName = `haiku_${actionName}`
	const tool = orchestratorToolHandlers.get(toolName)
	if (!tool) {
		return {
			ok: false,
			message: `Engine bug: no handler registered for selection action '${actionName}' (looked up as '${toolName}').`,
		}
	}
	try {
		const result = await tool.handle({ intent: slug }, signal)
		// Selection tools return text; the side effect (write to
		// intent.md) is what matters. Surface their isError status as
		// a hard failure so the agent sees a clean stop instead of
		// looping forever on the same select_* tick.
		if (result.isError) {
			const text =
				result.content
					?.map((c) => (c.type === "text" ? c.text : ""))
					.join("\n")
					.trim() || `Picker failed for ${actionName}.`
			return { ok: false, message: text }
		}
		// Cancellation guard. The picker tools return a JSON body with
		// `action: "cancelled"` when the SPA times out (default 30 min)
		// or the user dismisses the prompt without choosing — that's NOT
		// flagged as `isError` because the agent might want to surface a
		// retry prompt. But here we're inside the engine's blocking tick
		// loop; if we treat cancellation as success we re-tick, the
		// cursor still sees the field unset, the picker fires again, and
		// the call hangs for another 30 minutes per iteration. Treat
		// cancellation as terminal so the agent gets one clear message
		// and can decide whether to retry. See #333.
		const bodyText = result.content
			?.map((c) => (c.type === "text" ? c.text : ""))
			.join("\n")
			.trim()
		if (bodyText) {
			try {
				const parsed = JSON.parse(bodyText) as { action?: unknown }
				if (parsed?.action === "cancelled") {
					return {
						ok: false,
						message: `Picker for ${actionName} was cancelled or timed out without a selection. Re-run \`haiku_run_next\` to surface the picker again.`,
					}
				}
			} catch {
				/* not JSON — selection-tool responses are always JSON, so this is fine */
			}
		}
		return { ok: true }
	} catch (err) {
		return {
			ok: false,
			message: `Picker for ${actionName} threw: ${err instanceof Error ? err.message : String(err)}`,
		}
	}
}

import { reportError } from "../../sentry.js"
import { launchBrowserBestEffort } from "../../server/tool-call.js"
import { logSessionEvent } from "../../session-metadata.js"
import { getSession, isBrowserAttached, updateSession } from "../../sessions.js"
import {
	findFeedbackFile,
	findHaikuRoot,
	intentDir,
	intentFromCurrentBranch,
	isGitRepo,
	listVisibleIntents,
	parseFrontmatter,
	setFrontmatterField,
	syncSessionMetadata,
	validateBranch,
} from "../../state-tools.js"
import { resolveStudio } from "../../studio-reader.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

export default defineTool({
	name: "haiku_run_next",
	description:
		"Advance the workflow. Returns the next action for the agent to take, with rendered instructions appended. Auto-resolves `intent` from the current branch when omitted; if multiple intents are active, requires explicit `intent`. Pass `external_review_url` when a stage is blocked on external review to record the URL for approval polling.",
	inputSchema: {
		type: "object" as const,
		properties: {
			intent: { type: "string" },
			external_review_url: { type: "string" },
			state_file: { type: "string" },
			pickup: {
				type: "boolean" as const,
				description:
					"Set true when invoked from /haiku:pickup. The engine fetches origin and materializes the active stage branch locally so the user can `git switch` into in-flight work, then appends a pickup hint to the response.",
			},
		},
	},
	async handle(args, signal) {
		// Auto-resolve `intent` when omitted. The contract: the engine
		// only touches an intent when we're explicitly working with it.
		// Two signals count as "explicitly":
		//   1. Caller passed `intent` directly.
		//   2. Current git branch is `haiku/<slug>/main` or
		//      `haiku/<slug>/<stage>` — the checkout itself is the
		//      declaration that this intent is in scope.
		// In a git repo, those are the ONLY signals. Falling back to
		// "the sole active intent on disk" is wrong: a checked-in intent
		// directory with `status: active` does not mean the user is
		// working on it right now (e.g. you're reviewing main, doing
		// engine work on another worktree, or the intent was committed
		// by an unrelated PR). Touching an intent the user isn't on
		// pollutes its on-disk runtime journals (action-log.jsonl,
		// state.json, baseline-content/) and shows up as untracked
		// noise in `git status`.
		// Filesystem mode (no git) has no branch signal, so the
		// "sole active" fallback is the only auto-resolve available
		// there — keep it gated behind !isGitRepo().
		let slug = (args.intent as string) || ""
		if (!slug) {
			const branchMatch = intentFromCurrentBranch()
			if (branchMatch) {
				slug = branchMatch.slug
			} else if (isGitRepo()) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No intent specified and the current branch isn't an intent branch (`haiku/<slug>/main` or `haiku/<slug>/<stage>`). Pass `intent` explicitly, or `git switch haiku/<slug>/main` to scope the engine to a specific intent. The engine refuses to auto-target an intent the user isn't actively on — that's how stray intent dirs end up touched and polluting `git status`.",
						},
					],
					isError: true,
				}
			} else {
				const root = findHaikuRoot()
				const intentsDir = join(root, "intents")
				const active = existsSync(intentsDir)
					? listVisibleIntents(intentsDir).filter(
							(i) => (i.data.status as string) !== "completed",
						)
					: []
				if (active.length === 1) {
					slug = active[0].slug
				} else if (active.length === 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: "No active intents found. Start one with /haiku:start.",
							},
						],
						isError: true,
					}
				} else {
					return {
						content: [
							{
								type: "text" as const,
								text: `Multiple active intents (${active.map((i) => i.slug).join(", ")}). Pass \`intent\` explicitly.`,
							},
						],
						isError: true,
					}
				}
			}
		}
		const stFile = args.state_file as string | undefined

		const branchCheck = validateBranch(slug, "intent")
		if (branchCheck) {
			return {
				content: [{ type: "text" as const, text: branchCheck }],
				isError: true,
			}
		}

		// Mid-merge detector — runs BEFORE any other guard so a working
		// tree that's mid-merge from a prior pre-cursor sync conflict
		// surfaces a single clean recovery message instead of falling
		// through to the stage-branch enforcement guard's cryptic
		// "git operation in progress" error.
		//
		// The wedge it fixes (reproduced 2026-05-12 against the real
		// admin-portal-reimagine state): pre-cursor sync's step 2
		// (intent main → stage, in-place merge) hits a real conflict
		// on intent.md. mergeRefInPlace leaves the working tree mid-
		// merge with `<<<<<<<` markers in intent.md. The conflict
		// markers corrupt the YAML frontmatter so readFrontmatter
		// returns {} — studio/mode read as empty, the selection-phase
		// guard at line ~506 fires, ensureOnStageBranch sees MERGE_HEAD,
		// and surfaces "Finish or abort the merge before stage-branch
		// enforcement can realign the checkout." The agent has no idea
		// which files to resolve.
		//
		// This block runs early and tells the agent EXACTLY what to do:
		// resolve the conflicted files (workflow-fields guard's mid-
		// merge bypass — PR #344 — permits generic Edit/Write during a
		// merge), `git add` them, `git commit`, then re-run
		// haiku_run_next.
		if (isGitRepo()) {
			try {
				const gitDir = execFileSync("git", ["rev-parse", "--git-dir"], {
					encoding: "utf8",
					stdio: ["ignore", "pipe", "pipe"],
				}).trim()
				const midMergeMarker = [
					"MERGE_HEAD",
					"REBASE_HEAD",
					"CHERRY_PICK_HEAD",
					"REVERT_HEAD",
				].find((m) => existsSync(join(gitDir, m)))
				if (midMergeMarker) {
					const conflicts = execFileSync(
						"git",
						["diff", "--name-only", "--diff-filter=U"],
						{
							encoding: "utf8",
							stdio: ["ignore", "pipe", "pipe"],
						},
					)
						.split("\n")
						.filter(Boolean)
					const branch = execFileSync("git", ["branch", "--show-current"], {
						encoding: "utf8",
						stdio: ["ignore", "pipe", "pipe"],
					}).trim()
					const fileList =
						conflicts.length > 0
							? `Conflicted files: ${conflicts.join(", ")}.`
							: `(No conflict files reported — try \`git status\` to inspect, or \`git ${midMergeMarker === "MERGE_HEAD" ? "merge" : "rebase"} --abort\` to bail out.)`
					return text(
						JSON.stringify(
							{
								action: "error",
								intent: slug,
								error: "mid_merge_blocking_tick",
								marker: midMergeMarker,
								branch,
								conflict_files: conflicts,
								message:
									`The working tree on '${branch}' is mid-merge (${midMergeMarker} present) — most likely from the previous tick's pre-cursor sync hitting a real conflict. ` +
									"Resolve the conflicted files in place (the workflow-fields guard's mid-merge bypass permits Edit/Write during a merge), " +
									"run `git add <files>` and `git commit`, then re-run `haiku_run_next`. " +
									fileList,
							},
							null,
							2,
						),
					)
				}
			} catch {
				/* non-fatal — if git probe fails, fall through and let the
				   later guards surface whatever they find */
			}
		}

		// Pre-cursor reconciliation: when external review is pending OR
		// the user might have merged a stage PR externally, fetch from
		// origin and check for the "merged into wrong branch" footgun.
		//
		// The footgun: User A's stage PR landed on the repo default
		// (`main`) instead of `haiku/<slug>/main`, so the cursor's
		// findCurrentStage check keeps the stage pinned and User B's
		// pickup never advances. Reconciliation fast-forwards intent
		// main to the repo default when safe, so the merge propagates
		// to where the cursor expects it.
		//
		// Skip on filesystem mode (no remote to fetch from), and when
		// the intent has no studio yet (the picker gate fires first).
		try {
			const intentFile = join(findHaikuRoot(), "intents", slug, "intent.md")
			if (existsSync(intentFile)) {
				const im = readFrontmatter(intentFile)
				const studio = (im.studio as string) || ""
				const hasExternalReview =
					typeof im.external_review_url === "string" &&
					(im.external_review_url as string).length > 0
				if (studio && hasExternalReview) {
					const { isGitRepo: checkGitRepo } = await import(
						"../../state-tools.js"
					)
					if (checkGitRepo()) {
						fetchOrigin()
						const { resolveStudioStages } = await import(
							"../../orchestrator.js"
						)
						const { reconcileMisroutedStageMerges } = await import(
							"../../git-worktree.js"
						)
						const stages = resolveStudioStages(studio)
						const reconciliations = reconcileMisroutedStageMerges(slug, stages)
						const hardErrors = reconciliations.filter(
							(r) => r.misrouted && !r.reconciled && r.error,
						)
						if (hardErrors.length > 0) {
							return {
								content: [
									{
										type: "text" as const,
										text: `Stage merge routed to the wrong branch — manual reconciliation needed:\n\n${hardErrors.map((e) => `- **Stage ${e.stage}**: ${e.error}`).join("\n")}\n\nWhen reconciled, re-run \`haiku_run_next\` to continue.`,
									},
								],
								isError: true,
							}
						}
						// On successful reconciliation, the merge is now on
						// haiku/<slug>/main and the cursor walk that follows
						// will pick up the next stage naturally. No need to
						// surface anything to the agent — the recovery is
						// invisible (which is what the user wants for the
						// pickup case).
					}
				}
			}
		} catch (err) {
			// Reconciliation is best-effort; failures here just mean we
			// surface the same wedged-stage state we'd see otherwise.
			console.error(
				`[haiku_run_next] pre-cursor reconciliation failed: ${err instanceof Error ? err.message : String(err)}`,
			)
		}

		// Pickup auto-fetch: when /haiku:pickup hands off to a fresh user,
		// they only have intent main locally. The cursor's state.json and
		// any pending feedback live there, but the active stage branch's
		// in-flight unit work doesn't. Fetch origin, materialize the
		// active stage branch as a local ref (no checkout — keep the
		// user's working tree intact), and surface a hint naming the
		// branch so they know how to inspect it. Best-effort: never
		// blocks the tick.
		let pickupHint = ""
		if (args.pickup === true && isGitRepo()) {
			try {
				fetchOrigin()
				const intentFile = join(findHaikuRoot(), "intents", slug, "intent.md")
				if (existsSync(intentFile)) {
					const im = readFrontmatter(intentFile)
					const studio = (im.studio as string) || ""
					if (studio) {
						const activeStage = findCurrentStage(slug, studio)
						if (activeStage) {
							const branch = `haiku/${slug}/${activeStage}`
							try {
								// `git fetch origin <branch>:<branch>` creates or
								// fast-forwards the local ref to origin's tip.
								// Fails when origin lacks the branch (the user is
								// way ahead, no one's pushed it yet) or when the
								// local branch has diverged — both are fine, we
								// just don't make a hint promise we can't keep.
								execFileSync(
									"git",
									["fetch", "origin", `${branch}:${branch}`],
									{ encoding: "utf8", stdio: "pipe" },
								)
								pickupHint = `Active stage branch \`${branch}\` was fetched from origin. Run \`git switch ${branch}\` to inspect in-flight unit work; the engine drives the workflow from intent main and doesn't need you on the stage branch.`
							} catch {
								// Origin doesn't have the branch yet, or there's
								// a divergence we can't fast-forward through.
								// Fall through silently — the engine still works
								// from intent main.
							}
						}
					}
				}
			} catch (err) {
				console.error(
					`[haiku_run_next] pickup auto-fetch threw: ${
						err instanceof Error ? err.message : String(err)
					}`,
				)
			}
		}

		// Pre-tick branch reconciliation. Bring both canonical refs up
		// to date BEFORE we read either tree:
		//
		//   - `haiku/<slug>/main` ← `origin/<default>` (FF only). When
		//     the worktree is on a stage branch, this is a refspec write
		//     that doesn't touch HEAD or the working tree.
		//   - current stage branch ← `haiku/<slug>/main` (only when
		//     we're on a stage branch). Architecture invariant: stage
		//     branches must be ahead of main, never behind.
		//
		// Best-effort: divergence cases set `error` but the tick still
		// proceeds. The cursor walk that follows will surface a real
		// action against whatever state exists.
		{
			const reconcile = reconcileIntentBranches(slug)
			if (reconcile.error) {
				console.error(`[haiku_run_next] reconcile: ${reconcile.error}`)
			}
		}

		// Stage-branch enforcement (disk-only cursor model).
		//
		// The cursor's signal is the disk under the current working tree.
		// Pre-tick has already merged origin/<default> → intent main and
		// intent main → current stage branch (via `reconcileIntentBranches`
		// above), so the working tree reflects the latest content from
		// every past stage plus whatever in-flight work lives on the
		// current branch.
		//
		// Algorithm:
		//   1. Read intent.md for studio + mode.
		//   2. Walk files on the CURRENT working tree → `findCurrentStage`
		//      names the stage the cursor is in (or null if every stage's
		//      content is complete).
		//   3. Reconcile the walk's answer against the branch I'm on:
		//      a. Walk says X, I'm on X → already aligned. Proceed.
		//      b. Walk says X, I'm on Y where Y is an EARLIER stage → Y
		//         is complete on its branch but never merged to main.
		//         Surface `merge_stage(Y)` so the engine merges it
		//         before we advance. The merge handler will re-tick;
		//         the next tick's walk + alignment then routes to X.
		//      c. Walk says X, I'm on Y where Y is a LATER stage (or
		//         not in the stage list) → just switch to X.
		//      d. Walk says X, I'm on intent main → switch to X (fresh
		//         entry into a stage).
		//      e. Walk says null (every stage past), I'm on a stage
		//         branch Y → Y owes a merge. Surface `merge_stage(Y)`.
		//      f. Walk says null, I'm on intent main → fall through;
		//         the cursor walk will emit intent-level approvals or
		//         sealed.
		//
		// Reading the current branch name is observational (where am I
		// physically?), not git-topology decision-making. It's a fact
		// about the working tree, same as the disk content under it.
		//
		// Selection-phase guard: when studio or mode isn't set yet, the
		// selection chain (`select_studio` / `select_mode`) belongs on
		// intent main, not a stage branch.
		{
			const intentFile = join(findHaikuRoot(), "intents", slug, "intent.md")
			if (existsSync(intentFile)) {
				const im = readFrontmatter(intentFile)
				const studio = (im.studio as string) || ""
				const mode = (im.mode as string) || ""
				if (!studio || !mode) {
					// Selection-phase guard: when studio or mode isn't set
					// yet, the selection chain (`select_studio` /
					// `select_mode`) belongs on intent main, not a stage
					// branch.
					const mainGuard = ensureOnStageBranch(slug, undefined)
					if (!mainGuard.ok) {
						return buildGuardResponse(
							slug,
							undefined,
							mainGuard,
							"run_next entry — intent main (pre-selection)",
						)
					}
				} else {
					// PRE-CURSOR DOWNSTREAM SYNC. The cursor's walk reads
					// per-unit FM from the current working tree. If the
					// branch isn't up to date with intent main (and intent
					// main isn't up to date with the org mainline), the
					// cursor sees a stale view and emits wrong actions —
					// the exact admin-portal-reimagine wedge reported
					// 2026-05-11, where design's branch had pre-migration
					// inception unit FM and the cursor concluded inception
					// wasn't complete.
					//
					// Sync downstream BEFORE the cursor walks: mainline →
					// intent main, then intent main → current stage. Both
					// merges short-circuit on tree-equality (no `--no-ff`
					// no-op commits). No branch switching here — switching
					// happens AFTER the cursor produces an action.
					const sync = syncBranchDownstream(slug)
					if (!sync.ok) {
						// The downstream sync failed. Two distinct failure
						// modes need distinct error codes:
						//   - `pre_cursor_sync_conflict` (conflictFiles
						//     non-empty): real content conflict. Recovery
						//     differs by step (in-place vs temp worktree).
						//   - `pre_cursor_sync_failed` (conflictFiles
						//     empty or missing): the merge couldn't even
						//     start — target branch checked out elsewhere
						//     with a dirty tree, worktree locked, or git
						//     refused for a non-conflict reason. Reported
						//     2026-05-12: an agent ran into this when the
						//     temp-worktree path for mainline → intent
						//     main couldn't run. The old generic message
						//     told the user to "resolve the conflict
						//     files" — but the list was empty and no
						//     conflict markers existed anywhere, so the
						//     user looked for nothing and got stuck. The
						//     two codes give the agent a stable handle to
						//     branch on, and the messages give the user
						//     actionable recovery for each shape.
						//
						// Recovery for the real-conflict path differs by
						// step:
						//   - intent_main_to_stage (in-place): working
						//     tree is mid-merge, agent edits conflicted
						//     files in place (workflow-fields guard's
						//     mid-merge bypass — PR #344), then commits
						//     and re-ticks.
						//   - mainline_to_intent_main (temp worktree):
						//     withTempWorktree's finally block already
						//     force-removed the temp worktree. No
						//     conflict markers exist. Recovery requires
						//     manually checking out intent main,
						//     replaying the merge, resolving, committing,
						//     and switching back.
						// Pick a sensible fallback branch when conflictBranch is
						// missing (the syncBranchDownstream contract always
						// populates it on real conflicts, but
						// mergeRefIntoBranch's outer catch in git-worktree.ts
						// returns { ok: false, message } with no
						// conflictBranch when withWorktreeOnBranch itself
						// throws — e.g., target branch locked by another
						// worktree). Case-specific fallback: intent main for
						// the mainline-side step; the agent's current branch
						// (the stage they're checked out on) for the in-place
						// intent-main → stage step.
						const fallbackBranch =
							sync.conflictAt === "mainline_to_intent_main"
								? `haiku/${slug}/main`
								: getCurrentBranch() || `haiku/${slug}/main`
						const targetBranch = sync.conflictBranch ?? fallbackBranch
						// Surface conflict_branch as `null` (never `undefined`)
						// so agents/tests can rely on the key always being
						// present in the JSON body.
						const conflictBranchJson = sync.conflictBranch ?? null
						const hasConflictFiles = (sync.conflictFiles ?? []).length > 0
						if (!hasConflictFiles) {
							// Recovery shape differs by step:
							//   - mainline_to_intent_main: agent is on the stage
							//     branch; needs to switch to intent main, replay
							//     the merge there, switch back.
							//   - intent_main_to_stage: agent is already on the
							//     stage branch (that's where the in-place merge
							//     was attempted). No checkout dance needed; just
							//     merge intent main into it where they are.
							const recovery =
								sync.conflictAt === "mainline_to_intent_main"
									? `To recover: \`git checkout ${targetBranch}\`, merge the mainline ref into it manually, resolve any conflicts and commit, then \`git checkout\` back to your original branch and re-run \`haiku_run_next\`.`
									: `To recover: \`git merge haiku/${slug}/main\` on this branch (you're already on '${targetBranch}'), resolve any conflicts and commit, then re-run \`haiku_run_next\`.`
							return text(
								JSON.stringify(
									{
										action: "error",
										intent: slug,
										error: "pre_cursor_sync_failed",
										conflict_at: sync.conflictAt,
										conflict_branch: conflictBranchJson,
										underlying_error: sync.message,
										message:
											`Pre-cursor downstream sync FAILED on branch '${targetBranch}' ` +
											`(${sync.conflictAt}). The merge couldn't start — there are NO ` +
											"conflict markers to resolve. Likely cause: the target branch is " +
											"checked out elsewhere with dirty tracked changes, the worktree " +
											`is locked, or git refused for another non-conflict reason. ${recovery} ` +
											`Underlying error: ${sync.message ?? "(none reported)"}.`,
									},
									null,
									2,
								),
							)
						}
						const files = (sync.conflictFiles ?? []).join(", ")
						const recovery =
							sync.conflictAt === "mainline_to_intent_main"
								? `The conflict happened in a temp worktree that's already been cleaned up — there are NO conflict markers in your working tree. To resolve: \`git checkout ${targetBranch}\`, merge the mainline ref manually (\`git merge <mainline-ref>\`), resolve the listed files, \`git add\` + \`git commit\`, then \`git checkout\` back to your original branch and re-run \`haiku_run_next\`.`
								: `Resolve the conflict on the listed files in place, run \`git add <files>\` and \`git commit\`, then re-run \`haiku_run_next\`.`
						return text(
							JSON.stringify(
								{
									action: "error",
									intent: slug,
									error: "pre_cursor_sync_conflict",
									conflict_at: sync.conflictAt,
									conflict_branch: conflictBranchJson,
									conflict_files: sync.conflictFiles,
									message:
										`Pre-cursor downstream sync hit a conflict on branch '${targetBranch}' ` +
										`(${sync.conflictAt}). ${recovery} Conflicted files: ${files}.`,
								},
								null,
								2,
							),
						)
					}
				}
			}
		}

		// Gap 8: If external_review_url is passed and stage is blocked,
		// store it. Placed AFTER the stage-branch guard so this write
		// lands on the stage branch, not intent main.
		// v4: external_review_url is no longer persisted on stage state.json
		// (state.json is gone). Discrete-mode external review now signals
		// approval through the actual GitHub MR merge into intent main —
		// the cursor's findCurrentStage check naturally advances when the
		// merge lands. The url itself, if a caller still passes it, is
		// stamped on intent.md as a transient marker for the review UI to
		// display; nothing in the engine reads it.
		if (args.external_review_url) {
			try {
				const root = findHaikuRoot()
				const intentFile = join(root, "intents", slug, "intent.md")
				if (existsSync(intentFile)) {
					setFrontmatterField(
						intentFile,
						"external_review_url",
						args.external_review_url as string,
					)
				}
			} catch {
				/* non-fatal */
			}
		}

		// Drain any review/approval dispatches the cursor emitted on a
		// prior tick. Each pending entry came from the cursor returning
		// `dispatch_review` / `dispatch_approval` — the agent has now
		// had a chance to spawn the review-agent subagent and process
		// any FBs it filed (Track B drains before Track A). Drain
		// stamps `reviews.<role>` / `approvals.<role>` on each unit
		// that the review pass didn't flag with a still-open FB. See
		// dispatch-stamps.ts for the contract.
		try {
			const { drainPendingDispatches } = await import(
				"../../orchestrator/workflow/dispatch-stamps.js"
			)
			drainPendingDispatches(slug)
		} catch (err) {
			console.error(
				`[haiku_run_next] drainPendingDispatches failed: ${err instanceof Error ? err.message : String(err)}`,
			)
		}

		// Discovery worktree merge-back is the SUBAGENT's responsibility.
		// The dispatch prompt (decompose.ts) instructs each discovery
		// subagent to call `haiku_discovery_complete { intent, stage,
		// template }` after committing its artifact inside the isolation
		// worktree. That tool takes `withStageLock(slug, stage)` so
		// parallel siblings serialize, calls `mergeDiscoveryWorktree`,
		// and reaps the worktree + branch. The engine takes no action on
		// `.haiku/worktrees/<slug>/discovery-*` directories from this
		// path — the cursor's only signal is whether the artifact file
		// exists on disk at the template's `location:`. If it doesn't,
		// the cursor re-emits `discovery_required` and the agent
		// redispatches. See gigsmart/haiku-method#333 for why the
		// previous engine-side sweep here was deleted.

		// Workflow-engine dispatch: read disk → derive state → run
		// per-state handler. The handler registry lives in
		// orchestrator/workflow/handlers/.
		//
		// Selection-picker interception: when the tick emits
		// `select_studio`, `select_mode`, or `select_stage`, the engine
		// itself runs the SPA picker inline, writes the chosen value,
		// and re-ticks. The agent NEVER sees these actions — it just
		// experiences a blocking tick until the user picks. The select_*
		// MCP tools still exist for explicit user-driven invocation
		// (`/haiku:change-mode`, etc.) but the tick path drives them
		// engine-side here so the agent stays out of the loop.
		//
		// The cursor walks on a tree that pre-cursor sync has already
		// brought up to date (mainline → intent main → current stage).
		// Branch switching for the result's stage happens AFTER the walk
		// (via the post-cursor revisit alignment block below).
		let result: OrchestratorActionType = dispatchOrchestratorAction(slug)

		// POST-WALK STAGE-COMPLETION SYNTHESIS. When the cursor advances
		// past a stage (e.g., the agent is on `inception`'s branch but
		// the cursor's answer targets `design`'s next action), the
		// upstream stage `inception` MAY owe its merge to intent main
		// BEFORE the agent moves on. `walkIntentTrack` only emits
		// `complete_stage` from inside the walk OF the active stage —
		// when `findCurrentStage` advances past inception, the cursor
		// hands back design's action without ever surfacing inception's
		// completion. Without this synthesis the next tick walks from
		// design's branch (forked from intent main BEFORE inception's
		// merge that never happened), sees inception's units missing,
		// flips back to inception, and we ping-pong forever — the
		// real-intent-dry-run regression.
		//
		// The check is FM (filesystem) for "complete?" and git topology
		// for "still owes a merge?" — the latter is purely an
		// implementation detail of running the semantic action under a
		// git-backed portfolio, not a cursor signal. `hasNoMergeDebt`
		// short-circuits identical-tree and ancestor cases so a stage
		// that's already on main doesn't re-fire the synthesis.
		try {
			const here = _safeCurrentBranchHere()
			const stagePrefix = `haiku/${slug}/`
			const hereStage =
				here.startsWith(stagePrefix) && here !== `${stagePrefix}main`
					? here.slice(stagePrefix.length)
					: null
			if (
				hereStage &&
				typeof result.stage === "string" &&
				result.stage.length > 0 &&
				result.stage !== hereStage
			) {
				const iDir = intentDir(slug)
				const intentFile = join(iDir, "intent.md")
				if (existsSync(intentFile)) {
					const im = readFrontmatter(intentFile)
					const studio = (im.studio as string) || ""
					const mode = (im.mode as string) || "continuous"
					if (studio && isStageComplete(iDir, studio, hereStage, mode)) {
						const hereBranch = `haiku/${slug}/${hereStage}`
						const intentMainBranch = `haiku/${slug}/main`
						if (!hasNoMergeDebt(hereBranch, intentMainBranch)) {
							result = {
								action: "complete_stage",
								intent: slug,
								stage: hereStage,
							}
						}
					}
				}
			}
		} catch {
			/* non-fatal — falls through to normal dispatch */
		}
		{
			let iterations = 0
			while (
				result.action === "select_studio" ||
				result.action === "select_mode" ||
				result.action === "select_stage"
			) {
				const sigBefore = actionSignature(result)
				if (++iterations > RUN_NEXT_LOOP_CAP) {
					return loopAbortResponse("select_*", iterations, result, "cap")
				}
				const pickerResult = await runSelectionPicker(
					result.action,
					slug,
					signal,
				)
				if (!pickerResult.ok) {
					return {
						content: [{ type: "text" as const, text: pickerResult.message }],
						isError: true,
					}
				}
				// pre-tick merge + cursor walk handle branch alignment
				result = dispatchOrchestratorAction(slug)
				if (
					(result.action === "select_studio" ||
						result.action === "select_mode" ||
						result.action === "select_stage") &&
					actionSignature(result) === sigBefore
				) {
					return loopAbortResponse(
						"select_*",
						iterations,
						result,
						"no_progress",
					)
				}
			}
		}

		// Surface-once stamping for design_direction_complete /
		// _uploaded actions deleted 2026-05-08 — those cursor actions
		// were collapsed into the discovery-agent model. The picker
		// tool now writes a manifest at the artifact's `location:`
		// directly; the cursor's existence check on that file passes
		// the gate without a surface-once stamp on intent.md.

		// Stash dispatch_review / dispatch_approval action context on
		// intent.md so the next tick's drainPendingDispatches stamps
		// reviews.<role> / approvals.<role>. Without this, the cursor
		// would re-emit the same dispatch action forever — the prompt
		// promises "the engine stamps the sigs" but no engine code
		// stamped them before this fix. See dispatch-stamps.ts for the
		// full lifecycle contract.
		if (
			(result.action === "dispatch_review" ||
				result.action === "dispatch_approval") &&
			typeof result.stage === "string" &&
			typeof result.role === "string" &&
			Array.isArray(result.units)
		) {
			try {
				const { stashPendingDispatch } = await import(
					"../../orchestrator/workflow/dispatch-stamps.js"
				)
				stashPendingDispatch(
					slug,
					result.action === "dispatch_review" ? "review" : "approval",
					result.stage as string,
					result.role as string,
					result.units as string[],
				)
			} catch (err) {
				console.error(
					`[haiku_run_next] stashPendingDispatch failed: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}

		// Same shape for intent_review (non-user roles). The user role
		// goes through haiku_await_gate which stamps approvals.user
		// directly — no stashing needed there. Agent roles (spec,
		// continuity, studio review-agents) need this engine-side
		// stamp because nothing else writes their slot on intent.md.
		if (
			result.action === "intent_review" &&
			typeof result.role === "string" &&
			result.role !== "user"
		) {
			try {
				const { stashPendingIntentReview } = await import(
					"../../orchestrator/workflow/dispatch-stamps.js"
				)
				stashPendingIntentReview(slug, result.role as string)
			} catch (err) {
				console.error(
					`[haiku_run_next] stashPendingIntentReview failed: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}

		// Auto-close for `close_feedback`: the cursor returns this when
		// every fix-hat for an FB has signed advance. The prompt
		// promises "the engine writes the closure" — same gap as
		// merge_stage/merge_intent was. We stamp `closed_at` on the FB
		// file, apply the FB's `targets.invalidates` (clearing the
		// named role keys on the target unit so the cursor reroutes
		// through them), and when the FB has `origin: "drift"`, refresh
		// the witnessed reviews/approvals timestamps on the targeted
		// unit so the drift sweep stops flagging the same commit.
		let closeFbIterations = 0
		let closeFbLastSig: string | null = null
		while (
			result.action === "close_feedback" &&
			typeof result.stage === "string" &&
			typeof result.feedback_id === "string"
		) {
			const sig = actionSignature(result)
			if (++closeFbIterations > RUN_NEXT_LOOP_CAP) {
				return loopAbortResponse(
					"close_feedback",
					closeFbIterations,
					result,
					"cap",
				)
			}
			if (sig === closeFbLastSig) {
				return loopAbortResponse(
					"close_feedback",
					closeFbIterations,
					result,
					"no_progress",
				)
			}
			closeFbLastSig = sig
			try {
				const stage = result.stage as string
				const fbId = result.feedback_id as string
				// `fbId` is the canonical wire form (`FB-NNN`); files on
				// disk are `NNN-slug.md`. A naive `f.startsWith(fbId+"-")`
				// match never fires because `"01-foo.md".startsWith("FB-01-")`
				// is false. `findFeedbackFile` already normalises both
				// forms (FB-NN, FB-N, NN, N) to a numeric prefix and
				// matches the file's leading-digit prefix — single source
				// of truth for the lookup, no chance of drift.
				const found = findFeedbackFile(slug, stage, fbId)
				if (!found) break
				const fbFile = found.path
				const fbFm = found.data
				const closedAt = new Date().toISOString()
				setFrontmatterField(fbFile, "closed_at", closedAt)
				// Apply targets.invalidates — delete the named role keys
				// from the targeted unit's reviews / approvals so the
				// cursor reroutes through them. The start_feedback_hat
				// prompt promises this happens on close.
				const targets = (fbFm.targets as Record<string, unknown>) ?? {}
				const targetUnit = targets.unit as string | undefined
				const invalidates = Array.isArray(targets.invalidates)
					? (targets.invalidates as string[])
					: []
				if (targetUnit && invalidates.length > 0) {
					const { applyFeedbackInvalidations } = await import(
						"../../orchestrator/workflow/dispatch-stamps.js"
					)
					applyFeedbackInvalidations({
						slug,
						stage,
						targetUnit,
						invalidates,
					})
				}
				// Refresh witnessed signed_at on the targeted unit when
				// this is a drift FB — otherwise the drift sweep keeps
				// finding the same commit past the original sign time.
				// `targets` and `targetUnit` are reused from the
				// invalidations block above — same FB, same fields.
				if (fbFm.origin === "drift" && targetUnit) {
					const unitPath = join(
						findHaikuRoot(),
						"intents",
						slug,
						"stages",
						stage,
						"units",
						`${targetUnit}.md`,
					)
					if (existsSync(unitPath)) {
						const intentDirAbs = join(findHaikuRoot(), "intents", slug)
						const { buildApprovalRecord, buildReviewRecord } = await import(
							"../../orchestrator/workflow/sign-slot.js"
						)
						const raw = readFileSync(unitPath, "utf8")
						const parsed = parseFrontmatter(raw)
						const fm = parsed.data as Record<string, unknown>
						const outputs = Array.isArray(fm.outputs)
							? (fm.outputs as string[])
							: []
						const reviews =
							fm.reviews && typeof fm.reviews === "object"
								? { ...(fm.reviews as Record<string, unknown>) }
								: {}
						for (const role of Object.keys(reviews)) {
							reviews[role] = buildReviewRecord(unitPath)
						}
						const approvals =
							fm.approvals && typeof fm.approvals === "object"
								? { ...(fm.approvals as Record<string, unknown>) }
								: {}
						for (const role of Object.keys(approvals)) {
							approvals[role] = buildApprovalRecord(intentDirAbs, outputs)
						}
						setFrontmatterField(unitPath, "reviews", reviews)
						setFrontmatterField(unitPath, "approvals", approvals)
					}
				}
				// pre-tick merge + cursor walk handle branch alignment
				result = dispatchOrchestratorAction(slug)
			} catch (err) {
				console.error(
					`[haiku_run_next] close_feedback execution failed: ${err instanceof Error ? err.message : String(err)}`,
				)
				break
			}
		}

		// Auto-merge for `merge_stage`: the cursor returns this when a
		// stage's gates are all signed and the branch is ready to land
		// on intent main. Until 2026-05-07 the engine relied on the
		// agent calling run_next a second time to "trigger" the merge,
		// but no handler actually executed the merge — the cursor just
		// kept emitting merge_stage. Now we perform the merge inline,
		// under the intent-main lock, then re-walk the cursor so the
		// agent sees the next post-merge action (typically the next
		// stage's elaborate, or intent_review when the final stage
		// merged).
		// Auto-seal for `merge_intent`: cursor returns this when every
		// stage is merged and every intent-level approval is signed.
		// The engine stamps `sealed_at` and re-walks. Same fix as
		// merge_stage — was promised by the prompt, never executed by a
		// handler.
		if (result.action === "seal_intent") {
			try {
				const intentMd = join(findHaikuRoot(), "intents", slug, "intent.md")
				if (existsSync(intentMd)) {
					setFrontmatterField(intentMd, "sealed_at", new Date().toISOString())
					// pre-tick merge + cursor walk handle branch alignment
					result = dispatchOrchestratorAction(slug)
				}
			} catch (err) {
				console.error(
					`[haiku_run_next] merge_intent execution failed: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}

		// Auto-execute for `complete_stage`: a SEMANTIC action ("stage
		// is done"). Under a git-backed portfolio this triggers a stage
		// branch → intent main merge; under filesystem-only backings it
		// runs whatever "complete" means there. The action name reflects
		// the intent, not the implementation — git is internal detail.
		// Renamed 2026-05-12 from the prior verb-based `merge_stage`,
		// per the principle "no engine action reflects a git/VCS
		// operation."
		let completeStageIterations = 0
		let completeStageLastSig: string | null = null
		while (
			result.action === "complete_stage" &&
			typeof result.stage === "string"
		) {
			const sig = actionSignature(result)
			if (++completeStageIterations > RUN_NEXT_LOOP_CAP) {
				return loopAbortResponse(
					"complete_stage",
					completeStageIterations,
					result,
					"cap",
				)
			}
			if (sig === completeStageLastSig) {
				return loopAbortResponse(
					"complete_stage",
					completeStageIterations,
					result,
					"no_progress",
				)
			}
			completeStageLastSig = sig
			const stageToComplete = result.stage
			try {
				const { isGitRepo } = await import("../../state-tools.js")
				if (!isGitRepo()) {
					// Filesystem-only backing: no git merge. The FM signal
					// itself is what marks the stage complete (every unit
					// fully approved). Re-tick — findCurrentStage walks past.
					result = dispatchOrchestratorAction(slug)
					continue
				}
				const { mergeStageBranchIntoMain } = await import(
					"../../git-worktree.js"
				)
				const { withIntentMainLock } = await import("../../locks.js")
				const outcome = withIntentMainLock(slug, () =>
					mergeStageBranchIntoMain(slug, stageToComplete),
				)
				if (!outcome.success) {
					if (outcome.isConflict) {
						return {
							content: [
								{
									type: "text" as const,
									text: `Stage '${stageToComplete}' completion blocked by conflict: ${outcome.message}`,
								},
							],
							isError: true,
						}
					}
					break
				}

				// Downstream-invalidation on revisit re-completion.
				//
				// If any stage AFTER `stageToComplete` has stamped
				// reviews/approvals, we just merged a revisited upstream
				// stage back into intent main — the downstream stamps
				// reference content that no longer reflects current
				// upstream. Clear them so the cursor re-fires
				// dispatch_review / dispatch_approval / user_gate on
				// every downstream unit. The continuity contract is
				// enforced once on decompose; this fills the gap on
				// the output side. See `invalidate-downstream.ts`.
				try {
					const { invalidateDownstreamApprovals } = await import(
						"../../orchestrator/workflow/invalidate-downstream.js"
					)
					const iDir = intentDir(slug)
					const intentFile = join(iDir, "intent.md")
					if (existsSync(intentFile)) {
						const im = readFrontmatter(intentFile)
						const studio = (im.studio as string) || ""
						if (studio) {
							const cleared = invalidateDownstreamApprovals({
								intentDir: iDir,
								intentFm: im,
								studio,
								completedStage: stageToComplete,
							})
							if (cleared.units_cleared > 0) {
								emitTelemetry("haiku.revisit.downstream_invalidated", {
									intent: slug,
									completed_stage: stageToComplete,
									stages_cleared: cleared.stages_cleared.join(","),
									units_cleared: String(cleared.units_cleared),
								})
							}
						}
					}
				} catch (err) {
					console.error(
						`[haiku_run_next] downstream invalidation failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
					)
				}

				result = dispatchOrchestratorAction(slug)
			} catch (err) {
				console.error(
					`[haiku_run_next] complete_stage execution failed: ${err instanceof Error ? err.message : String(err)}`,
				)
				break
			}
		}

		// POST-CURSOR BRANCH SWITCH. After the cursor has produced an
		// action (a fully-decided Track C/B/A result, not just a
		// `findCurrentStage` peek), switch the working tree to the
		// action's stage if it differs from the current branch.
		//
		// Direction is unrestricted: forward (advancing into a new
		// stage), backward (feedback rewind, drift go-back, intent-
		// completion review rejection routing to an earlier stage),
		// or same-stage (no-op). The cursor's algorithm decides what's
		// legitimate; this code just executes the move.
		//
		// If the target stage branch doesn't exist (v3 merged-and-
		// deleted, or never created), ensureStageBranch (called
		// internally by ensureOnStageBranch) forks it from intent
		// main — preserving the merged content as the starting point
		// for any corrective work.
		//
		// Only fires when the action carries a `stage` field. Intent-
		// scope actions (`intent_review`, `merge_intent`, `sealed`) skip.
		if (typeof result.stage === "string" && result.stage.length > 0) {
			try {
				const intentFile = join(findHaikuRoot(), "intents", slug, "intent.md")
				if (existsSync(intentFile)) {
					const guard = ensureOnStageBranch(slug, result.stage)
					if (!guard.ok) {
						return buildGuardResponse(
							slug,
							result.stage,
							guard,
							"run_next post-cursor revisit alignment",
						)
					}
				}
			} catch {
				/* non-fatal — branch alignment is best-effort */
			}
		}

		emitTelemetry("haiku.orchestrator.action", {
			intent: slug,
			action: result.action,
		})
		if (stFile)
			logSessionEvent(stFile, {
				event: "run_next",
				intent: slug,
				action: result.action,
				stage: result.stage,
				unit: result.unit,
				hat: result.hat,
				wave: result.wave,
			})

		if (stFile && result.action === "outputs_missing") {
			logSessionEvent(stFile, {
				event: "outputs_missing",
				intent: slug,
				stage: result.stage,
				missing: result.missing,
			})
		}
		if (stFile && result.action === "discovery_missing") {
			logSessionEvent(stFile, {
				event: "discovery_missing",
				intent: slug,
				stage: result.stage,
				missing: result.missing,
			})
		}
		// Read intent metadata for instruction building (used in all
		// return paths).
		let intentMeta: Record<string, unknown> = {}
		try {
			const iDir = intentDir(slug)
			const intentRaw = readFileSync(join(iDir, "intent.md"), "utf8")
			const parsed = parseFrontmatter(intentRaw)
			intentMeta = parsed.data
		} catch {
			/* intent might not exist for error actions */
		}
		const intentStudio = (intentMeta.studio as string) || ""

		// Helper to enrich result with preview and append instructions.
		const withInstructions = (resultObj: Record<string, unknown>): string => {
			enrichActionWithPreview(resultObj as OrchestratorAction)
			const instructions = buildRunInstructions(
				slug,
				intentStudio,
				resultObj as OrchestratorAction,
				intentDir(slug),
			)
			const adapted = adaptInstructions(instructions)
			// Strip tell_user/next_step from outer JSON — they appear in
			// the announcement section.
			const { tell_user: _tu, next_step: _ns, ...resultForJson } = resultObj
			return `${JSON.stringify(resultForJson, null, 2)}\n\n---\n\n${adapted}`
		}

		// External review: when the action surfaces with no URL on hand,
		// try opening the MR programmatically here too. This is the
		// fallback path for `external_review_requested` cases that
		// originate from the cursor (rather than from gate-review's
		// inline await_gate, which already tried). Engine-opened MRs
		// always target `haiku/<slug>/main` so the merge signal lands on
		// the intent main branch, not the repo default — that was the
		// real-world footgun where stage-merge-detection broke because
		// the PR landed on `main` and never on `haiku/<slug>/main`.
		if (
			result.action === "external_review_requested" &&
			!args.external_review_url &&
			!intentMeta.external_review_url &&
			typeof result.stage === "string" &&
			(result.stage as string).length > 0
		) {
			try {
				const { openStagePullRequest } = await import("../../git-worktree.js")
				const opened = openStagePullRequest({
					slug,
					stage: result.stage as string,
				})
				if (opened.createdUrl) {
					try {
						const intentMd = join(findHaikuRoot(), "intents", slug, "intent.md")
						setFrontmatterField(
							intentMd,
							"external_review_url",
							opened.createdUrl,
						)
					} catch {
						/* non-fatal */
					}
					result.message = `${(result.message as string) || ""}\n\nThe engine opened the MR for you: ${opened.createdUrl} — base is \`haiku/${slug}/main\` so the workflow engine can detect the merge. Tell the user; they review and merge when ready, then run /haiku:pickup.`
				} else if (opened.compareUrl) {
					result.message = `${(result.message as string) || ""}\n\nEngine couldn't open the MR via gh/glab (${opened.prError ?? opened.pushError ?? "no CLI found"}). Surface this URL to the user — clicking it opens the MR with base \`haiku/${slug}/main\` pre-filled: ${opened.compareUrl}. After the user pastes the resulting URL, call haiku_run_next { intent: "${slug}", external_review_url: "<url>" }.`
				} else {
					result.message = `${(result.message as string) || ""}\n\n${opened.message} Open ONE merge request from branch \`haiku/${slug}/${result.stage}\` to \`haiku/${slug}/main\` (NOT the repo default branch — the engine detects merges via intent main, not the repo default). Record the URL via haiku_run_next { intent: "${slug}", external_review_url: "<url>" }.`
				}
			} catch (err) {
				result.message = `${(result.message as string) || ""}\n\nIMPORTANT: Open the change request from \`haiku/${slug}/${result.stage}\` to \`haiku/${slug}/main\` (NOT the repo default). Try \`gh pr create --base haiku/${slug}/main\` for GitHub or \`glab mr create --target-branch haiku/${slug}/main\` for GitLab. (Engine helper threw: ${err instanceof Error ? err.message : String(err)}.) Record the URL via haiku_run_next { intent: "${slug}", external_review_url: "<url>" }.`
			}
		}

		// Gate review — engine-side blocking path.
		//
		// Single blocking tick: prepare the session, launch the browser
		// best-effort, await the user's decision, post-process side
		// effects, and (for advance cases) re-tick to surface the
		// natural-next workflow action. The agent sees ONE blocking
		// haiku_run_next call instead of the old "post URL + call
		// haiku_await_gate" two-step. haiku_await_gate stays as a
		// resume entry point for the case where the original tick
		// timed out or was interrupted.
		//
		// Action shapes the loop handles:
		//   - `gate_review` (legacy): emitted by the v3 dispatcher with
		//     pre-computed next_stage/next_phase/gate_context/gate_type.
		//   - `user_gate` (v4 cursor): emitted by walkIntentTrack for
		//     per-unit spec/approval reviews. Carries gate_kind ("spec"
		//     or "approval") and the unit list; this code translates it
		//     to the prepare/await shape on entry. gateType is always
		//     "ask" — user_gate IS the local SPA review path. The await
		//     tool stamps reviews.user / approvals.user via
		//     stampGateApproval keyed off gate_review_context.
		let gateReviewIterations = 0
		let gateReviewLastSig: string | null = null
		while (result.action === "gate_review" || result.action === "user_gate") {
			const sig = actionSignature(result)
			if (++gateReviewIterations > RUN_NEXT_LOOP_CAP) {
				return loopAbortResponse(
					"gate_review",
					gateReviewIterations,
					result,
					"cap",
				)
			}
			if (sig === gateReviewLastSig) {
				return loopAbortResponse(
					"gate_review",
					gateReviewIterations,
					result,
					"no_progress",
				)
			}
			gateReviewLastSig = sig
			const stage = (result.stage as string | null) ?? ""
			// Field translation:
			//   - gate_review (legacy): pre-computed fields present
			//   - user_gate (v4): map gate_kind → gate_review_context;
			//     gate_type is implicit "ask" (local SPA review);
			//     next_stage/next_phase aren't supplied because the
			//     await tool's stampGateApproval handles advancement off
			//     the gate_review_context alone for per-unit reviews.
			const isUserGate = result.action === "user_gate"
			const gateKind = isUserGate ? (result.gate_kind as string) : ""
			const nextStage = isUserGate ? null : (result.next_stage as string | null)
			const nextPhase = isUserGate ? null : (result.next_phase as string | null)
			const gateContext = isUserGate
				? gateKind === "spec"
					? "elaborate_to_execute"
					: "stage_gate"
				: (result.gate_context as string) || "stage_gate"
			const gateType = isUserGate ? "ask" : (result.gate_type as string)
			const intentDirPath = `.haiku/intents/${slug}`
			if (stFile)
				logSessionEvent(stFile, {
					event: "gate_review_prepared",
					intent: slug,
					stage,
					gate_type: gateType,
				})

			const _prepareGateReview = getPrepareGateReview()
			if (!_prepareGateReview) {
				if (isUserGate) {
					// No SPA server wired (test env, or a harness without
					// the review server). Fall through: emit the cursor's
					// user_gate action as a normal JSON response and let
					// the agent take the URL+await fallback path. This
					// is the same response shape the test harness has
					// always handled.
					break
				}
				return text(
					"Gate-review prepare handler not registered — server.ts wiring is broken. File a bug.",
				)
			}

			try {
				const prepared = await _prepareGateReview(intentDirPath, gateType, {
					gateContext,
					stage,
					nextStage,
					nextPhase,
				})

				// v4: gate session pointers land on intent.md regardless of
				// scope (stage state.json is gone). Stage-scope gates use
				// keyed fields so multiple stages can have concurrent
				// sessions without colliding (a discrete-mode intent could
				// have an external MR open on stage A while stage B's user
				// gate is also open on the local review server).
				//
				// M6 will move these to a session-server side store; for now
				// stamping intent.md as a transient pointer keeps await_gate
				// recovery working.
				try {
					const intentMdPath = join(intentDir(slug), "intent.md")
					const sessionKey = stage
						? `gate_review_session_${stage}`
						: "gate_review_session_id"
					const urlKey = stage ? `gate_review_url_${stage}` : "gate_review_url"
					setFrontmatterField(intentMdPath, sessionKey, prepared.session_id)
					setFrontmatterField(intentMdPath, urlKey, prepared.review_url)
					setFrontmatterField(intentMdPath, "gate_review_context", gateContext)
					if (nextStage !== undefined && nextStage !== null) {
						setFrontmatterField(
							intentMdPath,
							"gate_review_next_stage",
							nextStage,
						)
					}
					if (nextPhase !== undefined && nextPhase !== null) {
						setFrontmatterField(
							intentMdPath,
							"gate_review_next_phase",
							nextPhase,
						)
					}
				} catch {
					/* non-fatal — agent can still pass session_id explicitly */
				}

				syncSessionMetadata(slug, args.state_file as string | undefined)

				// Stamp announced_at on first prepare so the SPA's "new
				// gate" toast doesn't double-fire if the resume entry
				// point (haiku_await_gate) reattaches after a host
				// timeout.
				const existingSession = getSession(prepared.session_id)
				const alreadyAnnounced =
					existingSession?.session_type === "review" &&
					!!existingSession.announced_at
				if (!alreadyAnnounced) {
					try {
						updateSession(prepared.session_id, {
							announced_at: new Date().toISOString(),
						})
					} catch {
						/* non-fatal */
					}
				}

				// Browser launch + attach detection.
				//
				// If `prepared.browser_attached === true`, a live SPA tab
				// is already heartbeating for this session — skip the
				// launch entirely. Re-launching would spawn a duplicate
				// tab and surprise the user.
				//
				// Otherwise: best-effort launch, then wait up to
				// BROWSER_ATTACH_GRACE_MS for the SPA's first heartbeat.
				// If a heartbeat lands → proceed inline-block (happy
				// path). If no heartbeat lands → fall back to URL-print
				// mode and tell the agent to call haiku_await_gate when
				// the user is ready. This matches the contract: "the
				// engine inlines the wait; the URL+await-gate two-step
				// is the fallback when we can't open a browser or no
				// signal arrives in time."
				const BROWSER_ATTACH_GRACE_MS = 8_000
				const POLL_INTERVAL_MS = 250
				if (!prepared.browser_attached) {
					launchBrowserBestEffort(prepared.review_url, "Gate review")
					const deadline = Date.now() + BROWSER_ATTACH_GRACE_MS
					while (
						Date.now() < deadline &&
						!isBrowserAttached(prepared.session_id)
					) {
						await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
					}
					if (!isBrowserAttached(prepared.session_id)) {
						// No SPA heartbeat within the grace window. Either the
						// host couldn't spawn a browser (headless, sandboxed)
						// or the user is on a remote/desktop where the URL
						// needs to be hand-delivered. Hand the agent the URL
						// + session id and tell it to call haiku_await_gate
						// when the user is ready.
						return text(
							[
								`Gate review session prepared but no browser attached within ${BROWSER_ATTACH_GRACE_MS / 1000}s.`,
								"",
								`**Review URL:** ${prepared.review_url}`,
								"",
								"Post this URL to the user. When they have the tab open, call:",
								"",
								"```",
								`haiku_await_gate { intent: "${slug}", session_id: "${prepared.session_id}" }`,
								"```",
								"",
								"to block on the user's decision. The await tool reuses the same session — no new tab will open.",
							].join("\n"),
						)
					}
				}

				// Engine-side blocking: dispatch to haiku_await_gate
				// inline. The await tool drains the session, blocks on
				// the user's decision, runs every post-decision side
				// effect (stampGateApproval, workflowAdvancePhase/Stage,
				// writeReviewFeedbackFiles, sealIntentState, etc.), and
				// returns a rendered response. We then either re-tick
				// (advance cases — cursor surfaces the next real
				// workflow action) or return the response directly
				// (terminal / changes-requested / external-review
				// cases).
				//
				// `auto_open: false` because we already launched (or
				// reused) the browser above — the await tool would
				// otherwise spawn a second tab.
				const { orchestratorToolHandlers: gateHandlers } = await import(
					"./index.js"
				)
				const awaitTool = gateHandlers.get("haiku_await_gate")
				if (!awaitTool) {
					return text(
						"haiku_await_gate handler not registered — server.ts wiring is broken. File a bug.",
					)
				}
				const awaitResponse = await awaitTool.handle(
					{
						intent: slug,
						session_id: prepared.session_id,
						review_url: prepared.review_url,
						auto_open: false,
						...(stFile ? { state_file: stFile } : {}),
					},
					signal,
				)
				if (awaitResponse.isError) {
					return awaitResponse
				}

				const awaitedAction = extractActionFromAwaitResponse(awaitResponse)
				// "approved" decisions that advance the workflow get
				// re-ticked: the cursor sees the new sigs and emits the
				// next real action (start_unit_hat, elaborate, gate_review
				// for the next gate, merge_stage, etc.). Everything else
				// — external_review_requested, changes_requested,
				// revise_unit_specs, intent_complete, revisit_*,
				// stage_revisit, error — is a terminal-this-turn signal
				// the agent should see directly.
				const RETICK_ACTIONS: ReadonlySet<string> = new Set([
					"advance_phase",
					"advance_stage",
					"intent_approved",
				])
				if (awaitedAction && RETICK_ACTIONS.has(awaitedAction)) {
					// pre-tick merge + cursor walk handle branch alignment
					result = dispatchOrchestratorAction(slug)
					continue
				}
				return awaitResponse
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err)
				const errorStack = err instanceof Error ? err.stack : ""

				console.error(`[haiku] gate_review prepare failed: ${errorMsg}`)
				reportError(err, { intent: slug, stage })

				try {
					const logDir = join(process.cwd(), ".haiku", "logs")
					mkdirSync(logDir, { recursive: true })
					writeFileSync(
						join(logDir, "gate-review-error.log"),
						`${new Date().toISOString()}\nintent: ${slug}\nstage: ${stage}\nphase: prepare\nerror: ${errorMsg}\n${errorStack}\n---\n`,
						{ flag: "a" },
					)
				} catch {
					/* non-fatal */
				}

				syncSessionMetadata(slug, args.state_file as string | undefined)
				return {
					content: [
						{
							type: "text" as const,
							text: `GATE PREPARE FAILED: ${errorMsg}. Logged to .haiku/logs/gate-review-error.log. Call haiku_run_next { intent: "${slug}" } to retry.`,
						},
					],
					isError: true,
				}
			}
		}

		// Repair agent intercept — if runNext detected a broken migrated
		// intent, try the embedded repair agent before returning to the
		// outer agent. Falls through to the normal withInstructions
		// return if the agent isn't available or repair fails.
		if (result.action === "safe_intent_repair") {
			try {
				const { runRepairAgent } = await import("../../repair-agent.js")
				const root = findHaikuRoot()
				const iDir = join(root, "intents", slug)

				const studioInfo = resolveStudio(intentStudio)
				const studioDir = studioInfo?.path
				if (!studioDir) {
					syncSessionMetadata(slug, args.state_file as string | undefined)
					return text(withInstructions(result))
				}

				const activeStage = (result.stage as string) || ""
				const diagnosis = {
					slug,
					intentDir: iDir,
					studio: intentStudio,
					studioDir,
					activeStage,
					synthesizedStages: (result.synthesized_stages as string[]) || [],
					needsManualReview: (result.needs_manual_review as string[]) || [],
					phaseRegressed: result.phase_regressed as boolean,
					unitsMissingInputs: (result.units_missing_inputs as string[]) || [],
				}

				const repairResult = await runRepairAgent(diagnosis)

				// Re-enforce stage branch after the repair-agent await — it
				// can take minutes, during which the user or the repair
				// agent itself may have touched the checkout. Every
				// downstream write depends on the correct branch.
				{
					const postRepairGuard = ensureOnStageBranch(
						slug,
						(result.stage as string) || undefined,
					)
					if (!postRepairGuard.ok) {
						return buildGuardResponse(
							slug,
							(result.stage as string) || undefined,
							postRepairGuard,
							"after repair-agent run",
						)
					}
				}

				if (repairResult.success && !repairResult.fallbackUsed) {
					// Repair agent succeeded — run the workflow again to get the real
					// next action.
					const postRepairResult = dispatchOrchestratorAction(slug)

					// Guard: if repair didn't actually fix things, don't loop.
					if (postRepairResult.action === "safe_intent_repair") {
						// Fall through to return the original result as-is.
					} else {
						emitTelemetry("haiku.orchestrator.action", {
							intent: slug,
							action: postRepairResult.action,
						})
						if (stFile)
							logSessionEvent(stFile, {
								event: "run_next",
								intent: slug,
								action: postRepairResult.action,
								stage: postRepairResult.stage,
								unit: postRepairResult.unit,
								hat: postRepairResult.hat,
								wave: postRepairResult.wave,
							})

						syncSessionMetadata(slug, args.state_file as string | undefined)

						const repairNote = `**Intent repaired automatically:** ${repairResult.summary}\n\n---\n\n`
						return {
							content: [
								{
									type: "text" as const,
									text: repairNote + withInstructions(postRepairResult),
								},
							],
						}
					}
				}
				// Repair failed or used fallback — fall through to return
				// safe_intent_repair as-is.
			} catch {
				// Repair agent not available — fall through to normal
				// handling.
			}
		}

		// End-of-tick auto-push: if the active stage branch's HEAD has
		// advanced past origin (whether from engine state writes or from
		// agent code commits between ticks), push it. Cheap rev-parse
		// comparison; no network when no remote is configured.
		// Best-effort — failures log and never block the tick.
		try {
			const intentDirPath = intentDir(slug)
			const intentMdPath = join(intentDirPath, "intent.md")
			if (existsSync(intentMdPath)) {
				const raw = readFileSync(intentMdPath, "utf8")
				const { data } = parseFrontmatter(raw)
				const studio = (data.studio as string) || ""
				if (studio) {
					const activeStage = findCurrentStage(slug, studio)
					if (activeStage) {
						const branch = `haiku/${slug}/${activeStage}`
						// pushStageBranch internally checks branchAheadOfOrigin
						// and returns { ok: true, skipped: true } when the
						// branch isn't ahead — no need to gate it here.
						const pushResult = pushStageBranch(slug, activeStage)
						if (!pushResult.ok && pushResult.error) {
							console.error(
								`[haiku] auto-push of ${branch} failed: ${pushResult.error}`,
							)
						}
					}
				}
			}
		} catch (err) {
			console.error(
				`[haiku] auto-push end-of-tick check threw: ${
					err instanceof Error ? err.message : String(err)
				}`,
			)
		}

		syncSessionMetadata(slug, args.state_file as string | undefined)
		const rendered = withInstructions(result)
		return text(pickupHint ? `${pickupHint}\n\n${rendered}` : rendered)
	},
})
