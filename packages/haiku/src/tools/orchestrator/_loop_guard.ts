// tools/orchestrator/_loop_guard.ts — Defensive guards for the
// re-dispatch `while` loops in haiku_run_next. Each loop body runs a
// side-effect (close a feedback, run a picker, merge a stage, decide a
// gate) and re-ticks the cursor. If the side-effect didn't actually
// advance cursor state, the loop spins inside the MCP call, hanging
// from the agent's perspective. The cap turns "hang for hours" into
// "fail with a stable diagnostic on tick 17"; the same-action
// signature check catches the no-progress case earlier.
//
// Lives in its own file so tests can import without dragging in the
// circular `tools/orchestrator/index.ts` ↔ `orchestrator.ts` chain
// that haiku_run_next is part of. See gigsmart/haiku-method#333.

import { appendFileSync } from "node:fs"
import type { OrchestratorAction } from "../../orchestrator.js"
import { sessionLogPath } from "../../subagent-prompt-file.js"

/** Hard cap on per-tick re-dispatch loop iterations. */
export const RUN_NEXT_LOOP_CAP = 16

/** Signature of an OrchestratorAction for same-action progress detection.
 *  Two consecutive ticks producing identical signatures means the
 *  side-effect-running loop body didn't advance cursor state. */
export function actionSignature(result: OrchestratorAction): string {
	const r = result as Record<string, unknown>
	return JSON.stringify({
		action: r.action ?? null,
		stage: r.stage ?? null,
		unit: r.unit ?? null,
		feedback_id: r.feedback_id ?? null,
		role: r.role ?? null,
	})
}

/** Append a line to the current MCP session's loop-guard log file.
 *  The MCP server's stderr is captured over a unix socket by Claude
 *  Code, which the user can't grep from disk. A file on disk in the
 *  session's own log directory (same dir the subagent prompts already
 *  live in, `$TMPDIR/haiku-prompts/{session_id}/`) is recoverable: the
 *  user pastes the last N lines back when filing a bug. Co-locating
 *  with subagent prompts means a wedged user has ONE place to look
 *  for everything the engine wrote during their session, not a
 *  scattered .haiku/diagnostics/ directory the repo otherwise doesn't
 *  use.
 *
 *  Fail-open: if the write fails (no session id, FS error), still
 *  emit to stderr so we don't silently lose the diagnostic.
 *
 *  Lives here (not in `state-tools` or a shared sink) so the loop
 *  guard's signal doesn't depend on a feature flag or a session
 *  context — it MUST land regardless of MCP state. */
function writeLoopGuardDiagnostic(line: string): string | null {
	const stamped = `[${new Date().toISOString()}] ${line}\n`
	try {
		const logFile = sessionLogPath("loop-guards.log")
		appendFileSync(logFile, stamped)
		return logFile
	} catch {
		/* fall through — stderr still gets the line below */
		return null
	}
}

/** Build the "engine loop guard" error response surfaced when a
 *  re-dispatch loop hits its cap or detects no progress. The agent
 *  doesn't need to know which engine-internal action looped — merging,
 *  closing FBs, gate-review processing are engine internals; the agent
 *  only needs "the engine had trouble, retry, file an issue if it
 *  persists." Diagnostic detail goes to:
 *    1. stderr (`console.error`) — captured by the MCP runner
 *    2. `$TMPDIR/haiku-prompts/{session_id}/loop-guards.log` — co-located
 *       with the session's subagent prompts, recoverable from disk
 *       when stderr is buried in the MCP socket
 *    3. The error-response text's `diagnostic:` suffix and `log:` path
 *       — so the user can paste the response into a bug report without
 *       grepping
 *  See gigsmart/haiku-method#333 (original) and the HAIKU-BUG-
 *  merge-loop-after-v0-to-v4-migration report (diagnostic recovery). */
export function loopAbortResponse(
	loopName: string,
	iterations: number,
	result: OrchestratorAction,
	reason: "cap" | "no_progress",
): { content: Array<{ type: "text"; text: string }>; isError: true } {
	const r = result as Record<string, unknown>
	const detail =
		`loop=${loopName} reason=${reason} iterations=${iterations} ` +
		`action=${String(r.action ?? "?")}` +
		(r.stage ? ` stage=${String(r.stage)}` : "") +
		(r.unit ? ` unit=${String(r.unit)}` : "") +
		(r.feedback_id ? ` fb=${String(r.feedback_id)}` : "")
	console.error(`[haiku_run_next] loop guard fired: ${detail}`)
	const logFile = writeLoopGuardDiagnostic(`loop guard fired: ${detail}`)
	const logHint = logFile
		? `\nlog: ${logFile} (this session's full loop-guard history)`
		: "\nlog: (write failed — diagnostic above and on MCP stderr only)"
	return {
		content: [
			{
				type: "text" as const,
				text:
					"The engine couldn't make progress on this tick (internal loop). " +
					"Re-run `haiku_run_next` to retry. If the same call keeps failing, " +
					"file an issue with the diagnostic line below and the contents of " +
					"the per-session log file (same dir as the subagent prompts).\n\n" +
					`diagnostic: ${detail}${logHint}`,
			},
		],
		isError: true,
	}
}
