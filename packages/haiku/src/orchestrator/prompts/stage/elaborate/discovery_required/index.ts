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

import { Eta } from "eta"
import {
	readDiscoveryBody,
	readStageArtifactDefs,
	resolveDiscoveryTemplatePath,
} from "../../../../../studio-reader.js"
import {
	buildConcurrentElaborateLoopBlock,
	emitSubagentDispatchBlock,
	resolveStudioMandateModel,
	studioReadRef,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)
const SUBAGENT_TEMPLATE = loadTemplate(import.meta.url, "subagent.eta.md")

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
		// Snapshot the discovery template via the same reader
		// haiku_read_discovery uses (cascade-aware — project override
		// honored, which the prior plugin-only resolution missed) and emit
		// a "Read <snapshot>" breadcrumb.
		const templateRef = studioReadRef({
			resolveBody: () => readDiscoveryBody(studio, stage, agent),
			toolName: "haiku_read_discovery",
			toolArgs: { studio, stage, template: agent },
			intent: slug,
			stage,
			kind: "discovery-template",
			name: agent,
		})
		const promptBody = eta.renderString(SUBAGENT_TEMPLATE, {
			agent,
			stage,
			slug,
			unit,
			resolvedLocation,
			templateRef,
		})
		const discoveryModel = resolveStudioMandateModel({
			mandatePath:
				resolveDiscoveryTemplatePath(studio, stage, agent) ?? undefined,
			studio,
			stage,
		})
		dispatchBlock = emitSubagentDispatchBlock({
			unit: "discovery",
			hat: agent,
			bolt: 1,
			intent: slug,
			stage,
			agentType: "general-purpose",
			model: discoveryModel,
			promptBody,
			heading: `### Subagent: \`${agent}\``,
			omitBolt: true,
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
