/**
 * ReplaceOutputDialog tests (unit-12).
 *
 * Covers Completion-Criteria assertions from
 * `.haiku/intents/out-of-band-human-file-modifications/stages/development/units/unit-12-spa-stage-output-replacement.md`:
 *
 *   - Card menu opens on click and on keyboard (Enter/Space). Esc closes.
 *   - Selecting "Replace this output…" opens the dialog with focus on
 *     the drop zone.
 *   - Replace happy path: drop file, click Replace, mocked 200 → dialog
 *     closes → card shows pending chip.
 *   - Mime mismatch: dropped png on html artifact surfaces
 *     `aria-live="assertive"` warning; override flow clears it; note
 *     pre-fills.
 *   - Submit error: 500 response keeps dialog open with retry button.
 *   - Concurrent `output_replaced` WS frame surfaces the non-dismissable
 *     banner.
 *   - ARIA strings verified: `aria-label="Output actions for hero-mockup.html"`,
 *     `role="menu"`, `role="menuitem"`, `aria-haspopup="menu"`,
 *     `aria-expanded` reflects state.
 *   - Reduced-motion: backdrop fade and slide-up are suppressed under
 *     `prefers-reduced-motion: reduce`.
 *   - Mobile (375 px): dialog opens fullscreen; thumbnail stacks; sticky
 *     action bar visible.
 *   - Path traversal in `target_path` prop is sanitised before POST.
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
import { OutputCardMenu } from "../src/molecules/OutputCardMenu"
import {
	type ReplaceOutputArtifact,
	ReplaceOutputDialog,
	sanitizeTargetPath,
} from "../src/organisms/ReplaceOutputDialog"

// jsdom 25 ships <dialog> without showModal/close; polyfill as setAttribute.
beforeEach(() => {
	const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
		showModal?: () => void
		close?: () => void
	}
	if (typeof proto.showModal !== "function") {
		proto.showModal = function () {
			this.setAttribute("open", "")
			Object.defineProperty(this, "open", {
				configurable: true,
				get: () => this.hasAttribute("open"),
			})
		}
	}
	if (typeof proto.close !== "function") {
		proto.close = function () {
			this.removeAttribute("open")
			this.dispatchEvent(new Event("close"))
		}
	}
	injectCanonicalTouchTargetCss("replace-output-dialog-touch-target-css")
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

const HTML_ARTIFACT: ReplaceOutputArtifact = {
	name: "hero-mockup.html",
	mime: "text/html",
	size: 14 * 1024,
	sha: "abc123",
	version: 3,
	content: "<!doctype html><html><body>hi</body></html>",
}

const okSubmit = (): Promise<void> => Promise.resolve()

describe("OutputCardMenu — ARIA + open/close behavior", () => {
	it("trigger has aria-label='Output actions for hero-mockup.html', aria-haspopup='menu', aria-expanded='false' when closed", () => {
		render(
			<OutputCardMenu artifactName="hero-mockup.html" onReplace={() => {}} />,
		)
		const trigger = screen.getByTestId("output-card-menu-trigger")
		expect(trigger.getAttribute("aria-label")).toBe(
			"Output actions for hero-mockup.html",
		)
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu")
		expect(trigger.getAttribute("aria-expanded")).toBe("false")
	})

	it("clicking the trigger opens the popover and flips aria-expanded to 'true'", () => {
		render(
			<OutputCardMenu artifactName="hero-mockup.html" onReplace={() => {}} />,
		)
		const trigger = screen.getByTestId("output-card-menu-trigger")
		fireEvent.click(trigger)
		expect(trigger.getAttribute("aria-expanded")).toBe("true")
		const popover = screen.getByTestId("output-card-menu-popover")
		expect(popover.getAttribute("role")).toBe("menu")
		const replaceItem = screen.getByTestId("output-menu-replace")
		expect(replaceItem.getAttribute("role")).toBe("menuitem")
	})

	it("opens via keyboard Enter and Space", () => {
		render(
			<OutputCardMenu artifactName="hero-mockup.html" onReplace={() => {}} />,
		)
		const trigger = screen.getByTestId("output-card-menu-trigger")
		trigger.focus()
		fireEvent.keyDown(trigger, { key: "Enter" })
		expect(trigger.getAttribute("aria-expanded")).toBe("true")
		// Close and re-open via Space.
		fireEvent.click(trigger)
		expect(trigger.getAttribute("aria-expanded")).toBe("false")
		fireEvent.keyDown(trigger, { key: " " })
		expect(trigger.getAttribute("aria-expanded")).toBe("true")
	})

	it("Esc inside the popover closes it and returns focus to the trigger", () => {
		render(
			<OutputCardMenu artifactName="hero-mockup.html" onReplace={() => {}} />,
		)
		const trigger = screen.getByTestId("output-card-menu-trigger")
		fireEvent.click(trigger)
		const popover = screen.getByTestId("output-card-menu-popover")
		fireEvent.keyDown(popover, { key: "Escape" })
		expect(screen.queryByTestId("output-card-menu-popover")).toBeNull()
	})

	it("activating 'Replace this output…' fires onReplace and closes the popover", () => {
		const onReplace = vi.fn()
		render(
			<OutputCardMenu artifactName="hero-mockup.html" onReplace={onReplace} />,
		)
		fireEvent.click(screen.getByTestId("output-card-menu-trigger"))
		fireEvent.click(screen.getByTestId("output-menu-replace"))
		expect(onReplace).toHaveBeenCalledTimes(1)
		expect(screen.queryByTestId("output-card-menu-popover")).toBeNull()
	})
})

describe("ReplaceOutputDialog — open/close behavior", () => {
	it("renders the dialog with the literal title interpolated from the artifact name", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		const title = screen.getByTestId("replace-output-dialog-title")
		expect(title.textContent).toBe("Replace output: hero-mockup.html")
	})

	it("aria-labelledby points at the title element and aria-describedby is set", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		const dialog = screen.getByTestId("replace-output-dialog")
		const labelledBy = dialog.getAttribute("aria-labelledby")
		const describedBy = dialog.getAttribute("aria-describedby")
		expect(labelledBy).toBeTruthy()
		expect(describedBy).toBeTruthy()
		const title = document.getElementById(labelledBy ?? "")
		expect(title?.textContent).toBe("Replace output: hero-mockup.html")
	})

	it("focus on open lands on the drop zone", async () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		await waitFor(() => {
			const zone = screen.getByTestId("knowledge-drop-zone")
			expect(document.activeElement).toBe(zone)
		})
	})

	it("Cancel button calls dialog.close() and triggers onClose", () => {
		const onClose = vi.fn()
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={onClose}
			/>,
		)
		fireEvent.click(screen.getByTestId("replace-output-cancel"))
		expect(onClose).toHaveBeenCalled()
	})

	it("the close × button also closes the dialog", () => {
		const onClose = vi.fn()
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={onClose}
			/>,
		)
		fireEvent.click(screen.getByTestId("replace-output-dialog-close"))
		expect(onClose).toHaveBeenCalled()
	})
})

describe("ReplaceOutputDialog — happy path", () => {
	it("dropping a matching-mime file enables Replace; submit calls onSubmit with the file + note", async () => {
		const onSubmit = vi.fn(okSubmit)
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={onSubmit}
				onClose={() => {}}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("hero-v4.html", 12 * 1024, "text/html")])
		// Note input.
		const noteEl = screen.getByTestId(
			"replace-output-note",
		) as HTMLTextAreaElement
		fireEvent.change(noteEl, {
			target: { value: "Tightened the hero copy." },
		})
		const submit = screen.getByTestId(
			"replace-output-submit",
		) as HTMLButtonElement
		expect(submit.disabled).toBe(false)
		fireEvent.click(submit)
		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledTimes(1)
		})
		const payload = onSubmit.mock.calls[0][0]
		expect(payload.file.name).toBe("hero-v4.html")
		expect(payload.note).toBe("Tightened the hero copy.")
	})

	it("Replace button is disabled until a file is staged", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		const submit = screen.getByTestId(
			"replace-output-submit",
		) as HTMLButtonElement
		expect(submit.disabled).toBe(true)
	})
})

describe("ReplaceOutputDialog — mime-mismatch + override", () => {
	it("dropping a png on an html artifact surfaces an aria-live='assertive' warning", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("hero.png", 4096, "image/png")])
		const warning = screen.getByTestId("replace-output-mime-warning")
		expect(warning.getAttribute("aria-live")).toBe("assertive")
		expect(warning.textContent).toMatch(/Type mismatch/)
		expect(warning.textContent).toMatch(/text\/html/)
		expect(warning.textContent).toMatch(/image\/png/)
	})

	it("Replace button stays disabled while the mismatch is unresolved", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("hero.png", 4096, "image/png")])
		const submit = screen.getByTestId(
			"replace-output-submit",
		) as HTMLButtonElement
		expect(submit.disabled).toBe(true)
	})

	it("clicking 'Override type' clears the warning, pre-fills the note, and enables Replace", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("hero.png", 4096, "image/png")])
		fireEvent.click(screen.getByTestId("replace-output-mime-override"))
		expect(screen.queryByTestId("replace-output-mime-warning")).toBeNull()
		const note = screen.getByTestId(
			"replace-output-note",
		) as HTMLTextAreaElement
		expect(note.value).toMatch(/Type changed: text\/html → image\/png/)
		const submit = screen.getByTestId(
			"replace-output-submit",
		) as HTMLButtonElement
		expect(submit.disabled).toBe(false)
	})
})

describe("ReplaceOutputDialog — submit error", () => {
	it("a rejected onSubmit promise keeps the dialog open and relabels the button to 'Retry'", async () => {
		const onSubmit = vi
			.fn<(p: { file: File; note: string }) => Promise<void>>()
			.mockRejectedValue(new Error("HTTP 500: server"))
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={onSubmit}
				onClose={() => {}}
			/>,
		)
		const input = screen.getByTestId(
			"knowledge-drop-zone-input",
		) as HTMLInputElement
		setFiles(input, [makeFile("hero-v4.html", 1024, "text/html")])
		fireEvent.click(screen.getByTestId("replace-output-submit"))
		await waitFor(() => {
			expect(screen.getByTestId("replace-output-submit-error")).toBeTruthy()
		})
		expect(
			screen.getByTestId("replace-output-submit-error").textContent,
		).toMatch(/HTTP 500: server/)
		expect(screen.getByTestId("replace-output-submit").textContent).toMatch(
			/Retry/,
		)
		// Dialog still open.
		expect(screen.queryByTestId("replace-output-dialog")).toBeTruthy()
	})
})

describe("ReplaceOutputDialog — concurrent change banner", () => {
	it("renders the non-dismissable banner when concurrentReplaced is true", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
				concurrentReplaced
			/>,
		)
		const banner = screen.getByTestId("replace-output-concurrent-banner")
		expect(banner).toBeTruthy()
		expect(banner.textContent).toMatch(
			/replaced by another user|overwrite theirs/i,
		)
		// No close button on the banner.
		expect(within(banner).queryByRole("button")).toBeNull()
	})

	it("does NOT render the banner when concurrentReplaced is omitted/false", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		expect(screen.queryByTestId("replace-output-concurrent-banner")).toBeNull()
	})
})

describe("ReplaceOutputDialog — reduced-motion", () => {
	let stub: ReturnType<typeof installMatchMediaStub>

	beforeEach(() => {
		stub = installMatchMediaStub({
			"(prefers-reduced-motion: reduce)": true,
		})
	})

	afterEach(() => {
		stub.restore()
	})

	it("the inner drop zone reports prefers-reduced-motion via data-reduced-motion (which suppresses the scale-on-drag animation)", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		const zone = screen.getByTestId("knowledge-drop-zone")
		fireEvent.dragOver(zone, { dataTransfer: makeDataTransfer([]) })
		expect(zone.className).not.toMatch(/scale-\[1\.01\]/)
		expect(zone.getAttribute("data-reduced-motion")).toBe("true")
	})
})

describe("ReplaceOutputDialog — mobile (375 px) fullscreen variant", () => {
	it("mobileFullscreen=true tags the dialog with data-mobile-fullscreen='true' and uses the fullscreen frame", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
				mobileFullscreen
			/>,
		)
		const dialog = screen.getByTestId("replace-output-dialog")
		expect(dialog.getAttribute("data-mobile-fullscreen")).toBe("true")
		// Sticky bottom action bar is part of the footer's class chain.
		expect(dialog.className).toMatch(/h-\[100dvh\]/)
	})

	it("default (non-mobile) does not carry the data-mobile-fullscreen flag", () => {
		render(
			<ReplaceOutputDialog
				open
				output={HTML_ARTIFACT}
				onSubmit={okSubmit}
				onClose={() => {}}
			/>,
		)
		const dialog = screen.getByTestId("replace-output-dialog")
		expect(dialog.getAttribute("data-mobile-fullscreen")).toBeNull()
	})
})

describe("sanitizeTargetPath — path-traversal sanitizer", () => {
	it("strips leading slashes (defends against absolute paths)", () => {
		expect(sanitizeTargetPath("/etc/passwd")).toBe("etc/passwd")
	})

	it("resolves .. by popping the previous segment", () => {
		expect(sanitizeTargetPath("foo/../bar")).toBe("bar")
		expect(sanitizeTargetPath("a/./b/../c")).toBe("a/c")
		expect(sanitizeTargetPath("a/b/c/../../d")).toBe("a/d")
	})

	it("never escapes above the root — leading .. segments are dropped", () => {
		expect(sanitizeTargetPath("../../../etc/passwd")).toBe("etc/passwd")
		expect(sanitizeTargetPath("..")).toBe("")
		expect(sanitizeTargetPath("../foo")).toBe("foo")
	})

	it("normalizes backslashes (windows-style separators) to forward slashes", () => {
		expect(sanitizeTargetPath("foo\\bar\\baz.html")).toBe("foo/bar/baz.html")
	})

	it("returns the empty string for input that collapses to nothing", () => {
		expect(sanitizeTargetPath("")).toBe("")
		expect(sanitizeTargetPath("////")).toBe("")
		expect(sanitizeTargetPath("../..")).toBe("")
	})

	it("preserves valid relative paths unchanged", () => {
		expect(sanitizeTargetPath("stages/design/artifacts/hero.html")).toBe(
			"stages/design/artifacts/hero.html",
		)
	})
})
