// orchestrator/prompts/start_stage/index.ts — Stage just started.
// Inline the studio + stage definitions and the hat sequence so the
// agent has the full mandate up front. If the intent `follows`
// another intent, instruct loading parent knowledge first.

import { Eta } from "eta"
import { readStageDef, readStudio } from "../../../../studio-reader.js"
import { loadTemplate } from "../../_load-template.js"
import { definePromptBuilder } from "../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = action.stage as string
	const hats = (action.hats as string[]) || []
	const stageDef = readStageDef(studio, stage)
	const studioData = readStudio(studio)
	return eta.renderString(TEMPLATE, {
		slug,
		studio,
		stage,
		hats,
		studioBody: studioData?.body || "",
		stageBody: stageDef?.body || "",
		follows: action.follows || "",
		parentKnowledgeJson: JSON.stringify(action.parent_knowledge),
	})
})
