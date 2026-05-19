// orchestrator/prompts/start_feedback_hat/index.ts — v4 fix-hat
// dispatch for one or more open feedback files.
//
// Cursor returns `start_feedback_hat { dispatches: [{ feedback_id,
// stage, hat, terminal }, ...] }` when one or more open FBs need
// their next fix-hat dispatched. The agent spawns ONE subagent per
// dispatch entry, in parallel via N Task calls in a single message.
// Each subagent loads its assigned FB, executes its assigned hat's
// mandate against the FB body, and calls
// `haiku_feedback_advance_hat` or `haiku_feedback_reject_hat` when
// done.
//
// Heterogeneous batches: each dispatch entry carries its own (stage,
// hat, terminal). FBs at different stages or different hat positions
// in their respective fix_hats sequences batch together. The
// per-dispatch prompt block below renders the right hat-mandate path,
// stage, and tool args for each FB independently.
//
// Dedup invariant (enforced by cursor.ts walkFeedbackTrack): at most
// one entry per `targets.unit` per batch. Same-target duplicates wait
// for the next tick — the close hook's `applyFeedbackInvalidations`
// does a read-modify-write on the target unit's FM and concurrent
// subagents would race.
//
// Terminal hat: on advance, the FB closes (`closed_at` stamped) and
// `targets.invalidates` is applied to the targeted unit's approvals
// — the cursor on the next tick reroutes through those approval
// roles.
//
// Model routing — same cascade as unit dispatch (start_unit.ts). The
// resolution order is `feedback.model` → `hat.model` → stage
// `default_model:` → studio `default_model:`. Per-FB, since
// heterogeneous batches may mix hats / stages with different cascade
// outcomes.
//
// Layout: this file owns *data prep only* (cascade resolution, FM
// reads, integer parsing). The prompt body lives in
// `template.eta.md`. The split keeps the prose readable end-to-end
// and the conditional shape testable.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import matter from "gray-matter"
import { features } from "../../../../config.js"
import { type ModelTier, resolveModel } from "../../../../model-selection.js"
import { intentDir, stageDir } from "../../../../state-tools.js"
import {
	readHatDefs,
	readStageDef,
	readStudio,
	resolveHatPath,
} from "../../../../studio-reader.js"
import { batchDispatchDirective } from "../../_helpers.js"
import { loadTemplate } from "../../_load-template.js"
import { sharedBlockRef } from "../../_shared/index.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

/** Resolve the model for a single fix-hat dispatch. Mirrors the
 *  cascade in start_unit.ts so feedback hats and unit hats route
 *  through the same rules. Optional FB-level override: if the FB
 *  frontmatter carries `model: <tier>`, it wins over hat / stage /
 *  studio. Per-dispatch under heterogeneous batches — each FB may
 *  resolve to a different tier. */
function resolveFixHatModel(opts: {
	slug: string
	stage: string
	studio: string
	hat: string
	feedbackId: string
}): { model: ModelTier | undefined; source: string } | undefined {
	if (!features.modelSelection) return undefined
	const { slug, stage, studio, hat, feedbackId } = opts
	let fbModel: string | undefined
	if (feedbackId) {
		// Try the standard `<NN>-*.md` filename (the engine writes this
		// shape; agents addressing FB-NN go through the cursor's emit so
		// they always match). Best-effort — a missing file means the FB
		// is intent-scope or freshly renamed; either way, the cascade
		// falls through to hat/stage/studio.
		const num = feedbackId.replace(/^FB-/, "")
		const dir = stage
			? join(stageDir(slug, stage), "feedback")
			: join(intentDir(slug), "feedback")
		try {
			const candidates = existsSync(dir)
				? readdirSync(dir).filter(
						(f: string) => f.startsWith(num) && f.endsWith(".md"),
					)
				: []
			if (candidates.length > 0) {
				const raw = readFileSync(join(dir, candidates[0]), "utf8")
				fbModel = (matter(raw).data as { model?: string }).model
			}
		} catch {
			/* swallow — cascade falls through */
		}
	}
	// Stage may be empty for intent-scope FBs. readHatDefs / readStageDef
	// both validate the stage identifier and would throw — skip them
	// when there's no stage and let the cascade fall to studio default.
	const hatDef = stage ? readHatDefs(studio, stage)?.[hat] : undefined
	const stageDef = stage ? readStageDef(studio, stage) : undefined
	const studioData = readStudio(studio)
	const resolved = resolveModel({
		unit: fbModel, // FB acts as the "unit" level of the cascade
		hat: hatDef?.model,
		stage: stageDef?.data?.default_model as string | undefined,
		studio: studioData?.data?.default_model as string | undefined,
	})
	return { model: resolved.model, source: resolved.source }
}

