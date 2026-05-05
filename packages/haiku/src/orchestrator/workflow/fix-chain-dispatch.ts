// orchestrator/workflow/fix-chain-dispatch.ts — Shared review_fix
// dispatch helper for the fix-loop path.
//
// Both gate.ts (gate phase) and feedback-triage-gate.ts (non-gate
// phases) need to dispatch the per-FB fix-hat sequence against open
// pending feedback. Before this module the logic lived inline in
// gate.ts; feedback-triage-gate.ts emitted a text-only
// `feedback_dispatch` action with no actual dispatch infrastructure.
// That left non-gate-phase inline fixes stuck — the pre-tick gate told
// the agent to "run ONE bolt of fix_hats" but produced no per-FB
// prompts, no worktree, and no bolt increment. The agent had no
// runnable artifact to spawn.
//
// This module exports `dispatchFixChains` — a pure-ish function that:
//   1. Resolves `fix_hats` from STAGE.md frontmatter.
//   2. Validates each hat has a mandate file.
//   3. Splits eligible (bolt < cap) vs escalated items.
//   4. For each eligible item: increments bolt counter (state.json
//      mutation), creates the per-FB fix-chain worktree.
//   5. Returns either:
//      - `escalate` action when only escalated items remain.
//      - `review_fix` action with the dispatched item list.
//      - `null` when no fix_hats are configured or no items pending.
//
// Callers handle telemetry + git commit themselves so they can
// emit phase-specific event names.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
	createFixChainWorktree,
	fixChainBranchName,
} from "../../git-worktree.js"
import type { OrchestratorAction } from "../../orchestrator.js"
import {
	type FeedbackItem,
	incrementFeedbackBolt,
	MAX_FIX_LOOP_BOLTS,
	parseFrontmatter,
} from "../../state-tools.js"
import { readHatDefs, studioSearchPaths } from "../../studio-reader.js"
import { summarizeFeedback } from "../actions.js"

/** Read `fix_hats:` from a stage's STAGE.md frontmatter. Returns []
 *  when the file is missing or the field is unset. Inline rather than
 *  imported to avoid a circular export through orchestrator.ts. */
export function resolveStageFixHats(studio: string, stage: string): string[] {
	for (const base of studioSearchPaths()) {
		const stageFile = join(base, studio, "stages", stage, "STAGE.md")
		if (!existsSync(stageFile)) continue
		const { data: fm } = parseFrontmatter(readFileSync(stageFile, "utf8"))
		const fixHats = (fm.fix_hats as string[]) || []
		return fixHats
	}
	return []
}

/** Result of the dispatch: either an action to return, or null when
 *  the caller should continue with its own fall-through path. */
export type FixChainDispatchResult = OrchestratorAction | null

/** Dispatch the per-FB fix-hat sequence against pending items.
 *
 *  Side effects: increments each eligible item's bolt counter on disk
 *  (status `pending` → `fixing`) and creates a per-FB worktree. The
 *  caller is responsible for committing the resulting state changes
 *  and emitting telemetry; this function just owns the dispatch shape.
 *
 *  Returns:
 *    - `null` when the stage has no `fix_hats:` configured or no
 *      pending items — the caller falls through to its own next step.
 *    - `error` action when a declared hat has no mandate file.
 *    - `escalate` action when every pending item is at the bolt cap.
 *    - `review_fix` action with the dispatched per-FB block list.
 */
export function dispatchFixChains(args: {
	slug: string
	studio: string
	stage: string
	pendingItems: FeedbackItem[]
}): FixChainDispatchResult {
	const { slug, studio, stage, pendingItems } = args
	const fixHats = resolveStageFixHats(studio, stage)
	if (fixHats.length === 0 || pendingItems.length === 0) return null

	const hatDefs = readHatDefs(studio, stage)
	const missing = fixHats.filter((h) => !hatDefs[h])
	if (missing.length > 0) {
		return {
			action: "error",
			intent: slug,
			message: `Stage '${stage}' declares fix_hats: [${fixHats.join(", ")}] but [${missing.join(", ")}] have no mandate file in plugin/studios/<studio>/stages/${stage}/hats/. Create the missing files or remove them from fix_hats.`,
		}
	}

	const sorted = [...pendingItems].sort((a, b) => a.num - b.num)
	const eligibleItems = sorted.filter((i) => i.bolt < MAX_FIX_LOOP_BOLTS)
	const escalatedItems = sorted.filter((i) => i.bolt >= MAX_FIX_LOOP_BOLTS)

	if (eligibleItems.length === 0 && escalatedItems.length > 0) {
		const target = escalatedItems[0]
		return {
			action: "escalate",
			intent: slug,
			stage,
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
		const bumped = incrementFeedbackBolt(slug, stage, item.id)
		if (!bumped) continue
		const wt = createFixChainWorktree(slug, stage, item.id)
		dispatched.push({
			feedback_id: item.id,
			feedback_file: item.file,
			feedback_title: item.title,
			bolt: bumped.bolt,
			worktree: wt,
			branch: wt ? fixChainBranchName(slug, stage, item.id) : null,
		})
	}

	if (dispatched.length === 0) {
		return {
			action: "error",
			intent: slug,
			message: `Failed to increment fix-loop bolts on any of ${eligibleItems.length} eligible finding(s) — feedback files may have been deleted mid-tick.`,
		}
	}

	return {
		action: "review_fix",
		intent: slug,
		studio,
		stage,
		fix_hats: fixHats,
		max_bolts: MAX_FIX_LOOP_BOLTS,
		items: dispatched,
		total_pending: pendingItems.length,
		escalated_count: escalatedItems.length,
		message: `Dispatching fix loop for ${dispatched.length} finding(s) in parallel — stage '${stage}'. Per-finding hat sequence: ${fixHats.join(" → ")} (serial within chain). Chains run in parallel across findings.${escalatedItems.length > 0 ? ` ${escalatedItems.length} additional finding(s) are at the bolt cap and will escalate after these complete.` : ""}`,
	}
}
