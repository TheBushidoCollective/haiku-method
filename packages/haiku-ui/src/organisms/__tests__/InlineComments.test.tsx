/**
 * InlineComments — annotation-mode → comment-prompt coverage.
 *
 * Guards the reported "annotation pen toggle is not working — highlighting
 * text just highlights it and does NOT prompt for a comment" symptom by
 * pinning the contract that path depends on: the selection→prompt popover is
 * gated on annotation mode being ACTIVE.
 *   - mode OFF → a text selection is a plain browser selection, no popover.
 *   - mode ON  → selecting text in the rendered content opens the
 *                "+ Comment" popover anchored to the selection.
 *
 * These tests drive the FULL live wiring: the global `AnnotationModeProvider`
 * wraps both the pen FAB and `InlineComments` (mirroring the app's root), the
 * FAB toggles the shared mode, and InlineComments reads it. If the FAB and the
 * content ever stop sharing one provider, or InlineComments stops reading the
 * mode, the ON test goes red.
 *
 * jsdom notes:
 *   - jsdom's `Range` has no `getBoundingClientRect`; the component reads it to
 *     position the popover. Stub it so the popover-positioning path doesn't
 *     throw.
 *   - The CSS Custom Highlight API is absent in jsdom — that only affects the
 *     amber/saved PAINT (a console.warn), NOT the popover, which is the
 *     contract under test here.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { AnnotationModeProvider } from "../../hooks/AnnotationModeContext"
import { AnnotationModeFab } from "../AnnotationModeFab"
import { InlineComments } from "../InlineComments"

beforeAll(() => {
	// jsdom Range lacks getBoundingClientRect; the component reads it to place
	// the popover. A static rect is enough for the popover to mount. Assign via
	// an index cast so the "in" check doesn't narrow the proto type to `never`.
	const proto = Range.prototype as unknown as {
		getBoundingClientRect?: () => DOMRect
	}
	if (!proto.getBoundingClientRect) {
		proto.getBoundingClientRect = () =>
			({
				x: 0,
				y: 0,
				top: 10,
				left: 10,
				right: 50,
				bottom: 30,
				width: 40,
				height: 20,
				toJSON: () => ({}),
			}) as DOMRect
	}
})

afterEach(() => {
	cleanup()
})

const HTML =
	"<p>First paragraph alpha text.</p><p>Second paragraph beta text.</p>"

/** Select the contents of paragraph `idx` inside the rendered prose body. */
function selectParagraph(root: HTMLElement, idx: number): HTMLParagraphElement {
	const p = root.querySelectorAll("p")[idx] as HTMLParagraphElement
	if (!p) throw new Error(`no paragraph at index ${idx}`)
	const range = document.createRange()
	range.selectNodeContents(p)
	const sel = window.getSelection()
	if (!sel) throw new Error("no Selection API in this environment")
	sel.removeAllRanges()
	sel.addRange(range)
	return p
}

/** Drive the full selection→mouseup→rAF path the component listens on. */
async function selectAndRelease(root: HTMLElement, idx: number): Promise<void> {
	selectParagraph(root, idx)
	await act(async () => {
		fireEvent.mouseUp(document)
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
	})
}

function proseRoot(): HTMLElement {
	const el = document.querySelector(".prose")
	if (!el) throw new Error("InlineComments prose root not found")
	return el as HTMLElement
}

function commentButton(): HTMLElement | null {
	return screen.queryByRole("button", { name: /add comment/i })
}

describe("InlineComments — annotation-gated comment prompt", () => {
	it("annotation ON: selecting text opens the + Comment prompt", async () => {
		render(
			<AnnotationModeProvider>
				<AnnotationModeFab />
				<InlineComments htmlContent={HTML} onCommentsChange={() => {}} />
			</AnnotationModeProvider>,
		)
		// Toggle annotation mode on via the global pen FAB.
		fireEvent.click(screen.getByRole("button", { name: /annotation mode/i }))

		await selectAndRelease(proseRoot(), 0)

		// The comment prompt anchored to the selection must appear.
		expect(commentButton()).not.toBeNull()
	})

	it("annotation OFF: selecting text does NOT prompt (plain selection)", async () => {
		render(
			<AnnotationModeProvider>
				<InlineComments htmlContent={HTML} onCommentsChange={() => {}} />
			</AnnotationModeProvider>,
		)
		// No FAB click → annotation mode stays off.
		await selectAndRelease(proseRoot(), 0)

		expect(commentButton()).toBeNull()
	})

	it("annotation toggled OFF after being ON: selection stops prompting again", async () => {
		render(
			<AnnotationModeProvider>
				<AnnotationModeFab />
				<InlineComments htmlContent={HTML} onCommentsChange={() => {}} />
			</AnnotationModeProvider>,
		)
		const fab = screen.getByRole("button", { name: /annotation mode/i })
		// On → prompts.
		fireEvent.click(fab)
		await selectAndRelease(proseRoot(), 0)
		expect(commentButton()).not.toBeNull()
		// Dismiss the open prompt by clicking outside, then toggle off.
		fireEvent.mouseDown(document.body)
		fireEvent.click(fab)
		// Off → a fresh selection no longer prompts.
		await selectAndRelease(proseRoot(), 1)
		expect(commentButton()).toBeNull()
	})

	it("clicking + Comment opens the comment input textarea", async () => {
		render(
			<AnnotationModeProvider>
				<AnnotationModeFab />
				<InlineComments htmlContent={HTML} onCommentsChange={() => {}} />
			</AnnotationModeProvider>,
		)
		fireEvent.click(screen.getByRole("button", { name: /annotation mode/i }))
		await selectAndRelease(proseRoot(), 0)
		const addBtn = commentButton()
		expect(addBtn).not.toBeNull()
		fireEvent.click(addBtn as HTMLElement)
		// The editing textarea is the surface where the inline comment is typed.
		expect(screen.getByPlaceholderText(/add your comment/i)).toBeTruthy()
	})
})
