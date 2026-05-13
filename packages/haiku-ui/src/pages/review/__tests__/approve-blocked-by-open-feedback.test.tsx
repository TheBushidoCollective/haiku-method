/**
 * Tests the workflow principle (2026-05-12):
 *
 *   "A person cannot approve a stage if there is still open feedback,
 *    and that needs to be clear in the SPA, and the feedback needed
 *    to be reviewed needs to be intuitive for the user to find."
 *
 * Open feedback includes:
 *
 *   - `pending`  — just filed, awaiting agent fix-loop
 *   - `addressed` — agent marked done; awaiting USER verification
 *                   via the FeedbackItem "Verify & Close" button
 *   - `answered`  — question-type FB answered; awaiting user
 *                   verification
 *
 * The pre-fix gap: `hasPending` only counted `status === "pending"`,
 * so once the agent's fix-loop marked a user-FB as `addressed`, the
 * Approve button became available — even though the user was supposed
 * to verify it first. This regression test pins the corrected
 * behavior.
 */

import { describe, expect, it } from "vitest"
import { decideMode } from "../FeedbackSidebar"

describe("FeedbackSidebar — open-feedback gate (principle: a person cannot approve a stage with open feedback)", () => {
	it("mode=approve when nothing is open and the user is on the current stage", () => {
		expect(
			decideMode({
				hasTyped: false,
				hasPending: false,
				hasUnverified: false,
				adHoc: false,
				isCurrent: true,
			}),
		).toBe("approve")
	})

	it("mode=request when there is pending feedback (Approve hidden — Request Changes is the primary action)", () => {
		expect(
			decideMode({
				hasTyped: false,
				hasPending: true,
				hasUnverified: false,
				adHoc: false,
				isCurrent: true,
			}),
		).toBe("request")
	})

	it("mode=verify-required when only addressed items remain (Approve blocked — user must Verify & Close each card)", () => {
		// This is the gap the fix closes. Pre-fix this state returned
		// `approve`, allowing the user to advance the stage while the
		// addressed items still required their verification.
		expect(
			decideMode({
				hasTyped: false,
				hasPending: false,
				hasUnverified: true,
				adHoc: false,
				isCurrent: true,
			}),
		).toBe("verify-required")
	})

	it("mode=request takes priority over verify-required when both pending AND addressed items exist", () => {
		// Pending is the more urgent action surface (Request Changes
		// sends them to the agent). Addressed verification is the next
		// step after the agent fix-loop closes the pending items.
		expect(
			decideMode({
				hasTyped: false,
				hasPending: true,
				hasUnverified: true,
				adHoc: false,
				isCurrent: true,
			}),
		).toBe("request")
	})

	it("mode=verify-required blocks Approve even in ad-hoc reviews (the user must still verify before closing the pane)", () => {
		expect(
			decideMode({
				hasTyped: false,
				hasPending: false,
				hasUnverified: true,
				adHoc: true,
				isCurrent: false,
			}),
		).toBe("verify-required")
	})

	it("mode=add when the user has typed in the composer (typing is always the primary action)", () => {
		// Typing wins over every other state — the user is mid-thought,
		// don't yank focus to another button.
		expect(
			decideMode({
				hasTyped: true,
				hasPending: true,
				hasUnverified: true,
				adHoc: false,
				isCurrent: true,
			}),
		).toBe("add")
	})

	it("mode=disabled when the stage is not current AND nothing is pending or addressed (no action for the user to take here)", () => {
		expect(
			decideMode({
				hasTyped: false,
				hasPending: false,
				hasUnverified: false,
				adHoc: false,
				isCurrent: false,
			}),
		).toBe("disabled")
	})
})
