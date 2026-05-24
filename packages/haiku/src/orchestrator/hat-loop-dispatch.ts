// orchestrator/hat-loop-dispatch.ts — Shared dispatch-block assembler for
// the unified hat-loop engine.
//
// The unit hat-loop and the feedback fix-loop build their per-hat
// `<subagent prompt_file="...">` dispatch blocks through an IDENTICAL
// skeleton: ensure the loop's worktree, snapshot the hat mandate, surface
// the prior handoff/rejection baton, resolve the model tier, render the
// subagent template, and emit the file-backed dispatch markup. Only the
// inputs to each step differ between the two tracks — those differences
// live in a `HatLoopTarget` adapter (built in unit-dispatch-builder.ts and
// fb-dispatch-builder.ts). The skeleton lives here so an improvement (e.g.
// the tiered handoff baton, Phase 2) lands ONCE for both tracks instead of
// being hand-mirrored across two builders that silently drift.
//
// Dispatch is storage-agnostic: the only place the tracks' divergent
// loop-position storage (unit = `iterations[]` sole truth; feedback =
// scalar `hat`/`bolt` + `iterations[]`) leaks in is the `bolt()` accessor,
// which the adapter computes from its native storage.

import { Eta } from "eta"
import type { ModelTier } from "../model-selection.js"
import { emitSubagentDispatchBlock } from "./prompts/_helpers.js"

const eta = new Eta({ autoEscape: false, useWith: true })

/** The track-specific surface the shared dispatch skeleton drives. A unit
 *  and a feedback fix-chain each supply one of these; the skeleton is
 *  identical. */
export interface HatLoopTarget {
	/** Intent slug. */
	readonly slug: string
	/** Stage value passed to `emitSubagentDispatchBlock` — undefined for
	 *  intent-scope feedback. */
	readonly emitStage: string | undefined
	/** The dispatch id used as `emitSubagentDispatchBlock`'s `unit` field:
	 *  the unit name for units, `fix-<FB>` for feedback. */
	readonly dispatchId: string
	/** Create (idempotent) the loop's worktree, returning its path or ""
	 *  in filesystem mode. Side-effecting; the skeleton calls it first. */
	ensureWorktree(): string
	/** Snapshot the hat mandate to the intent refs/ tree and return the
	 *  followable "Read <snapshot>" breadcrumb. */
	mandateRef(hat: string): string
	/** The (tiered) prior handoff/rejection baton block for this target. */
	priorHandoffBlock(): string
	/** Resolve the model tier for this hat dispatch (full cascade). */
	resolveModel(hat: string): ModelTier | undefined
	/** Current bolt number, computed from the adapter's native storage. */
	bolt(): number
	/** The subagent template body for this track. */
	template(): string
	/** Render vars for the template. */
	templateVars(args: {
		hat: string
		terminal: boolean
		worktree: string
		mandateRef: string
		priorRejectBlock: string
	}): Record<string, unknown>
	/** Dispatch-block heading. */
	heading(hat: string): string
}

/** Assemble one per-hat `<subagent prompt_file="...">` dispatch block for
 *  any hat-loop target (unit or feedback). This is the single skeleton both
 *  the cursor's wave dispatch and the advance/reject relay breadcrumb run —
 *  keeping them from disagreeing (no-agent-mechanics-teaching.md). */
export function buildHatDispatchBlock(
	target: HatLoopTarget,
	hat: string,
	terminal: boolean,
): string {
	const worktree = target.ensureWorktree()
	const mandateRef = target.mandateRef(hat)
	const priorRejectBlock = target.priorHandoffBlock()
	const model = target.resolveModel(hat)
	const bolt = target.bolt()
	const promptBody = eta.renderString(
		target.template(),
		target.templateVars({
			hat,
			terminal,
			worktree,
			mandateRef,
			priorRejectBlock,
		}),
	)
	return emitSubagentDispatchBlock({
		unit: target.dispatchId,
		hat,
		bolt,
		intent: target.slug,
		stage: target.emitStage,
		agentType: "general-purpose",
		model,
		promptBody,
		heading: target.heading(hat),
	})
}
