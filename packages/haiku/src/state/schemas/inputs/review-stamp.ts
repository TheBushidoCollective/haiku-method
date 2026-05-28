// state/schemas/inputs/review-stamp.ts — TypeBox input schema for the
// `haiku_review_stamp` MCP tool. A stage review-agent / approval-agent
// subagent calls this as its CLOSURE — it records its own
// `reviews.<role>` / `approvals.<role>` witness and terminates, instead
// of calling `haiku_run_next`. Decoupling stamping from the global
// next-action walk is what kills the parallel-fan-out loop-halt false
// positive (automated-starlink-rental-platform, 2026-05-22): self-stamp
// ticks no longer pull — and re-pull — the wave's fix dispatch.
//
// Intent-completion review agents are NOT in scope: they close by
// terminating (no self-`haiku_run_next`), so the parent's next tick
// drains their stamp and they never trip the loop guard.

import { type Static, Type } from "@sinclair/typebox"
import { stateAjv } from "../_ajv.js"

export const HAIKU_REVIEW_STAMP_INPUT_SCHEMA = Type.Object(
	{
		intent: Type.String({
			minLength: 1,
			description: "Intent slug. Required.",
		}),
		kind: Type.String({
			enum: ["review", "approval"],
			description:
				"Which witness to stamp: `review` (PRE-execute spec audit) or `approval` (POST-execute work audit). Matches the dispatch phase your subagent ran under.",
		}),
		role: Type.String({
			minLength: 1,
			description:
				"Your review role (e.g. `continuity`, `cross-stage-consistency`, `completeness`, `spec`, or a studio review-agent name). Stamps `reviews.<role>` / `approvals.<role>`.",
		}),
		stage: Type.String({
			minLength: 1,
			description: "Stage the review/approval belongs to.",
		}),
	},
	{ additionalProperties: false },
)
export type HaikuReviewStampInput = Static<
	typeof HAIKU_REVIEW_STAMP_INPUT_SCHEMA
>
export const validateHaikuReviewStampInputSchema = stateAjv.compile(
	HAIKU_REVIEW_STAMP_INPUT_SCHEMA,
)
