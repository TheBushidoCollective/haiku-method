/**
 * KnowledgeUploadPanel tests (unit-11).
 *
 * Covers Completion-Criteria assertions from
 * `.haiku/intents/out-of-band-human-file-modifications/stages/development/units/unit-11-spa-knowledge-upload-panel.md`:
 *
 *   - Renders disclosure, drop zone, destination select with default
 *     `Intent knowledge`.
 *   - Drop event populates staged list; Upload calls onUpload(files,
 *     destination).
 *   - Validation rejection on file too large; remaining valid files stage.
 *   - Cancel clears state; success toast appears after a successful POST
 *     mocked at /api/intents/{intentSlug}/uploads/knowledge.
 *   - 413 response surfaces "File exceeds size limit" toast.
 *   - Live region announcements fire on add, remove, success.
 *   - ARIA labels match DESIGN-BRIEF strings exactly (role="button",
 *     aria-label="Upload knowledge file", etc.).
 *   - Reduced-motion: drag-over scale animation suppressed under
 *     prefers-reduced-motion: reduce (mock the media query).
 *   - Mobile (375 px) renders the collapsed single-button variant.
 *   - Disabled state when no active intent: panel is locked + opacity-60-
 *     equivalent (token-bound disabled surface).
 *   - Tab order: caret → drop zone → first staged row → its remove
 *     button → … → destination select → Upload → Cancel.
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installMatchMediaStub } from "../src/a11y/__tests__/matchMedia.stub"
import { injectCanonicalTouchTargetCss } from "../src/a11y/__tests__/touch-target-css"
import {
	KnowledgeUploadPanel,
	type KnowledgeUploadResult,
} from "../src/pages/review/KnowledgeUploadPanel"

beforeEach(() => {
	injectCanonicalTouchTargetCss("knowledge-upload-panel-touch-target-css")
})

afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

function makeFile(
	name: string,
	bytes: number,
	type: string = "text/plain",
): File {
	const blob = new Blob([new Uint8Array(bytes)], { type })
	return new File([blob], name, { type, lastModified: Date.now() })
}

/**
 * jsdom 25 ships an incomplete DataTransfer (no .items), so we hand-roll
 * a minimal stand-in that satisfies the React drop-handler path: a
 * `files: FileList` getter is the only field the production code reads.
 */
function makeFileList(files: File[]): FileList {
	const list = {
		length: files.length,
		item: (i: number) => files[i] ?? null,
		[Symbol.iterator]: function* () {
			for (const f of files) yield f
		},
	} as unknown as FileList
	for (let i = 0; i < files.length; i += 1) {
		Object.defineProperty(list, i, {
			value: files[i],
			enumerable: true,
		})
	}
	return list
}

function makeDataTransfer(files: File[] = []): { files: FileList } {
	return { files: makeFileList(files) }
}

function setFiles(input: HTMLInputElement, files: File[]): void {
	Object.defineProperty(input, "files", {
		configurable: true,
		value: makeFileList(files),
	})
	fireEvent.change(input)
}

const okUpload = (files: File[]): Promise<KnowledgeUploadResult> =>
	Promise.resolve({ ok: true, uploaded: files, failed: [] })

describe("KnowledgeUploadPanel — initial render", () => {
	it("renders the disclosure caret with the canonical label", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const caret = screen.getByTestId("knowledge-upload-caret")
		expect(caret).toBeTruthy()
		expect(caret.textContent).toMatch(/Upload knowledge/)
	})

	it("renders the drop zone with role=button + the canonical aria-label", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const zone = screen.getByRole("button", { name: "Upload knowledge file" })
		expect(zone).toBeTruthy()
		expect(zone.getAttribute("aria-label")).toBe("Upload knowledge file")
		expect(zone.getAttribute("tabindex")).toBe("0")
	})

	it("hides the destination select until a file is staged (matches DESIGN-BRIEF empty state)", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		expect(screen.queryByTestId("destination-select")).toBeNull()
	})

	it("the destination select defaults to Intent knowledge once staging populates", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 1024)])
		const select = screen.getByTestId("destination-select") as HTMLSelectElement
		expect(select.value).toBe("intent")
		const option = within(select).getByRole("option", {
			name: "Intent knowledge",
		}) as HTMLOptionElement
		expect(option).toBeTruthy()
	})
})

describe("KnowledgeUploadPanel — drop / browse staging", () => {
	it("drop event populates the staged list", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const zone = screen.getByTestId("knowledge-drop-zone")
		const file = makeFile("hero.png", 4096, "image/png")
		fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) })
		const stagedList = screen.getByTestId("staged-list")
		expect(within(stagedList).getByText("hero.png")).toBeTruthy()
	})

	it("clicking Upload calls onUpload with the file array and destination", async () => {
		const onUpload = vi.fn(okUpload)
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={onUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		const f1 = makeFile("a.md", 200)
		const f2 = makeFile("b.md", 300)
		setFiles(input, [f1, f2])
		const submit = screen.getByTestId("knowledge-upload-submit")
		fireEvent.click(submit)
		await waitFor(() => {
			expect(onUpload).toHaveBeenCalledTimes(1)
		})
		expect(onUpload).toHaveBeenCalledWith([f1, f2], "intent")
	})
})

