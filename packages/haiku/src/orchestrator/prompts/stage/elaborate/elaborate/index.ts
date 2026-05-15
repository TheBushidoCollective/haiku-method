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

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Eta } from "eta"
import { buildConcurrentElaborateLoopBlock } from "../../../_helpers.js"
import { loadTemplate } from "../../../_load-template.js"
import { definePromptBuilder } from "../../../define.js"

const eta = new Eta({ autoEscape: false, useWith: true })
const TEMPLATE = loadTemplate(import.meta.url)

export default definePromptBuilder((ctx) => {
	const action = ctx.action as { stage?: string; intent?: string }
	const stage = action.stage ?? "(unknown)"
	const intentSlug = action.intent ?? ctx.slug

	const intentMdPath = join(ctx.dir, "intent.md")
	const intentExcerpt = readFirstNonEmptyChunk(intentMdPath, 400)

	const stageDir = join(ctx.dir, "stages", stage)
	const stageMdPath = join(stageDir, "STAGE.md")
	const stageScope = readFirstNonEmptyChunk(stageMdPath, 300)

	const concurrentLoopBlock = buildConcurrentElaborateLoopBlock(
		"conversation",
		{ slug: intentSlug, stage },
	)

	return eta.renderString(TEMPLATE, {
		stage,
		intentSlug,
		intentMdPath,
		stageMdPath,
		intentExcerpt,
		stageScope,
		concurrentLoopBlock,
		composedMode: ctx.composedMode === true,
	})
})

function readFirstNonEmptyChunk(path: string, maxLen: number): string {
	if (!existsSync(path)) return ""
	try {
		const raw = readFileSync(path, "utf8")
		const trimmed = raw.trim()
		if (trimmed.length <= maxLen) return trimmed
		return `${trimmed.slice(0, maxLen)}…`
	} catch {
		return ""
	}
}
