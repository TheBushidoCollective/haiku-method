/**
 * Advance endpoint — POST /api/advance/:sessionId
 *
 * The SPA's ONE signal to the engine besides `/api/feedback` (which writes
 * feedback files to disk) and the heartbeat. No body, no payload, no
 * workflow verb.
 *
 * Two engine-side effects per call:
 *   1. If no feedback items are open on the resolved stage at the time of
 *      the call, `reviews.user` and `approvals.user` are stamped on every
 *      unit that didn't already have them. The user's act of advancing
 *      with nothing pending IS the approval; the cursor reads disk on the
 *      next tick and walks past the user gate.
 *   2. The gate session's `pending_decision` is set to `decision: "advance"`
 *      so the parked `haiku_await_gate` waiter unblocks and the agent
 *      re-enters `haiku_run_next`.
 *
 * Replaces the legacy `/api/revisit/:sessionId` endpoint (removed 2026-05-14)
 * which bundled FB-create + workflow-verb. SPA-side, the equivalent flow is
 * now `POST /api/feedback` (per FB the user wants to file) followed by
 * `POST /api/advance/:sessionId` to wake the gate.
 */

import { z } from "zod"

/** POST /api/advance/:sessionId response body (200 on success). */
export const AdvanceResponseSchema = z
	.object({
		ok: z.literal(true),
		stage: z
			.string()
			.describe("The stage the advance signal was resolved against."),
		open_feedback_count: z
			.number()
			.int()
			.min(0)
			.describe(
				"Number of pending / fixing / addressed feedback items on the stage at the time of the call. Zero means the engine stamped the user slots; non-zero means it didn't — the cursor will walk Track B first.",
			),
		stamped_user_slots: z
			.boolean()
			.describe(
				"True when this call stamped `reviews.user` and `approvals.user` on the units that needed them (i.e., open_feedback_count was zero).",
			),
	})
	.describe("POST /api/advance/:sessionId response body")
export type AdvanceResponse = z.infer<typeof AdvanceResponseSchema>
