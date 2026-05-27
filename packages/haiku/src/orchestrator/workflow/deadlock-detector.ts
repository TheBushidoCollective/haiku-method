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
// State is per-slug, held in-memory and backed by a per-intent file
// under `~/.haiku/projects/<key>/intents/<slug>/.deadlock-history.json`
// (NOT the git-tracked project `.haiku/`). The on-disk backing is
// load-through: a cold process (after an MCP restart) rehydrates the
// last entry so a no-op loop that spans a reconnect keeps accumulating
// toward the halt instead of resetting to zero on every restart — the
// FB-011/012/013 stall survived precisely because reconnects during
// debugging wiped the in-memory count. Staleness is keyed on the
// entry's last-update time (`updated_at`): an actively-ticked loop
// stays live; a walked-away session older than STALE_AGE_MS is treated
// as fresh on return, so a rapid reconnect-loop accumulates but a
// next-day session never inherits a stale halt.
//
// What this does NOT do:
//   - Halt the workflow. The detector only emits telemetry. The
//     existing loop guard handles hard halts.
//   - Replace the agent's recovery path. If a wedge is detected, the
//     user / agent still has to investigate. The signal is meant for
//     dashboards (Sentry/OTel), not for engine logic.

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { intentRuntimeStatePath } from "../../subagent-prompt-file.js"
import { emitTelemetry } from "../../telemetry.js"

