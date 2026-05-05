// orchestrator/revisit.ts — Stage / phase regression logic.
//
// Two entry points:
//   - revisit(slug, requestedStage?)            — public, called by
//     the pre-tick feedback gate when stage_revisit resolution wins
//     triage on an open FB at an earlier stage.
//   - revisitCurrentStage(slug, iDir, ...)      — re-elaborate the
//     active stage in place. Public so the gate handler can route
//     auto-revisit findings without re-opening the classify path.
//
// Plus the support functions:
//   - classifyPendingForRevisit  — bucket pending feedback by resolution
//   - buildFeedbackDispatchAction — non-rollback feedback_dispatch action
//   - resetFixLoopBolts          — restart fix-loop budget on revisit
//   - markDownstreamStagesStale  — Guard 2 reset of downstream stages
//   - revisitEarlierStage        — jump to an earlier stage
//   - uncompleteIntent           — revive a completed intent for revisit

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import {
	checkoutFromBranchOnIntentMain,
	cleanupIntentWorktrees,
	prepareRevisitBranch,
	writeOnIntentMain,
} from "../git-worktree.js"
import type { OrchestratorAction } from "../orchestrator.js"
import { sealIntentState } from "../state-integrity.js"
import {
	type FeedbackItem,
	findFeedbackFile,
	findHaikuRoot,
	gitCommitState,
	parseFrontmatter,
	readFeedbackFiles,
	readJson,
	setFrontmatterField,
	stageStatePath,
	timestamp,
	writeJson,
} from "../state-tools.js"
import { emitTelemetry } from "../telemetry.js"
import { resolveIntentStages } from "./studio.js"

function readFrontmatter(filePath: string): Record<string, unknown> {
	if (!existsSync(filePath)) return {}
	const raw = readFileSync(filePath, "utf8")
	const { data } = parseFrontmatter(raw)
	return data
}

/** Bucket pending feedback on a stage by the `resolution` field the
 *  reviewer (or a prior triage pass) wrote. The revisit entry point
 *  uses this to decide whether to actually roll the stage back or to
 *  hand the resolution work off to the agent without a rollback.
 *
 *  Resolution semantics:
 *    - `null`            → reviewer didn't pick a path; agent triages
 *                          each one during `feedback_dispatch`.
 *                          NOT treated as `stage_revisit` — the
 *                          nuclear option should never be the silent
 *                          default.
 *    - `stage_revisit`   → the stage needs a full re-loop; this is the
 *                          ONLY bucket that triggers revisitCurrentStage.
 *    - `question`        → agent replies via POST .../replies with
 *                          close_as_answered: true, no code delta.
 *    - `inline_fix`      → agent dispatches ONE bolt of the stage's
 *                          fix_hats against the finding.
 *
 *  Cross-stage routing flows through file location: the pre-tick
 *  triage gate relocates misplaced FBs via `haiku_feedback_move`, so
 *  every pending item we classify here is already in-scope for the
 *  current stage. */
interface FeedbackClassification {
	questions: FeedbackItem[]
	inlineFixes: FeedbackItem[]
	stageRevisits: FeedbackItem[]
	needsTriage: FeedbackItem[]
}

export function classifyPendingForRevisit(
	items: FeedbackItem[],
): FeedbackClassification {
	const out: FeedbackClassification = {
		questions: [],
		inlineFixes: [],
		stageRevisits: [],
		needsTriage: [],
	}
	for (const it of items) {
		if (it.status !== "pending") continue
		const r = (it as { resolution?: string | null }).resolution ?? null
		switch (r) {
			case "question":
				out.questions.push(it)
				break
			case "inline_fix":
				out.inlineFixes.push(it)
				break
			case "stage_revisit":
				out.stageRevisits.push(it)
				break
			default:
				out.needsTriage.push(it)
				break
		}
	}
	return out
}

/** Compose a `feedback_dispatch` action the agent can act on without
 *  a stage rollback. Each bucket becomes a block of instructions
 *  keyed off the feedback id, so the agent can dispatch them
 *  serially. Returned only when every pending item routes through one
 *  of the non-revisit paths.
 *
 *  Exported so `gate.ts` can dispatch the same action when it sees
 *  pending feedback that still needs triage or replies — keeping the
 *  user out of the review UI while open feedback is unaddressed. */
