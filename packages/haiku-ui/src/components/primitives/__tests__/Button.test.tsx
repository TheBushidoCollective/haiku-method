import { cleanup, render } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { Button } from "../Button"

afterEach(() => {
	cleanup()
})

describe("Button primitive", () => {
	it("renders every variant × size with enabled tokens", () => {
		const variants = ["primary", "secondary", "danger", "ghost"] as const
		const sizes = ["sm", "md", "lg"] as const
		for (const variant of variants) {
			for (const size of sizes) {
				const { container } = render(
					<Button variant={variant} size={size}>
						{`${variant}-${size}`}
					</Button>,
				)
				const btn = container.querySelector("button")
				expect(btn).not.toBeNull()
				const cls = btn?.className ?? ""
				// focus-visible:ring-2 is the canonical focus ring for all variants.
				expect(cls).toContain("focus-visible:ring-2")
				// Enabled buttons must NOT carry opacity-* composite (banned per §1.7).
				expect(cls).not.toMatch(/\bopacity-(50|60|70)\b/)
				cleanup()
			}
		}
	})

	it("applies token-based disabled styles and aria-disabled (no opacity composite)", () => {
		const { container } = render(
			<Button variant="primary" disabled>
				Disabled
			</Button>,
		)
		const btn = container.querySelector("button") as HTMLButtonElement
		expect(btn.disabled).toBe(true)
		expect(btn.getAttribute("aria-disabled")).toBe("true")
		const cls = btn.className
		// Primary-disabled uses bg-green-300 + text-green-800 per DESIGN-TOKENS §1.7.
		expect(cls).toContain("bg-green-300")
		expect(cls).toContain("text-green-800")
		expect(cls).toContain("cursor-not-allowed")
		// Banned: any opacity-{50,60,70} composite on disabled.
		expect(cls).not.toMatch(/\bopacity-(50|60|70)\b/)
	})

	it("applies secondary-disabled token pair with border (non-text contrast 3:1)", () => {
		const { container } = render(
			<Button variant="secondary" disabled>
				Disabled
			</Button>,
		)
		const cls =
			container.querySelector("button")?.className ?? ""
		expect(cls).toContain("bg-stone-100")
		expect(cls).toContain("text-stone-600")
		expect(cls).toContain("border-stone-400")
	})

	it("forwards ref to the underlying <button>", () => {
		const ref = createRef<HTMLButtonElement>()
		render(<Button ref={ref}>ok</Button>)
		expect(ref.current).not.toBeNull()
		expect(ref.current?.tagName).toBe("BUTTON")
	})

	it("passes through arbitrary props and className", () => {
		const { container } = render(
			<Button data-testid="ok" className="extra-class" aria-label="hi">
				ok
			</Button>,
		)
		const btn = container.querySelector("button") as HTMLButtonElement
		expect(btn.getAttribute("data-testid")).toBe("ok")
		expect(btn.getAttribute("aria-label")).toBe("hi")
		expect(btn.className).toContain("extra-class")
	})

	it("does not emit aria-disabled when enabled", () => {
		const { container } = render(<Button>ok</Button>)
		const btn = container.querySelector("button") as HTMLButtonElement
		expect(btn.getAttribute("aria-disabled")).toBeNull()
	})
})
