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
 *  classic A→B→A→B wedge needs 4 ticks to surface (the suspected
 *  churn-telemetry signal); the halt threshold needs 8, so the
 *  window has to hold at least 8. Set to 10 for headroom — handles
 *  slightly noisier patterns without dropping older entries. */
const CHURN_WINDOW = 10

/** Minimum number of recent ticks that must alternate before we call
 *  it churn. Below this, the signature variety is just normal cursor
 *  progression. */
const CHURN_MIN_TICKS = 4

/** A churn pattern is: the LAST `CHURN_MIN_TICKS` signatures cycle
 *  through ≤ `CHURN_MAX_DISTINCT` distinct values. 2 catches the
 *  classic A/B alternation; 3 would catch A/B/C cycles too but
 *  raises the false-positive risk. */
const CHURN_MAX_DISTINCT = 2

/** Hard halt threshold. After this many consecutive identical
 *  signatures (i.e. the SAME action emitted and re-dispatched and re-
 *  emitted with no on-disk progress in between), the next tick HALTS
 *  with a `loop_halted` action instead of returning the same payload
 *  yet again. The agent gets a clear directive to stop re-ticking and
 *  surface the loop to the user.
 *
 *  Set higher than `SUSPECTED_THRESHOLD`: telemetry fires at the first
 *  suspicion (2 ticks) so dashboards see early signal; the hard halt
 *  only fires after the wedge has continued past that signal (4 ticks
 *  total). The gap is intentional — operators who instrument the
 *  telemetry can intervene before the engine forcibly halts.
 *
 *  Per goal "ensure nothing in our engine can put us in an infinite
 *  loop": this is the architectural floor. Even if every other
 *  protection misses (drift dedup, bolt cap, migration idempotency),
 *  the same action cannot be returned MORE than `HALT_THRESHOLD`
 *  consecutive times. */
const HALT_THRESHOLD = 4

/** Same idea for the churn (alternating-signatures) wedge. 8 ticks of
 *  A↔B alternation = 4 round-trips that produced no on-disk progress.
 *  Halt instead of letting the agent burn another tick. */
const CHURN_HALT_MIN_TICKS = 8

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

	// Per claude-bot review on PR #367: when the engine has just SWAPPED
	// the cursor's action for `loop_halted`, we still want to track that
	// a halt fired (count + signature update + telemetry), but we must
	// NOT append `loop_halted` to the `recent` window. The window
	// represents real workflow-action progression for the churn check;
	// dropping a meta-halt marker into it would add a 3rd distinct value
	// and silently disable churn detection for the next CHURN_WINDOW
	// ticks (the alternating wedge would resume unchecked until
	// `loop_halted` scrolled off).
	const isHaltMarker =
		typeof action === "object" &&
		action !== null &&
		(action as Record<string, unknown>).action === "loop_halted"

	let entry: TickEntry
	if (prev && prev.signature === signature) {
		const newCount = prev.count + 1
		const recent = isHaltMarker
			? prev.recent
			: [...prev.recent, signature].slice(-CHURN_WINDOW)
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
		// when the alternation pattern restarts. Same `loop_halted`
		// exemption as above: don't pollute the window with the meta
		// marker.
		const recent = isHaltMarker
			? prev.recent
			: [...prev.recent, signature].slice(-CHURN_WINDOW)
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
		// Fresh history. If the very first record is somehow a halt
		// marker (defensive — shouldn't happen in practice since the
		// detector only halts after seeing a prior chain), still keep
		// the recent window empty rather than seeding it with the
		// marker.
		entry = {
			signature,
			count: 1,
			first_seen: now,
			recent: isHaltMarker ? [] : [signature],
			churn_fired: false,
		}
	}

	tickHistory.set(slug, entry)
	pruneStale()
}

/** Inspect the prospective NEXT tick result for an intent and decide
 *  whether the engine should HALT instead of returning the action.
 *
 *  Returns:
 *    - `null` — no halt; the caller proceeds with the action.
 *    - `{ kind: "repeat", count }` — the same signature has fired
 *      `count` times in a row (≥ HALT_THRESHOLD). The engine MUST
 *      replace the action with a halt directive.
 *    - `{ kind: "churn", distinct, window }` — the recent window
 *      cycles through ≤ CHURN_MAX_DISTINCT signatures over
 *      ≥ CHURN_HALT_MIN_TICKS ticks. Same: engine MUST halt.
 *
 *  This is a PRE-emit check that runs before `recordTickResult`. The
 *  caller passes the action it's ABOUT to return; if `wouldDeadlock`
 *  fires, the caller swaps in the halt action and records THAT instead.
 *  Per goal "ensure nothing in our engine can put us in an infinite
 *  loop" (2026-05-15): the engine can detect AND stop. */
