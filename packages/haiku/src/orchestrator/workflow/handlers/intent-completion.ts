// orchestrator/workflow/handlers/intent-completion.ts — Emit for the
// `intent_completion_review` and `intent_completion_fix` states.
//
// derive-state routes intent.phase === "intent_completion" into two
// state names based on the `completion_review_dispatched` flag:
//   - !dispatched → intent_completion_review
//   - dispatched → intent_completion_fix
//
// The runtime behavior is shared (both flow through the same chain
// inside runIntentCompletionReview at orchestrator.ts:1776). This
// handler ports that 332-line chain in one go and is registered
// against both state keys.
//
// Sub-cases handled:
//   1. Studio-scope fix-chain reconciliation (escalate /
//      integrate_fix_chains)
//   2. First-tick review dispatch:
//        - no studio review agents → set skipped flag, fall through
//        - agents present → set dispatched flag, emit
//          intent_completion_review
//   3. In-scope pending findings → studio fix loop:
//        - cap exhausted → escalate
//        - dispatch → intent_completion_fix
//
// Cross-stage findings are no longer modeled — the pre-tick triage
// gate (run-tick.ts) relocates misplaced feedback before any handler
// runs.
//        - error if no fix hats configured
//   5. All findings resolved → final gate_review (intent_completion
//      gate context)

import { execSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	cleanupFixChainWorktree,
	createFixChainWorktree,
	fixChainBranchName,
	fixChainWorktreePath,
	isBranchMerged,
	mergeFixChainWorktree,
	resolveMainlineRef,
} from "../../../git-worktree.js"
import { sealIntentState } from "../../../state-integrity.js"
import {
	gitCommitState,
	incrementFeedbackBolt,
	intentDir,
	isGitRepo,
	MAX_FIX_LOOP_BOLTS,
	MAX_INTEGRATOR_ATTEMPTS,
	parseFrontmatter,
	readFeedbackFiles,
	setFrontmatterField,
	timestamp,
} from "../../../state-tools.js"
import {
	readStudioFixHatPaths,
	readStudioReviewAgentPaths,
} from "../../../studio-reader.js"
import { emitTelemetry } from "../../../telemetry.js"
import { resolveIntentStages } from "../../studio.js"
import { validateOutputLiveness } from "../../validators.js"
import { countOpenFeedbackForGateCheck } from "../feedback-triage-gate.js"
import { workflowIntentComplete } from "../side-effects.js"
import type { WorkflowHandler } from "./_types.js"

