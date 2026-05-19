// subagent-prompt-file — Persist generated prompts to a per-intent
// directory under the user's home so they outlive the process and can
// be inspected by the user or re-read by agents.
//
// Layout (mirrors Claude's `~/.claude/projects/<key>/` convention —
// `<key>` is the absolute project root with `/` replaced by `-`):
//
//   ~/.haiku/projects/<project-key>/
//     intents/<intent-slug>/
//       prompts/
//         intent/                            ← intent-scoped dispatches
//           action-<actionName>.prompt.md
//           intent-review-<slug>-<role>.prompt.md
//           intent-fix-<fbId>-<hat>-<bolt>.prompt.md
//         stages/<stage>/                    ← per-stage dispatches
//           action-<actionName>.prompt.md
//           discovery-<agent>.prompt.md
//           <unit>-<hat>-<bolt>.prompt.md
//           <unit>-<hat>-<bolt>.next-relay.md
//           <unit>-<hat>-<bolt>.result.json
//     sessions/<session_id>/
//       loop-guards.log
//
// Filenames are deterministic and overwrite on rerun — a single slot
// per logical prompt, so the user (or an agent) can point at a known
// path and trust it reflects the engine's current decision for that
// slot. Tick history is intentionally not kept; if you need it, copy
// the file before re-ticking.
//
// Project key matches Claude's `~/.claude/projects/<key>/` convention
// so the two trees line up side-by-side on disk.

