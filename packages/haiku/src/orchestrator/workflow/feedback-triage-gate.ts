// orchestrator/workflow/feedback-triage-gate.ts — Pre-tick check
// that scans every stage from index 0 through the current stage for
// open (non-terminal) feedback. Four outcomes, in priority order:
//
//   1. Any FB without a `triaged_at:` timestamp → emit
//      `feedback_triage` action so the agent classifies/relocates
//      every untriaged finding via `haiku_feedback_move` before any
//      stage work proceeds.
//
//   2. All FBs triaged AND ≥ 1 open FB sits on a stage EARLIER than
//      the current active stage → return a `revisited` action
//      targeting the earliest stage with open feedback. The existing
//      revisit machinery handles branch state, downstream
//      invalidation, and re-entry.
//
//   3. All FBs triaged + open pending FBs on the current stage in a
//      non-gate phase → emit `feedback_dispatch` for every
//      classification bucket (needsTriage / questions / inlineFixes /
//      stageRevisits) regardless of who authored the FB. Author-
//      agnostic by design: only agents address feedback no matter
//      who filed it, and run_next must route every open FB through
//      the dispatch path before any handler emits `gate_review`.
//
//      In gate phase, pre-tick stays out: `gate.ts` owns the full
//      fix-chain / rollback / `review_fix` / `feedback_dispatch`
//      chain there. Pre-tick emitting from gate phase would
//      double-dispatch (e.g. firing `feedback_dispatch` when
//      `gate.ts` would otherwise emit `review_fix`).
//
//      We never call `revisitCurrentStage` from the pre-tick gate —
//      the helper resets phase to elaborate without closing the FB,
//      so the next tick would see the same FB and roll back again.
//      Dispatch is the only path that breaks the loop.
//
//   4. Nothing to dispatch from pre-tick — gate phase is in
//      `gate.ts`'s territory, or only `fixing` / `answered` items
//      remain (mid-handler state) on the current stage. Fall
//      through; the per-state handler chain picks up.
//
// Companion `countOpenFeedbackForGateCheck` is the defensive
// predicate every `gate_review` emit site calls before opening the
// SPA review UI. It uses `isGateBlocking` (NOT `isOpen`) so
// `answered` items — agent already replied, awaiting human
// confirmation — don't dead-lock the workflow.

import type { OrchestratorAction } from "../../orchestrator.js"
import {
	type FeedbackItem,
	gitCommitState,
	readFeedbackFiles,
} from "../../state-tools.js"
import { emitTelemetry } from "../../telemetry.js"
import {
	buildFeedbackDispatchAction,
	classifyPendingForRevisit,
	revisit,
} from "../revisit.js"
import { resolveIntentStages } from "../studio.js"
import type { DerivedContext } from "./derive-state.js"
import { dispatchFixChains } from "./fix-chain-dispatch.js"

/** A feedback item that's still open + the stage it lives on. */
interface OpenFeedbackOnStage {
	stage: string // "" = intent-scope
	item: FeedbackItem
}

/** An FB is "open" if it can still need pre-tick attention —
 *  anything in a non-terminal status with no `closed_by` set.
 *  Used by triage tracking (Outcomes 1 + 2 above): an answered FB
 *  still counts as open because the human hasn't confirmed yet, so
 *  if it's misplaced on an earlier stage we still want to revisit
 *  there.
 *
 *  Note: `fixing` (fix-loop in progress) and `answered` (agent
 *  replied, awaiting human confirmation) PASS this filter
 *  intentionally — they're not terminal. Outcome 3 uses
 *  `classifyPendingForRevisit`, which buckets only
 *  `status === "pending"` items, so re-dispatching a `fixing` /
 *  `answered` item won't happen here.
 *
 *  Exported because the HTTP revisit handler reuses this exact
 *  predicate when deciding whether to 409 on an empty-reasons
 *  request — the two call sites must stay in sync. */
export function isOpen(item: FeedbackItem): boolean {
	if (item.closed_by) return false
	return (
		item.status !== "closed" &&
		item.status !== "addressed" &&
		item.status !== "rejected"
	)
}

/** An FB "blocks the gate" if its presence should prevent
 *  `gate_review` from opening the SPA review UI. Stricter than
 *  `isOpen`: also excludes `answered` (agent has replied, awaiting
 *  human confirmation — agents can't close `answered` items, the
 *  human does so via the SPA, so blocking the gate on them would
 *  deadlock the workflow). Mirrors `countPendingFeedback` in
 *  state-tools.ts so the defensive check stays consistent with the
 *  existing gate.ts feedback routing semantics. */
