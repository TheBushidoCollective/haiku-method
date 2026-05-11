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
	/** Recent signatures observed for this intent. Used for the
	 *  alternating-wedge (churn) detector below. Bounded to
	 *  `CHURN_WINDOW`. */
	recent: string[]
	/** True if the churn detector has already fired for this run of
	 *  alternating signatures. Reset when a brand-new signature
	 *  enters the window. */
	churn_fired: boolean
}

const tickHistory: Map<string, TickEntry> = new Map()

/** Threshold for "this looks wedged." Two repeats means the agent
 *  invoked run_next, got an action, dispatched it (or tried to),
 *  invoked run_next again, and got the EXACT same action back. That's
 *  load-bearing: a no-op tick where the dispatched action didn't
 *  produce on-disk progress. Conservative — three would miss
 *  fast-firing wedges; one would false-positive on intentional reruns. */
const SUSPECTED_THRESHOLD = 2

/** Size of the recent-signature window for the churn detector. A
 *  classic A→B→A→B wedge needs 4 ticks to surface; 6 gives some
 *  headroom for slightly noisier patterns. */
const CHURN_WINDOW = 6

/** Minimum number of recent ticks that must alternate before we call
 *  it churn. Below this, the signature variety is just normal cursor
 *  progression. */
const CHURN_MIN_TICKS = 4

/** A churn pattern is: the LAST `CHURN_MIN_TICKS` signatures cycle
 *  through ≤ `CHURN_MAX_DISTINCT` distinct values. 2 catches the
 *  classic A/B alternation; 3 would catch A/B/C cycles too but
 *  raises the false-positive risk. */
const CHURN_MAX_DISTINCT = 2

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

	let entry: TickEntry
	if (prev && prev.signature === signature) {
		const newCount = prev.count + 1
		const recent = [...prev.recent, signature].slice(-CHURN_WINDOW)
		entry = {
			signature,
			count: newCount,
			first_seen: prev.first_seen,
			recent,
			// Once the chain of identical signatures continues, the
			// churn-fired flag carries forward — repeat A→A→A doesn't
			// also count as A↔B churn.
			churn_fired: prev.churn_fired,
		}
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
	} else if (prev) {
		// Signature changed. Carry the recent-window forward and reset
		// the consecutive counter. A NEW signature entering the window
		// also resets the churn-fired latch — we want fresh detection
		// when the alternation pattern restarts.
		const recent = [...prev.recent, signature].slice(-CHURN_WINDOW)
		const isInWindow = prev.recent.includes(signature)
		entry = {
			signature,
			count: 1,
			first_seen: prev.first_seen,
			recent,
			churn_fired: isInWindow ? prev.churn_fired : false,
		}

		// Churn detection: take the LAST CHURN_MIN_TICKS entries from
		// recent. If they cycle through ≤ CHURN_MAX_DISTINCT signatures,
		// it's an alternating wedge.
		if (!entry.churn_fired && recent.length >= CHURN_MIN_TICKS) {
			const tail = recent.slice(-CHURN_MIN_TICKS)
			const distinct = new Set(tail)
			if (distinct.size <= CHURN_MAX_DISTINCT && distinct.size > 1) {
				emitTelemetry("haiku.deadlock.churn_suspected", {
					intent: slug,
					recent_signatures: tail.join(" | "),
					distinct_count: String(distinct.size),
					window_size: String(tail.length),
					first_seen: prev.first_seen,
				})
				entry.churn_fired = true
			}
		}
	} else {
		entry = {
			signature,
			count: 1,
			first_seen: now,
			recent: [signature],
			churn_fired: false,
		}
	}

	tickHistory.set(slug, entry)
	pruneStale()
}

/** Test-only: reset detector state between test runs. */
export function __resetDeadlockDetector(): void {
	tickHistory.clear()
}

/** Test-only: peek at the recorded history for an intent. */
export function __getTickHistoryForTests(slug: string): {
	signature: string
	count: number
	first_seen: string
	recent: string[]
	churn_fired: boolean
} | null {
	return tickHistory.get(slug) ?? null
}
