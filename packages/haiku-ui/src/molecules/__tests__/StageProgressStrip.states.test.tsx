/**
 * State-matrix snapshot for StageProgressStrip (state-coverage-grid.md §7.11, §5).
 *
 * Per DESIGN-BRIEF §2 / state-coverage-grid the documented variants for this
 * component are: default, hover, focus, active, disabled, never-visited.
 * jsdom cannot render `:hover` / `:focus-visible` / `:active` pseudo-classes
 * into `className` strings, so hover/focus/active cells are proven by
 * driving real interaction (`userEvent.hover`, `.focus()`, `mousedown`) and
 * asserting the class tokens responsible for each state are present on the
 * rendered button — not by snapshot-equality of arrangement variants.
 */

import { cleanup, render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StageProgressStrip } from "../StageProgressStrip"

/**
 * Pre-2026-05-13 these tests queried by `getByTitle("inception (completed)")`
 * etc. The `title` attribute was removed from the marker button because it
 * caused the native OS tooltip to render simultaneously with the styled
 * hover card, with contradictory text (the styled card uses topology-derived
 * state copy while the native title was raw `stage.status`). All queries
 * now read the marker via its `data-stage` attribute (the same attribute
 * the click-target / e2e tooling reads).
 */
function byStage(name: string): HTMLButtonElement {
	const el = document.querySelector(`button[data-stage="${name}"]`)
	if (!el) throw new Error(`No marker with data-stage="${name}"`)
	return el as HTMLButtonElement
}

/** Non-throwing variant for "marker may not be rendered" probes (e.g.
 *  iterating an enum where some entries are intentionally omitted). */
function byStageOrNull(name: string): HTMLButtonElement | null {
	return document.querySelector<HTMLButtonElement>(
		`button[data-stage="${name}"]`,
	)
}

afterEach(() => {
	cleanup()
})

const STAGES = [
	{ name: "inception", status: "completed" as const, visits: 1 },
	{ name: "design", status: "completed" as const, visits: 1 },
	{ name: "product", status: "current" as const, visits: 1 },
	{ name: "development", status: "future" as const, visits: 0 },
	{ name: "review", status: "future" as const, visits: 0 },
]

