// orchestrator/prompts/start_feedback_hat/index.ts — v4 fix-hat
// dispatch for an open feedback file.
//
// Cursor returns `start_feedback_hat { stage, hat, feedback_ids,
// terminal }` when an open FB needs its next fix-hat dispatched. The
// agent spawns a subagent that loads the FB, executes the fix-hat's
// mandate against the FB body, and calls
// `haiku_feedback_advance_hat` or `haiku_feedback_reject_hat` when
// done.
//
// Terminal hat (`feedback-assessor`): on advance, the FB closes
// (`closed_at` stamped) and `targets.invalidates` is applied to the
// targeted unit's approvals — the cursor on the next tick reroutes
// through those approval roles.
//
// Model routing — same cascade as unit dispatch (start_unit.ts). The
// resolution order is `feedback.model` → `hat.model` → stage
// `default_model:` → studio `default_model:`. Pre-fix this builder
// emitted no model annotation, so every fix-hat subagent inherited
// the parent's model — typically Opus, even for mechanical text-edit
// hats whose mandate would run fine on Sonnet.
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
} from "../../../../studio-reader.js"
import { loadTemplate } from "../../_load-template.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

/** Resolve the model for a fix-hat dispatch. Mirrors the cascade in
 *  start_unit.ts so feedback hats and unit hats route through the same
 *  rules. Optional FB-level override: if the FB frontmatter carries
 *  `model: <tier>`, it wins over hat / stage / studio. The first
 *  feedback_id in the dispatch defines the FB-level value (the cursor
 *  groups FBs by hat, so they all share the same fix-hat invocation —
 *  in practice they're always the same FB right now, but if that
 *  changes, the head FB's model takes precedence). */
function resolveFixHatModel(opts: {
	slug: string
	stage: string
	studio: string
	hat: string
	feedbackIds: readonly string[]
}): { model: ModelTier | undefined; source: string } | undefined {
	if (!features.modelSelection) return undefined
	const { slug, stage, studio, hat, feedbackIds } = opts
	let fbModel: string | undefined
	const headFbId = feedbackIds[0]
	if (headFbId) {
		// Try the standard `<NN>-*.md` filename (the engine writes this
		// shape; agents addressing FB-NN go through the cursor's emit so
		// they always match). Best-effort — a missing file means the FB
		// is intent-scope or freshly renamed; either way, the cascade
		// falls through to hat/stage/studio.
		const num = headFbId.replace(/^FB-/, "")
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

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""
	const hat = (action.hat as string) || ""
	const feedbackIds = (action.feedback_ids as string[]) || []
	const terminal = (action.terminal as boolean) || false

	const resolved = resolveFixHatModel({
		slug,
		studio,
		stage,
		hat,
		feedbackIds,
	})

	// Pre-compute the integer form of each FB ID. Tools take the integer
	// at the schema gate, not the `FB-NNN` string; the display label in
	// the heading keeps the human-readable form.
	const fbInts = feedbackIds.map(
		(id) => Number.parseInt(id.replace(/^FB-/i, ""), 10) || 0,
	)

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		hat,
		terminal,
		feedbackIds,
		feedbackCount: feedbackIds.length,
		plural: feedbackIds.length === 1 ? "" : "s",
		modelTier: resolved?.model,
		modelSource: resolved?.source,
		fbInts,
	})
})
