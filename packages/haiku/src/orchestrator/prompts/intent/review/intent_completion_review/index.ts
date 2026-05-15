// orchestrator/prompts/intent_completion_review/index.ts — Studio-level
// review pass that fires once after the final stage gate passes.
// Spawns one subagent per studio review-agent in parallel; findings
// are logged at intent scope (no stage). The pre-tick triage gate
// relocates any misplaced findings via `haiku_feedback_move`.

import { Eta } from "eta"
import { getCapabilities } from "../../../../../harness.js"
import { readStudioReviewAgentPaths } from "../../../../../studio-reader.js"
import {
	batchDispatchDirective,
	buildInterpretationBlock,
	emitSubagentDispatchBlock,
	inlineFile,
	readInterpretation,
	resolveStudioMandateModel,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { WORKFLOW_CONTRACTS_ANNOUNCEMENT_BLOCK } from "../../../_shared/index.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, studio, action }) => {
	const agents = (action.agents as string[]) || []
	const agentPaths = readStudioReviewAgentPaths(studio)

	const dispatchParts: string[] = []
	for (const name of agents) {
		const mandatePath = agentPaths[name]
		if (!mandatePath) continue
		const interpretation = readInterpretation(mandatePath)
		const interpretiveBlock = buildInterpretationBlock(interpretation)
		const reviewLines: string[] = [
			`You are the **${name}** studio-level review agent for intent "${slug}".`,
			"",
			"## Required context (inlined below)",
			"Your review mandate is embedded in this prompt. You audit the WHOLE intent — every stage's artifacts — against the studio's standards.",
			"",
			inlineFile(mandatePath, `Mandate: ${name}`),
		]
		if (interpretiveBlock) {
			reviewLines.push("", interpretiveBlock)
		}
		reviewLines.push(
			"",
			"## Write scope (STRICT)",
			"**You MUST NOT write, edit, or create any file.** Your ONLY output channel is the `haiku_feedback` MCP tool. If you're tempted to fix an issue yourself, log it as feedback instead. Any file write is a scope violation.",
			"",
			"## Scope routing",
			"Log every finding at intent scope — omit `stage` when calling `haiku_feedback`. The pre-tick triage gate is the single point where cross-stage findings get relocated to the right stage via `haiku_feedback_move`. Do NOT pre-classify with a stage hint.",
			"",
			"## Instructions",
			"",
			`1. Read the intent artifacts across every stage: \`.haiku/intents/${slug}/stages/*/\` and \`.haiku/intents/${slug}/knowledge/\`.`,
			"2. Review through your mandate's lens.",
			`3. For each issue you find, call \`haiku_feedback({ intent: "${slug}", title: "<short>", body: "<full with file:line refs>", origin: "studio-review", author: "${name}" })\`. Omit \`stage\` to log at intent scope.`,
			"4. Return only a summary count of how many findings you logged.",
		)
		const studioReviewModel = resolveStudioMandateModel({
			mandatePath,
			studio,
		})
		dispatchParts.push(
			emitSubagentDispatchBlock({
				unit: `studio-review-${slug}`,
				hat: name,
				bolt: 1,
				agentType: "general-purpose",
				model: studioReviewModel,
				promptBody: reviewLines.join("\n"),
				heading: `#### Subagent: \`${name}\``,
			}),
		)
	}

	const announceBlock =
		agents.length > 1 ? WORKFLOW_CONTRACTS_ANNOUNCEMENT_BLOCK : ""
	const bgLine = getCapabilities().subagents.backgroundSpawn
		? ' Each `<subagent>` carries `background="true"` — pass `run_in_background: true` to the Task tool so the parent thread stays responsive while review agents run.'
		: ""
	const batchDirective = batchDispatchDirective(
		agents.length,
		"studio-level review agents",
	)

	return eta.renderString(TEMPLATE, {
		slug,
		announceBlock,
		dispatchSections: dispatchParts.join("\n\n"),
		bgLine,
		batchDirective,
	})
})
