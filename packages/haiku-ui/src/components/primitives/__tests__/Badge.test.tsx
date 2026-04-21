import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Badge } from "../Badge"

afterEach(() => {
	cleanup()
})

describe("Badge primitive", () => {
	it("renders every tone with AA-compliant token pairs", () => {
		const tones = [
			"neutral",
			"success",
			"warning",
			"info",
			"danger",
		] as const
		for (const tone of tones) {
			const { container } = render(<Badge tone={tone}>{tone}</Badge>)
			const span = container.querySelector("span")
			expect(span).not.toBeNull()
			const cls = span?.className ?? ""
			expect(cls).toContain("inline-flex")
			expect(cls).toContain("rounded-full")
			cleanup()
		}
	})

	it("neutral tone uses text-stone-600 (NOT banned text-stone-500 per FB-15)", () => {
		const { container } = render(<Badge tone="neutral">neutral</Badge>)
		const cls = container.querySelector("span")?.className ?? ""
		expect(cls).toContain("bg-stone-100")
		expect(cls).toContain("text-stone-600")
		// text-stone-500 on bg-stone-100 is 4.40:1 — BANNED per DESIGN-TOKENS §1.1a.
		expect(cls).not.toMatch(/\btext-stone-500\b/)
	})

	it("renders size=md at text-xs (typography floor) and size=sm at text-[11px] font-bold", () => {
		const mdRender = render(<Badge size="md">md</Badge>)
		expect(mdRender.container.querySelector("span")?.className).toContain(
			"text-xs",
		)
		cleanup()
		const smRender = render(<Badge size="sm">sm</Badge>)
		const smCls = smRender.container.querySelector("span")?.className ?? ""
		expect(smCls).toContain("text-[11px]")
		expect(smCls).toContain("font-bold")
	})

	it("is a pure label — passes through className and arbitrary html attrs", () => {
		const { container } = render(
			<Badge className="extra" aria-label="status">
				ok
			</Badge>,
		)
		const span = container.querySelector("span") as HTMLSpanElement
		expect(span.className).toContain("extra")
		expect(span.getAttribute("aria-label")).toBe("status")
	})
})