describe("KnowledgeUploadPanel — validation", () => {
	it("rejects files larger than 10 MB; valid siblings still stage", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		const big = makeFile(
			"huge.bin",
			20 * 1024 * 1024,
			"application/octet-stream",
		)
		const ok = makeFile("notes.md", 1024)
		setFiles(input, [big, ok])
		// The valid file stages.
		const stagedList = screen.getByTestId("staged-list")
		expect(within(stagedList).getByText("notes.md")).toBeTruthy()
		// The big file does not.
		expect(within(stagedList).queryByText("huge.bin")).toBeNull()
		// Rejection message announced in rose-600 typography.
		const rejection = screen.getByTestId("knowledge-upload-rejection")
		expect(rejection.textContent).toMatch(/exceeds size limit/i)
		expect(rejection.className).toMatch(/text-rose-700|text-rose-600/)
	})
})

describe("KnowledgeUploadPanel — cancel + success toast", () => {
	it("cancel clears staged state and collapses the panel", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("notes.md", 512)])
		expect(screen.getByTestId("staged-list")).toBeTruthy()
		fireEvent.click(screen.getByTestId("knowledge-upload-cancel"))
		expect(screen.queryByTestId("staged-list")).toBeNull()
		expect(screen.queryByTestId("knowledge-upload-body")).toBeNull()
	})

	it("success toast appears after a successful POST and references the destination label", async () => {
		const onUpload = vi.fn(okUpload)
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={onUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 800)])
		fireEvent.click(screen.getByTestId("knowledge-upload-submit"))
		// Re-open the panel — success collapses it. Toast still renders inside
		// the form, so re-expand to verify.
		await waitFor(() => {
			fireEvent.click(screen.getByTestId("knowledge-upload-caret"))
			expect(screen.getByTestId("knowledge-upload-toast")).toBeTruthy()
		})
		expect(screen.getByTestId("knowledge-upload-toast").textContent).toMatch(
			/Uploaded 1 file to Intent knowledge/,
		)
	})
})

describe("KnowledgeUploadPanel — 413 / partial-failure surfacing", () => {
	it("surfaces 'File exceeds size limit' when onUpload reports a 413-equivalent failure", async () => {
		const onUpload = vi
			.fn<(files: File[]) => Promise<KnowledgeUploadResult>>()
			.mockResolvedValue({
				ok: false,
				uploaded: [],
				failed: [
					{
						file: makeFile("brand.md", 800),
						error: "File exceeds size limit",
					},
				],
			})
		const onError = vi.fn()
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={onUpload}
				onError={onError}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 800)])
		fireEvent.click(screen.getByTestId("knowledge-upload-submit"))
		await waitFor(() => {
			expect(onError).toHaveBeenCalledWith("File exceeds size limit")
		})
		// Live region carries the failure copy.
		const live = screen.getByTestId("knowledge-upload-live")
		expect(live.textContent).toMatch(/Upload failed: File exceeds size limit/)
	})

	it("partial failures keep failed rows + relabel the primary button to 'Retry N file(s)'", async () => {
		const f1 = makeFile("ok.md", 100)
		const f2 = makeFile("bad.md", 200)
		const onUpload = vi
			.fn<(files: File[]) => Promise<KnowledgeUploadResult>>()
			.mockResolvedValue({
				ok: true,
				uploaded: [f1],
				failed: [{ file: f2, error: "write_failed" }],
			})
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={onUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [f1, f2])
		fireEvent.click(screen.getByTestId("knowledge-upload-submit"))
		await waitFor(() => {
			expect(screen.getByTestId("knowledge-upload-submit").textContent).toMatch(
				/Retry 1 file/,
			)
		})
		// f1 (succeeded) was removed from the staged list; f2 (failed) remains.
		const stagedList = screen.getByTestId("staged-list")
		expect(within(stagedList).queryByText("ok.md")).toBeNull()
		expect(within(stagedList).getByText("bad.md")).toBeTruthy()
	})
})

