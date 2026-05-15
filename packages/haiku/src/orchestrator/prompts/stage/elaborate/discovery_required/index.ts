// orchestrator/prompts/discovery_required/index.ts — Per-stage,
// per-agent discovery dispatch.
//
// Cursor returns `discovery_required { stage, agent, units: [name] }`
// when a required discovery agent's artifact is not yet on disk at
// the location declared by its template. The agent dispatches a
// single subagent against the named template; the subagent writes
// its artifact and the next tick re-walks. The artifact existence
// IS the signal — no FM stamp, no record-call.
//
// Two paths inside the prompt:
//   - tool-driven (template declares `tool: <mcp_tool_name>`) — the
//     agent calls the named MCP tool, which writes the artifact at
//     `location:` as a side effect.
//   - subagent-driven (template has no `tool:`) — spawn one subagent
//     against the discovery template's body.

import { join } from "node:path"
import { Eta } from "eta"
import { resolvePluginRoot } from "../../../../../config.js"
import { readStageArtifactDefs } from "../../../../../studio-reader.js"
import {
	buildConcurrentElaborateLoopBlock,
	emitSubagentDispatchBlock,
	inlineFile,
	resolveStudioMandateModel,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder((ctx) => {
	const { slug, studio, action } = ctx
	const stage = (action.stage as string) || ""
	const agent = (action.agent as string) || ""
	const units = (action.units as string[]) || []
	const unit = units[0] || ""

	const defs = readStageArtifactDefs(studio, stage).filter(
		(d) => d.kind === "discovery",
	)
	const def = defs.find((d) => d.name === agent)
	const resolvedLocation = def
		? def.location.replace(/\{intent-slug\}/g, slug)
		: ""
	const unitLabel = unit ? ` on \`${unit}\`` : ""
	const concurrentLoopBlock = buildConcurrentElaborateLoopBlock("discovery", {
		slug,
		stage,
	})

	let dispatchBlock = ""
	if (def && !def.tool) {
		const templatePath = `plugin/studios/${studio}/stages/${stage}/discovery/${agent}.md`
		const promptBody = [
			`You are the **${agent}** discovery agent for stage \`${stage}\` of intent "${slug}". Unit \`${unit}\` is provided as representative context — the artifact you produce serves every unit in the stage.`,
			"",
			"## Required context (inlined below)",
			`Your discovery template is embedded in this prompt. The artifact you produce becomes a knowledge input for every execute hat that runs in this stage.`,
			"",
			inlineFile(templatePath, `Template: ${agent}`),
			"",
			"## Output target",
			`Write your artifact to \`${resolvedLocation}\`. The cursor reads this path on the next tick — file existence IS the signal that discovery ran. No record-call, no FM stamp.`,
			"",
			"## Write scope",
			`The discovery artifact is your primary write. Do NOT touch unit specs or stage state.`,
			"",
			"## Surfacing decisions to the user (GOALS.md)",
			`If your discovery surfaces a decision the user must make — a fork, a constraint, a preference that the artifact alone cannot resolve — file feedback rather than guessing. Call \`haiku_feedback\` with:`,
			`- \`origin: "discovery"\``,
			`- \`resolution: "question"\``,
			`- \`stage: "${stage}"\` (so the FB lives at stage scope alongside the elaboration artifact)`,
			`- \`source_ref: "${agent}"\``,
			`- body: a clear question describing the decision and what's at stake`,
			"",
			`The next tick's feedback flow routes \`resolution: question\` FBs as \`feedback_question\` — the main agent picks up the question, asks the user inline via \`ask_user_chat\`, writes the answer back on the FB body, and closes it. Until the FB closes, the elaborate-loop's 2nd completion signal (no open \`origin: discovery, resolution: question\` FBs) stays unmet and the cursor won't leave elaborate.`,
		].join("\n")
		const discoveryMandatePath = join(
			resolvePluginRoot(),
			"studios",
			studio,
			"stages",
			stage,
			"discovery",
			`${agent}.md`,
		)
		const discoveryModel = resolveStudioMandateModel({
			mandatePath: discoveryMandatePath,
			studio,
			stage,
		})
		dispatchBlock = emitSubagentDispatchBlock({
			unit,
			hat: agent,
			bolt: 1,
			agentType: "general-purpose",
			model: discoveryModel,
			promptBody,
			heading: `### Subagent: \`${agent}\``,
		})
	}

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		agent,
		unit,
		unitLabel,
		def,
		resolvedLocation,
		dispatchBlock,
		concurrentLoopBlock,
		composedMode: ctx.composedMode === true,
	})
})
