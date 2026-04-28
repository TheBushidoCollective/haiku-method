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
//   3. All FBs triaged + at least one human-authored FB on the
//      current stage with `resolution: null` or `resolution:
//      "question"` → emit `feedback_dispatch` so the agent triages /
//      replies inline. This is THE chokepoint that prevents either
//      `elaborate.ts` (spec gate) OR `gate.ts` (post-execute stage
//      gate) from re-popping the review UI while feedback is still
//      pending. Without this, the spec gate handler would fire
//      `gate_review` again on every tick when the stage is in
//      elaborate phase with leftover FBs from a Request Changes.
//
//   4. All FBs triaged + only inline_fix / stage_revisit / no open
//      FBs at all → return null. Lets the normal handler chain run
//      (the stage's gate handler picks up current-stage inline_fix
//      items via the existing `review_fix` dispatch).

import type { OrchestratorAction } from "../../orchestrator.js"
import { type FeedbackItem, readFeedbackFiles } from "../../state-tools.js"
import {
	buildFeedbackDispatchAction,
	classifyPendingForRevisit,
	revisit,
} from "../revisit.js"
import { resolveIntentStages } from "../studio.js"
import type { DerivedContext } from "./derive-state.js"

/** A feedback item that's still open + the stage it lives on. */
interface OpenFeedbackOnStage {
	stage: string // "" = intent-scope
	item: FeedbackItem
}

/** An FB is "open" if it can still block the gate — anything in a
 *  non-terminal status with no `closed_by` set. Mirrors the filter
 *  used in gate.ts so the pre-tick check stays consistent.
 *
 *  Note: `fixing` (fix-loop in progress) and `answered` (agent
 *  replied, awaiting human confirmation) PASS this filter intentionally
 *  — they're not terminal. But Outcome 3 below uses
 *  `classifyPendingForRevisit`, which buckets only `status === "pending"`
 *  items. That's deliberate: re-dispatching a `fixing` item would
 *  pre-empt an active fix-chain bolt; re-dispatching an `answered`
 *  item would resend reply instructions for something the agent
 *  already handled. Both are correctly left to fall through to the
 *  per-state handler chain. */
function isOpen(item: FeedbackItem): boolean {
	if (item.closed_by) return false
	return (
		item.status !== "closed" &&
		item.status !== "addressed" &&
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

	// Outcome 3: human-authored FB on the current stage with no
	// resolution (or resolution=question) — dispatch to the agent for
	// inline triage / reply via `feedback_dispatch`, BEFORE any handler
	// can re-pop the review UI. This catches the bug where a stage in
	// elaborate phase with leftover null/question FBs from a Request
	// Changes would have `elaborate.ts` emit `gate_review` again on
	// every tick.
	//
	// NOT handled here: stage_revisit-resolution FBs. `gate.ts` already
	// triggers `revisitCurrentStage` for those when the stage is in
	// gate phase, and we deliberately do NOT mirror that here. Calling
	// `revisitCurrentStage` from the pre-tick gate would loop forever
	// — the helper resets the phase to elaborate but does not close
	// the FB, so the next tick would see the same stage_revisit FB
	// and roll back again. Closing the FB here would mutate feedback
	// state as a side-effect of the pre-tick check (out of scope for
	// this PR). For now stage_revisit FBs in elaborate phase fall
	// through; this is no worse than before this PR.
	if (currentStage) {
		const currentStageFbs = openFeedback
			.filter(({ stage }) => stage === currentStage)
			.map(({ item }) => item)
		const classification = classifyPendingForRevisit(currentStageFbs)
		const humanNeedsTriage = classification.needsTriage.filter(
			(item) => item.author_type === "human",
		)
		const humanQuestions = classification.questions.filter(
			(item) => item.author_type === "human",
		)
		if (humanNeedsTriage.length > 0 || humanQuestions.length > 0) {
			return buildFeedbackDispatchAction(slug, currentStage, {
				needsTriage: humanNeedsTriage,
				questions: humanQuestions,
				inlineFixes: [],
				stageRevisits: [],
			})
		}
	}

	// Outcome 4: open feedback only routes through inline_fix / revisit
	// or sits at intent scope. Existing handlers manage those.
	return null
}
