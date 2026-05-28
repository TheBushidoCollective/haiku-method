/**
 * AnnotationModeContext tests.
 *
 * Covers the two activation paths the global annotation mode exposes:
 *   - the persistent FAB toggle (`pinned`)
 *   - the held Alt/Option transient (`transient`)
 * and their derivation into the single `active` value surfaces gate on,
 * plus the unprovided fallback contract (`provided: false`).
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AnnotationModeFab } from "../../organisms/AnnotationModeFab"
import {
	AnnotationModeProvider,
	type AnnotationModeValue,
	useAnnotationMode,
} from "../AnnotationModeContext"

afterEach(cleanup)

/** Renders the live context value into the DOM as JSON so assertions can
 *  read pinned/transient/active without reaching into React internals. */
function Probe(): React.ReactElement {
	const mode = useAnnotationMode()
	return (
		<div
			data-testid="probe"
			data-provided={String(mode.provided)}
			data-pinned={String(mode.pinned)}
			data-transient={String(mode.transient)}
			data-active={String(mode.active)}
		/>
	)
}

function readProbe(): Pick<
	AnnotationModeValue,
	"provided" | "pinned" | "transient" | "active"
> {
	const el = screen.getByTestId("probe")
	return {
		provided: el.getAttribute("data-provided") === "true",
		pinned: el.getAttribute("data-pinned") === "true",
		transient: el.getAttribute("data-transient") === "true",
		active: el.getAttribute("data-active") === "true",
	}
}

describe("useAnnotationMode — unprovided default", () => {
	it("reports provided:false and inert state with no provider", () => {
		render(<Probe />)
		expect(readProbe()).toEqual({
			provided: false,
			pinned: false,
			transient: false,
			active: false,
		})
	})
})

describe("AnnotationModeProvider", () => {
	it("starts provided + inactive, and the FAB toggles persistent mode", () => {
		render(
			<AnnotationModeProvider>
				<Probe />
				<AnnotationModeFab />
			</AnnotationModeProvider>,
		)
		expect(readProbe()).toMatchObject({
			provided: true,
			pinned: false,
			active: false,
		})

		const fab = screen.getByRole("button")
		expect(fab.getAttribute("aria-pressed")).toBe("false")
		expect(fab.hasAttribute("data-annotation-fab")).toBe(true)

		// Click → pinned on → active.
		fireEvent.click(fab)
		expect(readProbe()).toMatchObject({ pinned: true, active: true })
		expect(fab.getAttribute("aria-pressed")).toBe("true")

		// Click again → off.
		fireEvent.click(fab)
		expect(readProbe()).toMatchObject({ pinned: false, active: false })
	})

	it("holding Alt sets the transient mode; releasing clears it", () => {
		render(
			<AnnotationModeProvider>
				<Probe />
			</AnnotationModeProvider>,
		)
		expect(readProbe().active).toBe(false)

		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" }))
		})
		expect(readProbe()).toMatchObject({ transient: true, active: true })

		act(() => {
			window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" }))
		})
		expect(readProbe()).toMatchObject({ transient: false, active: false })
	})

	it("window blur clears a stuck transient mode", () => {
		render(
			<AnnotationModeProvider>
				<Probe />
			</AnnotationModeProvider>,
		)
		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" }))
		})
		expect(readProbe().transient).toBe(true)

		act(() => {
			window.dispatchEvent(new Event("blur"))
		})
		expect(readProbe().transient).toBe(false)
	})

	it("pinned stays on independent of the Alt transient", () => {
		render(
			<AnnotationModeProvider>
				<Probe />
				<AnnotationModeFab />
			</AnnotationModeProvider>,
		)
		fireEvent.click(screen.getByRole("button"))
		expect(readProbe()).toMatchObject({ pinned: true, active: true })

		// Alt down then up — pinned must survive the transient release.
		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" }))
		})
		act(() => {
			window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" }))
		})
		expect(readProbe()).toMatchObject({
			pinned: true,
			transient: false,
			active: true,
		})
	})
})