const emit: WorkflowHandler = (ctx) => {
	const slug = ctx.slug
	const studio = ctx.studio
	const intent = ctx.intent
	const intentFile = join(intentDir(slug), "intent.md")

	// Pre-completion liveness check: every code-output declared by any
	// unit across every stage must be referenced by SOME OTHER file in
	// the repo (or explicitly acknowledged in a stage's
	// coverage-decisions.json). Catches the orphan-component class of
	// failure (defined but never rendered). Runs before studio-level
	// review dispatch so reviewers see the orphan list and any
	// acknowledgments before signing off. Repo root resolves via git
	// rev-parse; in non-git environments the function short-circuits to
	// null because grep across an unindexed tree would be slow and
	// unreliable.
	if (isGitRepo()) {
		try {
			const repoRoot = execSync("git rev-parse --show-toplevel", {
				encoding: "utf8",
			}).trim()
			const allStages = resolveIntentStages(intent, studio)
			const livenessViolation = validateOutputLiveness(
				intentDir(slug),
				allStages,
				repoRoot,
			)
			if (livenessViolation) return livenessViolation
		} catch {
			// best-effort — skip if git is unavailable
		}
	}

	const allFeedback = readFeedbackFiles(slug, "")

	// ── Studio-scope fix-chain reconciliation ─────────────────────────
	const pendingIntegrationIC: Array<{
		feedback_id: string
		feedback_title: string
		feedback_file: string
		worktree: string
		branch: string
		conflict_files: string[]
		attempt: number
	}> = []
	const exhaustedIntegrationIC: Array<{
		feedback_id: string
		title: string
		attempts: number
	}> = []
	if (isGitRepo()) {
		for (const fb of allFeedback) {
			const wtPath = fixChainWorktreePath(slug, "intent", fb.id)
			if (!existsSync(wtPath)) continue
			const isClosed =
				fb.status === "closed" ||
				fb.status === "addressed" ||
				fb.status === "rejected" ||
				!!fb.closed_by
			if (!isClosed) {
				cleanupFixChainWorktree(slug, "intent", fb.id)
				emitTelemetry("haiku.intent_fix_chain.cleaned", {
					intent: slug,
					feedback_id: fb.id,
				})
				continue
			}

			const res = mergeFixChainWorktree(slug, "intent", fb.id)
			if (res.success) {
				emitTelemetry("haiku.intent_fix_chain.merged", {
					intent: slug,
					feedback_id: fb.id,
				})
				continue
			}

			if (!res.isConflict) {
				console.error(
					`[haiku] intent fix-chain merge failed for ${fb.id}: ${res.message}. Leaving worktree in place; next tick will retry.`,
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
				exhaustedIntegrationIC.push({
					feedback_id: fb.id,
					title: fb.title,
					attempts: nextAttempt - 1,
				})
				emitTelemetry("haiku.intent_integrator.exhausted", {
					intent: slug,
					feedback_id: fb.id,
					attempts: String(nextAttempt - 1),
				})
			} else {
				pendingIntegrationIC.push({
					feedback_id: fb.id,
					feedback_title: fb.title,
					feedback_file: fb.file,
					worktree: wtPath,
					branch: fixChainBranchName(slug, "intent", fb.id),
					conflict_files: res.conflictFiles || [],
					attempt: nextAttempt,
				})
				emitTelemetry("haiku.intent_integrator.dispatched", {
					intent: slug,
					feedback_id: fb.id,
					attempt: String(nextAttempt),
				})
			}
		}
	}

	if (exhaustedIntegrationIC.length > 0) {
		const target = exhaustedIntegrationIC[0]
		return {
			action: "escalate",
			intent: slug,
			stage: null,
			reason: "integrator_cap_exceeded",
			iteration: target.attempts,
			max_iterations: MAX_INTEGRATOR_ATTEMPTS,
			message: `Intent-scope fix-chain for ${target.feedback_id} ("${target.title}") still has unresolved merge conflicts after ${target.attempts} integrator attempt(s). Automated conflict resolution failed. ${exhaustedIntegrationIC.length - 1 > 0 ? `${exhaustedIntegrationIC.length - 1} other chain(s) are also exhausted. ` : ""}Resolve manually inside the fix-chain worktrees, commit, then run \`haiku_run_next\`.`,
			pending_items: exhaustedIntegrationIC.map((e) => ({
				feedback_id: e.feedback_id,
				title: e.title,
			})),
		}
	}

	if (pendingIntegrationIC.length > 0) {
		gitCommitState(
			`haiku: integrate_fix_chains dispatch ${pendingIntegrationIC.length} conflict(s) at intent scope`,
		)
		return {
			action: "integrate_fix_chains",
			intent: slug,
			studio,
			stage: null,
			scope: "intent",
			max_attempts: MAX_INTEGRATOR_ATTEMPTS,
			items: pendingIntegrationIC,
			message: `Intent-completion fix-chain merges hit conflicts on ${pendingIntegrationIC.length} finding(s). Dispatching the integrator subagent per chain to resolve in-place.`,
		}
	}

	const pendingItems = allFeedback.filter((item) => {
		if (item.closed_by) return false
		return (
			item.status !== "closed" &&
			item.status !== "addressed" &&
			item.status !== "rejected"
		)
	})

	// By the time we reach this handler, the pre-tick triage gate has
	// guaranteed intent-scope FBs are in-scope for the studio fix loop.

	const reviewDispatched =
		(intent.completion_review_dispatched as boolean) === true
	if (!reviewDispatched) {
		const agentPaths = readStudioReviewAgentPaths(studio)
		if (Object.keys(agentPaths).length === 0) {
			setFrontmatterField(intentFile, "completion_review_dispatched", true)
			setFrontmatterField(intentFile, "completion_review_skipped", true)
			sealIntentState(slug)
		} else {
			setFrontmatterField(intentFile, "completion_review_dispatched", true)
			setFrontmatterField(
				intentFile,
				"completion_review_dispatched_at",
				timestamp(),
			)
			sealIntentState(slug)
			emitTelemetry("haiku.intent.completion_review_dispatched", {
				intent: slug,
				agents: String(Object.keys(agentPaths).length),
			})
			return {
				action: "intent_completion_review",
				intent: slug,
				studio,
				agents: Object.keys(agentPaths),
				message: `Dispatching ${Object.keys(agentPaths).length} studio-level review agent(s) for intent '${slug}'. Each reviews the whole-intent artifacts and logs findings at intent scope via \`haiku_feedback\` (with stage omitted).`,
			}
		}
	}

	if (pendingItems.length > 0) {
		const inScopePending = pendingItems
		const fixHatPaths = readStudioFixHatPaths(studio)
		const fixHatNames = Object.keys(fixHatPaths)
		if (fixHatNames.length === 0) {
			return {
				action: "error",
				intent: slug,
				message: `Intent '${slug}' has ${inScopePending.length} pending intent-scope finding(s) but studio '${studio}' defines no fix-hats in \`plugin/studios/${studio}/fix-hats/\`. Either add fix hats, reject the findings, or close them manually.`,
			}
		}

		const sortedScope = [...inScopePending].sort((a, b) => a.num - b.num)
		const eligibleScope = sortedScope.filter((i) => i.bolt < MAX_FIX_LOOP_BOLTS)
		const escalatedScope = sortedScope.filter(
			(i) => i.bolt >= MAX_FIX_LOOP_BOLTS,
		)

		if (eligibleScope.length === 0 && escalatedScope.length > 0) {
			const target = escalatedScope[0]
			emitTelemetry("haiku.intent.fix_loop_escalate", {
				intent: slug,
				feedback_id: target.id,
				bolt: String(target.bolt),
			})
			return {
				action: "escalate",
				intent: slug,
				stage: null,
				reason: "fix_loop_cap_exceeded",
				iteration: target.bolt,
				max_iterations: MAX_FIX_LOOP_BOLTS,
				message:
					`Intent-scope feedback ${target.id} ("${target.title}") has exceeded the fix-loop cap of ${MAX_FIX_LOOP_BOLTS} bolts. Present the finding to the user; they can reject, edit, or close it manually. ${escalatedScope.length - 1 > 0 ? `${escalatedScope.length - 1} other finding(s) are also blocked at the cap.` : ""}`.trim(),
				pending_items: escalatedScope.map((i) => ({
					feedback_id: i.id,
					title: i.title,
					status: i.status,
					origin: i.origin,
					author: i.author,
					file: i.file,
				})),
			}
		}

		const dispatchedScope: {
			feedback_id: string
			feedback_file: string
			feedback_title: string
			bolt: number
			worktree: string | null
			branch: string | null
		}[] = []
		for (const item of eligibleScope) {
			const bumped = incrementFeedbackBolt(slug, "", item.id)
			if (!bumped) continue
			const wt = createFixChainWorktree(slug, "intent", item.id)
			dispatchedScope.push({
				feedback_id: item.id,
				feedback_file: item.file,
				feedback_title: item.title,
				bolt: bumped.bolt,
				worktree: wt,
				branch: wt ? fixChainBranchName(slug, "intent", item.id) : null,
			})
		}

		if (dispatchedScope.length === 0) {
			return {
				action: "error",
				intent: slug,
				message: `Failed to increment fix-loop bolts on any of ${eligibleScope.length} eligible intent-scope finding(s) — feedback files may have been deleted mid-tick.`,
			}
		}

		gitCommitState(
			`haiku: intent_completion_fix dispatch ${dispatchedScope.length} finding(s)`,
		)
		emitTelemetry("haiku.intent.completion_fix_dispatch", {
			intent: slug,
			count: String(dispatchedScope.length),
			escalated: String(escalatedScope.length),
		})
		return {
			action: "intent_completion_fix",
			intent: slug,
			studio,
			fix_hats: fixHatNames,
			max_bolts: MAX_FIX_LOOP_BOLTS,
			items: dispatchedScope,
			total_pending: inScopePending.length,
			escalated_count: escalatedScope.length,
			message: `Dispatching intent-completion fix loop for ${dispatchedScope.length} finding(s) in parallel. Per-finding studio fix-hats: ${fixHatNames.join(" → ")} (serial within chain). Chains run in parallel.${escalatedScope.length > 0 ? ` ${escalatedScope.length} additional finding(s) are at the bolt cap and will escalate after these complete.` : ""}`,
		}
	}

	// Defensive invariant: never emit gate_review while open
	// intent-scope feedback exists. intent_completion_fix dispatch
	// above is supposed to drain these; this check catches anything
	// that slipped through.
	const openIntentFb = countOpenFeedbackForGateCheck(slug, [], -1, true)
	if (openIntentFb > 0) {
		return {
			action: "error",
			intent: slug,
			message: `Refusing to emit gate_review for intent '${slug}' completion: ${openIntentFb} open intent-scope feedback item(s). The intent-completion fix loop should have dispatched these — file a bug citing handlers/intent-completion.ts. Workaround: close / reject the open items via the review UI first.`,
		}
	}

	// Autopilot marks the intent complete now (status: completed,
	// completed_at timestamp, finalize stage branches into intent main,
	// commit, seal). The completed state lands on the intent main branch.
	// The agent then opens the delivery PR; the merge is the only
	// remaining action — no further /haiku:pickup tick required to seal.
	const intentMode = ((intent.mode as string) || "continuous").toLowerCase()
	const autopilot = intentMode === "autopilot" || intent.autopilot === true
	if (autopilot && isGitRepo()) {
		workflowIntentComplete(slug)
		emitTelemetry("haiku.intent.autopilot_complete", { intent: slug })
		const intentMainBranch = `haiku/${slug}/main`
		const mainline = resolveMainlineRef()
		// If the branch is already merged, the intent is fully done —
		// return intent_complete (no PR to open). Otherwise return
		// external_review_requested so the agent opens the delivery PR.
		// Either way, the on-disk completion state is already in place.
		if (isBranchMerged(intentMainBranch, mainline)) {
			return {
				action: "intent_complete",
				intent: slug,
				studio,
				message: `Intent '${slug}' is complete — branch '${intentMainBranch}' has merged into '${mainline}'.`,
			}
		}
		return {
			action: "external_review_requested",
			intent: slug,
			studio,
			stage: null,
			gate_context: "intent_completion",
			message: `Intent '${slug}' is marked complete. Open ONE merge request from branch '${intentMainBranch}' to the repo mainline ('${mainline}') for final delivery. Include the H·AI·K·U browse link in the description so reviewers can see the intent, units, and knowledge artifacts. The merge IS the only remaining action — once merged, the completed intent lands on mainline. No further haiku_run_next call required.`,
		}
	}

	return {
		action: "gate_review",
		intent: slug,
		studio,
		stage: null,
		gate_type: "ask",
		gate_context: "intent_completion",
		message: `Intent '${slug}' has passed all stages and all studio-level review checks${(intent.completion_review_skipped as boolean) ? " (no studio-level reviewers configured)" : ""}. Opening final review gate.`,
	}
}

export default emit