interface FbDispatchEntry {
	feedback_id: string
	stage: string
	hat: string
	terminal: boolean
}

export default definePromptBuilder(({ slug, studio, action }) => {
	// Canonical shape: `action.dispatches: FbDispatchEntry[]`. Legacy
	// callers / test fixtures may pass the pre-2026-05-18 shape
	// (`action.stage`, `action.hat`, `action.feedback_ids: string[]`,
	// `action.terminal`); synthesize a single-element dispatches array
	// from those fields so the prompt renders identically.
	let dispatchesRaw = (action.dispatches as FbDispatchEntry[] | undefined) ?? []
	if (dispatchesRaw.length === 0 && Array.isArray(action.feedback_ids)) {
		const legacyStage = (action.stage as string | undefined) ?? ""
		const legacyHat = (action.hat as string | undefined) ?? ""
		const legacyTerminal = (action.terminal as boolean | undefined) ?? false
		dispatchesRaw = (action.feedback_ids as string[]).map((id) => ({
			feedback_id: id,
			stage: legacyStage,
			hat: legacyHat,
			terminal: legacyTerminal,
		}))
	}

	// Defensive guard against the 2026-05-18 "cursor stuck dispatching
	// closed FB" bug class. The cursor's closure detection was fixed in
	// the same change (isFbClosed in cursor.ts), but this filter is a
	// belt-and-suspenders: even if a future regression lets a closed FB
	// slip through, the dispatch refuses to spawn a subagent that would
	// loop on lifecycle_violation. Reads the FB file from disk to
	// verify closure status; any of (status === "closed", closed_at
	// set, closed_by starts with "fix-loop:") is sufficient.
	dispatchesRaw = dispatchesRaw.filter((d) => {
		const num = d.feedback_id.replace(/^FB-/i, "")
		const dir = d.stage
			? join(stageDir(slug, d.stage), "feedback")
			: join(intentDir(slug), "feedback")
		if (!existsSync(dir)) return true
		const candidates = readdirSync(dir).filter(
			(f) => f.startsWith(num) && f.endsWith(".md"),
		)
		if (candidates.length === 0) return true
		try {
			const raw = readFileSync(join(dir, candidates[0]), "utf8")
			const fm = matter(raw).data as Record<string, unknown>
			const closedAt = fm.closed_at
			if (closedAt instanceof Date) return false
			if (typeof closedAt === "string" && closedAt.length > 0) return false
			if (typeof fm.status === "string" && fm.status === "closed")
				return false
			if (
				typeof fm.closed_by === "string" &&
				(fm.closed_by as string).startsWith("fix-loop:")
			)
				return false
		} catch {
			/* swallow — if we can't read the FB, let it through to the
			 * existing error paths rather than silently dropping it. */
		}
		return true
	})
	// Per-dispatch enrichment — each FB gets its own integer ID + model
	// tier resolution because batches are heterogeneous across stages
	// and hats.
	const dispatches = dispatchesRaw.map((d) => {
		const resolved = resolveFixHatModel({
			slug,
			studio,
			stage: d.stage,
			hat: d.hat,
			feedbackId: d.feedback_id,
		})
		// Walk the three-tier hat cascade (global → studio → stage) so the
		// subagent's spawn prompt names the actual on-disk mandate file
		// for THIS studio, not the hardcoded `plugin/studios/<studio>/...`
		// path the pre-cascade template used to emit. classifier and
		// feedback-assessor resolve to the global tier; per-stage hats
		// resolve to the stage tier.
		const hatPath = d.stage ? resolveHatPath(studio, d.stage, d.hat) : null
		return {
			feedback_id: d.feedback_id,
			stage: d.stage,
			hat: d.hat,
			terminal: d.terminal,
			fb_int: Number.parseInt(d.feedback_id.replace(/^FB-/i, ""), 10) || 0,
			model_tier: resolved?.model,
			model_source: resolved?.source,
			hat_path: hatPath,
		}
	})

	return eta.renderString(TEMPLATE, {
		slug,
		dispatches,
		dispatchCount: dispatches.length,
		plural: dispatches.length === 1 ? "" : "s",
		batchDirective:
			dispatches.length > 0
				? batchDispatchDirective(dispatches.length, "fix-hat subagents")
				: "",
		// Unconditional fix-loop workflow contract block. Pre-2026-05-18
		// the FB dispatch prompt included no contract reminder; subagents
		// terminated without calling advance_hat / reject_hat and the
		// cursor re-dispatched forever (compounded by the closed_at
		// write bug). Always emit the contract so the subagent sees the
		// closure obligation up front.
		fixLoopContractsBlock: sharedBlockRef("workflow-contracts-fix-loop"),
	})
})
