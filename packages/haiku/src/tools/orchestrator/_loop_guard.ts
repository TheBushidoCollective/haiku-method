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

import type { OrchestratorAction } from "../../orchestrator.js"

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

/** Build the "engine loop guard" error response surfaced when a
 *  re-dispatch loop hits its cap or detects no progress. The agent
 *  doesn't need to know which engine-internal action looped — merging,
 *  closing FBs, gate-review processing are engine internals; the agent
 *  only needs "the engine had trouble, retry, file an issue if it
 *  persists." Diagnostic detail goes to the server log, NOT the
 *  surfaced text. See gigsmart/haiku-method#333. */
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
	return {
		content: [
			{
				type: "text" as const,
				text: "The engine couldn't make progress on this tick (internal loop). Re-run `haiku_run_next` to retry. If the same call keeps failing, file an issue with the contents of the MCP server log — the engine emits a diagnostic line starting with `[haiku_run_next] loop guard fired:` for each occurrence.",
			},
		],
		isError: true,
	}
}
