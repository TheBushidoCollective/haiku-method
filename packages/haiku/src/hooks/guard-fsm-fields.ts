// guard-fsm-fields — PreToolUse hook for Write/Edit
//
// Blocks direct file edits that attempt to set status to "completed" on
// haiku state files (intent.md, stage state.json, unit.md). Completion is
// the ONE field transition that MUST go through the FSM — the FSM owns
// merge-back, scope validation, feedback closure, and integrity sealing
// on completion. Every other field (including status transitions to
// pending/active/blocked) is allowed; agents may freely edit those for
// legitimate state repair.

import { resolve } from "node:path"

function out(s: string): void {
	process.stderr.write(s)
}

export async function guardFsmFields(
	input: Record<string, unknown>,
): Promise<void> {
	const toolName = (input.tool_name as string) || ""
	if (toolName !== "Write" && toolName !== "Edit") return

	const toolInput = (input.tool_input || {}) as Record<string, unknown>
	const filePath = (toolInput.file_path as string) || ""
	if (!filePath) return

	const absPath = resolve(process.cwd(), filePath)

	// Only guard haiku state files.
	const isIntentFile = /\.haiku\/intents\/[^/]+\/intent\.md$/.test(absPath)
	const isStageState = /\.haiku\/intents\/[^/]+\/stages\/[^/]+\/state\.json$/.test(
		absPath,
	)
	const isUnitFile = /\.haiku\/intents\/[^/]+\/stages\/[^/]+\/units\/[^/]+\.md$/.test(
		absPath,
	)
	if (!isIntentFile && !isStageState && !isUnitFile) return

	const content =
		(toolInput.content as string) || (toolInput.new_string as string) || ""
	if (!content) return

	// Detect status=completed writes in either YAML frontmatter or JSON body.
	// YAML: `status: completed` (optionally quoted)
	// JSON: `"status": "completed"`
	const yamlCompleted = /^\s*status:\s*["']?completed\b["']?/m.test(content)
	const jsonCompleted = /"status"\s*:\s*"completed"/.test(content)

	if (yamlCompleted || jsonCompleted) {
		const kind = isIntentFile ? "intent" : isStageState ? "stage" : "unit"
		out(
			`BLOCKED: Cannot directly set status to "completed" on ${kind} files. ` +
				`Completion is FSM-controlled — use the MCP tools (haiku_run_next, ` +
				`haiku_unit_advance_hat) so scope validation, feedback closure, ` +
				`worktree merge-back, and integrity sealing run. Setting status to ` +
				`other values (pending, active, blocked) via direct edit is fine.`,
		)
		process.exit(2)
	}
}