export function buildFeedbackDispatchAction(
	slug: string,
	stage: string,
	classification: FeedbackClassification,
): OrchestratorAction {
	const summaryOf = (it: FeedbackItem): string => `- **${it.id}** — ${it.title}`
	const sections: string[] = []
	if (classification.needsTriage.length > 0) {
		sections.push(
			`### Triage — reviewer left resolution unset (${classification.needsTriage.length})\n\nFor each item below, read the title + body (and any attachment/source_ref) and decide which resolution applies:\n- **question** — the reviewer wants a reply with no code delta\n- **inline_fix** — small, scoped change; dispatch one fix_hats bolt against just this finding\n- **stage_revisit** — the stage's elaboration or execution missed something fundamental; a full re-loop is warranted\n\nIf the FB belongs in a different stage entirely, call \`haiku_feedback_move\` first to relocate it; the pre-tick gate will then revisit the correct stage. Persist your resolution choice by calling \`haiku_feedback_update { intent: "${slug}", stage: "${stage}", feedback_id, resolution: "<choice>" }\`. After setting resolutions on every item below, call \`haiku_run_next\` again — the router will re-classify and dispatch.\n\n${classification.needsTriage.map(summaryOf).join("\n")}`,
		)
	}
	if (classification.questions.length > 0) {
		sections.push(
			`### Reply to questions (${classification.questions.length})\n\nFor each item below, read the body, formulate a reply, and POST it to \`/api/feedback/${encodeURIComponent(slug)}/${encodeURIComponent(stage)}/<feedback_id>/replies\` with \`{ body: <reply>, close_as_answered: true }\`. No code delta needed.\n\n${classification.questions.map(summaryOf).join("\n")}`,
		)
	}
	if (classification.inlineFixes.length > 0) {
		sections.push(
			`### Inline fixes (${classification.inlineFixes.length})\n\nFor each item below, run ONE bolt of the stage's \`fix_hats\` sequence against the single finding. The fix hat must land a real code change; a planning-only hat (planner/strategist) will fail to close the finding. On success, the feedback_assessor hat (terminal validator) flips the item to \`closed\`.\n\n${classification.inlineFixes.map(summaryOf).join("\n")}`,
		)
	}
	if (classification.stageRevisits.length > 0) {
		sections.push(
			`### Close stage_revisit findings (${classification.stageRevisits.length})\n\nThese findings asked for a stage revisit. The stage has already been rolled back to elaborate (or never left it) — the rollback already happened or wasn't needed. Now you need to verify each finding is addressed by the current stage state and explicitly close it.\n\nFor each item below:\n1. Read the finding body + any attachment/source_ref.\n2. Check the stage's decision_log, current units, and knowledge artifacts to confirm the concern is addressed.\n3. If addressed: \`haiku_feedback_update { intent: "${slug}", stage: "${stage}", feedback_id, status: "closed" }\`.\n4. If not yet addressed: do the elaborate work first (record decisions via \`haiku_decision_record\`, write/revise units via \`haiku_unit_write\`, edit knowledge artifacts), then close.\n\nDo NOT roll the stage back again — gate.ts owns rollback when the stage is in gate phase, and the rollback you needed has already happened. Closing these findings is what unblocks the gate.\n\n${classification.stageRevisits.map(summaryOf).join("\n")}`,
		)
	}
	return {
		action: "feedback_dispatch",
		intent: slug,
		stage,
		counts: {
			needs_triage: classification.needsTriage.length,
			questions: classification.questions.length,
			inline_fixes: classification.inlineFixes.length,
			stage_revisits: classification.stageRevisits.length,
		},
		message: `Resolve pending feedback on stage '${stage}' WITHOUT rolling the stage back. Dispatch each item per its resolution:\n\n${sections.join("\n\n")}\n\nAfter dispatching all items, call \`haiku_run_next { intent: "${slug}" }\` to re-check the gate.`,
	}
}