export function wouldDeadlock(
	slug: string,
	action: Record<string, unknown> | null | undefined,
):
	| { kind: "repeat"; count: number; signature: string }
	| { kind: "churn"; distinct: number; window: number }
	| null {
	const signature = actionSignatureForDeadlock(action)
	const prev = tickHistory.get(slug)
	if (!prev) return null
	// Repeat-halt check: the next tick would make this the (count + 1)-th
	// consecutive identical signature.
	if (prev.signature === signature && prev.count + 1 >= HALT_THRESHOLD) {
		return { kind: "repeat", count: prev.count + 1, signature }
	}
	// Churn-halt check: simulate appending the new signature to the
	// window, then see if the resulting tail of the last
	// CHURN_HALT_MIN_TICKS signatures cycles through ≤ 2 distinct values.
	const projected = [...prev.recent, signature].slice(-CHURN_WINDOW)
	if (projected.length >= CHURN_HALT_MIN_TICKS) {
		const tail = projected.slice(-CHURN_HALT_MIN_TICKS)
		const distinct = new Set(tail)
		if (distinct.size <= CHURN_MAX_DISTINCT && distinct.size > 1) {
			return { kind: "churn", distinct: distinct.size, window: tail.length }
		}
	}
	return null
}

/** Build the halt-action returned in place of the looping action. The
 *  agent reads `action: "loop_halted"` and is expected to STOP
 *  re-ticking — surface the halt to the user, do not auto-recover. The
 *  message names the loop kind, the offending signature, and a
 *  concrete next-step (file an FB or invoke /haiku:repair).
 *
 *  Also fires `haiku.deadlock.halted` telemetry — the engine's hard-
 *  halt counterpart to the existing `haiku.deadlock.suspected` /
 *  `churn_suspected` advisory signals. Operators see (a) early
 *  suspicion, (b) the eventual hard halt; both flow to the OTLP /
 *  Sentry sink via `emitTelemetry`. */
export function buildLoopHaltAction(
	slug: string,
	verdict: NonNullable<ReturnType<typeof wouldDeadlock>>,
): { action: "loop_halted"; intent: string; message: string; loop: string } {
	emitTelemetry("haiku.deadlock.halted", {
		intent: slug,
		loop: verdict.kind,
		...(verdict.kind === "repeat"
			? {
					signature: verdict.signature,
					consecutive_ticks: String(verdict.count),
				}
			: {
					distinct: String(verdict.distinct),
					window: String(verdict.window),
				}),
	})
	const detail =
		verdict.kind === "repeat"
			? `The engine emitted the SAME action signature ${verdict.count} consecutive times for intent '${slug}' with no on-disk progress between ticks. Signature: ${verdict.signature}.`
			: `The engine cycled through ${verdict.distinct} alternating action signatures across ${verdict.window} consecutive ticks for intent '${slug}'. The classic A↔B churn wedge.`
	const message =
		`**Loop halted.** ${detail}\n\n` +
		`The cursor was about to return the same action again. Repeating it would not produce progress — something downstream of the cursor (a fix-hat that doesn't change disk, a verifier that won't sign, a witness that won't refresh) is wedged. The engine is refusing to let the agent burn more ticks.\n\n` +
		`**What to do:**\n` +
		`1. Surface this halt to the user. Don't auto-recover.\n` +
		`2. Identify what the cursor was waiting for (read the signature above).\n` +
		`3. Either fix the underlying state (commit the missing artifact, sign the verifier, run \`/haiku:repair\`) or file a feedback explaining why the loop happened.\n` +
		`4. Once the underlying state has changed, the next \`haiku_run_next\` tick will surface a different action and the loop guard will reset.`
	return {
		action: "loop_halted",
		intent: slug,
		message,
		loop: verdict.kind,
	}
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