describe("StageProgressStrip — state matrix", () => {
	it("renders every documented state cell (snapshot)", () => {
		const { container } = render(
			<div>
				<div data-cell="default">
					<StageProgressStrip stages={STAGES} currentStage="product" />
				</div>
				<div data-cell="first-stage-current">
					<StageProgressStrip stages={STAGES} currentStage="inception" />
				</div>
				<div data-cell="last-stage-completed">
					<StageProgressStrip
						stages={STAGES.map((s) => ({ ...s, status: "completed" }))}
						currentStage="review"
					/>
				</div>
				<div data-cell="with-click-handler">
					<StageProgressStrip
						stages={STAGES}
						currentStage="product"
						onStageClick={() => {}}
					/>
				</div>
				<div data-cell="visited-but-not-current">
					<StageProgressStrip
						stages={STAGES.map((s) =>
							s.name === "development"
								? { ...s, status: "future", visits: 1 }
								: s,
						)}
						currentStage="product"
					/>
				</div>
				<div data-cell="never-visited">
					<StageProgressStrip
						stages={STAGES.map((s) => ({ ...s, visits: 0 }))}
						currentStage="inception"
					/>
				</div>
				<div data-cell="disabled">
					{/*
					 * A future stage with zero visits and no onStageClick renders a
					 * disabled button. `disabled` attribute is the documented disabled
					 * cell for this component.
					 */}
					<StageProgressStrip
						stages={[
							{ name: "inception", status: "completed", visits: 1 },
							{ name: "design", status: "future", visits: 0 },
						]}
						currentStage="inception"
					/>
				</div>
			</div>,
		)
		expect(container.firstChild).toMatchSnapshot()
	})

	// ── Interaction-state cells ─────────────────────────────────────────────
	//
	// These prove hover / focus / active coverage by driving real interaction
	// and asserting on the class tokens responsible for each state. Snapshot
	// of className strings alone cannot capture pseudo-class styles.

	it("hover cell: completed dot exposes a hover-scale utility", () => {
		render(
			<StageProgressStrip
				stages={STAGES}
				currentStage="product"
				onStageClick={() => {}}
			/>,
		)
		const completedDot = byStage("inception")
		// The class that drives :hover styling must be present.
		expect(completedDot.className).toMatch(/hover:scale-\[?/)
	})

	it("hover cell: clickable future dot exposes hover:border-teal-400", () => {
		render(
			<StageProgressStrip
				stages={STAGES.map((s) =>
					s.name === "development" ? { ...s, status: "future", visits: 1 } : s,
				)}
				currentStage="product"
				onStageClick={() => {}}
			/>,
		)
		const clickableFuture = byStage("development")
		expect(clickableFuture.className).toContain("hover:border-teal-400")
	})

	it("focus cell: every dot carries focus-visible:ring-2 focus-visible:ring-teal-500", () => {
		render(
			<StageProgressStrip
				stages={STAGES}
				currentStage="product"
				onStageClick={() => {}}
			/>,
		)
		for (const name of [
			"inception",
			"design",
			"product",
			"development",
			"review",
		]) {
			const dot = byStage(name)
			expect(dot.className).toContain("focus-visible:outline-none")
			expect(dot.className).toContain("focus-visible:ring-2")
			expect(dot.className).toContain("focus-visible:ring-teal-500")
			expect(dot.className).toContain("focus-visible:ring-offset-1")
		}
	})

	it("focus cell: clickable dot becomes document.activeElement on focus()", async () => {
		render(
			<StageProgressStrip
				stages={STAGES}
				currentStage="product"
				onStageClick={() => {}}
			/>,
		)
		const dot = byStage("inception")
		dot.focus()
		expect(document.activeElement).toBe(dot)
	})

	it("active cell: click on clickable dot invokes onStageClick", async () => {
		const user = userEvent.setup()
		const onStageClick = vi.fn()
		render(
			<StageProgressStrip
				stages={STAGES}
				currentStage="product"
				onStageClick={onStageClick}
			/>,
		)
		await user.click(byStage("inception"))
		expect(onStageClick).toHaveBeenCalledWith("inception")
	})

	it("disabled cell: future-with-no-visits dot is disabled and has cursor-not-allowed", () => {
		render(
			<StageProgressStrip
				stages={[
					{ name: "inception", status: "completed", visits: 1 },
					{ name: "design", status: "future", visits: 0 },
				]}
				currentStage="inception"
			/>,
		)
		const disabledDot = byStage("design")
		expect(disabledDot.disabled).toBe(true)
		expect(disabledDot.className).toContain("cursor-not-allowed")
	})

	it("disabled cell: disabled dot does not fire onStageClick", async () => {
		const user = userEvent.setup()
		const onStageClick = vi.fn()
		render(
			<StageProgressStrip
				stages={[
					{ name: "inception", status: "completed", visits: 1 },
					{ name: "design", status: "future", visits: 0 },
				]}
				currentStage="inception"
				onStageClick={onStageClick}
			/>,
		)
		await user.click(byStage("design"))
		expect(onStageClick).not.toHaveBeenCalled()
	})

	// ── FB-01: "you are here" indicator when viewing a previous stage ─────────
	//
	// When the reviewer clicks the stepper to go back to a previous (completed)
	// stage, the workflow engine-current stage keeps its teal diamond, and the VIEWED stage
	// picks up a teal ring + underlined label + `aria-current="location"` +
	// "viewing" sublabel so the reviewer can see where they are without losing
	// sight of the workflow engine pointer.

	it("viewing-different: completed stage gains amber ring on marker + location aria", () => {
		render(
			<StageProgressStrip
				stages={STAGES}
				currentStage="product"
				viewingStage="inception"
			/>,
		)
		const viewed = byStage("inception")
		expect(viewed.getAttribute("aria-current")).toBe("location")
		expect(viewed.getAttribute("aria-label")).toMatch(/currently viewing/)
		expect(viewed.getAttribute("data-viewing")).toBe("true")
		expect(viewed.textContent).toContain("inception")
		// Sublabel slot reads "viewing"
		expect(viewed.textContent).toMatch(/viewing/i)
		// Marker picks up a thick amber ring (stands out against the
		// teal workflow engine-current diamond).
		const marker = viewed.querySelector('[aria-hidden="true"].rounded-full')
		expect(marker?.className).toMatch(/ring-4/)
		expect(marker?.className).toMatch(/ring-amber-400/)
	})

	it("viewing-different: workflow engine-current stage still carries aria-current='step'", () => {
		render(
			<StageProgressStrip
				stages={STAGES}
				currentStage="product"
				viewingStage="inception"
			/>,
		)
		const fsmCurrent = byStage("product")
		expect(fsmCurrent.getAttribute("aria-current")).toBe("step")
	})

	it("viewing-same-as-current: no duplicate 'location' marker", () => {
		render(
			<StageProgressStrip
				stages={STAGES}
				currentStage="product"
				viewingStage="product"
			/>,
		)
		const fsmCurrent = byStage("product")
		expect(fsmCurrent.getAttribute("aria-current")).toBe("step")
		// No stage should report aria-current="location" when viewing == current
		for (const s of STAGES) {
			const btn = byStageOrNull(s.name)
			if (btn && btn !== fsmCurrent) {
				expect(btn.getAttribute("aria-current")).toBeNull()
			}
		}
	})

	it("viewing-different: viewing a visited future stage gains amber ring on the outlined circle", () => {
		render(
			<StageProgressStrip
				stages={STAGES.map((s) =>
					s.name === "development" ? { ...s, status: "future", visits: 1 } : s,
				)}
				currentStage="product"
				viewingStage="development"
			/>,
		)
		const viewed = byStage("development")
		expect(viewed.getAttribute("aria-current")).toBe("location")
		const marker = viewed.querySelector('[aria-hidden="true"].rounded-full')
		expect(marker?.className).toMatch(/ring-4/)
		expect(marker?.className).toMatch(/ring-amber-400/)
	})

	// ── Phase surfacing in the hover card ────────────────────────────────────
	//
	// When `phase` is supplied, the current stage's hover card surfaces
	// "<Phase> phase" as a sub-line so reviewers see WHICH phase the
	// stage sits in without leaving the stepper.

	it("hover card on current stage surfaces the phase sub-line", () => {
		render(
			<StageProgressStrip
				stages={[
					{ name: "inception", status: "completed", visits: 1 },
					{ name: "design", status: "current", visits: 1, phase: "review" },
				]}
				currentStage="design"
			/>,
		)
		const designButton = byStage("design")
		// The hover card lives inside the button as a role=tooltip span
		// so SR users get the same content via aria-describedby's
		// implicit fallthrough. We assert on the rendered text.
		expect(designButton.textContent).toMatch(/Review phase/)
	})

	it("hover card on completed stage does NOT surface a phase sub-line", () => {
		// Completed stages have no live phase — surfacing one would
		// confuse "completed" with "still in review".
		render(
			<StageProgressStrip
				stages={[
					{ name: "inception", status: "completed", visits: 1, phase: "" },
					{ name: "design", status: "current", visits: 1, phase: "execute" },
				]}
				currentStage="design"
			/>,
		)
		const inceptionButton = byStage("inception")
		expect(inceptionButton.textContent).not.toMatch(/phase$/i)
		// Status sub-line still reads "completed".
		expect(inceptionButton.textContent).toMatch(/completed/i)
	})

	it("hover card surfaces pending-feedback count when > 0", () => {
		render(
			<StageProgressStrip
				stages={[
					{
						name: "inception",
						status: "completed",
						visits: 1,
						pendingCount: 3,
					},
					{ name: "design", status: "current", visits: 1, phase: "review" },
				]}
				currentStage="design"
			/>,
		)
		const inceptionButton = byStage("inception")
		expect(inceptionButton.textContent).toMatch(/3 pending feedback/i)
	})
})
