import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Divider } from "../Divider"

afterEach(() => {
	cleanup()
})

describe("Divider primitive", () => {
	it("renders horizontal with role separator + aria-orientation", () => {
		const { container } = render(<Divider />)
		const el = container.querySelector('[role="separator"]') as HTMLElement
		expect(el).not.toBeNull()
		expect(el.getAttribute("aria-orientation")).toBe("horizontal")
		expect(el.className).toContain("h-px")
		expect(el.className).toContain("w-full")
	})

	it("renders vertical with correct class + aria-orientation", () => {
		const { container } = render(<Divider orientation="vertical" />)
		const el = container.querySelector('[role="separator"]') as HTMLElement
		expect(el.getAttribute("aria-orientation")).toBe("vertical")
		expect(el.className).toContain("w-px")
		expect(el.className).toContain("h-full")
	})

	it("uses token-based stone background in both modes", () => {
		const { container } = render(<Divider />)
		const cls =
			container.querySelector('[role="separator"]')?.className ?? ""
		expect(cls).toContain("bg-stone-200")
		expect(cls).toContain("dark:bg-stone-700")
	})
})
