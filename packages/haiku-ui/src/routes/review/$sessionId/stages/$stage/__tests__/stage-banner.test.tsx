/**
 * StageBanner ad-hoc rendering — regression for the user-reported
 * "ad-hoc review screen looks like a review gate" bug.
 *
 * The banner renders gate-context badges (e.g. "Approve specs",
 * "External review") as pills next to the stage name. On a gate-
 * review session those badges describe the gate the user is about
 * to advance. On an ad-hoc review pane there's no gate to advance
 * — the badges are misleading and make ad-hoc panes
 * indistinguishable from real gate reviews.
 *
 * Fix: when `adHoc` is true, suppress the gate badges and render an
 * "Ad-hoc" pill instead so the state is explicit.
 */

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { StageBanner } from "../-stage-banner"

afterEach(() => {
	cleanup()
})

const SAMPLE_GATE_BADGES = [
	{
		label: "Approve specs",
		classes: "bg-teal-100 text-teal-700",
	},
	{
		label: "External review",
		classes: "bg-indigo-100 text-indigo-700",
	},
]

describe("StageBanner — ad-hoc vs. gate-review affordances", () => {
	it("gate-review session: renders the gate badges", () => {
		render(
			<StageBanner
				stageName="design"
				stageStatus="current"
				stagePhase="execute"
				gateBadges={SAMPLE_GATE_BADGES}
			/>,
		)
		expect(screen.getByText("Approve specs")).toBeTruthy()
		expect(screen.getByText("External review")).toBeTruthy()
		expect(screen.queryByText("Ad-hoc")).toBeNull()
	})

	it("ad-hoc session: suppresses gate badges, renders 'Ad-hoc' pill", () => {
		render(
			<StageBanner
				stageName="design"
				stageStatus="current"
				stagePhase="execute"
				gateBadges={SAMPLE_GATE_BADGES}
				adHoc
			/>,
		)
		// The user-reported regression: gate badges leak into ad-hoc
		// panes, making them visually identical to real gate reviews.
		expect(screen.queryByText("Approve specs")).toBeNull()
		expect(screen.queryByText("External review")).toBeNull()
		// And the explicit "Ad-hoc" pill replaces them so the state is
		// readable at a glance.
		expect(screen.getByText("Ad-hoc")).toBeTruthy()
	})

	it("ad-hoc session with empty gateBadges: still shows 'Ad-hoc' pill", () => {
		// Defensive: the upstream code path may pass an empty
		// gateBadges array on ad-hoc panes. The pill must still render
		// regardless — the signal "this is ad-hoc" should never depend
		// on what gate-context the engine happened to compute.
		render(
			<StageBanner
				stageName="design"
				stageStatus="current"
				stagePhase={null}
				gateBadges={[]}
				adHoc
			/>,
		)
		expect(screen.getByText("Ad-hoc")).toBeTruthy()
	})

	it("non-ad-hoc with empty gateBadges: no 'Ad-hoc' pill, no gate badges", () => {
		render(
			<StageBanner
				stageName="design"
				stageStatus="current"
				stagePhase={null}
				gateBadges={[]}
			/>,
		)
		expect(screen.queryByText("Ad-hoc")).toBeNull()
		expect(screen.queryByText("Approve specs")).toBeNull()
	})
})
