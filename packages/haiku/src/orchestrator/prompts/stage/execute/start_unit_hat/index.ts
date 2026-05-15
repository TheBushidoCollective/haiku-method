// orchestrator/prompts/start_unit_hat/index.ts — v4 batch-aware hat
// dispatch prompt builder.
//
// The cursor returns `start_unit_hat { stage, hat, units: [...], terminal }`
// when one or more wave-ready units need their next hat. The prompt
// instructs the parent agent to spawn ONE subagent per listed unit,
// in parallel. Each subagent runs that unit's hat, calls
// haiku_unit_advance_hat (or _reject_hat) when done, and terminates
// with a clean signal — no Workflow Result file relay, no in-context
// hat iteration. The parent reaps all returns, calls haiku_run_next
// once, and the cursor returns the next instruction.
//
// Why batch (not one-per-tick): cursor walks the wave-ready set once,
// emits all of them; parent dispatches N in parallel. Single tick =
// whole wave. Mid-wave ticks return null (noop) until all in-flight
// units terminate.
//
// Model routing — mirrors start_unit and start_feedback_hat. Cascade:
// unit > hat > stage > studio. When a unit was rejected and the
// model_original/model fields got bumped (haiku→sonnet→opus), the
// per-unit value is at the top of the cascade so the escalated tier
// gets picked up on the next bolt automatically.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import matter from "gray-matter"
import { features } from "../../../../../config.js"
import { type ModelTier, resolveModel } from "../../../../../model-selection.js"
import { stageDir } from "../../../../../state-tools.js"
import {
	readHatDefs,
	readStageDef,
	readStudio,
} from "../../../../../studio-reader.js"
import { loadTemplate } from "../../../_load-template.js"
import { WORKFLOW_CONTRACTS_ANNOUNCEMENT_BLOCK } from "../../../_shared/index.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

function resolveUnitModel(opts: {
	slug: string
	stage: string
	unit: string
	hatModel?: string
	stageDefault?: string
	studioDefault?: string
}): ModelTier | undefined {
	if (!features.modelSelection) return undefined
	const { slug, stage, unit, hatModel, stageDefault, studioDefault } = opts
	let unitModel: string | undefined
	const unitPath = join(stageDir(slug, stage), "units", `${unit}.md`)
	if (existsSync(unitPath)) {
		try {
			const raw = readFileSync(unitPath, "utf8")
			unitModel = (matter(raw).data as { model?: string }).model
		} catch {
			/* swallow */
		}
	}
	return resolveModel({
		unit: unitModel,
		hat: hatModel,
		stage: stageDefault,
		studio: studioDefault,
	}).model
}

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""
	const hat = (action.hat as string) || ""
	const units = (action.units as string[]) || []
	const terminal = (action.terminal as boolean) || false

	const hatDef = stage ? readHatDefs(studio, stage)?.[hat] : undefined
	const stageDef = stage ? readStageDef(studio, stage) : undefined
	const studioData = readStudio(studio)
	const perUnitModel = new Map<string, ModelTier | undefined>()
	for (const u of units) {
		perUnitModel.set(
			u,
			resolveUnitModel({
				slug,
				stage,
				unit: u,
				hatModel: hatDef?.model,
				stageDefault: stageDef?.data?.default_model as string | undefined,
				studioDefault: studioData?.data?.default_model as string | undefined,
			}),
		)
	}
	const someResolved = Array.from(perUnitModel.values()).some(Boolean)
	const unitLines = units.map((u) => {
		const m = perUnitModel.get(u)
		return `\`${u}\`${m ? ` _(model: ${m})_` : ""}`
	})

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		hat,
		terminal,
		unitCount: units.length,
		unitLines,
		someResolved,
		showAnnouncement: units.length > 1,
		announcementBlock: WORKFLOW_CONTRACTS_ANNOUNCEMENT_BLOCK,
	})
})