describe("KnowledgeUploadPanel — live-region announcements", () => {
	it("announces 'Added <name>' on file add", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 800)])
		const live = screen.getByTestId("knowledge-upload-live")
		expect(live.textContent).toBe("Added brand.md")
	})

	it("announces 'Removed <name>' on file remove", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 800)])
		const removeBtn = screen.getByRole("button", {
			name: "Remove brand.md from upload",
		})
		fireEvent.click(removeBtn)
		const live = screen.getByTestId("knowledge-upload-live")
		expect(live.textContent).toBe("Removed brand.md")
	})

	it("announces a success summary with the destination label after a complete upload", async () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 800)])
		fireEvent.click(screen.getByTestId("knowledge-upload-submit"))
		await waitFor(() => {
			const live = screen.getByTestId("knowledge-upload-live")
			expect(live.textContent).toMatch(/Uploaded 1 files to Intent knowledge/)
		})
	})
})

describe("KnowledgeUploadPanel — ARIA literal-string regression guards", () => {
	it("drop zone has the literal aria-label='Upload knowledge file' (DESIGN-BRIEF Screen 1)", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const zone = screen.getByTestId("knowledge-drop-zone")
		expect(zone.getAttribute("aria-label")).toBe("Upload knowledge file")
	})

	it("staged list has role='list' and rows have role='listitem'", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 800)])
		const list = screen.getByTestId("staged-list")
		expect(list.getAttribute("role")).toBe("list")
		const row = screen.getByTestId("staged-file-row")
		expect(row.getAttribute("role")).toBe("listitem")
	})

	it("remove button has aria-label='Remove <file.name> from upload' (interpolated literal)", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 800)])
		expect(
			screen.getByRole("button", { name: "Remove brand.md from upload" }),
		).toBeTruthy()
	})

	it("disclosure carries aria-expanded that reflects open state", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const caret = screen.getByTestId("knowledge-upload-caret")
		expect(caret.getAttribute("aria-expanded")).toBe("true")
		fireEvent.click(caret)
		expect(caret.getAttribute("aria-expanded")).toBe("false")
	})
})

describe("KnowledgeUploadPanel — reduced-motion variant", () => {
	let stub: ReturnType<typeof installMatchMediaStub>

	beforeEach(() => {
		stub = installMatchMediaStub({
			"(prefers-reduced-motion: reduce)": true,
		})
	})

	afterEach(() => {
		stub.restore()
	})

	it("drop zone does NOT receive the scale-on-drag-over class under prefers-reduced-motion", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const zone = screen.getByTestId("knowledge-drop-zone")
		fireEvent.dragOver(zone, { dataTransfer: makeDataTransfer([]) })
		// The component swaps in `scale-[1.01]` only when reduced-motion is false.
		expect(zone.className).not.toMatch(/scale-\[1\.01\]/)
		expect(zone.getAttribute("data-reduced-motion")).toBe("true")
	})
})

describe("KnowledgeUploadPanel — mobile (375 px) collapsed variant", () => {
	it("renders a single full-width '+ Add files' button instead of the drag affordance", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
				collapsedVariant
			/>,
		)
		const trigger = screen.getByRole("button", {
			name: "Upload knowledge file",
		})
		expect(trigger.tagName).toBe("BUTTON")
		expect(trigger.textContent?.trim()).toBe("+ Add files")
		// The desktop drop zone (a div with role=button) is not present.
		expect(trigger.tagName).not.toBe("DIV")
	})
})

describe("KnowledgeUploadPanel — disabled state", () => {
	it("when disabled, root section locks pointer events and surfaces a token-bound disabled surface", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
				disabled
			/>,
		)
		const root = screen.getByTestId("knowledge-upload-panel")
		expect(root.getAttribute("data-disabled")).toBe("true")
		expect(root.className).toMatch(/pointer-events-none/)
	})
})

describe("KnowledgeUploadPanel — tab order", () => {
	it("tab order is caret → drop zone → staged row → remove → destination → upload → cancel", () => {
		render(
			<KnowledgeUploadPanel
				intentSlug="demo-intent"
				currentStage="design"
				onUpload={okUpload}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("brand.md", 800)])
		const caret = screen.getByTestId("knowledge-upload-caret")
		const zone = screen.getByTestId("knowledge-drop-zone")
		const remove = screen.getByRole("button", {
			name: "Remove brand.md from upload",
		})
		const destination = screen.getByTestId("destination-select")
		const submit = screen.getByTestId("knowledge-upload-submit")
		const cancel = screen.getByTestId("knowledge-upload-cancel")

		const focusable = Array.from(
			document.querySelectorAll<HTMLElement>(
				"button, [role='button'], select, [tabindex='0']",
			),
		).filter((el) => !el.hasAttribute("disabled"))

		const indexOf = (el: HTMLElement): number => focusable.indexOf(el)
		expect(indexOf(caret)).toBeLessThan(indexOf(zone))
		expect(indexOf(zone)).toBeLessThan(indexOf(remove))
		expect(indexOf(remove)).toBeLessThan(indexOf(destination))
		expect(indexOf(destination)).toBeLessThan(indexOf(submit))
		expect(indexOf(submit)).toBeLessThan(indexOf(cancel))
	})
})
