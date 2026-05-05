/**
 * DriftAssessmentsView tests (unit-13).
 *
 * Covers the feature scenarios from
 * `features/drift-assessment-visibility.feature`:
 *
 *   - "lists recent assessments most-recent-first"
 *   - "outcome badge for surface-as-feedback links to the underlying FB"
 *   - "shows pending-revisit state between trigger-revisit and revisit-invoked"
 *   - "resolves pending-revisit when revisited stage re-passes its gate"
 *   - "shows empty state when no assessments exist"
 *   - "degrades gracefully on a corrupted record"
 *   - "outcome badge text matches the classification outcome" (Scenario Outline)
 *   - chat-summary autopilot helper produces the documented copy
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OutcomeBadge } from "../src/atoms/OutcomeBadge"
import {
	type AssessmentEntry,
	type AssessmentRecord,
	DriftAssessmentsView,
	driftAssessmentsTickHref,
	formatAssessmentSummary,
} from "../src/pages/review/DriftAssessmentsView"

afterEach(() => {
	cleanup()
})

const NOW = Date.parse("2026-04-30T12:00:00Z")

function record(overrides: Partial<AssessmentRecord> = {}): AssessmentRecord {
	return {
		id: "DA-01",
		paths: ["stages/design/artifacts/dashboard-layout.html"],
		change_kind: "modified",
		outcome: "ignore",
		created_at: new Date(NOW - 60 * 60_000).toISOString(),
		rationale_excerpt: "Whitespace-only edit; no semantic change.",
		agent_rationale:
			"Diff shows only whitespace and one comment update. No content delta — classified as ignore and the baseline was advanced.",
		diff_unified: "@@ -1,3 +1,3 @@\n-old\n+new\n",
		...overrides,
	}
}

describe("DriftAssessmentsView — most-recent-first ordering", () => {
	it("renders rows ordered by created_at descending", () => {
		const t1 = new Date(NOW - 3 * 60 * 60_000).toISOString()
		const t2 = new Date(NOW - 2 * 60 * 60_000).toISOString()
		const t3 = new Date(NOW - 1 * 60 * 60_000).toISOString()
		const entries: AssessmentEntry[] = [
			record({ id: "DA-01", created_at: t1 }),
			record({ id: "DA-02", created_at: t2 }),
			record({ id: "DA-03", created_at: t3 }),
		]
		render(
			<DriftAssessmentsView intentSlug="demo-intent" assessments={entries} />,
		)
		const rows = screen.getAllByTestId("drift-assessment-row")
		expect(rows.map((r) => r.getAttribute("data-record-id"))).toEqual([
			"DA-03",
			"DA-02",
			"DA-01",
		])
	})
})

describe("DriftAssessmentsView — empty state", () => {
	it("renders empty state when no records exist", () => {
		render(<DriftAssessmentsView intentSlug="demo-intent" assessments={[]} />)
		expect(screen.getByTestId("drift-assessments-empty")).toBeTruthy()
		expect(
			screen.getByText(/no out-of-band changes have been detected yet/i),
		).toBeTruthy()
		expect(screen.queryByTestId("drift-assessments-list")).toBeNull()
	})
})

describe("DriftAssessmentsView — corrupt record", () => {
	it("renders a 'Record could not be parsed' warning + remaining records still render", () => {
		const entries: AssessmentEntry[] = [
			{ id: "DA-99", error: "parse-error", message: "Unexpected token" },
			record({ id: "DA-02" }),
		]
		render(
			<DriftAssessmentsView intentSlug="demo-intent" assessments={entries} />,
		)
		expect(screen.getByTestId("drift-assessment-corrupt")).toBeTruthy()
		expect(screen.getByText(/Record could not be parsed/)).toBeTruthy()
		expect(screen.getByText(/DA-99/)).toBeTruthy()
		// the valid record beside the corrupt one renders normally
		expect(screen.getByTestId("drift-assessment-row")).toBeTruthy()
	})
})

describe("DriftAssessmentsView — expandable diff + rationale", () => {
	it("clicking the row reveals the full diff_unified and full agent_rationale", () => {
		render(
			<DriftAssessmentsView
				intentSlug="demo-intent"
				assessments={[record()]}
			/>,
		)
		// agent rationale + diff are hidden initially
		expect(screen.queryByText(/Diff shows only whitespace/)).toBeNull()
		const expand = screen.getByRole("button", {
			name: /view diff and rationale/i,
		})
		fireEvent.click(expand)
		expect(screen.getByText(/Diff shows only whitespace/)).toBeTruthy()
		expect(screen.getByText(/@@ -1,3 \+1,3 @@/)).toBeTruthy()
	})
})

describe("OutcomeBadge — Scenario Outline label table", () => {
	it("ignore → 'Acknowledged'", () => {
		render(<OutcomeBadge outcome="ignore" />)
		expect(screen.getByLabelText("Outcome: Acknowledged")).toBeTruthy()
	})

	it("inline-fix → 'Acknowledged'", () => {
		render(<OutcomeBadge outcome="inline-fix" />)
		expect(screen.getByLabelText("Outcome: Acknowledged")).toBeTruthy()
	})

	it("surface-as-feedback (no id) → 'Surfaced as FB-NN'", () => {
		render(<OutcomeBadge outcome="surface-as-feedback" />)
		expect(screen.getByLabelText("Outcome: Surfaced as FB-NN")).toBeTruthy()
	})

	it("surface-as-feedback (linked FB-07) → 'Surfaced as FB-07' as a link", () => {
		render(
			<OutcomeBadge
				outcome="surface-as-feedback"
				linkedFeedbackId="FB-07"
				href="/review/demo-intent/feedback/FB-07"
			/>,
		)
		const link = screen.getByLabelText("Outcome: Surfaced as FB-07")
		expect(link.tagName).toBe("A")
		expect(link.getAttribute("href")).toBe("/review/demo-intent/feedback/FB-07")
	})

	it("trigger-revisit (default) → 'Pending revisit'", () => {
		render(<OutcomeBadge outcome="trigger-revisit" />)
		expect(screen.getByLabelText("Outcome: Pending revisit")).toBeTruthy()
	})

	it("trigger-revisit + revisit_invoked_at set → 'Revisit invoked'", () => {
		render(
			<OutcomeBadge outcome="trigger-revisit" revisitState="revisit-invoked" />,
		)
		expect(screen.getByLabelText("Outcome: Revisit invoked")).toBeTruthy()
	})

	it("trigger-revisit + cleared_at set → 'Resolved'", () => {
		render(<OutcomeBadge outcome="trigger-revisit" revisitState="resolved" />)
		expect(screen.getByLabelText("Outcome: Resolved")).toBeTruthy()
	})

	it("no outcome (pre-classification) → 'Drift detected'", () => {
		render(<OutcomeBadge />)
		expect(screen.getByLabelText("Outcome: Drift detected")).toBeTruthy()
	})

	it("uses the drift-acknowledged token pair for ignore/inline-fix", () => {
		const { container } = render(<OutcomeBadge outcome="ignore" />)
		const badge = container.firstElementChild
		expect(badge?.className).toMatch(
			/bg-\[var\(--color-drift-acknowledged-bg\)\]/,
		)
		expect(badge?.className).toMatch(
			/text-\[var\(--color-drift-acknowledged-fg\)\]/,
		)
	})

	it("uses the drift-surfaced token pair for surface-as-feedback", () => {
		const { container } = render(<OutcomeBadge outcome="surface-as-feedback" />)
		const badge = container.firstElementChild
		expect(badge?.className).toMatch(/bg-\[var\(--color-drift-surfaced-bg\)\]/)
	})

	it("uses the drift-revisit token pair for trigger-revisit (pending state)", () => {
		const { container } = render(<OutcomeBadge outcome="trigger-revisit" />)
		const badge = container.firstElementChild
		expect(badge?.className).toMatch(/bg-\[var\(--color-drift-revisit-bg\)\]/)
	})

	it("uses the drift-detected token pair for the bare (no-outcome) state", () => {
		const { container } = render(<OutcomeBadge />)
		const badge = container.firstElementChild
		expect(badge?.className).toMatch(/bg-\[var\(--color-drift-detected-bg\)\]/)
	})
})

describe("OutcomeBadge — surface-as-feedback navigation", () => {
	it("clicking the badge invokes onClick (intercepts router navigation)", () => {
		const onClick = vi.fn()
		render(
			<OutcomeBadge
				outcome="surface-as-feedback"
				linkedFeedbackId="FB-07"
				href="/review/demo-intent/feedback/FB-07"
				onClick={onClick}
			/>,
		)
		fireEvent.click(screen.getByLabelText("Outcome: Surfaced as FB-07"))
		expect(onClick).toHaveBeenCalled()
	})
})

describe("DriftAssessmentsView — pending-revisit state machine", () => {
	it("renders 'Pending revisit' when revisit_invoked_at is null", () => {
		render(
			<DriftAssessmentsView
				intentSlug="demo-intent"
				assessments={[
					record({
						id: "DA-10",
						outcome: "trigger-revisit",
						revisit_invoked_at: null,
						pending_marker_cleared_at: null,
					}),
				]}
			/>,
		)
		expect(screen.getByLabelText("Outcome: Pending revisit")).toBeTruthy()
	})

	it("transitions to 'Revisit invoked' when revisit_invoked_at is set", () => {
		render(
			<DriftAssessmentsView
				intentSlug="demo-intent"
				assessments={[
					record({
						id: "DA-10",
						outcome: "trigger-revisit",
						revisit_invoked_at: new Date(NOW - 60_000).toISOString(),
						pending_marker_cleared_at: null,
					}),
				]}
			/>,
		)
		expect(screen.getByLabelText("Outcome: Revisit invoked")).toBeTruthy()
	})

	it("transitions to 'Resolved' when pending_marker_cleared_at is set", () => {
		render(
			<DriftAssessmentsView
				intentSlug="demo-intent"
				assessments={[
					record({
						id: "DA-10",
						outcome: "trigger-revisit",
						revisit_invoked_at: new Date(NOW - 120_000).toISOString(),
						pending_marker_cleared_at: new Date(NOW - 60_000).toISOString(),
					}),
				]}
			/>,
		)
		expect(screen.getByLabelText("Outcome: Resolved")).toBeTruthy()
	})
})

describe("DriftAssessmentsView — surface-as-feedback navigation", () => {
	it("renders the FB-07 badge as a link to the FB detail route", () => {
		render(
			<DriftAssessmentsView
				intentSlug="demo-intent"
				assessments={[
					record({
						id: "DA-15",
						outcome: "surface-as-feedback",
						linked_feedback_id: "FB-07",
					}),
				]}
			/>,
		)
		const link = screen.getByLabelText("Outcome: Surfaced as FB-07")
		expect(link.getAttribute("href")).toBe("/review/demo-intent/feedback/FB-07")
	})

	it("invokes onNavigateToFeedback when the badge is clicked (router intercept)", () => {
		const onNavigate = vi.fn()
		render(
			<DriftAssessmentsView
				intentSlug="demo-intent"
				assessments={[
					record({
						id: "DA-15",
						outcome: "surface-as-feedback",
						linked_feedback_id: "FB-07",
					}),
				]}
				onNavigateToFeedback={onNavigate}
			/>,
		)
		fireEvent.click(screen.getByLabelText("Outcome: Surfaced as FB-07"))
		expect(onNavigate).toHaveBeenCalledWith("demo-intent", "FB-07")
	})
})

describe("DriftAssessmentsView — accessibility", () => {
	it("rows are keyboard-focusable (tabIndex=0)", () => {
		render(
			<DriftAssessmentsView
				intentSlug="demo-intent"
				assessments={[record()]}
			/>,
		)
		const row = screen.getByTestId("drift-assessment-row")
		expect(row.getAttribute("tabindex")).toBe("0")
	})
})

describe("formatAssessmentSummary — chat-surface integration", () => {
	it("12 mixed-outcome → 'X changes detected: 9 ignored, 2 inline-fix, 1 surface-as-feedback'", () => {
		expect(
			formatAssessmentSummary({
				ignore: 9,
				"inline-fix": 2,
				"surface-as-feedback": 1,
				"trigger-revisit": 0,
			}),
		).toBe(
			"12 changes detected: 9 ignored, 2 inline-fix, 1 surface-as-feedback",
		)
	})

	it("ignore-only across multiple ticks → 'N minor changes ignored across X ticks'", () => {
		expect(
			formatAssessmentSummary(
				{
					ignore: 3,
					"inline-fix": 0,
					"surface-as-feedback": 0,
					"trigger-revisit": 0,
				},
				{ ticks: 3 },
			),
		).toBe("3 minor changes ignored across 3 ticks")
	})

	it("single classification → '1 change classified as <outcome>'", () => {
		expect(
			formatAssessmentSummary({
				ignore: 0,
				"inline-fix": 1,
				"surface-as-feedback": 0,
				"trigger-revisit": 0,
			}),
		).toBe("1 change classified as inline-fix")
	})

	it("zero counts → empty string (caller hides the surface)", () => {
		expect(
			formatAssessmentSummary({
				ignore: 0,
				"inline-fix": 0,
				"surface-as-feedback": 0,
				"trigger-revisit": 0,
			}),
		).toBe("")
	})

	it("driftAssessmentsTickHref produces a deep-link URL", () => {
		expect(driftAssessmentsTickHref("demo-intent", "tick-42")).toBe(
			"/review/demo-intent/drift-assessments?tick=tick-42",
		)
	})
})
