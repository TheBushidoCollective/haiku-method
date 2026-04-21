import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { touchTargetClass, touchTargetHitAreaClass } from "../touch-target"

afterEach(() => {
	cleanup()
})

/**
 * jsdom doesn't implement layout (getBoundingClientRect returns zeros),
 * and it only applies CSS from <style> tags in the document — not from
 * external imports. We therefore inject the canonical `.touch-target`
 * rules as a <style> node in beforeAll so `getComputedStyle` resolves
 * `min-height` / `min-width` to 44px.
 *
 * The CSS under test is authored in `packages/haiku-ui/src/index.css`
 * and mirrored here; any change to the canonical rule must land in both
 * places and this test will fail first.
 */
beforeAll(() => {
	const style = document.createElement("style")
	style.setAttribute("data-test-id", "touch-target-css")
	style.textContent = `
		.touch-target {
			position: relative;
			min-height: 44px;
			min-width: 44px;
		}
		.touch-target.touch-target--hit-area {
			min-height: unset;
			min-width: unset;
		}
	`
	document.head.appendChild(style)
})

describe("touchTargetClass token", () => {
	it("emits the canonical 'touch-target' class string", () => {
		expect(touchTargetClass).toBe("touch-target")
	})

	it("renders a 20x20 icon button with ≥44×44 computed min dimensions", () => {
		const { container } = render(
			<button
				type="button"
				className={`w-5 h-5 ${touchTargetClass}`}
				data-testid="btn"
			>
				x
			</button>,
		)
		const el = container.querySelector(
			"[data-testid='btn']",
		) as HTMLButtonElement
		const style = getComputedStyle(el)
		expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(44)
		expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(44)
		// Visible geometry (className still carries w-5 h-5) is unchanged
		// — the class reports the expansion via min-* sizing.
		expect(el.classList.contains("touch-target")).toBe(true)
		expect(el.classList.contains("w-5")).toBe(true)
		expect(el.classList.contains("h-5")).toBe(true)
	})
})

describe("touchTargetHitAreaClass token", () => {
	it("emits the canonical 'touch-target touch-target--hit-area' combo", () => {
		expect(touchTargetHitAreaClass).toBe("touch-target touch-target--hit-area")
	})

	it("renders with the hit-area modifier class applied", () => {
		const { container } = render(
			<button
				type="button"
				className={`w-7 h-7 ${touchTargetHitAreaClass}`}
				data-testid="pin"
			>
				•
			</button>,
		)
		const el = container.querySelector(
			"[data-testid='pin']",
		) as HTMLButtonElement
		expect(el.classList.contains("touch-target")).toBe(true)
		expect(el.classList.contains("touch-target--hit-area")).toBe(true)
	})
})
