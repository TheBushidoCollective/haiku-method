// orchestrator/prompts/discovery_required/index.ts — Per-stage discovery
// dispatch (batched).
//
// Cursor returns one discovery signal per missing template inside
// `elaborate_loop.signals_unmet[]`. The elaborate_loop builder groups those
// signals together and calls THIS builder ONCE with `dispatches[]` carrying
// every missing template — so the prompt renders ONE "Discovery" section
// with N subagent blocks (or N tool-call instructions for tool-driven
// templates), matching the parallel-batched shape of `dispatch_review`.
// Single-template callers pass a one-element `dispatches[]`; the template
// loops uniformly either way.
//
// Two paths per dispatch entry:
//   - tool-driven (template declares `tool: <mcp_tool_name>`) — the
//     agent calls the named MCP tool, which writes the artifact at
//     `location:` as a side effect. No subagent block.
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

interface DiscoveryDispatchEntry {
	agent: string
	units: string[]
}

interface RenderedDispatch {
	agent: string
	unit: string
	unitLabel: string
	def: ReturnType<typeof readStageArtifactDefs>[number] | undefined
	resolvedLocation: string
	dispatchBlock: string
}

export default definePromptBuilder((ctx) => {
	const { slug, studio, action } = ctx
	const stage = (action.stage as string) || ""

	// Batched dispatches: iterate `dispatches[]` to render one entry per
	// missing discovery template. Fall back to the legacy single-agent shape
	// for callers that pass `agent`/`units` directly.
	const dispatches: DiscoveryDispatchEntry[] = Array.isArray(action.dispatches)
		? (action.dispatches as DiscoveryDispatchEntry[])
		: [
				{
					agent: (action.agent as string) || "",
					units: (action.units as string[]) || [],
				},
			]

	const defs = readStageArtifactDefs(studio, stage).filter(
		(d) => d.kind === "discovery",
	)

	const rendered: RenderedDispatch[] = dispatches.map((d) => {
		const agent = d.agent
		const units = d.units ?? []
		const unit = units[0] || ""
		const def = defs.find((dd) => dd.name === agent)
		const resolvedLocation = def
			? def.location.replace(/\{intent-slug\}/g, slug)
			: ""
		const unitLabel = unit ? ` on \`${unit}\`` : ""

		let dispatchBlock = ""
		if (def && !def.tool) {
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

		return { agent, unit, unitLabel, def, resolvedLocation, dispatchBlock }
	})

	const concurrentLoopBlock = buildConcurrentElaborateLoopBlock("discovery", {
		slug,
		stage,
	})

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		dispatches: rendered,
		dispatchCount: rendered.length,
		// Backward-compat aliases for the single-agent shape.
		agent: rendered[0]?.agent ?? "",
		unit: rendered[0]?.unit ?? "",
		unitLabel: rendered[0]?.unitLabel ?? "",
		def: rendered[0]?.def,
		resolvedLocation: rendered[0]?.resolvedLocation ?? "",
		dispatchBlock: rendered[0]?.dispatchBlock ?? "",
		concurrentLoopBlock,
		composedMode: ctx.composedMode === true,
	})
})
