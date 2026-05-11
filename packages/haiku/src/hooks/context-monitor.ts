// context-monitor — Warn at context budget thresholds (only while a H·AI·K·U intent is active)
//
// Fires on PostToolUse. Skips entirely when no intent is active —
// users running Claude Code for non-intent work shouldn't be nagged by
// haiku-flavored guidance. When an intent is active, emits one budget
// note at 35% and 25% remaining, suggestions only (not directives).
// Debounced so it only fires once per threshold per session.

import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { defineHook } from "./define.js"
import { findActiveIntent } from "./utils.js"

export async function contextMonitor(
	input: Record<string, unknown>,
	_pluginRoot: string,
): Promise<void> {
	const totalTokens = Number(input.total_tokens ?? 0)
	const maxTokens = Number(input.max_tokens ?? 0)

	// Skip if we can't determine usage
	if (totalTokens === 0 || maxTokens === 0) return

	// Only fire inside an active intent — outside, the haiku-flavored
	// guidance is noise and pushes the agent into "should I keep going?" loops.
	if (!findActiveIntent()) return

	// Calculate remaining percentage
	const remaining = Math.floor(((maxTokens - totalTokens) * 100) / maxTokens)

	// Debounce file
	const sessionId = process.env.CLAUDE_SESSION_ID ?? "unknown"
	const debounceFile = join("/tmp", `context-monitor-${sessionId}`)

	let debounceContent = ""
	if (existsSync(debounceFile)) {
		debounceContent = readFileSync(debounceFile, "utf8")
	}

	if (remaining <= 25) {
		if (!debounceContent.includes("25")) {
			appendFileSync(debounceFile, "25\n")
			process.stderr.write(
				"⚠️ CONTEXT LOW (≤25% remaining)\n\n" +
					"You're nearing the end of this context window. " +
					"Consider committing in-flight changes and finding a clean break point — " +
					"a stage boundary or a successful tick is usually a good spot. " +
					"Keep going if you're close to one.\n",
			)
			process.exit(2)
		}
	} else if (remaining <= 35) {
		if (!debounceContent.includes("35")) {
			appendFileSync(debounceFile, "35\n")
			process.stderr.write(
				"⚠️ CONTEXT NOTE (≤35% remaining)\n\n" +
					"Context is getting tight. Commit working changes when convenient " +
					"and keep responses lean.\n",
			)
			process.exit(2)
		}
	}
}

export default defineHook({
	name: "context-monitor",
	description:
		"PostToolUse: while an intent is active, soft-note at 35% / 25% remaining context budget.",
	async handle(input, ctx) {
		await contextMonitor(input, ctx.pluginRoot)
	},
})