export function revisit(
	slug: string,
	requestedStage?: string,
): OrchestratorAction {
	const root = findHaikuRoot()
	const iDir = join(root, "intents", slug)
	const intentFile = join(iDir, "intent.md")

	if (!existsSync(intentFile)) {
		return { action: "error", message: `Intent '${slug}' not found` }
	}

	const intent = readFrontmatter(intentFile)
	const studio = (intent.studio as string) || ""
	if (!studio) {
		return {
			action: "error",
			message: `Intent '${slug}' has no studio selected. Call haiku_select_studio first.`,
		}
	}
	const currentActiveStage = (intent.active_stage as string) || ""

	if (!currentActiveStage) {
		return { action: "error", message: "No active stage to revisit from" }
	}

	// Before rolling back anything, inspect the pending feedback on
	// the active stage. If every pending item explicitly routes
	// through a non-revisit path (question / inline_fix), return a
	// `feedback_dispatch` action instead. The stage stays intact, the
	// agent resolves each finding per its declared resolution, and the
	// next run_next re-checks the gate.
	const shouldClassify =
		!requestedStage || requestedStage === currentActiveStage
	if (shouldClassify) {
		const pending = readFeedbackFiles(slug, currentActiveStage)
		const classification = classifyPendingForRevisit(pending)
		const hasAny =
			classification.questions.length +
				classification.inlineFixes.length +
				classification.stageRevisits.length +
				classification.needsTriage.length >
			0
		// Rollback ONLY when the reviewer explicitly tagged at least one
		// item `stage_revisit`. Null/unset resolutions route through the
		// dispatch action and the agent triages them — silent defaulting
		// to rollback was the "ran next and got rewound" footgun.
		if (hasAny && classification.stageRevisits.length === 0) {
			return buildFeedbackDispatchAction(
				slug,
				currentActiveStage,
				classification,
			)
		}
	}

	const studioStages = resolveIntentStages(intent, studio)
	const currentIdx = studioStages.indexOf(currentActiveStage)

	if (currentIdx < 0) {
		return {
			action: "error",
			message: `Active stage '${currentActiveStage}' is not in the studio's stage list: [${studioStages.join(", ")}]. Run haiku_repair to fix.`,
		}
	}

	if (requestedStage) {
		const targetIdx = studioStages.indexOf(requestedStage)
		if (targetIdx < 0) {
			return {
				action: "error",
				message: `Stage '${requestedStage}' not found in studio stages: [${studioStages.join(", ")}]`,
			}
		}
		if (targetIdx > currentIdx) {
			return {
				action: "error",
				message: `Cannot revisit '${requestedStage}' — it's ahead of current stage '${currentActiveStage}'. Use haiku_run_next to advance.`,
			}
		}
		if (targetIdx === currentIdx) {
			return revisitCurrentStage(slug, iDir, intentFile, currentActiveStage)
		}
		return revisitEarlierStage(
			slug,
			iDir,
			intentFile,
			currentActiveStage,
			requestedStage,
		)
	}

	// No stage specified — infer from current position. If in
	// execute/review/gate → re-elaborate the current stage.
	const path = stageStatePath(slug, currentActiveStage)
	const stageState = readJson(path)
	const currentPhase = (stageState.phase as string) || "elaborate"

	if (currentPhase !== "elaborate") {
		return revisitCurrentStage(slug, iDir, intentFile, currentActiveStage)
	}

	// Already in elaborate — target is ambiguous. Force the caller to
	// be explicit; the silent fall-back to "previous stage" caused
	// active_stage to jump backwards unexpectedly.
	if (currentIdx <= 0) {
		return {
			action: "error",
			message: `Stage '${currentActiveStage}' is already in the elaborate phase and is the first stage — there is no earlier stage to revisit. If you intend to re-elaborate '${currentActiveStage}', pass \`stage: "${currentActiveStage}"\` explicitly.`,
		}
	}
	const prevStage = studioStages[currentIdx - 1]
	return {
		action: "error",
		message: `Stage '${currentActiveStage}' is already in the elaborate phase — the revisit caller cannot infer whether you want to re-elaborate '${currentActiveStage}' or jump back to '${prevStage}'. Pass \`stage\` explicitly (\`stage: "${currentActiveStage}"\` to re-elaborate the current stage, \`stage: "${prevStage}"\` to revisit the prior one) — or, agent-side, log the stage_revisit FB at the specific target stage you want.`,
	}
}

function uncompleteIntent(slug: string, intentFile: string): void {
	const intent = readFrontmatter(intentFile)
	let dirty = false
	if (intent.status === "completed") {
		setFrontmatterField(intentFile, "status", "active")
		setFrontmatterField(intentFile, "completed_at", null)
		dirty = true
	}
	// A completed intent may have landed in awaiting_completion_review
	// earlier; reviving it for a revisit must drop out of that phase
	// or the next run_next tick will re-enter the completion-review
	// branch instead of the revisited stage.
	if (
		intent.phase === "awaiting_completion_review" ||
		intent.completion_review_dispatched === true
	) {
		setFrontmatterField(intentFile, "phase", "active")
		setFrontmatterField(intentFile, "completion_review_dispatched", false)
		setFrontmatterField(intentFile, "completion_review_skipped", false)
		dirty = true
	}
	if (dirty) {
		// All the above fields are workflow-tracked in INTENT_FIELDS;
		// reseal so the next verifyIntentState() doesn't false-positive
		// as tampering.
		sealIntentState(slug)
	}
}

