/**
 * Proves the stage Overview tab's file-backed text artifacts — the stage
 * BRIEF and the agent OBSERVATIONS — are annotatable (select-text →
 * comment) when the host wires `onInlineCommentsChange`, and degrade to a
 * plain `<MarkdownViewer>` when it doesn't.
 *
 * Discriminator: `<MarkdownViewer>` renders `<div id="brief-<stage>">` /
 * `<div id="observations-<stage>">`. `<InlineComments>` renders neither id —
 * its content div carries `style="user-select: text"`. We assert on the
 * presence/absence of those markers.
 *
 * Also asserts `deriveExistingAnchorsForFile` re-paints only the anchors
 * whose `inline_anchor.file_path` matches the surface's real repo path.
 */

import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { FeedbackItemData } from "../../../../types"
import type { ReviewPageSessionData } from "../../shared/session-data"
import { deriveExistingAnchorsForFile, StageReview } from "../StageReview"

const STAGE = "development"
const INTENT = "test-intent"

function makeSession(): ReviewPageSessionData {
	return {
		stage_briefs: { [STAGE]: "## Brief\n\nDeliver the thing." },
		stage_observations: {
			[STAGE]: "## Observations\n\nThe mandate was ambiguous.",
		},
	} as unknown as ReviewPageSessionData
}

afterEach(() => {
	cleanup()
})

describe("StageReview Overview — brief + observations annotatable", () => {
	it("renders brief + observations through InlineComments when onInlineCommentsChange is wired", () => {
		const { container } = render(
			<StageReview
				session={makeSession()}
				sessionId="sess-1"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
				onInlineCommentsChange={() => {}}
			/>,
		)
		// MarkdownViewer (plain) would emit these ids — must be absent.
		expect(container.querySelector(`#brief-${STAGE}`)).toBeNull()
		expect(container.querySelector(`#observations-${STAGE}`)).toBeNull()
		// InlineComments content divs are selectable text surfaces.
		const selectable = container.querySelectorAll(
			'div[style*="user-select: text"]',
		)
		expect(selectable.length).toBeGreaterThanOrEqual(2)
	})

	it("falls back to plain MarkdownViewer when onInlineCommentsChange is absent", () => {
		const { container } = render(
			<StageReview
				session={makeSession()}
				sessionId="sess-1"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
			/>,
		)
		expect(container.querySelector(`#brief-${STAGE}`)).not.toBeNull()
		expect(container.querySelector(`#observations-${STAGE}`)).not.toBeNull()
	})
})

function fbWithAnchor(
	id: string,
	filePath: string,
	selectedText: string,
): FeedbackItemData {
	return {
		feedback_id: id,
		title: `${id} title`,
		body: "body",
		status: "pending",
		origin: "user-chat",
		author: "user",
		author_type: "human",
		created_at: "2026-05-27T12:00:00Z",
		visit: 1,
		source_ref: null,
		closed_by: null,
		inline_anchor: {
			selected_text: selectedText,
			paragraph: 0,
			location: "Brief",
			file_path: filePath,
		},
	} as FeedbackItemData
}

describe("deriveExistingAnchorsForFile", () => {
	const briefPath = `.haiku/intents/${INTENT}/stages/${STAGE}/BRIEF.md`
	const obsPath = `.haiku/intents/${INTENT}/stages/${STAGE}/observations.md`

	it("returns only anchors whose file_path matches the surface", () => {
		const items = [
			fbWithAnchor("FB-01", briefPath, "deliver the thing"),
			fbWithAnchor("FB-02", obsPath, "mandate was ambiguous"),
			fbWithAnchor("FB-03", briefPath, "the thing"),
		]
		const briefAnchors = deriveExistingAnchorsForFile(briefPath, items)
		expect(briefAnchors.map((a) => a.selectedText)).toEqual([
			"deliver the thing",
			"the thing",
		])
		const obsAnchors = deriveExistingAnchorsForFile(obsPath, items)
		expect(obsAnchors.map((a) => a.selectedText)).toEqual([
			"mandate was ambiguous",
		])
	})

	it("returns empty when no anchor matches the path", () => {
		const items = [fbWithAnchor("FB-01", obsPath, "elsewhere")]
		expect(deriveExistingAnchorsForFile(briefPath, items)).toEqual([])
	})
})

describe("StageReview — Elaboration tab", () => {
	it("surfaces elaboration.md in its own Elaboration tab (annotatable), not on Overview or Other", () => {
		const session = {
			stage_briefs: { [STAGE]: "## Brief\n\nDeliver the thing." },
			stage_elaborations: {
				[STAGE]: "## Elaboration\n\nBroke the stage into three units.",
			},
		} as unknown as ReviewPageSessionData
		const { getAllByRole, getByText } = render(
			<StageReview
				session={session}
				sessionId="sess-elab"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
				onInlineCommentsChange={() => {}}
			/>,
		)
		// An Elaboration tab button exists in the tablist.
		const elabTab = getAllByRole("tab").find(
			(t) => t.textContent === "Elaboration",
		)
		expect(elabTab).toBeTruthy()
		// Activate it (the Tabs component renders only the active panel), then
		// the elaboration body + its eyebrow caption render.
		if (elabTab) fireEvent.click(elabTab)
		expect(getByText(/how this stage was broken into units/i)).toBeTruthy()
		expect(getByText(/Broke the stage into three units/i)).toBeTruthy()
	})

	it("disables the Elaboration tab when the stage has no elaboration.md", () => {
		const session = {
			stage_briefs: { [STAGE]: "## Brief" },
		} as unknown as ReviewPageSessionData
		const { getAllByRole } = render(
			<StageReview
				session={session}
				sessionId="sess-noelab"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
				onInlineCommentsChange={() => {}}
			/>,
		)
		const elabTab = getAllByRole("tab").find(
			(t) => t.textContent === "Elaboration",
		)
		expect(elabTab).toBeTruthy()
		expect(
			elabTab?.getAttribute("aria-disabled") === "true" ||
				(elabTab as HTMLButtonElement)?.disabled,
		).toBeTruthy()
	})
})