interface TickEntry {
	signature: string
	count: number
	first_seen: string
	/** Last time this entry was written. Drives staleness on rehydrate —
	 *  an entry not touched within STALE_AGE_MS is treated as fresh, so a
	 *  next-day session never inherits a stale halt while a rapid
	 *  reconnect-loop keeps accumulating. */
	updated_at: string
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

/** Slugs whose on-disk history file has been written this process —
 *  lets `__resetDeadlockDetector` clean disk too, for test isolation. */
const persistedSlugs = new Set<string>()

const HISTORY_FILENAME = ".deadlock-history.json"

/** Load the entry for a slug: memory first, else rehydrate from the
 *  per-intent file (after an MCP restart). Stale entries (not updated
 *  within STALE_AGE_MS) are discarded so a returning session starts
 *  clean. */
function loadEntry(slug: string): TickEntry | undefined {
	const mem = tickHistory.get(slug)
	if (mem) return mem
	try {
		const p = intentRuntimeStatePath(slug, HISTORY_FILENAME)
		if (!existsSync(p)) return undefined
		const raw = JSON.parse(readFileSync(p, "utf8")) as TickEntry
		const stamp = raw.updated_at ?? raw.first_seen
		if (!stamp || Date.now() - new Date(stamp).getTime() > STALE_AGE_MS) {
			return undefined
		}
		tickHistory.set(slug, raw)
		return raw
	} catch {
		return undefined
	}
}

/** Persist the entry: memory + per-intent file. Best-effort on the
 *  write — a failed persist degrades to in-memory-only, never throws
 *  into the tick. */
function saveEntry(slug: string, entry: TickEntry): void {
	tickHistory.set(slug, entry)
	try {
		writeFileSync(
			intentRuntimeStatePath(slug, HISTORY_FILENAME),
			JSON.stringify(entry),
			"utf8",
		)
		persistedSlugs.add(slug)
	} catch {
		/* in-memory-only fallback */
	}
}

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
	// Batch dispatches carry their items in `dispatches[]`
	// (start_feedback_hat: {feedback_id, hat}) or `units[]`
	// (start_unit_hat) — NOT in the top-level feedback_id/unit fields. If
	// the signature ignores the batch contents, every start_feedback_hat
	// tick looks identical: a healthy fix loop that advances different
	// FBs each tick would false-halt after HALT_THRESHOLD, and a genuine
	// no-op loop on one stuck batch couldn't be told apart from progress.
	// Fold the per-item identity in (sorted, so item order can't make an
	// equivalent batch look different). A stable stuck batch → stable
	// signature → halts; an evolving batch (items progressing) → changing
	// signature → no false halt.
	const dispatches = action.dispatches
	const fbBatch = Array.isArray(dispatches)
		? dispatches
				.map((d) => {
					const o = (d ?? {}) as Record<string, unknown>
					return `${o.feedback_id ?? ""}:${o.hat ?? ""}`
				})
				.sort()
				.join(",")
		: null
	const units = action.units
	const unitBatch = Array.isArray(units)
		? [...(units as unknown[])]
				.map((u) => String(u))
				.sort()
				.join(",")
		: null
	// `elaborate_loop` is the same multi-item shape as the batch dispatches
	// above, just on a different field: ONE action kind whose payload lists
	// every currently-unmet completion signal in `signals_unmet[]`
	// (conversation, verify_conversation, discovery:<agent>, decompose,
	// verify_decompose). The agent clears them one-per-tick — each verifier
	// signal needs its own subagent dispatch tick — so a perfectly healthy
	// elaborate phase emits `elaborate_loop`/<stage> on 4+ consecutive ticks,
	// each making real on-disk progress (elaboration.md, verified_at, units,
	// decompose_verified_at) but resolving a DIFFERENT signal. If the
	// signature ignores the unmet-signal set, all those ticks collapse to one
	// value and the no-progress halt fires on the 4th tick, BEFORE the last
	// signal can clear (admin-portal-reimagine, security stage, 2026-05-22).
	// Fold the unmet-signal set in (sorted, stable): an evolving set →
	// changing signature → counter resets, no false halt; a genuinely stuck
	// signal (a verifier that won't sign, the same set every tick) → stable
	// signature → halts correctly. Same contract as fb_batch/unit_batch.
	const signals = action.signals_unmet
	const signalSet = Array.isArray(signals)
		? signals
				.map((s) => {
					const o = (s ?? {}) as Record<string, unknown>
					return o.agent ? `${o.signal ?? ""}:${o.agent}` : `${o.signal ?? ""}`
				})
				.sort()
				.join(",")
		: null
	return JSON.stringify({
		action: action.action ?? null,
		stage: action.stage ?? null,
		unit: action.unit ?? null,
		feedback_id: action.feedback_id ?? null,
		role: action.role ?? null,
		hat: action.hat ?? null,
		fb_batch: fbBatch,
		unit_batch: unitBatch,
		signals: signalSet,
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
	// Wait-for-human / block-on-external actions are NOT engine
	// progression. By design they re-emit the IDENTICAL signature every
	// tick while idle, until the human (or external event) acts. They are
	// already exempt from being the halt TARGET in `wouldDeadlock`, but
	// they must ALSO stay out of the progression history entirely — a
	// human-wait is not a tick of work, so it can neither advance the
	// consecutive counter nor enter the churn `recent[]` window.
	//
	// Skipping the count is obvious; skipping the window is the
	// load-bearing half. If a window fills with `user_gate` waits and is
	// then followed by a single genuine progress action, the churn
	// detector reads `[user_gate ×7, progress]` as a 2-distinct A↔B wedge
	// and false-halts the LEGITIMATE progress action — even though
	// `wouldDeadlock` correctly never halted any of the `user_gate` ticks
	// themselves. (worker-new-badge, 2026-05-27: the user re-ran
	// /haiku:haiku-pickup at a parked development-stage gate ~9× across
	// session restarts; the persisted `recent[]` filled with `user_gate`,
	// the next tick resolved `start_unit_hat`, and `wouldDeadlock` swapped
	// it for `loop_halted`/churn. The gate that was asking the user to act
	// got masked by the halt.) The detector tracks ENGINE wedges; an idle
	// human-wait is not one, so it is a complete no-op here.
	if (actionWaitsOnExternalInput(action)) return
	const signature = actionSignatureForDeadlock(action)
	const now = new Date().toISOString()
	const prev = loadEntry(slug)

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
			updated_at: now,
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
			updated_at: now,
			recent,
			churn_fired: isInWindow ? prev.churn_fired : false,
		}

		// Churn detection: take the LAST CHURN_MIN_TICKS entries from
		// recent (minus any wait-for-human signatures a legacy window may
		// hold — same filter the halt check uses). If they cycle through
		// ≤ CHURN_MAX_DISTINCT signatures, it's an alternating wedge.
		const progression = progressionSignatures(recent)
		if (!entry.churn_fired && progression.length >= CHURN_MIN_TICKS) {
			const tail = progression.slice(-CHURN_MIN_TICKS)
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
			updated_at: now,
			recent: isHaltMarker ? [] : [signature],
			churn_fired: false,
		}
	}

