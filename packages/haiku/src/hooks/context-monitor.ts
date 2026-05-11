// context-monitor — Suggest /clear when elaboration is the cursor and context is tight
//
// Fires on PostToolUse. Skips entirely when no intent is active —
// users running Claude Code for non-intent work shouldn't be nagged
// by haiku-flavored guidance. When an intent is active, checks the
// active stage's phase: if it's `elaborate` and remaining context is
// at/below the threshold, suggest `/clear` so the user can start
// elaboration with a fresh context. Mid-execute / mid-review work is
// left alone — clearing there would lose load-bearing in-conversation
// state (open tool plans, partial review reasoning).

import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { defineHook } from "./define.js"
import { findActiveIntent, readFrontmatterField, readJson } from "./utils.js"

function cursorPhase(intentDir: string): string | null {
	const intentFile = join(intentDir, "intent.md")
	// `active_stage` is a derived cache written by side-effects.ts after each
	// tick — the lightest way to locate the right state.json without pulling
	// in the cursor machinery. The field is also in DEPRECATED_INTENT_FIELDS
	// (v0-to-v4 strips it on migration), so if a future cleanup sweep stops
	// writing it, this hook silently skips. That's the safe failure mode.
	const activeStage = readFrontmatterField(intentFile, "active_stage")
	if (!activeStage) return null
	const stateFile = join(intentDir, "stages", activeStage, "state.json")
	const state = readJson(stateFile)
	const phase = typeof state.phase === "string" ? state.phase : ""
	return phase || null
}

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
	const intentDir = findActiveIntent()
	if (!intentDir) return

	// Only fire while the cursor is on elaborate. Once execute/review/gate
	// is running, a /clear nudge could drop in-flight reasoning the agent
	// needs to finish the bolt.
	if (cursorPhase(intentDir) !== "elaborate") return

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
				"⚠️ CONTEXT LOW (≤25% remaining) — elaboration in progress\n\n" +
					"You're partway through elaboration with a tight context window. " +
					"Run `/clear` to start with a fresh session — elaboration state is " +
					"already on disk (`intent.md`, unit files, stage `state.json`), so " +
					"the next tick will pick up exactly where you left off.\n",
			)
			process.exit(2)
		}
	} else if (remaining <= 35) {
		if (!debounceContent.includes("35")) {
			appendFileSync(debounceFile, "35\n")
			process.stderr.write(
				"⚠️ CONTEXT NOTE (≤35% remaining) — elaboration in progress\n\n" +
					"Context is getting tight while elaborating. Consider `/clear` to " +
					"give elaboration a fresh window — your unit/intent files on disk " +
					"are the source of truth, so the next tick resumes cleanly.\n",
			)
			process.exit(2)
		}
	}
}

export default defineHook({
	name: "context-monitor",
	description:
		"PostToolUse: while elaborating in an active intent, suggest /clear at 35% / 25% remaining context budget.",
	async handle(input, ctx) {
		await contextMonitor(input, ctx.pluginRoot)
	},
})