describe("StageReview — per-directory tabs", () => {
	function sessionWithOther() {
		return {
			other_files: [
				{
					stage: STAGE,
					name: "proofs/run-1.md",
					type: "markdown",
					content: "# proof one",
					directory: "proofs",
				},
				{
					stage: STAGE,
					name: "proofs/run-2.md",
					type: "markdown",
					content: "# proof two",
					directory: "proofs",
				},
				{
					stage: STAGE,
					name: "scratch.md",
					type: "markdown",
					content: "# loose scratch",
				},
			],
		} as unknown as ReviewPageSessionData
	}

	it("renders a tab named after each asset subdirectory; loose files stay in Other", () => {
		const { getAllByRole } = render(
			<StageReview
				session={sessionWithOther()}
				sessionId="sess-dir"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
				onInlineCommentsChange={() => {}}
			/>,
		)
		const labels = getAllByRole("tab").map((t) => t.textContent)
		// A "Proofs (2)" tab for the proofs/ subdir.
		expect(labels).toContain("Proofs (2)")
		// "Other" holds ONLY the loose stage-root file — not the proofs files.
		expect(labels).toContain("Other (1)")
	})

	it("activating a directory tab shows that directory's files", () => {
		const { getAllByRole, getByText } = render(
			<StageReview
				session={sessionWithOther()}
				sessionId="sess-dir2"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
				onInlineCommentsChange={() => {}}
			/>,
		)
		const proofsTab = getAllByRole("tab").find((t) =>
			t.textContent?.startsWith("Proofs"),
		)
		expect(proofsTab).toBeTruthy()
		if (proofsTab) fireEvent.click(proofsTab)
		expect(getByText("proofs/run-1.md")).toBeTruthy()
	})
})

describe("StageReview Outputs detail — code renders + empty never blanks", () => {
	const JSX_SRC = 'export const X = () => <div className="a">{v}</div>'
	function sessionWithOutputs() {
		return {
			output_artifacts: [
				{
					stage: STAGE,
					name: "WorkerDates.tsx",
					type: "code",
					language: "tsx",
					content: JSX_SRC,
				},
				{
					stage: STAGE,
					name: "missing.tsx",
					type: "file",
					// no content — the "declared output not on disk" case
					relativePath: "/stage-artifacts/x/missing.tsx",
				},
			],
		} as unknown as ReviewPageSessionData
	}

	it("renders a code output syntax-highlighted (escaped JSX), not an empty box", () => {
		const { container } = render(
			<StageReview
				session={sessionWithOutputs()}
				sessionId="s-code"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
				tab="outputs"
				detail={{ kind: "outputs", name: "WorkerDates.tsx" }}
				onInlineCommentsChange={() => {}}
			/>,
		)
		// highlight.js token spans present → the code rendered (not blank).
		expect(container.querySelector('[class*="hljs"]')).not.toBeNull()
		// JSX survives as escaped text, not a live (invisible) <div>.
		expect(container.innerHTML).toContain("&lt;div")
		expect(container.querySelector("div.a")).toBeNull()
	})

	it("shows a 'not on disk' note for an empty/file output, never a blank box", () => {
		const { getByText } = render(
			<StageReview
				session={sessionWithOutputs()}
				sessionId="s-missing"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
				tab="outputs"
				detail={{ kind: "outputs", name: "missing.tsx" }}
				onInlineCommentsChange={() => {}}
			/>,
		)
		expect(getByText(/isn't on disk at the expected path/i)).toBeTruthy()
	})
})

describe("StageReview — dir-tab detail renders (no Not Found)", () => {
	it("opening an item in a per-directory tab renders its content, not a route 404", () => {
		const session = {
			other_files: [
				{
					stage: STAGE,
					name: "proofs/run-1.md",
					type: "markdown",
					content: "# proof one body",
					directory: "proofs",
				},
			],
		} as unknown as ReviewPageSessionData
		// detail.kind = the dir name ("proofs"); the route widening (isKind
		// accepts dir slugs) gets us here, and StageReview matches
		// detail.tab === <dir> to render the dir-tab detail view.
		const { getAllByText } = render(
			<StageReview
				session={session}
				sessionId="s-dir-detail"
				intentSlug={INTENT}
				stageName={STAGE}
				feedback={[]}
				tab="proofs"
				detail={{ kind: "proofs" as never, name: "proofs/run-1.md" }}
				onInlineCommentsChange={() => {}}
			/>,
		)
		// Renders (in the detail view + summary), proving no route 404.
		expect(getAllByText(/proof one body/i).length).toBeGreaterThan(0)
	})
})
