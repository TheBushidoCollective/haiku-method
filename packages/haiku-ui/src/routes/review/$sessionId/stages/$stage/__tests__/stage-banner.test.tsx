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
import { PhaseStepper, StageBanner } from "../-stage-banner"

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

describe("PhaseStepper — bubble + tooltip per phase", () => {
	it("renders one bubble per phase (4 phases total)", () => {
		const { container } = render(
			<PhaseStepper phase="execute" stageStatus="current" />,
		)
		const list = container.querySelector("ol")
		expect(list).toBeTruthy()
		expect(list?.children.length).toBe(4)
	})

	it("active phase carries aria-current='step' on its bubble", () => {
		render(<PhaseStepper phase="review" stageStatus="current" />)
		// review is index 2 of 4. The active bubble's wrapper carries
		// aria-current and the SR label includes the active state.
		const active = screen.getByLabelText(/Review — active/i)
		expect(active.getAttribute("aria-current")).toBe("step")
	})

	it("pending phases do NOT carry aria-current", () => {
		render(<PhaseStepper phase="execute" stageStatus="current" />)
		// gate is downstream of execute → still pending.
		const pending = screen.getByLabelText(/Gate — pending/i)
		expect(pending.getAttribute("aria-current")).toBeNull()
	})

	it("done phases carry the green check glyph, NOT a number", () => {
		const { container } = render(
			<PhaseStepper phase="gate" stageStatus="current" />,
		)
		// elaborate, execute, review are all done (i < activeIndex=3).
		// Each done bubble renders an <svg> with a check path.
		const svgs = container.querySelectorAll("svg")
		// 3 done = 3 svg checks.
		expect(svgs.length).toBe(3)
	})

	it("when the stage is complete, every phase shows done — no active bubble", () => {
		const { container } = render(
			<PhaseStepper phase="" stageStatus="completed" />,
		)
		// No bubble should carry aria-current="step" once the stage is
		// terminal; the trailing count slot reads "done" instead of "N/M".
		const allBubbles = screen.queryAllByLabelText(/— active/i)
		expect(allBubbles.length).toBe(0)
		// Find the trailing count slot specifically — the only `font-mono`
		// child of the outer group. (svg <title>done</title> elements also
		// match the literal "done" text but live inside aria-hidden bubbles.)
		const countSlot = container.querySelector(".font-mono")
		expect(countSlot?.textContent).toBe("done")
	})

	it("tooltip card carries the phase title AND description", () => {
		render(<PhaseStepper phase="execute" stageStatus="current" />)
		// Aria-label encodes both. We pin on the aria-label since the
		// CSS-driven hover card isn't visible in jsdom.
		const execute = screen.getByLabelText(
			/Execute — active.*hats land code and artifacts for each unit/i,
		)
		expect(execute).toBeTruthy()
	})

	// ── Group-level aria-label (regression for "Phase 0 of 4" on complete) ──
	//
	// The group wrapper's `aria-label` previously used
	// `Phase ${activeIndex + 1} of ${STAGE_PHASES.length}`. When a stage
	// was complete (`phase === ""` → activeIndex = -1), screen readers
	// announced "Phase 0 of 4" — a confusing incomplete count that
	// contradicted the visible "done" text. The label now branches on
	// stage state so SRs hear something coherent in each case.

	it("group aria-label reads 'All phases complete' when the stage is complete", () => {
		render(<PhaseStepper phase="" stageStatus="completed" />)
		expect(screen.getByLabelText(/all phases complete/i)).toBeTruthy()
		// And the misleading old form must not surface.
		expect(screen.queryByLabelText(/phase 0 of 4/i)).toBeNull()
	})

	it("group aria-label reads 'Phase N of M' when an active phase is set", () => {
		render(<PhaseStepper phase="review" stageStatus="current" />)
		// review is index 2 → N=3, M=4.
		expect(screen.getByLabelText(/^phase 3 of 4$/i)).toBeTruthy()
	})

	it("group aria-label reads 'Phase progress' when stage is pending with no phase", () => {
		render(<PhaseStepper phase={null} stageStatus="pending" />)
		// Neutral fallback when there's no live phase and the stage
		// isn't complete (the in-between "we haven't entered yet" state).
		expect(screen.getByLabelText(/^phase progress$/i)).toBeTruthy()
	})
})