function isGateBlocking(item: FeedbackItem): boolean {
	if (item.closed_by) return false
	return (
		item.status !== "closed" &&
		item.status !== "addressed" &&
		item.status !== "answered" &&
		item.status !== "rejected"
	)
}

/** Collect every open FB from stage index 0 up through (and
 *  including) the current stage. Intent-scope FBs are included
 *  unconditionally — they can be filed at any time and need triage
 *  too. */
function collectOpenFeedback(
	slug: string,
	studioStages: string[],
	currentStageIdx: number,
): OpenFeedbackOnStage[] {
	const out: OpenFeedbackOnStage[] = []
	const upTo = currentStageIdx >= 0 ? currentStageIdx : studioStages.length - 1
	for (let i = 0; i <= upTo; i += 1) {
		const stage = studioStages[i]
		if (!stage) continue
		const items = readFeedbackFiles(slug, stage)
		for (const item of items) {
			if (isOpen(item)) out.push({ stage, item })
		}
	}
	// Intent-scope feedback (studio-level review findings).
	const intentScopeItems = readFeedbackFiles(slug, "")
	for (const item of intentScopeItems) {
		if (isOpen(item)) out.push({ stage: "", item })
	}
	return out
}

/** Defensive check used at every `gate_review` emit site: count
 *  gate-blocking feedback items on the active stage and earlier
 *  stages, plus intent-scope feedback. Uses `isGateBlocking` (NOT
 *  `isOpen`) — `answered` items pass `isOpen` for triage tracking
 *  but must NOT block the gate (they require human confirmation
 *  through the SPA, which is the user-facing surface for those).
 *
 *  The invariant is "no `gate_review` emitted while gate-blocking
 *  feedback is open" — pre-tick + gate.ts together are supposed to
 *  enforce it, but if either misses an edge case, the emit site
 *  returns this count so the caller can short-circuit with an error
 *  action instead of silently surfacing the gate to the user.
 *
 *  Pass `intentScopeOnly: true` for intent-completion review (where
 *  per-stage feedback is already adjudicated by definition). */
export function countOpenFeedbackForGateCheck(
	slug: string,
	studioStages: string[],
	currentStageIdx: number,
	intentScopeOnly = false,
): number {
	if (intentScopeOnly) {
		const intentScopeItems = readFeedbackFiles(slug, "")
		return intentScopeItems.filter(isGateBlocking).length
	}
	let count = 0
	const upTo = currentStageIdx >= 0 ? currentStageIdx : studioStages.length - 1
	for (let i = 0; i <= upTo; i += 1) {
		const stage = studioStages[i]
		if (!stage) continue
		count += readFeedbackFiles(slug, stage).filter(isGateBlocking).length
	}
	count += readFeedbackFiles(slug, "").filter(isGateBlocking).length
	return count
}

/** Run the pre-tick triage check. Returns an action when the tick
 *  should short-circuit (triage required or revisit needed); null
 *  when normal dispatch should proceed. */
