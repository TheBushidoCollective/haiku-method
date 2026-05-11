// redirect-plan-mode — Intercept EnterPlanMode and redirect to /haiku:start
//
// Opt-in: only fires when HAIKU_REDIRECT_PLAN_MODE is set to a truthy
// value ("1" or "true"). By default the hook is a no-op so users keep
// their native plan-mode flow. When opted in, the redirect still only
// fires for harnesses with an EnterPlanMode tool (Claude Code), inside
// a project that has a .haiku/ directory, and only when no intent is
// already active (mid-intent sideline work shouldn't be hijacked).

import { existsSync } from "node:fs"
import { join } from "node:path"
import { isClaudeCode, skillReference } from "../harness.js"
import { defineHook } from "./define.js"
import { findActiveIntent, getRepoRoot } from "./utils.js"

function isRedirectEnabled(): boolean {
	const raw = process.env.HAIKU_REDIRECT_PLAN_MODE
	if (!raw) return false
	const v = raw.trim().toLowerCase()
	return v === "1" || v === "true" || v === "yes" || v === "on"
}

export async function redirectPlanMode(
	input: Record<string, unknown>,
	_pluginRoot: string,
): Promise<void> {
	if (input.tool_name !== "EnterPlanMode") return

	// Opt-in via env var. Default: leave plan mode alone.
	if (!isRedirectEnabled()) return

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
			permissionDecisionReason: `H·AI·K·U: Use ${startRef} instead of plan mode.\n\nThe H·AI·K·U plugin replaces Claude Code's built-in plan mode with a more comprehensive workflow:\n\n**\`${startRef}\`** - Start a new intent that:\n- Defines intent and success criteria collaboratively\n- Decomposes work into independent units\n- Creates isolated worktrees for safe iteration\n- Sets up the execution loop with quality gates\n\n**To start:** Run \`${startRef}\` with a description of what you want to build.\n\n(To disable this redirect, unset \`HAIKU_REDIRECT_PLAN_MODE\` in your environment.)`,
		},
	}

	process.stdout.write(JSON.stringify(response))
}

export default defineHook({
	name: "redirect-plan-mode",
	description:
		"PreToolUse: when HAIKU_REDIRECT_PLAN_MODE is set and no intent is active, intercept EnterPlanMode (Claude Code) and redirect to /haiku:start.",
	async handle(input, ctx) {
		await redirectPlanMode(input, ctx.pluginRoot)
	},
})
