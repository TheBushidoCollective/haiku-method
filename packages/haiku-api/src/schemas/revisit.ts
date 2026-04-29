/**
 * Revisit endpoint — POST /api/revisit/:sessionId
 *
 * Traversed by: revisit-with-reasons.feature, auto-revisit.feature.
 *
 * Ground truth:
 * - The HTTP bridge resolves `intent` from the session (sessionId → intent_slug),
 *   so clients don't send it on the wire. Each `reason` becomes one
 *   `user-revisit` feedback file with `resolution: "stage_revisit"` written at
 *   the resolved target stage.
 * - The endpoint does NOT roll the FSM back inline — it writes the FBs,
 *   wakes the parked `haiku_run_next` waiter, and returns immediately. The
 *   actual rewind happens on the next tick when the pre-tick gate sees the
 *   open `stage_revisit` FBs and routes through `revisit()`.
 */

import { z } from "zod"

/** A single feedback reason to record before rolling back. */
export const RevisitReasonSchema = z
	.object({
		title: z.string().min(1).max(200).describe("Feedback title"),
		body: z.string().min(1).max(10_000).describe("Feedback body (markdown)"),
	})
	.describe("A single revisit reason — becomes one feedback file")
export type RevisitReason = z.infer<typeof RevisitReasonSchema>

/** POST /api/revisit/:sessionId request body. */
export const RevisitRequestSchema = z
	.object({
		stage: z
			.string()
			.max(200)
			.optional()
			.describe(
				"Target stage to revisit. Omit to let the orchestrator infer the target.",
			),
		reasons: z
			.array(RevisitReasonSchema)
			.max(50)
			.optional()
			.describe(
				"Optional feedback reasons. Each creates a feedback file before the revisit. At most 50 reasons per request.",
			),
	})
	.describe("POST /api/revisit/:sessionId request body")
export type RevisitRequest = z.infer<typeof RevisitRequestSchema>

/** POST /api/revisit/:sessionId response body (200 on success). */
export const RevisitResponseSchema = z
	.object({
		ok: z.literal(true),
		action: z
			.string()
			.describe(
				"Always 'revisit_pending' — the actual rewind happens on the next `haiku_run_next` tick when the pre-tick gate sees the open stage_revisit FBs.",
			),
		stage: z
			.string()
			.optional()
			.describe(
				"Target stage for the rewind — FSM rollback is deferred to the next tick.",
			),
		feedback_created: z
			.array(z.string())
			.optional()
			.describe(
				"FB-NN identifiers of the user-revisit feedback files written by this request, in order.",
			),
		message: z.string().describe("Human-readable summary."),
	})
	.describe("POST /api/revisit/:sessionId response body")
export type RevisitResponse = z.infer<typeof RevisitResponseSchema>
