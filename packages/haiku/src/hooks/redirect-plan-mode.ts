// redirect-plan-mode — Intercept EnterPlanMode and redirect to /haiku:start
//
// Only relevant for harnesses that have an EnterPlanMode tool (Claude Code).
// Only fires when no H·AI·K·U intent is already active — once an intent is
// running, plan mode is fine for sideline work and we don't hijack it.
// Outside a haiku project entirely, also a no-op (no intents dir to scan).

import { existsSync } from "node:fs"
import { join } from "node:path"
import { isClaudeCode, skillReference } from "../harness.js"
import { defineHook } from "./define.js"
import { findActiveIntent, getRepoRoot } from "./utils.js"

export async function redirectPlanMode(
	input: Record<string, unknown>,
	_pluginRoot: string,
): Promise<void> {
	if (input.tool_name !== "EnterPlanMode") return

	// Only Claude Code has EnterPlanMode — other harnesses won't trigger this
	if (!isClaudeCode()) return

	// If an intent is already active, leave plan mode alone — the user is
	// likely planning a sideline (engine bug fix, doc tweak) and we'd rather
	// not hijack their flow back into /haiku:start.
	if (findActiveIntent()) return

	// Outside a haiku-using project entirely, leave plan mode alone.
	// Heuristic: no .haiku/ directory anywhere from the repo root.
	const repoRoot = getRepoRoot()
	if (!existsSync(join(repoRoot, ".haiku"))) return

	const startRef = skillReference("start")
	const response = {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: "deny",
			permissionDecisionReason: `H·AI·K·U: Use ${startRef} instead of plan mode.\n\nThe H·AI·K·U plugin replaces Claude Code's built-in plan mode with a more comprehensive workflow:\n\n**\`${startRef}\`** - Start a new intent that:\n- Defines intent and success criteria collaboratively\n- Decomposes work into independent units\n- Creates isolated worktrees for safe iteration\n- Sets up the execution loop with quality gates\n\n**To start:** Run \`${startRef}\` with a description of what you want to build.`,
		},
	}

	process.stdout.write(JSON.stringify(response))
}

export default defineHook({
	name: "redirect-plan-mode",
	description:
		"PreToolUse: in haiku projects with no active intent, intercept EnterPlanMode (Claude Code) and redirect to /haiku:start.",
	async handle(input, ctx) {
		await redirectPlanMode(input, ctx.pluginRoot)
	},
})
