// orchestrator/unit-dispatch-builder.ts — Engine-side dispatch-block
// builder for unit hats.
//
// Mirrors `fb-dispatch-builder.ts` for the unit track. Builds a single
// file-backed `<subagent prompt_file="...">` dispatch block for one
// unit at one hat. Shared between two call sites:
//   - `prompts/stage/execute/start_unit_hat/index.ts` (cursor's wave
//     dispatch — calls this once per wave-ready unit)
//   - `state-tools.ts` (`haiku_unit_advance_hat`'s
//     `next_subagent_dispatch_block` relay breadcrumb)
//
// One code path is load-bearing per the no-agent-mechanics rule
// (`.claude/rules/no-agent-mechanics-teaching.md`): if the relay and
// the cursor's initial wave dispatch could disagree, the agent could
// relay a block that doesn't match what the cursor would emit and the
// engine and parent would fall out of sync.
//
// File-backed (2026-05-19): both the wave dispatch and the relay
// breadcrumb write a per-unit subagent prompt to disk and emit only
// a `<subagent prompt_file="...">` pointer. The parent's context
// stays clean; the subagent reads the full prompt from disk on its
// own turn. Pre-2026-05-19 the wave dispatch inlined the prompt prose
// in the parent template (start_unit_hat/template.eta.md), which
// duplicated the body in the parent context AND made it impossible to
// audit the relay prompt without re-running a tick.

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import matter from "gray-matter"
import { features } from "../config.js"
import { type ModelTier, resolveModel } from "../model-selection.js"
import { stageDir } from "../state-tools.js"
import {
	readHatDefs,
	readStageDef,
	readStudio,
	resolveHatPath,
} from "../studio-reader.js"
import {
	buildPriorRejectBlock,
	emitSubagentDispatchBlock,
} from "./prompts/_helpers.js"
import { loadTemplate } from "./prompts/_load-template.js"

const eta = new Eta({ autoEscape: false, useWith: true })

// The subagent template lives next to the start_unit_hat prompt
// builder. Loaded lazily + memoized (no module-init filesystem I/O) so
// state-tools — which imports this builder — can be pulled into non-MCP
// subcommands (status line, migrate) without firing a prompt read
// before the plugin root resolves.
let _subagentTemplate: string | null = null
function subagentTemplate(): string {
	if (_subagentTemplate === null) {
		_subagentTemplate = loadTemplate(
			new URL(
				"./prompts/stage/execute/start_unit_hat/index.ts",
				import.meta.url,
			).href,
			"subagent.eta.md",
		)
	}
	return _subagentTemplate
}

/** Resolve the model tier for a single unit hat dispatch. Cascade:
 *  unit-level `model:` override → hat → stage default → studio default. */
function resolveUnitHatModel(opts: {
	slug: string
	studio: string
	stage: string
	hat: string
	unit: string
}): ModelTier | undefined {
	if (!features.modelSelection) return undefined
	const { slug, studio, stage, hat, unit } = opts
	let unitModel: string | undefined
	const unitPath = join(stageDir(slug, stage), "units", `${unit}.md`)
	if (existsSync(unitPath)) {
		try {
			const raw = readFileSync(unitPath, "utf8")
			unitModel = (matter(raw).data as { model?: string }).model
		} catch {
			/* cascade falls through */
		}
	}
	const hatDef = stage ? readHatDefs(studio, stage)?.[hat] : undefined
	const stageDef = stage ? readStageDef(studio, stage) : undefined
	const studioData = readStudio(studio)
	return resolveModel({
		unit: unitModel,
		hat: hatDef?.model,
		stage: stageDef?.data?.default_model as string | undefined,
		studio: studioData?.data?.default_model as string | undefined,
	}).model
}

/** Read the unit's iterations[] and return the prior hats already
 *  executed in this hat sequence (i.e., previous iterations with a
 *  terminal `result: "advance"` stamp). Used by the subagent template
 *  to surface "there are N prior hat hand-offs to read" context. */
function readPriorHatsForUnit(opts: {
	slug: string
	stage: string
	unit: string
}): string[] {
	const { slug, stage, unit } = opts
	const unitPath = join(stageDir(slug, stage), "units", `${unit}.md`)
	if (!existsSync(unitPath)) return []
	try {
		const fm = matter(readFileSync(unitPath, "utf8")).data
		const iters = Array.isArray(fm.iterations)
			? (fm.iterations as Array<{ hat?: unknown; result?: unknown }>)
			: []
		return iters
			.filter((it) => it.result === "advance")
			.map((it) => (typeof it.hat === "string" ? it.hat : ""))
			.filter((h) => h.length > 0)
	} catch {
		return []
	}
}

/** Build a single per-unit `<subagent prompt_file="...">` dispatch
 *  block. Writes the rendered prompt to the per-intent prompts dir
 *  and returns the dispatch markup. The parent embeds only the
 *  markup; the subagent reads the full prompt from disk. */
export function buildUnitHatDispatchBlock(opts: {
	slug: string
	studio: string
	unit: string
	stage: string
	hat: string
	terminal: boolean
}): string {
	const { slug, studio, unit, stage, hat, terminal } = opts
	const model = resolveUnitHatModel({ slug, studio, stage, hat, unit })
	const hatPath = resolveHatPath(studio, stage, hat) ?? ""
	const priorHatsInline = readPriorHatsForUnit({ slug, stage, unit })
	// Surface the most-recent rejection reason so a bounced-to hat fixes
	// the verifier's specific objection on the new bolt rather than
	// re-rolling a fresh implementation the verifier already rejected.
	// Empty on the first bolt (no prior rejection on disk).
	const unitFile = join(stageDir(slug, stage), "units", `${unit}.md`)
	const priorRejectBlock = buildPriorRejectBlock(unitFile)
	const promptBody = eta.renderString(subagentTemplate(), {
		slug,
		stage,
		hat,
		unit,
		terminal,
		hatPath,
		priorHatsInline,
		priorRejectBlock,
	})
	return emitSubagentDispatchBlock({
		unit,
		hat,
		bolt: priorHatsInline.length + 1,
		intent: slug,
		stage,
		agentType: "general-purpose",
		model,
		promptBody,
		heading: `### Subagent — \`${unit}\` (stage \`${stage}\`, hat \`${hat}\`)`,
	})
}
