// orchestrator/prompts/start_unit_hat/index.ts — v4 batch-aware hat
// dispatch prompt builder.
//
// The cursor returns `start_unit_hat { stage, hat, units: [...], terminal }`
// when one or more wave-ready units need their next hat. The prompt
// instructs the parent agent to spawn ONE `<subagent>` block per
// listed unit, in parallel. Each subagent runs that unit's hat, calls
// haiku_unit_advance_hat (or _reject_hat) when done, and terminates
// with the engine's plain-text return verbatim — the engine appends a
// relay breadcrumb that tells the parent what to do next (spawn the
// next dispatch block, or call run_next).
//
// File-backed dispatch (2026-05-19): each per-unit subagent prompt is
// written to its own file under the per-intent prompts dir and the
// parent template only embeds `<subagent prompt_file="...">` markup
// per unit. Replaces the legacy inline prompt prose in the parent
// template, which duplicated the body in the parent's context.
// `buildUnitHatDispatchBlock` is the single source of truth for the
// per-unit prompt body — shared with the advance_hat relay breadcrumb
// in `state-tools.ts` so the two cannot disagree.

import { Eta } from "eta"
import { buildUnitHatDispatchBlock } from "../../../../unit-dispatch-builder.js"
import { batchDispatchDirective } from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { sharedBlockRef } from "../../../_shared/index.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder(({ slug, studio, action }) => {
	const stage = (action.stage as string) || ""
	const hat = (action.hat as string) || ""
	const units = (action.units as string[]) || []
	const terminal = (action.terminal as boolean) || false

	// Build one file-backed dispatch block per unit. The shared builder
	// resolves the model cascade, reads prior-hat iteration state, and
	// writes the per-unit subagent prompt to disk. Returns the
	// `<subagent prompt_file="...">` markup the parent pastes verbatim.
	const dispatchBlocks = units.map((unit) =>
		buildUnitHatDispatchBlock({
			slug,
			studio,
			unit,
			stage,
			hat,
			terminal,
		}),
	)

	return eta.renderString(TEMPLATE, {
		slug,
		stage,
		hat,
		terminal,
		unitCount: units.length,
		dispatchBlocks,
		// Multi-spawn announcement contract: when a wave fans out >1
		// subagent, the parent announces the batch before spawning so
		// the user isn't surprised by N parallel Tasks. Single-spawn
		// dispatches skip it (no panic risk).
		showAnnouncement: units.length > 1,
		announcementBlock: sharedBlockRef("workflow-contracts-announcement"),
		// Unconditional fix-loop / execute workflow contract block.
		// Pre-2026-05-18 this was tied to `units.length > 1`, leaving
		// single-unit dispatches without the closure reminder. Now
		// always emitted so the subagent sees the contract every time
		// regardless of wave size.
		executeContractsBlock: sharedBlockRef("workflow-contracts-execute"),
		batchDirective:
			units.length > 0 ? batchDispatchDirective(units.length, "subagents") : "",
	})
})