	saveEntry(slug, entry)
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
/** Cursor actions that BLOCK on a human (or an external event/system)
 *  rather than on the engine making on-disk progress. They are expected
 *  to re-emit the identical signature tick-after-tick until the human
 *  acts — so they're exempt from the no-progress / churn halt. A wedged
 *  human gate is recovered by the SPA-presence watch (await fail-fast),
 *  by the user acting, or by /haiku:haiku-repair — never by the engine
 *  yanking the workflow into `loop_halted`. */
const EXTERNAL_INPUT_ACTIONS = new Set<string>([
	"user_gate", // per-stage + intent-completion human review gate
	"feedback_question", // surfaces a discovery question, waits for the answer
	"select_studio", // pre-cursor human pickers (also inline-intercepted)
	"select_mode",
	"select_stage",
	// NOTE: external-review, design-direction, and visual-answer waits are NOT
	// listed. Those block INLINE inside their MCP tools (`haiku_await_gate`,
	// `pick_design_direction`, `ask_user_visual_question`) — the cursor never
	// surfaces them as a `haiku_run_next` action kind, so the no-progress
	// detector (which reads `action.action`) never sees them. The old
	// `"await_gate"` / `"await_design_direction"` / `"await_visual_answer"`
	// entries were MCP tool names, not action kinds — dead, never matched.
])

function actionWaitsOnExternalInput(
	action: Record<string, unknown> | null | undefined,
): boolean {
	if (!action || typeof action !== "object") return false
	const kind = (action as Record<string, unknown>).action
	if (typeof kind !== "string") return false
	if (EXTERNAL_INPUT_ACTIONS.has(kind)) return true
	// The intent-completion HUMAN gate rides `intent_review` with role
	// "user" (the engine reviewers are `spec`/`continuity`/… and DO make
	// progress; only the terminal user role waits on the human).
	if (
		kind === "intent_review" &&
		(action as Record<string, unknown>).role === "user"
	) {
		return true
	}
	return false
}

/** A signature string (as stored in `recent[]`) is a wait-for-human /
 *  block-on-external marker. Used to keep those signatures out of the
 *  churn computation even when they already sit in a persisted window —
 *  e.g. a pre-fix `.deadlock-history.json` whose window filled with
 *  `user_gate` before `recordTickResult` exempted them. The signature is
 *  the JSON produced by `actionSignatureForDeadlock`, so parse it back
 *  and reuse the same predicate. */
function signatureWaitsOnExternalInput(signature: string): boolean {
	try {
		return actionWaitsOnExternalInput(
			JSON.parse(signature) as Record<string, unknown>,
		)
	} catch {
		return false
	}
}

/** Drop wait-for-human signatures from a window before any churn test.
 *  Churn is an ENGINE wedge (the same workflow actions cycling with no
 *  on-disk progress); idle human-waits interleaved in the window are not
 *  part of a wedge and must not count toward distinct-signature cycling.
 *  Going forward these never enter the window (`recordTickResult` exempts
 *  them); this also HEALS a legacy window persisted before that exemption
 *  shipped — the next genuine progress action sees a clean progression
 *  history and is not false-halted. */
function progressionSignatures(window: string[]): string[] {
	return window.filter((s) => !signatureWaitsOnExternalInput(s))
}

export function wouldDeadlock(
	slug: string,
	action: Record<string, unknown> | null | undefined,
):
	| { kind: "repeat"; count: number; signature: string }
	| { kind: "churn"; distinct: number; window: number }
	| null {
	// Human / external-input gates legitimately re-emit the SAME action
	// across ticks while they WAIT for the user (or an external event) to
	// act — that is the gate working, not a wedge. They must never trip
	// the no-progress halt, or a user who's slow to open the review SPA
	// (or whose SPA was slow to connect) gets the workflow forcibly halted
	// out from under them with no way to advance. (2026-05-26 CRITICAL: a
	// `user_gate` halted after 4 ticks because the reviewer hadn't yet
	// approved — leaving the intent unadvanceable.) Liveness of the gate's
	// SPA is handled separately by the never-attached watch in
	// `awaitGateReviewSession`; THIS detector only guards ENGINE wedges (a
	// fix-hat that doesn't change disk, a verifier that won't sign).
	if (actionWaitsOnExternalInput(action)) return null
	const signature = actionSignatureForDeadlock(action)
	const prev = loadEntry(slug)
	if (!prev) return null
	// Repeat-halt check: the next tick would make this the (count + 1)-th
	// consecutive identical signature.
	if (prev.signature === signature && prev.count + 1 >= HALT_THRESHOLD) {
		return { kind: "repeat", count: prev.count + 1, signature }
	}
	// Churn-halt check: simulate appending the new signature to the
	// window, drop any wait-for-human signatures (they're not part of an
	// engine wedge — and a legacy persisted window may still hold them),
	// then see if the resulting tail of the last CHURN_HALT_MIN_TICKS
	// signatures cycles through ≤ 2 distinct values.
	const projected = progressionSignatures(
		[...prev.recent, signature].slice(-CHURN_WINDOW),
	)
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
 *  concrete next-step (file an FB or invoke /haiku:haiku-repair).
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
	// An `elaborate_loop` halt is almost never a downstream wedge — it means
	// the AGENT re-ticked without drafting unit specs / dispatching discovery,
	// so the unmet signal never cleared. The escape is to DO THE ELABORATE
	// WORK, not to surface a "wedge" to the user (which on autopilot is also a
	// false pause). Point the agent straight at the real recovery.
	const isElaborate =
		verdict.kind === "repeat" &&
		verdict.signature.includes('"action":"elaborate_loop"')
	const message = isElaborate
		? `**Loop halted — the elaborate loop isn't advancing.** ${detail}\n\n` +
			`This is NOT a downstream wedge: the elaborate loop's unmet signal clears only when you change disk state, and re-ticking changed nothing. You re-ran \`haiku_run_next\` without doing the elaborate work.\n\n` +
			`**What to do — do the work, don't re-tick:**\n` +
			`1. **Draft the stage's unit specs now** with \`haiku_unit_write\` (and dispatch any required discovery subagents). If the stage's scope is unclear, read its \`STAGE.md\` + \`phases/ELABORATION.md\` and draft from the intent's goals.\n` +
			`2. THEN call \`haiku_run_next\` — with units on disk the \`decompose\` signal flips and the loop advances.\n` +
			`3. In autopilot: do this autonomously. Do NOT surface the halt to the user — drafting the units IS the recovery, and there is no one to answer.`
		: `**Loop halted.** ${detail}\n\n` +
			`The cursor was about to return the same action again. Repeating it would not produce progress — something downstream of the cursor (a fix-hat that doesn't change disk, a verifier that won't sign, a witness that won't refresh) is wedged. The engine is refusing to let the agent burn more ticks.\n\n` +
			`**What to do:**\n` +
			`1. Surface this halt to the user. Don't auto-recover.\n` +
			`2. Identify what the cursor was waiting for (read the signature above).\n` +
			`3. Either fix the underlying state (commit the missing artifact, sign the verifier, run \`/haiku:haiku-repair\`) or file a feedback explaining why the loop happened.\n` +
			`4. Once the underlying state has changed, the next \`haiku_run_next\` tick will surface a different action and the loop guard will reset.`
	return {
		action: "loop_halted",
		intent: slug,
		message,
		loop: verdict.kind,
	}
}

/** Test-only: seed the in-memory entry for a slug, standing in for a
 *  rehydrated-from-disk history — e.g. a pre-fix `.deadlock-history.json`
 *  whose `recent[]` window filled with `user_gate` signatures before they
 *  were exempted. `loadEntry` reads the in-memory map first, so both
 *  `wouldDeadlock` and `recordTickResult` see this entry. */
export function __seedEntryForTests(slug: string, entry: TickEntry): void {
	tickHistory.set(slug, entry)
}

/** Test-only: reset detector state between test runs. Clears both the
 *  in-memory map and any per-intent files this process persisted, so a
 *  reused slug in a later test doesn't rehydrate a stale entry. */
export function __resetDeadlockDetector(): void {
	tickHistory.clear()
	for (const slug of persistedSlugs) {
		try {
			rmSync(intentRuntimeStatePath(slug, HISTORY_FILENAME), { force: true })
		} catch {
			/* ignore */
		}
	}
	persistedSlugs.clear()
}

/** Test-only: simulate an MCP restart — drop the in-memory map but
 *  leave the on-disk history intact, so the next access rehydrates from
 *  disk (the reconnect-survives-the-loop path). */
export function __simulateRestartForTests(): void {
	tickHistory.clear()
}

/** Test-only: peek at the recorded history for an intent. Goes through
 *  the load path so a rehydrate-from-disk assertion works after a
 *  simulated restart (in-memory map cleared, file intact). */
export function __getTickHistoryForTests(slug: string): {
	signature: string
	count: number
	first_seen: string
	updated_at?: string
	recent: string[]
	churn_fired: boolean
} | null {
	return loadEntry(slug) ?? null
}
