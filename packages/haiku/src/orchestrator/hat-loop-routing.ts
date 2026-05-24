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

export interface RejectTarget {
	/** The hat the loop bounces to — re-dispatched on the next bolt. */
	targetHat: string
	/** Index of the rejecting (calling) hat within `hatSequence`; -1 if the
	 *  hat isn't in the sequence. */
	callingIdx: number
}

/** Resolve which hat a reject bounces to. `callingHat` is the hat doing the
 *  rejecting (each track derives it from its own storage). */
export function resolveRejectTarget(
	hatSequence: string[],
	callingHat: string,
	opts?: { assessorToFirst?: boolean; assessorHat?: string },
): RejectTarget {
	const callingIdx = hatSequence.indexOf(callingHat)
	// Unit-track special case: a feedback-assessor rejection bolts to the
	// FIRST hat — the assessor verifies the work itself, not the prior
	// reviewer's judgment, so the fix needs fresh output, not a re-review.
	if (
		opts?.assessorToFirst &&
		opts.assessorHat &&
		callingHat === opts.assessorHat
	) {
		return { targetHat: hatSequence[0] ?? callingHat, callingIdx }
	}
	// Otherwise step back one hat. If the rejecter is already first, the same
	// hat retries (hatSequence[0] === callingHat when callingIdx === 0).
	const targetHat =
		callingIdx > 0
			? hatSequence[callingIdx - 1]
			: (hatSequence[0] ?? callingHat)
	return { targetHat, callingIdx }
}
