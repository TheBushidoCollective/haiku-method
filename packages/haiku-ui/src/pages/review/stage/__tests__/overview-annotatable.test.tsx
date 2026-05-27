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

import { cleanup, render } from "@testing-library/react"
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
