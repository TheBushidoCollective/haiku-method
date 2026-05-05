/**
 * DriftBanner tests (unit-13).
 *
 * Covers:
 *   - mounts when drift is non-empty; renders nothing when empty
 *   - disclosure reveals the entry list with aria-expanded + aria-controls
 *   - role="status" + aria-live="polite" on the container
 *   - amber stripe border (color-not-only signal)
 *   - architecture-vs-design conflict: NO "Run now" button
 *   - DriftEntryRow renders with stage / intent chips and mono path
 *   - reduced-motion: transition durations are clamped via the canonical
 *     `transition-duration: 0.01ms` rule in index.css; we assert the
 *     banner exposes a `transition-[opacity]` utility (the parent rule
 *     does the rest)
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DriftEntry } from "../src/atoms/DriftEntryRow"
import { DriftBanner } from "../src/molecules/DriftBanner"

afterEach(() => {
	cleanup()
})

const NOW = Date.parse("2026-04-30T12:00:00Z")

function makeEntry(overrides: Partial<DriftEntry> = {}): DriftEntry {
	return {
		path: "stages/design/artifacts/dashboard-layout.html",
		stage: "design",
		intent: "demo-intent",
		action: "modified",
		age: new Date(NOW - 5 * 60_000).toISOString(),
		...overrides,
	}
}

describe("DriftBanner — mount / unmount lifecycle", () => {
	it("mounts when drift is non-empty", () => {
		render(<DriftBanner drift={[makeEntry()]} />)
		expect(screen.getByTestId("drift-banner")).toBeTruthy()
		expect(screen.getByText("Out-of-band change detected")).toBeTruthy()
	})

	it("renders nothing when drift list is empty (auto-unmount on tick_complete)", () => {
		const { container } = render(<DriftBanner drift={[]} />)
		expect(container.firstChild).toBeNull()
	})

	it("renders the count + 'next workflow tick' subtext", () => {
		render(
			<DriftBanner
				drift={[makeEntry({ path: "a" }), makeEntry({ path: "b" })]}
			/>,
		)
		expect(
			screen.getByText(/2 files changed since the last tick/i),
		).toBeTruthy()
		expect(
			screen.getByText(/The next workflow tick will assess impact\./i),
		).toBeTruthy()
	})

	it("uses singular 'file' when count is 1", () => {
		render(<DriftBanner drift={[makeEntry()]} />)
		expect(screen.getByText(/1 file changed since the last tick/i)).toBeTruthy()
	})
})

describe("DriftBanner — disclosure", () => {
	it("starts collapsed by default and reveals entries on click", () => {
		render(
			<DriftBanner drift={[makeEntry({ path: "stages/design/a.html" })]} />,
		)
		const toggle = screen.getByRole("button", {
			name: /show changed files/i,
		})
		expect(toggle.getAttribute("aria-expanded")).toBe("false")
		// Entry list is hidden initially
		expect(screen.queryByRole("region", { name: /changed files/i })).toBeNull()
		fireEvent.click(toggle)
		expect(toggle.getAttribute("aria-expanded")).toBe("true")
		const region = screen.getByRole("region", { name: /changed files/i })
		expect(within(region).getByText(/a\.html/)).toBeTruthy()
	})

	it("disclosure aria-controls points at the rendered region", () => {
		render(<DriftBanner drift={[makeEntry()]} defaultExpanded />)
		const toggle = screen.getByRole("button", {
			name: /hide changed files/i,
		})
		const id = toggle.getAttribute("aria-controls")
		expect(id).toBeTruthy()
		const region = screen.getByRole("region", { name: /changed files/i })
		expect(region.getAttribute("id")).toBe(id)
	})

	it("collapses again when toggled twice", () => {
		render(<DriftBanner drift={[makeEntry()]} defaultExpanded />)
		const toggle = screen.getByRole("button", {
			name: /hide changed files/i,
		})
		fireEvent.click(toggle)
		expect(toggle.getAttribute("aria-expanded")).toBe("false")
	})
})

describe("DriftBanner — accessibility", () => {
	it("container has role='status' and aria-live='polite'", () => {
		render(<DriftBanner drift={[makeEntry()]} />)
		const banner = screen.getByTestId("drift-banner")
		expect(banner.getAttribute("role")).toBe("status")
		expect(banner.getAttribute("aria-live")).toBe("polite")
	})

	it("amber leading icon is decorative (aria-hidden)", () => {
		const { container } = render(<DriftBanner drift={[makeEntry()]} />)
		const decorations = container.querySelectorAll('[aria-hidden="true"]')
		// At least the leading icon + the disclosure caret glyph
		expect(decorations.length).toBeGreaterThanOrEqual(2)
	})

	it("amber stripe border is present for color-not-only signal (SC-5.3)", () => {
		const { container } = render(<DriftBanner drift={[makeEntry()]} />)
		const banner = container.querySelector('[data-testid="drift-banner"]')
		expect(banner?.className).toMatch(/border-l-4/)
		expect(banner?.className).toMatch(/border-l-amber-500/)
	})

	it("the path is wrapped in <bdi> for RTL safety", () => {
		const { container } = render(
			<DriftBanner drift={[makeEntry()]} defaultExpanded />,
		)
		const bdi = container.querySelector("bdi")
		expect(bdi).toBeTruthy()
		expect(bdi?.textContent).toMatch(/dashboard-layout\.html/)
	})

	it("non-actionable rows are <div> with no focus when onView is omitted", () => {
		render(<DriftBanner drift={[makeEntry()]} defaultExpanded />)
		// no <button> for the row itself (the disclosure button is for the banner)
		const rowButtons = screen
			.queryAllByRole("button")
			.filter((b) => /view /i.test(b.getAttribute("aria-label") ?? ""))
		expect(rowButtons.length).toBe(0)
		expect(screen.getByTestId("drift-entry-row")).toBeTruthy()
	})

	it("rows wrap in <button> when onOpenFile is supplied", () => {
		render(
			<DriftBanner
				drift={[makeEntry()]}
				onOpenFile={() => {}}
				defaultExpanded
			/>,
		)
		expect(
			screen.getByRole("button", {
				name: /view stages\/design\/artifacts\/dashboard-layout\.html/i,
			}),
		).toBeTruthy()
	})

	it("clicking a row dispatches onOpenFile with the entry", () => {
		const onOpenFile = vi.fn()
		const entry = makeEntry()
		render(
			<DriftBanner drift={[entry]} onOpenFile={onOpenFile} defaultExpanded />,
		)
		fireEvent.click(
			screen.getByRole("button", { name: /view stages\/design/i }),
		)
		expect(onOpenFile).toHaveBeenCalledWith(entry)
	})
})

describe("DriftBanner — architecture-vs-design conflict resolution", () => {
	it("does NOT render a 'Run now' button (passive-observer rule)", () => {
		render(<DriftBanner drift={[makeEntry()]} defaultExpanded />)
		expect(screen.queryByText(/run now/i)).toBeNull()
		expect(screen.queryByRole("button", { name: /run now/i })).toBeNull()
	})

	it("subtext explicitly references the next workflow tick", () => {
		render(<DriftBanner drift={[makeEntry()]} />)
		expect(
			screen.getByText(/the next workflow tick will assess impact/i),
		).toBeTruthy()
	})
})

describe("DriftBanner — reduced-motion compliance", () => {
	it("uses a Tailwind transition utility (auto-clamped under prefers-reduced-motion)", () => {
		const { container } = render(<DriftBanner drift={[makeEntry()]} />)
		const banner = container.querySelector('[data-testid="drift-banner"]')
		// The global @media (prefers-reduced-motion: reduce) rule in
		// index.css clamps every transition-duration to 0.01ms — this
		// component opts in by exposing the standard transition-[opacity]
		// utility rather than authoring a bespoke @keyframes.
		expect(banner?.className).toMatch(/transition-/)
	})
})