import {
	mkdirSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { findHaikuRoot } from "./state/shared.js"

/** Explicit session identity, set at MCP bootstrap when available. */
let explicitSessionId: string | null = null

/**
 * Set the session identity used for per-session tmpfile directories.
 * Call from MCP tool handlers when `_session_context.CLAUDE_SESSION_ID` is
 * available (injected by the inject-state-file hook). Safe to call with
 * the same value repeatedly; ignored if a different id would clobber.
 */
export function setSessionId(id: string | undefined | null): void {
	if (!id) return
	if (explicitSessionId && explicitSessionId !== id) return
	explicitSessionId = id
}

function sessionIdOrFallback(): string {
	return (
		explicitSessionId ||
		process.env.CLAUDE_SESSION_ID ||
		process.env.HAIKU_SESSION_ID ||
		String(process.pid)
	)
}

/** Claude-style key for the current project — the absolute path to the
 *  repo root with `/` replaced by `-`. Mirrors `~/.claude/projects/`'s
 *  naming so haiku's tree sits next to Claude's on disk. Falls back to
 *  the process cwd when `.haiku/` isn't reachable (early bootstrap,
 *  tests not seeded with an intent). */
function projectKey(): string {
	let projectRoot: string
	try {
		projectRoot = dirname(findHaikuRoot())
	} catch {
		projectRoot = process.cwd()
	}
	return projectRoot.replace(/\//g, "-")
}

function projectRootDir(): string {
	return join(homedir(), ".haiku", "projects", projectKey())
}

/** Scope-resolved prompts directory under the per-intent tree. Stage
 *  prompts land in `prompts/stages/<stage>/`; intent-scope dispatches
 *  (intent-completion review/fix, intent-level seal/complete actions)
 *  land in `prompts/intent/`. Both trees are user-inspectable and
 *  overwrite-on-rerun. */
function promptsScopeDir(intentSlug: string, stage?: string): string {
	const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-")
	const intentSafe = safe(intentSlug)
	const tail = stage ? join("stages", safe(stage)) : "intent"
	const dir = join(
		projectRootDir(),
		"intents",
		intentSafe,
		"prompts",
		tail,
	)
	mkdirSync(dir, { recursive: true })
	return dir
}

/** Per-session logs directory. Session-scoped because sessions can
 *  span multiple intents; loop-guard traces and similar live here. */
function sessionLogsDir(): string {
	const dir = join(projectRootDir(), "sessions", sessionIdOrFallback())
	mkdirSync(dir, { recursive: true })
	return dir
}

/**
 * Resolve a path inside the current session's logs directory
 * (`~/.haiku/projects/<key>/sessions/<session_id>/<filename>`).
 * Session-scoped because the log spans intents within one driver
 * session. Creates the directory if needed.
 */
export function sessionLogPath(filename: string): string {
	return join(sessionLogsDir(), filename)
}

/** Result type for action-prompt writes (e.g. elaborate). Only `path` is
 *  returned because action-prompt callers set the action's `message` field
 *  themselves — they never consume the pre-built instruction string. */
export interface ActionPromptFile {
	/** Absolute path to the written prompt file. */
	path: string
}

/** Result type for subagent-prompt writes. Includes `parentInstruction` so
 *  the parent Agent tool call can relay the "Read this file" directive
 *  verbatim without re-constructing it. */
export interface SubagentPromptFile extends ActionPromptFile {
	/** The minimal parent-facing instruction — "Read this file and execute its instructions." */
	parentInstruction: string
}

/**
 * Write a subagent prompt to the per-intent prompts directory and return
 * the path + parent-facing instruction. Deterministic name keyed by
 * `<unit>-<hat>-<bolt>` (or `<unit>-<hat>` when `omitBolt: true` —
 * used by discovery, which never iterates). Rerunning the same dispatch
 * slot overwrites. The parent's Agent tool call only needs to include
 * the parentInstruction as the prompt; the subagent reads the file
 * itself.
 */
export function writeSubagentPrompt(opts: {
	unit: string
	hat: string
	bolt: number
	content: string
	/** Intent slug — selects the per-intent prompts directory. Required
	 *  for the persistent layout. */
	intent: string
	/** Stage name. When present the prompt goes under
	 *  `prompts/stages/<stage>/`; when absent it goes under
	 *  `prompts/intent/` (intent-completion review/fix). */
	stage?: string
	/** Discovery dispatches don't iterate (bolt is always 1), so the
	 *  trailing `-1` on the filename is noise. Set true to drop it. */
	omitBolt?: boolean
}): SubagentPromptFile {
	const { unit, hat, bolt, content, intent, stage, omitBolt } = opts
	const boltPart = omitBolt ? "" : `-${bolt}`
	const slug = `${unit.replace(/\.md$/, "")}-${hat}${boltPart}`
	const dir = promptsScopeDir(intent, stage)
	const path = join(dir, `${slug}.prompt.md`)
	atomicWrite(path, content)

	const parentInstruction = `Read the file at \`${path}\` and execute its instructions exactly. The file is the complete, canonical subagent prompt authored by the workflow engine — do not paraphrase or skip any of it.`

	return { path, parentInstruction }
}

/**
 * Write a per-action prompt body to the per-intent prompts directory.
 * Mirrors `writeSubagentPrompt` but is keyed by action+stage instead
 * of unit+hat+bolt — used when an orchestrator action emission carries
 * an authoritative prompt body too large to inline in the tool
 * response (e.g. `elaborate_loop`). Deterministic name: a given
 * (action, stage) slot resolves to the same file on every tick;
 * subsequent ticks overwrite. Callers set their own `message` field on
 * the action object and never need the pre-built instruction string,
 * so only `path` is returned (see `ActionPromptFile`).
 *
 * Note: `tickHint` is accepted for ABI compatibility but is no longer
 * embedded in the filename — overwrite-on-rerun is the design.
 */
export function writeActionPromptFile(opts: {
	action: string
	intent: string
	stage?: string
	content: string
	tickHint?: string | number
}): ActionPromptFile {
	const { action, intent, stage, content } = opts
	const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-")
	const slug = `action-${safe(action)}`
	const dir = promptsScopeDir(intent, stage)
	const path = join(dir, `${slug}.prompt.md`)
	atomicWrite(path, content)

	return { path }
}

/**
 * Result path for the workflow response file. v3-era advance_hat/reject_hat
 * wrote their JSON response here; v4 took a separate code path and no
 * longer uses this. Kept exported for callers still on the legacy
 * relay (none in-tree at time of writing).
 */
export function resultPathFor(opts: {
	unit: string
	hat: string
	bolt: number
	intent: string
	stage?: string
}): string {
	const { unit, hat, bolt, intent, stage } = opts
	const slug = `${unit.replace(/\.md$/, "")}-${hat}-${bolt}`
	return join(promptsScopeDir(intent, stage), `${slug}.result.json`)
}

/**
 * Build a `<subagent>` dispatch-block markup string for a prompt file that
 * ALREADY exists on disk (no write side effect). Used by the dispatch
 * builder to format markup, AND by tool handlers reading sidecar files.
 *
 * Lives here (not in orchestrator/prompts/_helpers.ts) to avoid a circular
 * import: state-tools imports this; _helpers imports state-tools.
 */
export function formatSubagentDispatchBlock(opts: {
	path: string
	parentInstruction?: string
	agentType: string
	model?: string | null
	heading?: string
	toolAttr?: boolean
	/** When true, emit `background="true"` on the `<subagent>` block. The
	 *  parent's only job after dispatch is wait → read result file → call
	 *  `haiku_run_next`, so background dispatch frees the parent thread to
	 *  keep talking to the user. Caller must gate this on the active
	 *  harness's `subagents.backgroundSpawn` capability — passing it for a
	 *  harness that doesn't support background spawning would emit guidance
	 *  the parent can't follow. */
	background?: boolean
}): string {
	const {
		path,
		parentInstruction,
		agentType,
		model,
		heading,
		toolAttr,
		background = false,
	} = opts
	const instruction =
		parentInstruction ??
		`Read the file at \`${path}\` and execute its instructions exactly. The file is the complete, canonical subagent prompt authored by the workflow engine — do not paraphrase or skip any of it.`
	const tool = toolAttr ? ` tool="Agent"` : ""
	const modelAttr = model ? ` model="${model}"` : ""
	const bgAttr = background ? ` background="true"` : ""
	const h = heading ?? "## Subagent Dispatch (MANDATORY — relay verbatim)"
	return (
		`${h}\n\n<subagent${tool} type="${agentType}"${modelAttr}${bgAttr}` +
		` prompt_file="${path}">\n${instruction}\n</subagent>`
	)
}

/**
 * Path for a "next-hat relay" sidecar file. The fix-loop dispatch builder
 * writes the FULLY-FORMATTED next-hat `<subagent>` markup here at dispatch
 * time, keyed by the CURRENT hat (the one whose prompt would have embedded
 * the relay). `haiku_feedback_advance_hat` reads the sidecar after the
 * current hat advances and returns its contents in the tool response —
 * so the agent never sees the relay block in a prompt, only as a tool
 * return value they only get on the actionable path. If the agent calls
 * `haiku_feedback_reject` instead, no read happens, no block is returned,
 * nothing to mistakenly emit.
 */
export function nextRelayPath(opts: {
	unit: string
	hat: string
	bolt: number
	intent: string
	stage?: string
}): string {
	const { unit, hat, bolt, intent, stage } = opts
	const slug = `${unit.replace(/\.md$/, "")}-${hat}-${bolt}`
	return join(promptsScopeDir(intent, stage), `${slug}.next-relay.md`)
}

/**
 * Write a next-hat relay sidecar file. Best-effort: the file is treated
 * as advisory by readers — if the write fails, advance_hat falls back to
 * just returning `next_dispatched_hat` without the prebuilt block.
 */
export function writeNextRelaySidecar(
	opts: {
		unit: string
		hat: string
		bolt: number
		intent: string
		stage?: string
	},
	content: string,
): void {
	atomicWrite(nextRelayPath(opts), content)
}

export function writeResultFile(resultPath: string, payload: unknown): void {
	atomicWrite(resultPath, JSON.stringify(payload, null, 2))
}

/**
 * Write-then-rename for atomicity. Prevents readers from seeing a partial
 * file if the writer is interrupted mid-write. The rename is atomic on
 * POSIX filesystems IF the temp path and final path share a filesystem —
 * enforced here by placing the temp next to the final path inside the
 * same per-intent prompts directory.
 */
function atomicWrite(path: string, content: string): void {
	const tmp = `${path}.${process.pid}.tmp`
	writeFileSync(tmp, content, "utf8")
	try {
		renameSync(tmp, path)
	} catch (err) {
		try {
			rmSync(tmp, { force: true })
		} catch {
			/* ignore cleanup failure */
		}
		throw new Error(
			`atomicWrite: rename failed — tmp and final must share a filesystem. Original: ${err instanceof Error ? err.message : String(err)}`,
		)
	}
}

/**
 * Sweep stale per-session log dirs under the current project's tree
 * (`~/.haiku/projects/<key>/sessions/<old_session>/`). Intent prompt
 * dirs are NOT swept — they're the durable inspection surface, and
 * the user manages retention by archiving / deleting intents.
 */
export function cleanupStaleTmpfiles(maxAgeHours = 24): void {
	const root = join(projectRootDir(), "sessions")
	try {
		const now = Date.now()
		const maxMs = maxAgeHours * 60 * 60 * 1000
		for (const sessionDir of readdirSync(root)) {
			const p = join(root, sessionDir)
			try {
				const stat = statSync(p)
				if (now - stat.mtimeMs > maxMs) {
					rmSync(p, { recursive: true, force: true })
				}
			} catch {
				/* ignore */
			}
		}
	} catch {
		/* root doesn't exist yet — nothing to clean */
	}
}
