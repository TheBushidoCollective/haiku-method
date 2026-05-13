/**
 * Pins the principle (2026-05-13):
 *
 *   "Only human-authored feedback requires user verification.
 *    Agent- and system-authored FBs auto-close on the terminal
 *    fix-hat advance — they don't need a human in the loop."
 *
 * The pre-fix gap: `unverifiedCount` counted EVERY addressed /
 * answered item, regardless of authorship. Reported on
 * `admin-portal-reimagine` design — 23 review-agent items sat at
 * `addressed` and the SPA rendered "23 to verify" with Approve
 * blocked. Those items should auto-close on the fix-loop; they
 * shouldn't block the user.
 */

import { describe, expect, it } from "vitest"
import {
	countItemsAwaitingUserSubmission,
	countItemsNeedingUserVerification,
} from "../FeedbackSidebar"

type Item = Parameters<typeof countItemsNeedingUserVerification>[0][number]

function item(overrides: Partial<Item> = {}): Item {
	return {
		status: "addressed",
		author_type: "human",
		...overrides,
	}
}

describe("countItemsNeedingUserVerification — only human-authored FBs require verification", () => {
	it("counts human-authored addressed items", () => {
		expect(
			countItemsNeedingUserVerification([
				item({ status: "addressed", author_type: "human" }),
				item({ status: "addressed", author_type: "human" }),
			]),
		).toBe(2)
	})

	it("counts human-authored answered items", () => {
		expect(
			countItemsNeedingUserVerification([
				item({ status: "answered", author_type: "human" }),
			]),
		).toBe(1)
	})

	it("SKIPS agent-authored addressed items (the admin-portal-reimagine regression)", () => {
		expect(
			countItemsNeedingUserVerification([
				item({ status: "addressed", author_type: "agent" }),
				item({ status: "addressed", author_type: "agent" }),
				item({ status: "addressed", author_type: "agent" }),
			]),
		).toBe(0)
	})

	it("SKIPS system-authored addressed items", () => {
		expect(
			countItemsNeedingUserVerification([
				item({ status: "addressed", author_type: "system" }),
			]),
		).toBe(0)
	})

	it("SKIPS items with null author_type (defensive)", () => {
		expect(
			countItemsNeedingUserVerification([
				item({ status: "addressed", author_type: null }),
			]),
		).toBe(0)
	})

	it("SKIPS pending / closed / rejected — only addressed+answered are unverified", () => {
		expect(
			countItemsNeedingUserVerification([
				item({ status: "pending", author_type: "human" }),
				item({ status: "closed", author_type: "human" }),
				item({ status: "rejected", author_type: "human" }),
				item({ status: "fixing", author_type: "human" }),
			]),
		).toBe(0)
	})

	it("mixed list: only human-authored addressed/answered count", () => {
		expect(
			countItemsNeedingUserVerification([
				item({ status: "addressed", author_type: "human" }), // ✓
				item({ status: "addressed", author_type: "agent" }), // skip
				item({ status: "answered", author_type: "human" }), // ✓
				item({ status: "answered", author_type: "system" }), // skip
				item({ status: "pending", author_type: "human" }), // skip
				item({ status: "closed", author_type: "human" }), // skip
			]),
		).toBe(2)
	})
})

/**
 * Mirror suite for `countItemsAwaitingUserSubmission` — the same
 * "human-only" filter applied to the "pending → submit to agent"
 * pile. The original bug was the same shape: a count that included
 * agent-authored FBs surfaced "Send 23 to agent" when those 23 were
 * already on disk waiting for the next tick. Human-authored pending
 * FBs are the only items the user actually needs to submit.
 */
describe("countItemsAwaitingUserSubmission — only human-authored pending FBs need submission", () => {
	it("counts human-authored pending items", () => {
		expect(
			countItemsAwaitingUserSubmission([
				item({ status: "pending", author_type: "human" }),
				item({ status: "pending", author_type: "human" }),
			]),
		).toBe(2)
	})

	it("SKIPS agent-authored pending items (the admin-portal-reimagine regression)", () => {
		expect(
			countItemsAwaitingUserSubmission([
				item({ status: "pending", author_type: "agent" }),
				item({ status: "pending", author_type: "agent" }),
				item({ status: "pending", author_type: "agent" }),
			]),
		).toBe(0)
	})

	it("SKIPS system-authored pending items", () => {
		expect(
			countItemsAwaitingUserSubmission([
				item({ status: "pending", author_type: "system" }),
			]),
		).toBe(0)
	})

	it("SKIPS items with null author_type (defensive)", () => {
		expect(
			countItemsAwaitingUserSubmission([
				item({ status: "pending", author_type: null }),
			]),
		).toBe(0)
	})

	it("SKIPS addressed / answered / closed — only pending counts for submission", () => {
		expect(
			countItemsAwaitingUserSubmission([
				item({ status: "addressed", author_type: "human" }),
				item({ status: "answered", author_type: "human" }),
				item({ status: "closed", author_type: "human" }),
				item({ status: "fixing", author_type: "human" }),
			]),
		).toBe(0)
	})

	it("mixed list: only human-authored pending count", () => {
		expect(
			countItemsAwaitingUserSubmission([
				item({ status: "pending", author_type: "human" }), // ✓
				item({ status: "pending", author_type: "agent" }), // skip
				item({ status: "pending", author_type: "system" }), // skip
				item({ status: "addressed", author_type: "human" }), // skip
				item({ status: "answered", author_type: "human" }), // skip
				item({ status: "pending", author_type: "human" }), // ✓
			]),
		).toBe(2)
	})
})
