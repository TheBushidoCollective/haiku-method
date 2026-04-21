import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Chip } from "../Chip"

afterEach(() => {
	cleanup()
})

describe("Chip primitive", () => {
	it("renders neutral tone by default", () => {
		const { container } = render(<Chip>neutral</Chip>)
		const span = container.querySelector("span") as HTMLSpanElement
		const cls = span.className
		expect(cls).toContain("border-stone-200")
		expect(cls).toContain("text-stone-700")
	})

	it("renders teal (active filter) tone with bg-teal-600 + text-white", () => {
		const { container } = render(<Chip tone="teal">active</Chip>)
		const cls = container.querySelector("span")?.className ?? ""
		expect(cls).toContain("bg-teal-600")
		expect(cls).toContain("text-white")
	})

	it("renders muted tone token pair", () => {
		const { container } = render(<Chip tone="muted">muted</Chip>)
		const cls = container.querySelector("span")?.className ?? ""
		expect(cls).toContain("bg-stone-100")
		expect(cls).toContain("text-stone-600")
	})

	it("renders remove button only when onRemove provided", () => {
		const noRm = render(<Chip>x</Chip>)
		expect(noRm.container.querySelector("button")).toBeNull()
		cleanup()
		const onRemove = vi.fn()
		const rm = render(<Chip onRemove={onRemove}>x</Chip>)
		const btn = rm.container.querySelector("button") as HTMLButtonElement
		expect(btn).not.toBeNull()
		expect(btn.getAttribute("aria-label")).toBe("Remove chip")
		fireEvent.click(btn)
		expect(onRemove).toHaveBeenCalledTimes(1)
	})

	it("remove button uses focus-visible:ring-2 (NOT focus:ring-1)", () => {
		const { container } = render(
			<Chip onRemove={() => {}}>x</Chip>,
		)
		const cls = container.querySelector("button")?.className ?? ""
		expect(cls).toContain("focus-visible:ring-2")
		expect(cls).not.toMatch(/\bfocus:ring-1\b/)
	})
})
