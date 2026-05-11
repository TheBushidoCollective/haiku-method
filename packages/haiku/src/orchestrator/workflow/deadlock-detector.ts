// orchestrator/workflow/deadlock-detector.ts
//
// Inter-tick deadlock detector. The existing loop guard in
// `tools/orchestrator/_loop_guard.ts` catches INTRA-tick spin loops
// (the engine's re-dispatch while-loops that re-emit the same action
// inside a single haiku_run_next call). This detector catches the
// other shape: the same action emitted across MULTIPLE consecutive
// haiku_run_next calls with no disk delta between them. That's the
// "user calls run_next, gets dispatch_review(spec), runs the review
// subagent, the review subagent does nothing useful, user calls
// run_next again, gets dispatch_review(spec) again" loop — the wedge
// pattern that repeatedly shipped past CI tests because it spans tick
// boundaries.
//
// State is in-memory per-slug. A wedge requires multiple ticks in a
// short window, which means the same MCP server process. Lost on
// restart is intentional — the next session starts with no priors.
// Avoiding an on-disk cache also keeps the engine's "outputs are the
// signal, not bookkeeping artifacts" principle intact.
//
// What this does NOT do:
//   - Halt the workflow. The detector only emits telemetry. The
//     existing loop guard handles hard halts.
//   - Replace the agent's recovery path. If a wedge is detected, the
//     user / agent still has to investigate. The signal is meant for
//     dashboards (Sentry/OTel), not for engine logic.

import { emitTelemetry } from "../../telemetry.js"

interface TickEntry {
	signature: string
	count: number
	first_seen: string
}

const tickHistory: Map<string, TickEntry> = new Map()

/** Threshold for "this looks wedged." Two repeats means the agent
 *  invoked run_next, got an action, dispatched it (or tried to),
 *  invoked run_next again, and got the EXACT same action back. That's
 *  load-bearing: a no-op tick where the dispatched action didn't
 *  produce on-disk progress. Conservative — three would miss
 *  fast-firing wedges; one would false-positive on intentional reruns. */
const SUSPECTED_THRESHOLD = 2

/** Drop tracking older than this — keeps the map bounded across long-
 *  running MCP processes. */
const STALE_AGE_MS = 60 * 60 * 1000 // 1h

function pruneStale(): void {
	if (tickHistory.size < 100) return
	const now = Date.now()
	for (const [slug, entry] of tickHistory) {
		if (now - new Date(entry.first_seen).getTime() > STALE_AGE_MS) {
			tickHistory.delete(slug)
		}
	}
}

/**
 * Build a comparable signature from an OrchestratorAction. The fields
 * captured here are the load-bearing identifiers — action kind, target
 * stage/unit/feedback/role. Message text, timestamps, and payload
 * extras vary tick-to-tick and would defeat the comparison.
 */
export function actionSignatureForDeadlock(
	action: Record<string, unknown> | null | undefined,
): string {
	if (!action) return "null"
	return JSON.stringify({
		action: action.action ?? null,
		stage: action.stage ?? null,
		unit: action.unit ?? null,
		feedback_id: action.feedback_id ?? null,
		role: action.role ?? null,
		hat: action.hat ?? null,
	})
}

/**
 * Record a tick result for an intent. Emits
 * `haiku.deadlock.suspected` telemetry when the same action signature
 * repeats SUSPECTED_THRESHOLD or more times in a row.
 *
 * Safe to call from any haiku_run_next exit point. Idempotent on the
 * same signature — only the FIRST crossing of the threshold emits
 * telemetry (subsequent repeats stay silent). This prevents log spam
 * when a wedge sits for minutes.
 */
export function recordTickResult(
	slug: string,
	action: Record<string, unknown> | null | undefined,
): void {
	const signature = actionSignatureForDeadlock(action)
	const now = new Date().toISOString()
	const prev = tickHistory.get(slug)

	if (prev && prev.signature === signature) {
		const newCount = prev.count + 1
		tickHistory.set(slug, {
			signature,
			count: newCount,
			first_seen: prev.first_seen,
		})
		// Emit only on the first crossing — once detected, the wedge
		// is in dashboards; repeat emits add noise without information.
		if (newCount === SUSPECTED_THRESHOLD) {
			emitTelemetry("haiku.deadlock.suspected", {
				intent: slug,
				signature,
				consecutive_ticks: String(newCount),
				first_seen: prev.first_seen,
			})
		}
	} else {
		tickHistory.set(slug, { signature, count: 1, first_seen: now })
	}

	pruneStale()
}

/** Test-only: reset detector state between test runs. */
export function __resetDeadlockDetector(): void {
	tickHistory.clear()
}

/** Test-only: peek at the recorded history for an intent. */
export function __getTickHistoryForTests(
	slug: string,
): { signature: string; count: number; first_seen: string } | null {
	return tickHistory.get(slug) ?? null
}
