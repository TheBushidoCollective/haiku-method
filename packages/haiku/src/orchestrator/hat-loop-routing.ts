// orchestrator/hat-loop-routing.ts — Shared reject-target resolution for
// the unified hat-loop engine.
//
// When a hat rejects, the loop bounces to a PRIOR hat. The unit hat loop
// and the feedback fix-loop computed this identically — "step back one from
// the rejecting hat, or retry the same hat if it's already first" — but
// through divergent storage (unit: the rejecting hat derived from
// `iterations[]`; feedback: derived from the scalar `hat` field + 1). The
// DECISION is the same; only how each track names `callingHat` differs.
// Extracting it here means the Phase-2 role-aware routing (skip verify hats,
// honor a named rewind target) lands ONCE for both tracks instead of being
// hand-mirrored across two handler blocks that silently drift.
//
// Behavior-preserving extraction: reproduces today's "step-back-one" plus
// the unit-track `feedback-assessor → first hat` special case. The assessor
// hat name is passed in as data (not imported) so this stays a dependency-
// free leaf — no import cycle with state-tools. Guarded by
// hat-reject-backward-relay.test.mjs (both tracks).

export type HatRole = "plan" | "build" | "verify"

export interface RejectTarget {
	/** The hat the loop bounces to — re-dispatched on the next bolt. */
	targetHat: string
	/** Index of the rejecting (calling) hat within `hatSequence`; -1 if the
	 *  hat isn't in the sequence. */
	callingIdx: number
	/** How the target was chosen — for telemetry / the relay note. */
	via: "assessor-to-first" | "named-target" | "nearest-build" | "step-back-one"
}

export interface ResolveRejectOpts {
	/** Unit-track: a feedback-assessor reject bolts to the first hat. */
	assessorToFirst?: boolean
	/** The feedback-assessor hat name (passed as data to keep this a
	 *  dependency-free leaf — no import cycle with state-tools). */
	assessorHat?: string
	/** Loop role of a hat, when the stage declares `role:` markers. When
	 *  absent/undefined for every hat, routing degrades to step-back-one. */
	roleOf?: (hat: string) => HatRole | undefined
	/** A caller-named rewind target (e.g. a verifier flagging a PLAN defect
	 *  routes to the planner, not the builder). Honored only if it's a real
	 *  prior hat that can act (not a `verify` hat). */
	namedTarget?: string
}

/** Resolve which hat a reject bounces to. `callingHat` is the hat doing the
 *  rejecting (each track derives it from its own storage).
 *
 *  Routing precedence:
 *    1. assessor-to-first (unit special case)
 *    2. a valid named target (prior, non-verify hat)
 *    3. role-aware: nearest preceding `build` hat (skip `verify` hats — they
 *       judge, they can't fix; bouncing to them burns bolts to the cap)
 *    4. step-back-one (legacy; also the fallback when no roles are declared
 *       or no build hat precedes the rejecter)
 */
export function resolveRejectTarget(
	hatSequence: string[],
	callingHat: string,
	opts?: ResolveRejectOpts,
): RejectTarget {
	const callingIdx = hatSequence.indexOf(callingHat)

	// (1) Unit-track special case: a feedback-assessor rejection bolts to the
	// FIRST hat — the assessor verifies the work itself, not the prior
	// reviewer's judgment, so the fix needs fresh output, not a re-review.
	if (
		opts?.assessorToFirst &&
		opts.assessorHat &&
		callingHat === opts.assessorHat
	) {
		return {
			targetHat: hatSequence[0] ?? callingHat,
			callingIdx,
			via: "assessor-to-first",
		}
	}

	const roleOf = opts?.roleOf

	// (2) Named target: honor an explicit rewind target IF it's a real prior
	// hat that can ACT. A verify hat is never a valid target (it can only
	// judge), so reject a named verifier and fall through.
	if (opts?.namedTarget) {
		const ti = hatSequence.indexOf(opts.namedTarget)
		if (ti >= 0 && ti < callingIdx && roleOf?.(opts.namedTarget) !== "verify") {
			return { targetHat: opts.namedTarget, callingIdx, via: "named-target" }
		}
	}

	// (3) Role-aware: a reject must reach a hat that can ACT. Step back to the
	// nearest BUILD hat, skipping intervening verify hats. This is the fix for
	// stages with multiple verify hats in a row, where step-back-one would
	// bounce verifier→verifier (neither can fix) and burn bolts to the cap.
	if (roleOf) {
		for (let i = callingIdx - 1; i >= 0; i--) {
			if (roleOf(hatSequence[i]) === "build") {
				return { targetHat: hatSequence[i], callingIdx, via: "nearest-build" }
			}
		}
		// No build hat precedes the rejecter (e.g. the rejecter IS the builder,
		// or a knowledge-only stage) — fall through to step-back-one.
	}

	// (4) Step back one hat. If the rejecter is already first, the same hat
	// retries (hatSequence[0] === callingHat when callingIdx === 0).
	const targetHat =
		callingIdx > 0
			? hatSequence[callingIdx - 1]
			: (hatSequence[0] ?? callingHat)
	return { targetHat, callingIdx, via: "step-back-one" }
}
