import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Card } from "../Card"

afterEach(() => {
	cleanup()
})

describe("Card primitive", () => {
	it("renders flat elevation with white/stone-900 surface + shadow-sm", () => {
		const { container } = render(<Card>body</Card>)
		const div = container.querySelector("div")
		const cls = div?.className ?? ""
		expect(cls).toContain("bg-white")
		expect(cls).toContain("dark:bg-stone-900")
		expect(cls).toContain("shadow-sm")
		expect(cls).toContain("border")
		expect(cls).toContain("rounded-xl")
	})

	it("renders raised elevation with stone-50/50 surface + shadow-md", () => {
		const { container } = render(<Card elevation="raised">body</Card>)
		const cls = container.querySelector("div")?.className ?? ""
		expect(cls).toContain("bg-stone-50/50")
		expect(cls).toContain("dark:bg-stone-800/50")
		expect(cls).toContain("shadow-md")
	})

	it.each([
		["none", "p-0"],
		["sm", "p-3"],
		["md", "p-6"],
		["lg", "p-8"],
	] as const)("padding=%s applies %s", (padding, expectedClass) => {
		const { container } = render(<Card padding={padding}>body</Card>)
		const cls = container.querySelector("div")?.className ?? ""
		expect(cls).toContain(expectedClass)
	})

	it("renders children and forwards className + arbitrary attrs", () => {
		const { container } = render(
			<Card className="x" id="c1" data-testid="card">
				<span>inner</span>
			</Card>,
		)
		const div = container.querySelector("div") as HTMLDivElement
		expect(div.id).toBe("c1")
		expect(div.getAttribute("data-testid")).toBe("card")
		expect(div.className).toContain("x")
		expect(div.querySelector("span")?.textContent).toBe("inner")
	})

	it("never emits opacity-* state class (opacity-on-root banned)", () => {
		const { container } = render(<Card>body</Card>)
		const cls = container.querySelector("div")?.className ?? ""
		expect(cls).not.toMatch(/\bopacity-(50|60|70)\b/)
	})
})
