// orchestrator/prompts/design_direction_complete.ts — Surface a
// recently-recorded design-direction selection (archetype + comments
// + screenshot annotations) to the agent on the next workflow tick.
//
// The HTTP submit route (`/direction/:sessionId/select`) writes the
// user's choice and decoded screenshot PNGs to disk before waking the
// `pick_design_direction` MCP tool. That tool may have its response
// discarded by a cancelled MCP request — but the disk state survives.
// The elaborate handler emits this action exactly once per fresh
// selection, then flips `design_direction_surfaced=true` on the stage
// state so we don't re-emit on every tick.
//
// We list the screenshot paths and tell the agent to Read them. Image
// transport via MCP image content blocks would require widening the
// run_next return type all the way down; keeping screenshots on disk
// and having the agent Read them keeps the workflow's text-only
// emission contract intact.

import { definePromptBuilder } from "./define.js"

interface SurfacedAnnotation {
	comment: string
	screenshot_path: string
}

export default definePromptBuilder(({ action }) => {
	const a = action as unknown as Record<string, unknown>
	const archetype = (a.archetype as string) || "(unknown)"
	const comments = a.comments as string | undefined
	const annotations = (a.annotations as SurfacedAnnotation[] | undefined) ?? []

	const lines: string[] = []
	lines.push(`## Design Direction Recorded\n`)
	lines.push(
		`The user selected the **${archetype}** direction in the picker.\n`,
	)
	if (comments) {
		lines.push(`### Free-text comments\n`)
		lines.push(`${comments}\n`)
	}
	if (annotations.length > 0) {
		lines.push(`### Annotated screenshots (${annotations.length})\n`)
		lines.push(
			`Each entry below is a (comment, screenshot) pair the user attached. Use the \`Read\` tool on each \`screenshot_path\` to view the captured surface — the path is intent-relative under \`.haiku/intents/<slug>/\`.\n`,
		)
		annotations.forEach((ann, i) => {
			lines.push(
				`${i + 1}. **${ann.comment || "(no comment)"}** — \`${ann.screenshot_path}\``,
			)
		})
		lines.push("")
	}
	lines.push(
		`Incorporate this selection (and any visual notes from the screenshots) into elaboration. Then call \`haiku_run_next\` to continue.`,
	)
	return lines.join("\n")
})
