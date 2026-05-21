// orchestrator/prompts/elaborate/index.ts — Per-stage human-conversation
// gate. Replaces the legacy elaborate prompt (now `decompose.ts`,
// which handles unit-spec writing). The split landed 2026-05-08 to
// enforce the principle that every non-autopilot stage starts with a
// real conversation before any autonomous decomposition fires. The
// cursor blocks at this action until `stages/<stage>/elaboration.md`
// exists and a verifier has stamped `verified_at` on its frontmatter.
//
// Mode behavior:
//   - All non-autopilot modes (continuous, discrete, discrete-hybrid)
//     emit this action on stage entry. The agent reads context,
//     surfaces informed questions, captures the agreement.
//   - Autopilot bypasses this gate at the cursor level (cursor.ts
//     `walkIntentTrack` skips the elaborate clause when
//     `intent.mode === "autopilot"`). This builder never fires in
//     autopilot.

import { Eta } from "eta"
import { readIntentBody } from "../../../../../state-tools.js"
import { readStageBody } from "../../../../../studio-reader.js"
import {
	buildConcurrentElaborateLoopBlock,
	studioReadRef,
} from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder((ctx) => {
	const action = ctx.action as { stage?: string; intent?: string }
	const stage = action.stage ?? "(unknown)"
	const intentSlug = action.intent ?? ctx.slug

	// intent.md is guarded against generic Read; STAGE.md is studio
	// source. Snapshot both via the haiku_read_* readers and emit "Read
	// <snapshot>" — the agent gets the FULL body (not a truncated
	// excerpt) and a followable breadcrumb, no hook-blocked raw Read.
	const intentRef = studioReadRef({
		resolveBody: () => readIntentBody(intentSlug),
		toolName: "haiku_read_intent",
		toolArgs: { intent: intentSlug },
		intent: intentSlug,
		stage,
		kind: "intent-goal",
		name: "intent",
	})
	const stageRef = studioReadRef({
		resolveBody: () => readStageBody(ctx.studio, stage),
		toolName: "haiku_read_stage",
		toolArgs: { studio: ctx.studio, stage },
		intent: intentSlug,
		stage,
		kind: "stage-scope",
		name: stage,
	})

	const concurrentLoopBlock = buildConcurrentElaborateLoopBlock(
		"conversation",
		{ slug: intentSlug, stage },
	)

	return eta.renderString(TEMPLATE, {
		stage,
		intentSlug,
		intentRef,
		stageRef,
		concurrentLoopBlock,
		composedMode: ctx.composedMode === true,
	})
})
