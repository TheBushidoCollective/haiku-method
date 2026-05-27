/**
 * Narrow-viewport gate-actionability regression.
 *
 * The bug: the review gate's decision controls (composer + Approve /
 * Request-Changes / Add-comment button + the RevisitModal) lived ONLY
 * inside `FeedbackSidebar`, whose root is `hidden xl:flex` AND is
 * additionally suppressed by `{!isMobile && <FeedbackSidebar/>}`. Below
 * the xl breakpoint (1280px) the entire actionable panel disappeared and
 * the reviewer saw a feedback list with no way to Approve or Request
 * Changes — a stranded gate.
 *
 * The fix relocated those controls into the self-contained
 * `GateDecisionBar`, rendered both in the desktop sidebar AND as a sticky
 * bottom bar in the mobile branch. This test pins the mobile branch: at a
 * NARROW viewport (`useIsMobile()` → true via the `max-width: 1279px`
 * matchMedia stub) the gate decision control must be present + actionable.
 *
 * Against the pre-fix code this FAILS — on mobile the only render site for
 * the controls (the desktop sidebar) is suppressed, so neither a
 * `data-decision` button nor the `review-footer-bar` exists in the DOM.
 *
 * `matchMedia` stub pattern mirrors `responsive.test.tsx`.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import feedbackFixture from "../../../../test-fixtures/review-feedback-full.json"
import sessionFixture from "../../../../test-fixtures/review-session-full.json"
import { LiveRegionShell } from "../../../a11y"
import type { ApiClient } from "../../../api/client"
import { ApiClientProvider } from "../../../api/context"
import type { FeedbackItemData } from "../../../types"
import { ReviewPage } from "../ReviewPage"
import type { ReviewPageSessionData } from "../shared/session-data"

type FeedbackFixture = { items: FeedbackItemData[] }

function stubMatchMedia(isMobile: boolean): void {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		configurable: true,
		value: (query: string): MediaQueryList => {
			const matches = query.includes("max-width: 1279px") ? isMobile : false
			return {
				matches,
				media: query,
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => true,
			} as MediaQueryList
		},
	})
}

function buildMockClient(items: FeedbackItemData[]): ApiClient {
	return {
		async fetchSession() {
			throw new Error("fetchSession not used")
		},
		async fetchReviewCurrent() {
			throw new Error("fetchReviewCurrent not used")
		},
		async submitDecision() {
			return { ok: true } as never
		},
		async submitAnswer() {
			return {} as never
		},
		async submitDirection() {
			return {} as never
		},
		async submitPicker() {
			return {} as never
		},
		async submitAdvance() {
			return {} as never
		},
		feedback: {
			list: (async () => ({
				intent: "test-intent",
				stage: "design",
				count: items.length,
				items,
			})) as unknown as ApiClient["feedback"]["list"],
			create: (async () => ({})) as unknown as ApiClient["feedback"]["create"],
			update: (async () => ({
				item: items[0],
			})) as unknown as ApiClient["feedback"]["update"],
			delete: (async () => ({
				ok: true,
			})) as unknown as ApiClient["feedback"]["delete"],
		},
		setSessionId() {},
		getSessionId() {
			return null
		},
		openWebSocket() {
			return null
		},
	}
}

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

describe("ReviewPage — gate actionable at narrow (mobile) viewport", () => {
	const session = sessionFixture as unknown as ReviewPageSessionData
	const items = (feedbackFixture as FeedbackFixture).items

	function stubFetch(): void {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ items }),
		}) as unknown as typeof global.fetch
	}

	it("renders an actionable gate decision control on mobile (the stranded-gate regression)", async () => {
		stubMatchMedia(true)
		stubFetch()
		const client = buildMockClient(items)
		render(
			<ApiClientProvider client={client}>
				<ReviewPage session={session} sessionId="test-review-full" />
				<LiveRegionShell />
			</ApiClientProvider>,
		)

		// The decision controls live in the sticky GateDecisionBar — its
		// wrapper carries `data-testid="review-footer-bar"`. It must exist
		// at the narrow viewport (pre-fix: the only render site, the desktop
		// sidebar, was suppressed on mobile so this was never in the DOM).
		// Plain DOM queries — jest-dom matchers aren't wired in this suite.
		await waitFor(() => {
			expect(screen.getAllByTestId("review-footer-bar").length).toBeGreaterThan(
				0,
			)
		})

		// And a real, actionable decision button must be present — one of
		// the `data-decision` variants the gate emits (approved /
		// changes_requested / ad_hoc_*). With the fixture's 3 human pending
		// FBs on the current stage, the gate is in "request" mode, so the
		// "changes_requested" button renders.
		await waitFor(() => {
			expect(
				document.querySelectorAll("[data-decision]").length,
			).toBeGreaterThan(0)
		})
		const decisionButton = document.querySelector<HTMLButtonElement>(
			'[data-decision="changes_requested"], [data-decision="approved"]',
		)
		expect(decisionButton).not.toBeNull()
		// Actionable: not disabled. The request-changes button opens the
		// RevisitModal; the approve button posts the decision. The gate is
		// reachable on mobile — that's the whole point of the fix.
		expect(decisionButton?.disabled).toBe(false)
	})

	// Mobile composer↔decision split (2026-05-27): the bottom bar is
	// DECISION-ONLY — no textarea composer. Authoring moved into the
	// feedback drawer (`<FeedbackComposer/>` inside `FeedbackSheet`). This
	// test pins both halves of the split: the bottom bar has no textarea,
	// and the drawer carries the composer textarea.
	it("mobile bottom bar is DECISION-ONLY (no composer textarea); the feedback drawer carries the composer", async () => {
		stubMatchMedia(true)
		stubFetch()
		const client = buildMockClient(items)
		render(
			<ApiClientProvider client={client}>
				<ReviewPage session={session} sessionId="test-review-full" />
				<LiveRegionShell />
			</ApiClientProvider>,
		)

		// Bottom bar present (decision surface).
		const footer = await screen.findByTestId("review-footer-bar")
		// DECISION-ONLY: the bottom bar must NOT contain any textarea — the
		// composer is no longer part of the gate decision surface.
		expect(footer.querySelector("textarea")).toBeNull()

		// The composer lives inside the feedback drawer instead.
		const composer = await screen.findByTestId("feedback-composer")
		expect(composer.querySelector("textarea")).not.toBeNull()
		// And the composer is inside the drawer (FeedbackSheet), not the
		// bottom bar.
		const drawer = screen.getByTestId("feedback-sheet")
		expect(drawer.contains(composer)).toBe(true)
		expect(footer.contains(composer)).toBe(false)
	})
})
