// test/_elaborate-loop-helpers.mjs — Shared helpers for the
// post-Option-A elaborate-loop action shape (GAPS § 1a, 2026-05-14).
//
// The cursor used to emit one of five distinct action kinds per
// elaborate-loop tick (`elaborate`, `elaborate_review`, `decompose`,
// `decompose_review`, `discovery_required`). Option A collapsed them
// into a single `elaborate_loop` action whose `signals_unmet[]`
// enumerates the unmet signals. Tests express the same assertions
// through these helpers so the migration is uniform across files.

import assert from "node:assert"

/**
 * Return the elaborate-loop signal entry for a given signal name, or
 * undefined when absent. Use the `assertLoopSignal` helper when you
 * need to assert the signal is present.
 */
export function pickLoopSignal(action, signal) {
	if (!action || action.action !== "elaborate_loop") return undefined
	const signals = action.signals_unmet ?? []
	return signals.find((s) => s.signal === signal)
}

/** Assert the action is an `elaborate_loop` carrying the named signal. */
export function assertLoopSignal(action, signal, msgPrefix = "") {
	assert.strictEqual(
		action?.action,
		"elaborate_loop",
		`${msgPrefix}expected action.action === "elaborate_loop"; got ${JSON.stringify(
			action,
		)}`,
	)
	const entry = pickLoopSignal(action, signal)
	assert.ok(
		entry !== undefined,
		`${msgPrefix}expected signals_unmet to include \`${signal}\`; got ${JSON.stringify(
			action?.signals_unmet,
		)}`,
	)
	return entry
}

/**
 * Assert the action is NOT an elaborate_loop carrying the named signal.
 * Passes if the action is a different kind OR if the elaborate_loop's
 * signals_unmet doesn't contain the named signal.
 */
export function assertNotLoopSignal(action, signal, msgPrefix = "") {
	if (action?.action !== "elaborate_loop") return
	const entry = pickLoopSignal(action, signal)
	assert.ok(
		entry === undefined,
		`${msgPrefix}expected signals_unmet to NOT include \`${signal}\`; got ${JSON.stringify(
			action.signals_unmet,
		)}`,
	)
}
