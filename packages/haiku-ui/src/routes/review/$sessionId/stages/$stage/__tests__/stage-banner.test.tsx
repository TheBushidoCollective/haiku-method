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

// ── Granular milestone track ──────────────────────────────────────────
//
// When the session payload carries `current_state.milestones` (the same
// per-cursor-action track the status line shows), the stepper renders one
// bubble per milestone instead of the coarse four-phase strip. The labels
// arrive pre-worded from the engine; the stepper doesn't re-derive them.

const SAMPLE_MILESTONES = [
	{ key: "elaborate", label: "elaborate", status: "done" as const },
	{ key: "review:spec", label: "spec review", status: "done" as const },
	{ key: "execute", label: "execute", status: "active" as const },
	{
		key: "approve:quality_gates",
		label: "quality gates",
		status: "pending" as const,
	},
	{ key: "observations", label: "observations", status: "pending" as const },
]

describe("PhaseStepper — granular milestone track", () => {
	it("renders one bubble per milestone, not the coarse four-phase strip", () => {
		const { container } = render(
			<PhaseStepper
				phase="execute"
				stageStatus="current"
				milestones={SAMPLE_MILESTONES}
				progressIndex={2}
			/>,
		)
		const list = container.querySelector("ol")
		expect(list).toBeTruthy()
		// 5 milestones, not the 4 coarse phases.
		expect(list?.children.length).toBe(5)
	})

	it("marks the active milestone with aria-current='step' and spells out its label", () => {
		render(
			<PhaseStepper
				phase="execute"
				stageStatus="current"
				milestones={SAMPLE_MILESTONES}
				progressIndex={2}
			/>,
		)
		const active = screen.getByLabelText(/execute — active/i)
		expect(active.getAttribute("aria-current")).toBe("step")
		// The active milestone's label renders twice — its bubble tooltip
		// and the trailing spelled-out label after the count.
		expect(screen.getAllByText("execute").length).toBe(2)
	})

	it("uses progressIndex for the count slot (N/M form)", () => {
		const { container } = render(
			<PhaseStepper
				phase="execute"
				stageStatus="current"
				milestones={SAMPLE_MILESTONES}
				progressIndex={2}
			/>,
		)
		const countSlot = container.querySelector(".font-mono")
		// progressIndex 2 (0-based) → milestone 3 of 5.
		expect(countSlot?.textContent).toBe("3/5")
	})

	it("falls back to progressIndex from milestone status when not supplied", () => {
		render(
			<PhaseStepper
				phase="execute"
				stageStatus="current"
				milestones={SAMPLE_MILESTONES}
			/>,
		)
		// No progressIndex prop → derived from the first `active` milestone
		// (execute, index 2). aria-label reflects "Milestone 3 of 5".
		expect(screen.getByLabelText(/^milestone 3 of 5$/i)).toBeTruthy()
	})

	it("a complete stage shows every milestone done, no active bubble", () => {
		const { container } = render(
			<PhaseStepper
				phase=""
				stageStatus="completed"
				milestones={SAMPLE_MILESTONES}
				progressIndex={2}
			/>,
		)
		// Stage-complete overrides per-milestone status: nothing is active.
		expect(screen.queryAllByLabelText(/— active/i).length).toBe(0)
		const countSlot = container.querySelector(".font-mono")
		expect(countSlot?.textContent).toBe("done")
		expect(screen.getByLabelText(/all milestones complete/i)).toBeTruthy()
	})

	it("empty milestones array falls back to the coarse four-phase strip", () => {
		const { container } = render(
			<PhaseStepper phase="execute" stageStatus="current" milestones={[]} />,
		)
		// Empty track → coarse strip with its 4 numbered bubbles.
		const list = container.querySelector("ol")
		expect(list?.children.length).toBe(4)
	})

	// ── Desync regression (screenshot 2026-05-28) ───────────────────────
	// The stamp-derived milestone `status` LAGS the live cursor action by a
	// tick: it can mark an EARLY pip `active` with several LATER pips already
	// `done`, while `progress_index` (placed from the live action) points at
	// the late approval gate. The dots used to follow `status` (orange dot at
	// index 2) while the caption + active label used progress_index ("9/10
	// approval gate"). They must now agree on the live position.
	const LAGGING_MILESTONES = [
		{ key: "elaborate", label: "elaborate", status: "done" as const },
		{ key: "review:spec", label: "spec review", status: "active" as const },
		{
			key: "review:adversarial:0",
			label: "adversarial review",
			status: "done" as const,
		},
		{ key: "execute", label: "execute", status: "done" as const },
		{ key: "approve:spec", label: "spec approval", status: "done" as const },
		{
			key: "approve:adversarial:0",
			label: "adversarial approval",
			status: "done" as const,
		},
		{
			key: "approve:quality_gates",
			label: "quality gates",
			status: "done" as const,
		},
		{
			key: "approve:continuity",
			label: "continuity approval",
			status: "done" as const,
		},
		{
			key: "approve:runtime",
			label: "runtime approval",
			status: "done" as const,
		},
		{ key: "approve:user", label: "approval gate", status: "pending" as const },
	]

	it("places the active milestone at the live progressIndex, not the stamp-active one", () => {
		const { getByText } = render(
			<PhaseStepper
				phase="approve"
				stageStatus="current"
				milestones={LAGGING_MILESTONES}
				progressIndex={9}
			/>,
		)
		// Caption + group-aria reflect the LIVE position (approval gate,
		// 10/10), NOT the stamp-lagging "spec review" the status array marks
		// active. Before the fix the dots/aria followed `status` (index 1) so
		// "spec review — active" carried aria-current while the caption read
		// "10/10" — the desync the screenshot showed.
		expect(getByText("10/10")).toBeTruthy()
		expect(screen.getByLabelText(/^milestone 10 of 10$/i)).toBeTruthy()
		// EXACTLY ONE milestone carries aria-current="step", and it's the
		// approval gate — not "spec review" (the stamp-active one).
		const current = screen.getAllByLabelText(/— active$/i)
		expect(current.length).toBe(1)
		expect(current[0].getAttribute("aria-label")).toMatch(
			/approval gate — active/i,
		)
		expect(current[0].getAttribute("aria-current")).toBe("step")
		// The stamp-active "spec review" pip must now read DONE, not active.
		expect(screen.getByLabelText(/spec review — done/i)).toBeTruthy()
		// And every pip BEFORE the live active one is done (no pending gap).
		expect(screen.queryAllByLabelText(/— pending$/i).length).toBe(0)
	})

	it("falls back to the stamp-active milestone when no progressIndex", () => {
		render(
			<PhaseStepper
				phase="review"
				stageStatus="current"
				milestones={LAGGING_MILESTONES}
			/>,
		)
		// No live index → the array's own active marker (spec review, index 1).
		expect(screen.getByLabelText(/^milestone 2 of 10$/i)).toBeTruthy()
	})
})