export function revisitCurrentStage(
	slug: string,
	_iDir: string,
	intentFile: string,
	currentActiveStage: string,
): OrchestratorAction {
	const path = stageStatePath(slug, currentActiveStage)
	const stageState = readJson(path)
	const currentPhase = (stageState.phase as string) || "elaborate"

	stageState.phase = "elaborate"
	stageState.gate_entered_at = null
	stageState.gate_outcome = null
	// Reset pre-review state so the revisit re-audits the (edited)
	// unit specs.
	stageState.pre_review_dispatched = false
	stageState.pre_review_dispatched_at = null
	stageState.pre_review_skipped_no_agents = false
	stageState.pre_review_reviewers_acknowledged = false
	stageState.pre_review_reviewers_acknowledged_at = null
	// Reset spec/quality review flags so the revisit re-runs both review
	// phases against the updated implementation.
	stageState.spec_review_dispatched = false
	stageState.quality_review_dispatched = false
	writeJson(path, stageState)

	uncompleteIntent(slug, intentFile)

	gitCommitState(`haiku: revisit elaborate ${currentActiveStage} (pre-merge)`)
	cleanupIntentWorktrees(slug)
	const prepared = prepareRevisitBranch(
		slug,
		currentActiveStage,
		currentActiveStage,
	)
	if (!prepared.success) {
		return {
			action: "error",
			message: `Failed to prepare stage branch '${currentActiveStage}' for revisit: ${prepared.message}. Resolve conflicts on the stage branch manually, then retry.`,
		}
	}

	// Units are NOT reset on revisit. Revisit means "we missed
	// something" — the elaborate phase will INCREASE scope (author
	// new units or revise specs). Existing completed work stays
	// completed; the agent decides whether each existing unit needs
	// changes when re-entering elaborate. Only state.json resets so
	// the phase machinery re-runs.

	resetFixLoopBolts(slug, currentActiveStage)

	emitTelemetry("haiku.revisit.phase", {
		intent: slug,
		stage: currentActiveStage,
		from_phase: currentPhase,
		to_phase: "elaborate",
	})
	gitCommitState(`haiku: revisit elaborate in ${currentActiveStage}`)

	return {
		action: "revisited",
		intent: slug,
		stage: currentActiveStage,
		target_phase: "elaborate",
		message: `Revisiting elaborate phase in stage '${currentActiveStage}' — existing units preserved; elaborate will add scope or revise specs.`,
	}
}

/** Reset the fix-loop bolt counter (and "fixing" status) on every
 *  feedback file in the given stage that isn't terminal. Called when
 *  the human explicitly revisits a stage — their revisit is a
 *  deliberate "try again" signal, and the fix-loop budget should
 *  restart. Terminal items (closed / addressed / rejected) are left
 *  alone.
 *
 *  Pass stage = "" for intent-scope feedback (used when the
 *  intent-completion review gate is rejected and we re-enter the
 *  completion phase). */
export function resetFixLoopBolts(slug: string, stage: string): void {
	const items = readFeedbackFiles(slug, stage)
	for (const item of items) {
		if (
			item.status === "closed" ||
			item.status === "addressed" ||
			item.status === "rejected"
		)
			continue
		if (item.closed_by) continue
		if (item.bolt === 0 && item.status === "pending") continue
		const full = findFeedbackFile(slug, stage, item.id)
		if (!full) continue
		const newData = { ...full.data, bolt: 0, status: "pending" }
		writeFileSync(full.path, matter.stringify(`\n${full.body}\n`, newData))
	}
}

/** Mark every stage AFTER targetStage as stale so the workflow
 *  re-enters them on advance rather than fast-forwarding past a
 *  `completed` marker. The stage's artifacts and units are kept on
 *  disk — a re-run that finds them still valid can close immediately;
 *  a re-run that finds them broken starts from the feedback the
 *  reviewers raise. */
