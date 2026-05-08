// edit-auto-read-hint — P6 (2026-05-06).
//
// Claude Code's Edit/MultiEdit tools refuse to operate on a file the
// session hasn't Read yet. The error is "File has not been read yet."
// Without intervention the agent burns a turn trying again with the
// same args, gets the same error, and only then thinks to Read first.
// Session log evidence: this happened multiple times in one run.
//
// This hook fires PostToolUse on Edit/MultiEdit, detects the
// not-read error string in the tool response, and surfaces a clear
// "Read first, then retry" nudge to the agent. Claude Code doesn't
// allow tool-call injection via hooks (that would be the cleanest
// fix — auto-Read + auto-retry in one tool call), so this is the
// next-best contract layer: make the error noisy and actionable.

import { defineHook } from "./define.js"

const NOT_READ_PATTERN =
	/file has not been read yet|read it first before writing|read.*before.*edit/i

export default defineHook({
	name: "edit-auto-read-hint",
	description:
		"PostToolUse: when Edit/MultiEdit fails with 'file not read yet', surface a Read-first hint so the agent recovers in one turn instead of retrying blindly.",
	async handle(input, _ctx) {
		// Tool-result hooks receive the tool response data. The shape
		// varies by tool — for Edit, the failure text usually appears
		// in `tool_response.content[0].text` or a stringifiable field
		// that includes the canonical error. We check broadly to
		// minimize false negatives.
		const blob = JSON.stringify(input ?? {})
		if (!NOT_READ_PATTERN.test(blob)) return
		// Extract the file path the agent was trying to edit so the
		// hint can include it. Best-effort — fall back to a generic
		// message if the path isn't recoverable from the input.
		const inputAny = input as Record<string, unknown>
		const toolInput = inputAny.tool_input as Record<string, unknown> | undefined
		const filePath =
			(toolInput?.file_path as string | undefined) ?? "<the file>"

		// One-line nudge. Claude Code already knows "Read before Edit"
		// once it sees the error — the hook's job is just to surface
		// the file path so the recovery is one round-trip, not three.
		process.stderr.write(
			`Read \`${filePath}\` first, then retry the Edit.\n`,
		)
		process.exit(2)
	},
})
