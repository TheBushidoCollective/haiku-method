// orchestrator/workflow/handlers/gate.ts — Emit for the `gate_review`
// state.
//
// Owns the gate-phase emission chain at orchestrator.ts:3414-4030.
// Sub-cases handled (in branch order):
//
//   1. Fix-chain worktree reconciliation (closed → merge, conflict →
//      integrator dispatch, exhausted → escalate, open → reap).
//   2. Pending feedback routing (cross-stage findings are pre-relocated
//      by run-tick.ts's pre-tick triage gate, so by the time we get
//      here every pending FB is in-scope for the current stage):
//        a. Auto-dispatch resolutions:
//             - stage_revisit → revisitCurrentStage delegate
//        b. Human-authored needsTriage / question items → feedback_dispatch
//             (no UI re-pop — agent triages / replies inline; was the
//              source of the gate-review loop fixed 2026-04-27).
//        c. fix_hats fix loop → review_fix (or escalate / error)
//        d. Legacy revisit → feedback_revisit (or escalate). NOTE: agent-
//           authored needsTriage items with no `fix_hats` declared on
//           STAGE.md fall through here too, which means a full stage
//           rollback. If that's surfaced as a problem, route them
//           through feedback_dispatch first or require fix_hats on
//           stages that emit agent FBs.
//   3. External review reconciliation (only when stage already
//      completed+blocked): branch-merge or CLI signal → advance,
//      changes_requested → delegate, otherwise → awaiting_external_review.
//   4. Auto gate → advance_stage (with workflowAdvanceStage) or
//      completeOrReviewIntent.
//   5. Non-auto gate → gate_review (with workflowGateAsk).
//
// Side effects: feedback frontmatter writes (integrator_attempts),
// stage state writes (gate_outcome, pre-review reset on revisit),
// workflowGateAsk, workflowAdvanceStage, workflowCompleteStage, gitCommitState
// commits keyed off each sub-path.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	cleanupFixChainWorktree,
	createFixChainWorktree,
	fixChainBranchName,
	fixChainWorktreePath,
	isBranchMerged,
	mergeFixChainWorktree,
} from "../../../git-worktree.js"
import {
	buildFeedbackDispatchAction,
	checkExternalState,
	classifyPendingForRevisit,
	completeOrReviewIntent,
	type ExternalReviewState,
	handleExternalChangesRequested,
	maybeEscalate,
	resolveIntentStages,
	resolveStageReview,
	revisitCurrentStage,
	summarizeFeedback,
	workflowAdvanceStage,
	workflowCompleteStage,
	workflowGateAsk,
} from "../../../orchestrator.js"
import {
	appendStageIteration,
	countPendingFeedback,
	gitCommitState,
	incrementFeedbackBolt,
	isGitRepo,
	MAX_FIX_LOOP_BOLTS,
	MAX_INTEGRATOR_ATTEMPTS,
	parseFrontmatter,
	readFeedbackFiles,
	readJson,
	setFrontmatterField,
	stageStatePath,
	writeJson,
} from "../../../state-tools.js"
import { readHatDefs, studioSearchPaths } from "../../../studio-reader.js"
import { emitTelemetry } from "../../../telemetry.js"
import { countOpenFeedbackForGateCheck } from "../feedback-triage-gate.js"
import type { WorkflowHandler } from "./_types.js"