function markDownstreamStagesStale(
	slug: string,
	_iDir: string,
	targetStage: string,
	intentFile: string,
): void {
	const intent = readFrontmatter(intentFile)
	const studio = (intent.studio as string) || ""
	const stages = resolveIntentStages(intent, studio)
	const targetIdx = stages.indexOf(targetStage)
	if (targetIdx < 0) return
	// Guard 2: write pos-0 defaults on main for the target AND every
	// downstream stage via temp worktree. The reset is visible from
	// every stage branch on its next merge-main-forward; one source
	// of truth.
	const toReset = [targetStage, ...stages.slice(targetIdx + 1)]
	for (const stage of toReset) {
		const posZero = {
			stage,
			status: "active",
			phase: "elaborate",
			started_at: null,
			completed_at: null,
			gate_entered_at: null,
			gate_outcome: null,
			visits: 0,
			stale_reason: `revisit of upstream stage '${targetStage}'`,
			stale_marked_at: timestamp(),
		}
		const relPath = `.haiku/intents/${slug}/stages/${stage}/state.json`
		writeOnIntentMain(
			slug,
			relPath,
			`${JSON.stringify(posZero, null, 2)}\n`,
			`haiku: reset ${stage} state.json on revisit from '${targetStage}' (Guard 2)`,
		)
		const localPath = stageStatePath(slug, stage)
		if (existsSync(localPath)) {
			writeJson(localPath, posZero)
		}
	}
}

function revisitEarlierStage(
	slug: string,
	iDir: string,
	intentFile: string,
	fromStage: string,
	targetStage: string,
): OrchestratorAction {
	// Per the user "raw git+fs" model: a revisit is a state-bookkeeping
	// operation that lands on intent main directly. The originating
	// stage branches are NOT touched (their WIP may still be valid;
	// the revisit's elaborate phase will read those files when the
	// stage cycle re-enters its branch via the normal lifecycle).
	//
	// Sequence:
	//   1. Commit any pending state on the current branch
	//   2. Wipe the per-unit worktrees (their work is no longer in
	//      scope until elaborate re-evaluates)
	//   3. Carry FB files forward by surgical checkout from each
	//      stage branch in [target..from] onto intent main — only
	//      stages/<stage>/feedback/ paths, no other work files
	//   4. Reset state.json on intent main for [target..end] — target
	//      becomes active+elaborate; downstream stages become stale
	//   5. Set intent.md.active_stage = target (still on intent main
	//      via markDownstreamStagesStale's writeOnIntentMain helper
	//      family — the local intent.md write below acts as a cache
	//      consistent with state.json on intent main)
	//   6. uncompleteIntent + reseal

	gitCommitState(`haiku: revisit from ${fromStage}`)
	cleanupIntentWorktrees(slug)

	// FB carry — surgical checkout per intermediate stage branch.
	// Only stages/<stage>/feedback/ paths land on intent main, so
	// unreviewed work on those branches stays out.
	const intent = readFrontmatter(intentFile)
	const studio = (intent.studio as string) || ""
	const stages = resolveIntentStages(intent, studio)
	const targetIdx = stages.indexOf(targetStage)
	const fromIdx = stages.indexOf(fromStage)
	if (targetIdx >= 0 && fromIdx >= 0) {
		for (let i = targetIdx; i <= fromIdx; i++) {
			const stage = stages[i]
			const stageBranch = `haiku/${slug}/${stage}`
			const result = checkoutFromBranchOnIntentMain(
				slug,
				stageBranch,
				`.haiku/intents/${slug}/stages/${stage}/feedback`,
				`haiku: carry feedback from ${stage} on revisit to ${targetStage}`,
			)
			emitTelemetry("haiku.revisit.fb_carry", {
				intent: slug,
				stage,
				ok: String(result.ok),
				paths: String(result.paths_copied.length),
			})
		}
	}

	resetFixLoopBolts(slug, targetStage)

	// Reset state.json on intent main for target + every downstream
	// stage. markDownstreamStagesStale uses writeOnIntentMain so the
	// reset lands on the canonical branch even if the agent is
	// currently checked out elsewhere.
	markDownstreamStagesStale(slug, iDir, targetStage, intentFile)

	uncompleteIntent(slug, intentFile)
	setFrontmatterField(intentFile, "active_stage", targetStage)
	sealIntentState(slug)

	emitTelemetry("haiku.revisit.stage", {
		intent: slug,
		from_stage: fromStage,
		to_stage: targetStage,
	})
	gitCommitState(`haiku: revisit stage ${targetStage}`)

	return {
		action: "revisited",
		intent: slug,
		target_stage: targetStage,
		reset_phase: "elaborate",
		message: `Revisiting stage '${targetStage}' — state.json reset on intent main (target=elaborate, downstream=stale); FB files carried forward from intermediate stages via surgical checkout; existing units and unreviewed WIP on the originating stage branches preserved (elaborate decides what to redo when each stage re-enters its branch).`,
	}
}

// ── Drift-detection lifecycle hook (unit-09) ───────────────────────────────
