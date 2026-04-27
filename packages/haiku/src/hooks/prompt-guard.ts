// prompt-guard — Advisory scan for prompt injection in spec file writes

import { defineHook } from "./define.js"

const INJECTION_PATTERNS =
	/ignore previous|disregard|override instructions|you are now|system prompt|<system>|<\/system>/i

export async function promptGuard(
	input: Record<string, unknown>,
	_pluginRoot: string,
): Promise<void> {
	const toolName = input.tool_name as string
	if (toolName !== "Write" && toolName !== "Edit") return

	const toolInput = (input.tool_input || {}) as Record<string, unknown>
	const filePath = (toolInput.file_path || "") as string
	if (!filePath.includes("/.haiku/")) return

	const content = (toolInput.content || toolInput.new_string || "") as string
	if (INJECTION_PATTERNS.test(content)) {
		process.stdout.write(
			`⚠️ PROMPT GUARD: Potential injection pattern detected in spec file write to ${filePath}\nReview the content before proceeding.\n`,
		)
	}
}

export default defineHook({
	name: "prompt-guard",
	description:
		"PreToolUse Write/Edit: advisory scan for prompt injection in haiku spec writes.",
	async handle(input, ctx) {
		await promptGuard(input, ctx.pluginRoot)
	},
})