// Inline copy of resolveStageFixHats (private in orchestrator). The
// fix-hats list is read directly from STAGE.md frontmatter so we
// avoid a circular export. Mirrors orchestrator.ts:491.
function resolveStageFixHatsInline(studio: string, stage: string): string[] {
	for (const base of studioSearchPaths()) {
		const stageFile = join(base, studio, "stages", stage, "STAGE.md")
		if (!existsSync(stageFile)) continue
		const { data: fm } = parseFrontmatter(readFileSync(stageFile, "utf8"))
		const fixHats = (fm.fix_hats as string[]) || []
		return fixHats
	}
	return []
}

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const intent = ctx.intent
	const currentStage = ctx.currentStage
	const iDir = ctx.intentDirPath
	const intentFile = join(iDir, "intent.md")

	// Intent-level phases (intent_review, intent_completion) also
	// surface as gate_review from derive-state. Only handle the
	// stage-scoped variant here; defer the others to runNext until
	// their per-state ports land.
	if (!currentStage) return null
	if (ctx.currentPhase !== "gate") return null

	const stageState: Record<string, unknown> = { ...ctx.stageState }
	const stageStatus = (stageState.status as string) || "pending"
	const studioStages = resolveIntentStages(intent, studio)

	// ── Fix-chain worktree reconciliation ─────────────────────────────
	const pendingIntegration: Array<{
		feedback_id: string
		feedback_title: string
		feedback_file: string
		worktree: string
		branch: string
		conflict_files: string[]
		attempt: number
	}> = []
	const exhaustedIntegration: Array<{
		feedback_id: string
		title: string
		attempts: number
	}> = []
	if (isGitRepo()) {
		const allFeedback = readFeedbackFiles(slug, currentStage)
		for (const fb of allFeedback) {
			const wtPath = fixChainWorktreePath(slug, currentStage, fb.id)
			if (!existsSync(wtPath)) continue
			const isClosed =
				fb.status === "closed" ||
				fb.status === "addressed" ||
				fb.status === "rejected" ||
				!!fb.closed_by
			if (!isClosed) {
				cleanupFixChainWorktree(slug, currentStage, fb.id)
				emitTelemetry("haiku.fix_chain.cleaned", {
					intent: slug,
					stage: currentStage,
					feedback_id: fb.id,
				})
				continue
			}

			const res = mergeFixChainWorktree(slug, currentStage, fb.id)
			if (res.success) {
				emitTelemetry("haiku.fix_chain.merged", {
					intent: slug,
					stage: currentStage,
					feedback_id: fb.id,
				})
				continue
			}

			if (!res.isConflict) {
				console.error(
					`[haiku] fix-chain merge failed for ${fb.id}: ${res.message}. Leaving worktree in place; next tick will retry.`,
				)
				continue
			}

			const fbAbsPath = join(process.cwd(), fb.file)
			const { data: fbFM } = parseFrontmatter(readFileSync(fbAbsPath, "utf8"))
			const prevAttempts = Number(
				(fbFM as { integrator_attempts?: number }).integrator_attempts ?? 0,
			)
			const nextAttempt = prevAttempts + 1
			setFrontmatterField(fbAbsPath, "integrator_attempts", nextAttempt)
			if (nextAttempt > MAX_INTEGRATOR_ATTEMPTS) {
				exhaustedIntegration.push({
					feedback_id: fb.id,
					title: fb.title,
					attempts: nextAttempt - 1,
				})
				emitTelemetry("haiku.integrator.exhausted", {
					intent: slug,
					stage: currentStage,
					feedback_id: fb.id,
					attempts: String(nextAttempt - 1),
				})
			} else {
				pendingIntegration.push({
					feedback_id: fb.id,
					feedback_title: fb.title,
					feedback_file: fb.file,
					worktree: wtPath,
					branch: fixChainBranchName(slug, currentStage, fb.id),
					conflict_files: res.conflictFiles || [],
					attempt: nextAttempt,
				})
				emitTelemetry("haiku.integrator.dispatched", {
					intent: slug,
					stage: currentStage,
					feedback_id: fb.id,
					attempt: String(nextAttempt),
				})
			}
		}
	}

	if (exhaustedIntegration.length > 0) {
		const target = exhaustedIntegration[0]
		return {
			action: "escalate",
			intent: slug,
			stage: currentStage,
			reason: "integrator_cap_exceeded",
			iteration: target.attempts,
			max_iterations: MAX_INTEGRATOR_ATTEMPTS,
			message: `Fix-chain for ${target.feedback_id} ("${target.title}") still has unresolved merge conflicts after ${target.attempts} integrator attempt(s). Automated conflict resolution failed. ${exhaustedIntegration.length - 1 > 0 ? `${exhaustedIntegration.length - 1} other chain(s) are also exhausted. ` : ""}Resolve the conflicts manually inside the fix-chain worktrees (listed below), commit, then run \`haiku_run_next\` — the merge will retry.`,
			pending_items: exhaustedIntegration.map((e) => ({
				feedback_id: e.feedback_id,
				title: e.title,
			})),
		}
	}

	if (pendingIntegration.length > 0) {
		gitCommitState(
			`haiku: integrate_fix_chains dispatch ${pendingIntegration.length} conflict(s) in ${currentStage}`,
		)
		return {
			action: "integrate_fix_chains",
			intent: slug,
			studio,
			stage: currentStage,
			scope: currentStage,
			max_attempts: MAX_INTEGRATOR_ATTEMPTS,
			items: pendingIntegration,
			message: `Fix-chain merges hit conflicts on ${pendingIntegration.length} finding(s) in stage '${currentStage}'. Dispatching the integrator subagent per chain to resolve in-place.`,
		}
	}

	// ── Pending feedback check ────────────────────────────────────────
	const pendingCount = countPendingFeedback(slug, currentStage)
	if (pendingCount > 0) {
		const pendingItems = readFeedbackFiles(slug, currentStage).filter(
			(item) => {
				if (item.closed_by) return false
				return (
					item.status !== "closed" &&
					item.status !== "addressed" &&
					item.status !== "rejected"
				)
			},
		)

		// By the time we reach this gate, the pre-tick triage gate
		// (run-tick.ts) has guaranteed every pending FB lives on the
		// correct stage — cross-stage findings are relocated via
		// `haiku_feedback_move` before any handler dispatch.
		const gateClassification = classifyPendingForRevisit(pendingItems)
		if (gateClassification.stageRevisits.length > 0) {
			const revisitIds = gateClassification.stageRevisits
				.map((it) => it.id)
				.join(", ")
			emitTelemetry("haiku.gate.auto_revisit", {
				intent: slug,
				stage: currentStage,
				feedback_ids: revisitIds,
			})
			return revisitCurrentStage(slug, iDir, intentFile, currentStage)
		}
		// Cross-stage routing flows through file location (relocated at
		// the pre-tick triage gate); no resolution bucket needed here.

		// CONTRACT: open feedback ⇒ never engage the user. When the
		// reviewer left a HUMAN comment routed to "Let agent decide"
		// (resolution=null) — or filed a question — dispatch it back
		// to the agent for inline handling instead of bouncing the
		// user back into the review UI. The review UI was popping on
		// every tick because the gate kept seeing the unset resolution
		// and asking the human to triage; the human had already said
		// "agent decide," and the loop kept the feedback unaddressed.
		//
		// Agent-authored items with null resolution are out of scope
		// here — they fall through to the existing fix-chain / legacy
		// feedback_revisit paths, which don't engage the user.
		// inlineFixes are zeroed in the dispatch so the worktree-based
		// fix-chain below remains the canonical path for code fixes;
		// once the agent triages, the next tick re-enters this handler
		// with a clean classification and falls through to fix-chain.
		const humanNeedsTriage = gateClassification.needsTriage.filter(
			(item) => item.author_type === "human",
		)
		const humanQuestions = gateClassification.questions.filter(
			(item) => item.author_type === "human",
		)
		if (humanNeedsTriage.length > 0 || humanQuestions.length > 0) {
			emitTelemetry("haiku.gate.feedback_dispatch", {
				intent: slug,
				stage: currentStage,
				needs_triage: String(humanNeedsTriage.length),
				questions: String(humanQuestions.length),
			})
			return buildFeedbackDispatchAction(slug, currentStage, {
				needsTriage: humanNeedsTriage,
				questions: humanQuestions,
				inlineFixes: [],
				stageRevisits: [],
			})
		}

		// fix_hats route
		const fixHats = resolveStageFixHatsInline(studio, currentStage)
		if (fixHats.length > 0 && pendingItems.length > 0) {
			const hatDefs = readHatDefs(studio, currentStage)
			const missing = fixHats.filter((h) => !hatDefs[h])
			if (missing.length > 0) {
				return {
					action: "error",
					intent: slug,
					message: `Stage '${currentStage}' declares fix_hats: [${fixHats.join(", ")}] but [${missing.join(", ")}] have no mandate file in plugin/studios/<studio>/stages/${currentStage}/hats/. Create the missing files or remove them from fix_hats.`,
				}
			}

			const sorted = [...pendingItems].sort((a, b) => a.num - b.num)
			const eligibleItems = sorted.filter((i) => i.bolt < MAX_FIX_LOOP_BOLTS)
			const escalatedItems = sorted.filter((i) => i.bolt >= MAX_FIX_LOOP_BOLTS)

			if (eligibleItems.length === 0 && escalatedItems.length > 0) {
				const target = escalatedItems[0]
				emitTelemetry("haiku.feedback.fix_loop_escalate", {
					intent: slug,
					stage: currentStage,
					feedback_id: target.id,
					bolt: String(target.bolt),
				})
				return {
					action: "escalate",
					intent: slug,
					stage: currentStage,
					reason: "fix_loop_cap_exceeded",
					iteration: target.bolt,
					max_iterations: MAX_FIX_LOOP_BOLTS,
					message:
						`Feedback ${target.id} ("${target.title}") has exceeded the fix-loop cap of ${MAX_FIX_LOOP_BOLTS} bolts. The fix hats cannot resolve this finding autonomously — the finding itself, the spec it's flagging, or the hat mandates likely need human intervention. Present the finding to the user; they can revisit upstream, reject the finding, edit the spec, or mark it resolved manually. ${escalatedItems.length - 1 > 0 ? `${escalatedItems.length - 1} other finding(s) are also blocked at the cap.` : ""}`.trim(),
					pending_items: escalatedItems.map(summarizeFeedback),
				}
			}

			const dispatched: {
				feedback_id: string
				feedback_file: string
				feedback_title: string
				bolt: number
				worktree: string | null
				branch: string | null
			}[] = []
			for (const item of eligibleItems) {
				const bumped = incrementFeedbackBolt(slug, currentStage, item.id)
				if (!bumped) continue
				const wt = createFixChainWorktree(slug, currentStage, item.id)
				dispatched.push({
					feedback_id: item.id,
					feedback_file: item.file,
					feedback_title: item.title,
					bolt: bumped.bolt,
					worktree: wt,
					branch: wt ? fixChainBranchName(slug, currentStage, item.id) : null,
				})
			}

			if (dispatched.length === 0) {
				return {
					action: "error",
					intent: slug,
					message: `Failed to increment fix-loop bolts on any of ${eligibleItems.length} eligible finding(s) — feedback files may have been deleted mid-tick.`,
				}
			}

			gitCommitState(
				`haiku: review_fix dispatch ${dispatched.length} finding(s) in ${currentStage}`,
			)
			emitTelemetry("haiku.gate.review_fix", {
				intent: slug,
				stage: currentStage,
				count: String(dispatched.length),
				escalated: String(escalatedItems.length),
			})
			return {
				action: "review_fix",
				intent: slug,
				studio,
				stage: currentStage,
				fix_hats: fixHats,
				max_bolts: MAX_FIX_LOOP_BOLTS,
				items: dispatched,
				total_pending: pendingItems.length,
				escalated_count: escalatedItems.length,
				message: `Dispatching fix loop for ${dispatched.length} finding(s) in parallel — stage '${currentStage}'. Per-finding hat sequence: ${fixHats.join(" → ")} (serial within chain). Chains run in parallel across findings.${escalatedItems.length > 0 ? ` ${escalatedItems.length} additional finding(s) are at the bolt cap and will escalate after these complete.` : ""}`,
			}
		}

		// Legacy feedback_revisit
		const statePath = stageStatePath(slug, currentStage)
		const iterResult = appendStageIteration(
			slug,
			currentStage,
			{
				trigger: "feedback",
				reason: `${pendingCount} pending feedback item(s)`,
				feedbackTitles: pendingItems.map((i) => i.title),
			},
			"feedback-revisit",
		)
		emitTelemetry("haiku.gate.feedback_revisit", {
			intent: slug,
			stage: currentStage,
			pending_count: String(pendingCount),
			iteration: String(iterResult.count),
		})
		const escalation = maybeEscalate(
			slug,
			currentStage,
			iterResult,
			"feedback",
			pendingItems.map((i) => ({
				feedback_id: i.id,
				title: i.title,
			})),
		)
		if (escalation) {
			gitCommitState(
				`haiku: feedback_revisit escalated in ${currentStage} (${pendingCount} pending, iteration ${iterResult.count})`,
			)
			return escalation
		}

		const gateState = readJson(statePath)
		gateState.phase = "elaborate"
		gateState.pre_review_dispatched = false
		gateState.pre_review_dispatched_at = null
		gateState.pre_review_skipped_no_agents = false
		gateState.pre_review_reviewers_acknowledged = false
		gateState.pre_review_reviewers_acknowledged_at = null
		writeJson(statePath, gateState)
		gitCommitState(
			`haiku: feedback_revisit in ${currentStage} (${pendingCount} pending, iteration ${iterResult.count})`,
		)
		return {
			action: "feedback_revisit",
			intent: slug,
			studio,
			stage: currentStage,
			pending_count: pendingCount,
			iteration: iterResult.count,
			visits: iterResult.count,
			pending_items: pendingItems.map(summarizeFeedback),
			message: `${pendingCount} pending feedback item(s) found — rolling back to elaborate (iteration ${iterResult.count}). YOU MUST read every feedback file at pending_items[].file in full before elaborating — the body carries the requirements. Address all pending feedback before the gate can advance.`,
		}
	}

	// ── External review reconciliation ─────────────────────────────────
	const gateOutcomeInGate = (stageState.gate_outcome as string) || ""
	if (stageStatus === "completed" && gateOutcomeInGate === "blocked") {
		let extApproved = false
		let externalState: ExternalReviewState = { status: "unknown" }
		const externalUrl = (stageState.external_review_url as string) || ""

		if (isGitRepo()) {
			const stageBranch = `haiku/${slug}/${currentStage}`
			const mainline = `haiku/${slug}/main`
			if (isBranchMerged(stageBranch, mainline)) {
				extApproved = true
			}
		}

		if (!extApproved && externalUrl) {
			externalState = checkExternalState(externalUrl)
			if (externalState.status === "approved") {
				extApproved = true
			}
		}

		if (extApproved) {
			const statePath = stageStatePath(slug, currentStage)
			const stateData = readJson(statePath)
			stateData.gate_outcome = "advanced"
			writeJson(statePath, stateData)
			emitTelemetry("haiku.gate.resolved", {
				intent: slug,
				stage: currentStage,
				gate_type: "external",
				outcome: "approved",
			})
		} else if (externalState.status === "changes_requested") {
			return handleExternalChangesRequested(
				slug,
				currentStage,
				externalUrl,
				externalState.provider,
			)
		} else if (externalUrl) {
			return {
				action: "awaiting_external_review",
				intent: slug,
				stage: currentStage,
				external_review_url: externalUrl,
				message: `Stage '${currentStage}' is awaiting external review at: ${externalUrl}. Neither branch merge detection nor CLI-based check detected approval yet. Run /haiku:pickup after the review is approved.`,
			}
		}
	}

	const rawReviewType = resolveStageReview(studio, currentStage)
	const autopilot = intent.autopilot === true
	const intentMode = (intent.mode as string) || "continuous"
	// Note: `hybrid` mode intentionally does NOT inherit discrete's
	// external-review coercion. `state-tools.ts:7836` (dashboard branch
	// listing) treats hybrid as discrete-shaped for branch topology, but
	// the gate handler treats them differently because hybrid is "discrete
	// where it matters, continuous elsewhere" — per-stage PRs aren't a
	// universal requirement. If hybrid ever needs gate enforcement, add
	// it here explicitly rather than redefining `isDiscrete`.
	const isDiscrete = intentMode === "discrete"

	// Discrete-mode contract: every stage gate MUST open an external
	// PR/MR. The merge IS the approval signal — local "Approve" alone
	// does not advance the stage's status to completed (see
	// `project_discrete_approve_external_pr.md` in user memory). We
	// coerce the stage's declared `review:` type to include `external`
	// regardless of what STAGE.md says. autopilot is honored too:
	// even autopilot can't skip the external PR in discrete mode —
	// the contract is "every stage produces a reviewable PR/MR."
	//
	// Exception: `await` gates are NOT review types — they're wait-on-
	// external-event gates (customer response, pipeline completion,
	// etc.). Coercing `await` to `await,external` would conflate two
	// independent signals; the existing `await` → `effectiveGateType:
	// external` mapping below already handles routing. Skip coercion
	// when any segment of the declared type is `await`.
	let coercedReviewType = rawReviewType
	const declaredSegments = rawReviewType.split(",").map((t) => t.trim())
	const hasAwait = declaredSegments.includes("await")
	if (isDiscrete && !rawReviewType.includes("external") && !hasAwait) {
		// Compose with the existing type so users who declared `ask`
		// still get the local-review path in addition to the external
		// PR. `auto` becomes pure `external` (no local picker
		// needed).
		coercedReviewType =
			rawReviewType === "auto" ? "external" : `${rawReviewType},external`
	}
	const reviewType =
		autopilot && coercedReviewType === "ask" ? "auto" : coercedReviewType
	const stageIdx = studioStages.indexOf(currentStage)
	const nextStage =
		stageIdx < studioStages.length - 1 ? studioStages[stageIdx + 1] : null

	const gitAvailable = isGitRepo()

	// Discrete + no-git is a contract violation — discrete mode requires
	// external PR/MR approval, which requires a git host. Telemetry
	// surfaces the inconsistency. The actual graceful fallback runs a few
	// lines below: `effectiveGateType` strips `external` from the
	// resolved review type when `!gitAvailable`, leaving the
	// non-external residue (or `ask` as a last-resort default).
	if (isDiscrete && !gitAvailable) {
		emitTelemetry("haiku.gate.discrete_no_git_fallback", {
			intent: slug,
			stage: currentStage,
		})
	}

	if (reviewType === "auto") {
		emitTelemetry("haiku.gate.auto_advanced", {
			intent: slug,
			stage: currentStage,
			gate_context: "stage_gate",
		})
		if (nextStage) {
			workflowAdvanceStage(slug, currentStage, nextStage)
			return {
				action: "advance_stage",
				intent: slug,
				studio,
				stage: currentStage,
				next_stage: nextStage,
				gate_outcome: "advanced",
				message: `Auto-gate passed — advancing to '${nextStage}'. Call haiku_run_next { intent: "${slug}" } immediately.`,
			}
		}
		workflowCompleteStage(slug, currentStage, "advanced")
		return completeOrReviewIntent(
			slug,
			studio,
			`Auto-gate passed — all stages complete for intent '${slug}'.`,
		)
	}

	let effectiveGateType: string
	if (!gitAvailable && reviewType.includes("external")) {
		const remaining = reviewType
			.split(",")
			.filter((t) => t !== "external")
			.join(",")
		effectiveGateType = remaining || "ask"
	} else if (reviewType === "ask") {
		effectiveGateType = "ask"
	} else if (reviewType === "await") {
		effectiveGateType = "external"
	} else {
		effectiveGateType = reviewType
	}

	// Defensive invariant: never emit gate_review while open feedback
	// exists. gate.ts itself routes pending feedback through
	// review_fix / feedback_revisit / feedback_dispatch above; if any
	// branch missed an item, this final check catches it before the
	// user sees a gate with open feedback.
	const openFbCount = countOpenFeedbackForGateCheck(
		slug,
		studioStages,
		studioStages.indexOf(currentStage),
	)
	if (openFbCount > 0) {
		return {
			action: "error",
			intent: slug,
			message: `Refusing to emit gate_review for stage '${currentStage}' (stage gate): ${openFbCount} open feedback item(s) on or before this stage. The gate handler should have routed these through review_fix / feedback_revisit / feedback_dispatch — file a bug citing handlers/gate.ts. Workaround: close / reject the open items via the review UI first.`,
		}
	}

	workflowGateAsk(slug, currentStage)
	return {
		action: "gate_review",
		intent: slug,
		studio,
		stage: currentStage,
		next_stage: nextStage,
		gate_type: effectiveGateType,
		message: `Stage '${currentStage}' complete — opening review`,
	}
}

export default emit