export function preTickFeedbackGate(
	context: DerivedContext,
): OrchestratorAction | null {
	const { slug, studio, intent, currentStage } = context
	if (!studio) return null
	const studioStages = resolveIntentStages(intent, studio)
	if (studioStages.length === 0) return null
	// `indexOf("")` returns -1, which collectOpenFeedback() treats as
	// "include every stage" — exactly what we want for pre-stage
	// states where currentStage is empty.
	const currentIdx = currentStage ? studioStages.indexOf(currentStage) : -1

	const openFeedback = collectOpenFeedback(slug, studioStages, currentIdx)
	if (openFeedback.length === 0) return null

	// Outcome 1: any untriaged → fire the triage action.
	const untriaged = openFeedback.filter(({ item }) => item.triaged_at === null)
	if (untriaged.length > 0) {
		return {
			action: "feedback_triage",
			intent: slug,
			stage: currentStage || null,
			valid_stages: studioStages,
			items: untriaged.map(({ stage, item }) => ({
				feedback_id: item.id,
				stage,
				title: item.title,
				origin: item.origin,
				author: item.author,
				file: item.file,
			})),
			message: `Found ${untriaged.length} untriaged feedback item(s) on or before the current stage. The pre-tick gate refuses to advance until every open FB has been classified — call \`haiku_feedback_move\` (to confirm or relocate) or \`haiku_feedback_reject\` (to dismiss) on each item below.`,
		}
	}

	// Outcome 2: every FB triaged, but ≥ 1 sits on a stage earlier
	// than the active one → revisit the earliest such stage. The
	// `revisit()` helper handles the rollback semantics; emitting its
	// result directly preserves the existing contract.
	if (currentStage) {
		const stagesByIndex = new Map<string, number>()
		for (let i = 0; i < studioStages.length; i += 1) {
			stagesByIndex.set(studioStages[i], i)
		}
		let earliestStage: string | null = null
		let earliestIdx = Number.POSITIVE_INFINITY
		for (const { stage } of openFeedback) {
			if (!stage) continue // intent-scope; not a per-stage rollback target
			const idx = stagesByIndex.get(stage)
			if (idx === undefined) continue
			if (idx < currentIdx && idx < earliestIdx) {
				earliestIdx = idx
				earliestStage = stage
			}
		}
		if (earliestStage) {
			return revisit(slug, earliestStage)
		}
	}

	// Outcome 3: open pending FBs on the current stage that need
	// agent attention.
	//
	// Author-agnostic by design: only agents address feedback, no
	// matter who filed it. The user's review-screen rule is "pending
	// feedback should never surface a user-facing gate via run_next" —
	// the SPA review UI is the manual surface for human inspection,
	// and run_next must always route open FBs through a fix /
	// dispatch path before any handler emits gate_review.
	//
	// Phase split:
	//   - In gate phase, `gate.ts` owns the full fix-chain / rollback
	//     / review_fix dispatch chain. Pre-tick stays out — emitting
	//     from here would double-dispatch (e.g. firing
	//     feedback_dispatch when gate.ts would otherwise emit
	//     review_fix or feedback_revisit). gate.ts is responsible for
	//     never emitting gate_review while feedback is open in gate
	//     phase, and the defensive check at the gate_review emit
	//     site enforces it.
	//   - In non-gate phases (elaborate / execute / review), no
	//     downstream handler dispatches per-FB fix work. If pre-tick
	//     falls through, the elaborate handler emits gate_review with
	//     feedback still open. Pre-tick is the only place that can
	//     prevent that, so we dispatch every classification bucket
	//     here regardless of who authored the FB.
	//
	//   We never call `revisitCurrentStage` here — the helper resets
	//   phase to elaborate without closing the FB, so the next tick
	//   would see the same FB and roll back again. The dispatch path
	//   is the only one that closes the FB.
	if (currentStage && context.currentPhase !== "gate") {
		const currentStageFbs = openFeedback
			.filter(({ stage }) => stage === currentStage)
			.map(({ item }) => item)
		const classification = classifyPendingForRevisit(currentStageFbs)
		if (
			classification.needsTriage.length > 0 ||
			classification.questions.length > 0 ||
			classification.inlineFixes.length > 0 ||
			classification.stageRevisits.length > 0
		) {
			// Inline-fix items get the same `review_fix` dispatch the gate
			// handler uses in gate phase. Without this, non-gate-phase
			// inline fixes would land in `buildFeedbackDispatchAction`'s
			// text-only instruction — telling the agent to "run ONE bolt of
			// fix_hats" but producing no per-FB prompt files, no worktree,
			// no bolt increment. The agent would have no runnable artifact
			// to spawn, and the workflow would loop on `feedback_dispatch`
			// forever. Triage / question / stage_revisit items still flow
			// through the text-only dispatch action — those need agent
			// judgment, not fix-hat work.
			if (
				classification.inlineFixes.length > 0 &&
				classification.needsTriage.length === 0 &&
				classification.questions.length === 0 &&
				classification.stageRevisits.length === 0
			) {
				const dispatch = dispatchFixChains({
					slug,
					studio: context.studio,
					stage: currentStage,
					pendingItems: classification.inlineFixes,
				})
				if (dispatch) {
					if (dispatch.action === "review_fix") {
						gitCommitState(
							`haiku: review_fix dispatch ${
								(dispatch as { items?: unknown[] }).items?.length ?? 0
							} finding(s) in ${currentStage} (pre-tick gate)`,
						)
						emitTelemetry("haiku.pretick.review_fix", {
							intent: slug,
							stage: currentStage,
							count: String(classification.inlineFixes.length),
						})
					}
					return dispatch
				}
				// Fix_hats not configured — fall through to the legacy
				// text-only feedback_dispatch so the agent gets at least
				// the diagnostic message instead of silent skip.
			}
			return buildFeedbackDispatchAction(slug, currentStage, {
				needsTriage: classification.needsTriage,
				questions: classification.questions,
				inlineFixes: classification.inlineFixes,
				stageRevisits: classification.stageRevisits,
			})
		}
	}

	// Outcome 4: nothing to dispatch from pre-tick — gate phase is
	// in `gate.ts`'s territory, or only `fixing` / `answered` items
	// remain (mid-handler state) on the current stage. Fall through
	// to the per-state handler chain.
	return null
}
