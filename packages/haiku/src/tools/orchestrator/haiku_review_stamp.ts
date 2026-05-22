// tools/orchestrator/haiku_review_stamp.ts — Stage review/approval
// subagent's CLOSURE hand-off.
//
// Why this exists (the loop-halt false positive, automated-starlink-rental-
// platform 2026-05-22):
//   Review-agent subagents used to self-stamp their role by calling
//   `haiku_run_next` on close. But run_next ALSO computes and returns the
//   GLOBAL next action. In a parallel review fan-out (≥4 roles), the moment
//   one role files findings, every sibling's self-stamp tick returns the
//   SAME `start_feedback_hat` fix dispatch — returned, but never consumed,
//   because spawning the fix hats is the PARENT's job after the whole wave
//   closes. Four such pulls trip the inter-tick loop guard on a perfectly
//   healthy review→fix transition and force a human into the loop.
//
//   This tool decouples "stamp my review role" from "compute the global
//   next action." The subagent calls it; the engine stamps the one role's
//   witnesses and returns a terminal ack. No cursor walk, so no fix
//   dispatch is pulled and nothing is recorded by the deadlock detector.
//   Only the parent's wave-level `haiku_run_next` — fired once, after all
//   siblings return — pulls the fix dispatch, and it pulls it once.
//
// Contract:
//   - `kind: "review" | "approval"` + `stage`: stamps the matching
//     `_pending_*_dispatches[stage][role]` entry's units (skipping units the
//     subagent just flagged with an open invalidating FB), then removes ONLY
//     that (stage, role) entry — sibling roles keep their pending entries
//     for their own closures.
//   - Idempotent: a second call (or one after a bulk drain already stamped)
//     returns `found: false` and is a clean no-op.
//
// What this tool does NOT do:
//   - Walk the cursor / return the next action. The parent ticks the
//     workflow when the wave closes.
//   - Record a deadlock-detector tick. It isn't a workflow tick.
//   - Handle intent-completion review. Those agents close by terminating
//     (no self-run_next), so they never trip the guard and keep using the
//     parent's deferred bulk drain.

import { stampSingleDispatch } from "../../orchestrator/workflow/dispatch-stamps.js"
import {
	HAIKU_REVIEW_STAMP_INPUT_SCHEMA,
	type HaikuReviewStampInput,
	validateHaikuReviewStampInputSchema,
} from "../../state/schemas/index.js"
import {
	jsonSchemaOf,
	validateToolInput,
} from "../../state/schemas/inputs/_validate.js"
import { emitTelemetry } from "../../telemetry.js"
import { defineTool } from "../define.js"
import { text } from "./_text.js"

const CLOSURE_HINT =
	"Your work here is done — terminate with your one-line findings summary. Do NOT call haiku_run_next; your parent ticks the workflow when the whole review wave closes."

export default defineTool({
	name: "haiku_review_stamp",
	description:
		"Review/approval/intent-review subagent CLOSURE. Records your own `reviews.<role>` / `approvals.<role>` witness and returns a terminal ack — call this INSTEAD of `haiku_run_next` when you finish reviewing. `kind: review|approval` requires `stage`; `kind: intent_review` omits it. Returns `{ ok: true, stamped: [...], skipped: [...] }` (skipped = units you flagged with an open finding; they stay un-stamped so the cursor reroutes through them on close), or `{ ok: true, found: false }` when nothing was pending for your role (already stamped — clean no-op). Never walks the cursor and never returns a fix dispatch, so it can't trip the inter-tick loop guard.",
	inputSchema: jsonSchemaOf(HAIKU_REVIEW_STAMP_INPUT_SCHEMA),
	async handle(args) {
		const inputErr = validateToolInput(
			args,
			validateHaikuReviewStampInputSchema,
			"haiku_review_stamp",
		)
		if (inputErr) return inputErr
		const { intent: slug, kind, role, stage } = args as HaikuReviewStampInput

		// The AJV gate has already constrained `kind` to the enum; the
		// TypeBox Static widens it to `string`, so narrow for the helper.
		const res = stampSingleDispatch(
			slug,
			kind as "review" | "approval",
			stage,
			role,
		)
		emitTelemetry("haiku.review.stamped", {
			intent: slug,
			kind,
			role,
			stage,
			found: String(res.found),
			stamped_count: String(res.stamped.length),
			skipped_count: String(res.skipped.length),
		})
		return text(
			JSON.stringify({
				ok: true,
				intent: slug,
				kind,
				role,
				stage,
				found: res.found,
				stamped: res.stamped,
				skipped: res.skipped,
				message: res.found
					? `Recorded ${kind} witness for '${role}' on stage '${stage}': ${res.stamped.length} unit(s) stamped${res.skipped.length > 0 ? `, ${res.skipped.length} skipped (you filed open findings against them — they re-review after close)` : ""}. ${CLOSURE_HINT}`
					: `No pending ${kind} dispatch for '${role}' on stage '${stage}' (already stamped). ${CLOSURE_HINT}`,
			}),
		)
	},
})
