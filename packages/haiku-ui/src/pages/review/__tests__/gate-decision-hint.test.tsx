/**
 * Gate hint copy in the "disabled" decision mode (2026-05-27).
 *
 * When the reviewer is viewing a NON-active stage with nothing pending
 * (`decideMode` → "disabled"), the bar can't approve — it can only point
 * the reviewer at how to leave feedback. The old copy said "Type a comment
 * above or click into another stage", which is wrong in the docked-rail
 * layout (`composer={false}`): the composer isn't "above", it lives in the
 * slide-out feedback panel. This pins the composer-aware copy:
 *   - composer present (desktop sidebar): "type a comment above"
 *   - composer absent (docked rail): "open the feedback panel"
 * Both name that only the ACTIVE stage can be approved.
 *
 * The three context hooks are mocked so the bar renders standalone; in
 * disabled mode nothing calls the API on render.
 */

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../useFeedbackSidebarController", () => ({
	useFeedbackSidebarController: () => ({
		items: [],
		createFeedback: async () => ({}),
		refetch: () => {},
	}),
}))
vi.mock("../../../api/context", () => ({
	useApiClient: () => ({}),
}))
vi.mock("../../../a11y", async (orig) => ({
	...(await orig<typeof import("../../../a11y")>()),
	useAnnounce: () => () => {},
}))

import { GateDecisionBar } from "../GateDecisionBar"

afterEach(() => cleanup())

describe("GateDecisionBar — disabled-mode hint copy", () => {
	// Non-active stage ("design" while "development" is active), no pending,
	// not ad-hoc → decideMode returns "disabled".
	const base = {
		stage: "design",
		activeStage: "development",
		sessionId: "s",
		adHoc: false,
	} as const

	it("docked rail (composer=false) points at the feedback PANEL, not 'above'", () => {
		render(<GateDecisionBar {...base} composer={false} />)
		expect(
			screen.getByText(/open the feedback panel to leave a comment/i),
		).toBeTruthy()
		expect(
			screen.getByText(/only the active stage can be approved/i),
		).toBeTruthy()
		// The stale "click into another stage" copy is gone.
		expect(screen.queryByText(/click into another stage/i)).toBeNull()
	})

	it("desktop sidebar (composer=true) points 'above' (the inline textarea)", () => {
		render(<GateDecisionBar {...base} composer={true} />)
		expect(
			screen.getByText(/type a comment above to leave feedback/i),
		).toBeTruthy()
		expect(
			screen.getByText(/only the active stage can be approved/i),
		).toBeTruthy()
	})
})
