// orchestrator/prompts/discovery_required.ts — Per-stage, per-agent
// discovery dispatch.
//
// Cursor returns `discovery_required { stage, agent, units: [name] }`
// when a required discovery agent's artifact is not yet on disk at
// the location declared by its template. The agent dispatches a
// single subagent against the named template; the subagent writes
// its artifact and the next tick re-walks. The artifact existence
// IS the signal — no FM stamp, no record-call. The cursor will keep
// emitting `discovery_required` for each missing artifact until every
// required file exists.
//
// `units[0]` is a representative unit — discovery artifacts are
// typically intent-scoped (one artifact serves all units in the
// stage), so the unit name is for prompt context only, not for
// per-unit isolation.

import { join } from "node:path"
import { resolvePluginRoot } from "../../config.js"
import { readStageArtifactDefs } from "../../studio-reader.js"
import {
	emitSubagentDispatchBlock,
	inlineFile,
	resolveStudioMandateModel,
} from "./_helpers.js"
import { definePromptBuilder } from "./define.js"

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""
	const agent = (action.agent as string) || ""
	const units = (action.units as string[]) || []
	const unit = units[0] || ""

	const defs = readStageArtifactDefs(studio, stage).filter(
		(d) => d.kind === "discovery",
	)
	const def = defs.find((d) => d.name === agent)

	const lines: string[] = []
	const unitLabel = unit ? ` on \`${unit}\`` : ""
	lines.push(`# Discovery required: \`${agent}\`${unitLabel}`)
	lines.push("")
	const resolvedLocation = def
		? def.location.replace(/\{intent-slug\}/g, slug)
		: ""
	lines.push(
		`Stage \`${stage}\` declares discovery agent \`${agent}\`. The artifact at \`${resolvedLocation || "(template missing)"}\` is not on disk yet — run the agent before decompose proceeds. (File existence IS the signal that discovery ran; there is no FM stamp.)`,
	)
	lines.push("")

	if (!def) {
		lines.push(
			`The studio configuration is missing the template file for discovery agent \`${agent}\`. Fix the studio configuration; this should never reach the agent in a healthy intent.`,
		)
		return lines.join("\n")
	}

	// Tool-driven discovery (2026-05-08). When the template declares
	// `tool: <mcp_tool_name>`, the discovery agent's job is to call
	// that tool, not fan out a subagent. The tool writes the artifact
	// at `location:` as a side effect (e.g., `pick_design_direction`
	// opens the SPA picker, captures the user's choice, and writes
	// the result to the location declared on the template). This
	// unifies design-direction-style human-input gates with knowledge-
	// research discovery agents under one cursor mechanism.
	if (def.tool) {
		lines.push(`## What to do`)
		lines.push("")
		lines.push(
			`This discovery template is **tool-driven**: call the \`${def.tool}\` MCP tool. The tool produces the artifact at \`${resolvedLocation}\` as a side effect. The cursor reads that path on the next tick — file existence IS the signal that discovery ran.`,
		)
		lines.push("")
		lines.push("### Template body (for context)")
		lines.push("")
		lines.push("```markdown")
		lines.push(def.body.trim())
		lines.push("```")
		lines.push("")
		lines.push(
			`Call \`${def.tool} { intent: "${slug}" }\` (plus any tool-specific arguments documented in the template body above). When the tool returns, call \`haiku_run_next { intent: "${slug}" }\` to re-tick.`,
		)
		return lines.join("\n")
	}

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
		`Write your artifact to \`${def.location.replace(/\{intent-slug\}/g, slug)}\`. The cursor reads this path on the next tick — file existence IS the signal that discovery ran. No record-call, no FM stamp.`,
		"",
		"## Write scope",
		`The discovery artifact is your only file write. Do NOT touch unit specs, feedback, or stage state.`,
	].join("\n")

	lines.push("## What to do")
	lines.push("")
	lines.push(
		`Spawn one subagent for the \`${agent}\` discovery template against unit \`${unit}\`.`,
	)
	lines.push("")
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
	lines.push(
		emitSubagentDispatchBlock({
			unit,
			hat: agent,
			bolt: 1,
			agentType: "general-purpose",
			model: discoveryModel,
			promptBody,
			heading: `### Subagent: \`${agent}\``,
		}),
	)
	lines.push("")
	lines.push(
		`When the subagent returns, call \`haiku_run_next { intent: "${slug}" }\`. The cursor will dispatch the next missing discovery artifact, or — once every required output is on disk — move on to the execute wave.`,
	)
	return lines.join("\n")
})
