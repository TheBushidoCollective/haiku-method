/**
 * ArtifactsPane — left-column composition of the review page.
 *
 * Delegates to the `IntentReview` leaf view which owns the card/tab
 * rendering for stage artifacts, mockups, wireframes, success criteria,
 * and annotation canvas integration.
 *
 * Annotation pin integration: `onPinsChange` bubbles up to the parent
 * `ReviewPage`, which owns the annotations state. The callsite is
 * prop-driven so the canvas internals can be reshaped without touching
 * this pane.
 */

import type { AnnotationPin } from "../../organisms/AnnotationCanvas"
import type { InlineCommentEntry } from "../../organisms/InlineComments"
import type { ReviewAnnotations } from "../../types"
import { IntentReview } from "./intent/IntentReview"
import type { ReviewPageSessionData } from "./shared/session-data"

export interface ArtifactsPaneProps {
	session: ReviewPageSessionData
	sessionId: string
	getAnnotations: () => ReviewAnnotations | undefined
	wsRef?: React.RefObject<WebSocket | null>
	onInlineCommentsChange: (comments: InlineCommentEntry[]) => void
	onPinsChange: (pins: AnnotationPin[]) => void
	className?: string
}

export function ArtifactsPane({
	session,
	sessionId,
	getAnnotations,
	wsRef,
	onInlineCommentsChange,
	onPinsChange,
	className,
}: ArtifactsPaneProps): React.ReactElement {
	const commonProps = {
		session,
		sessionId,
		getAnnotations,
		wsRef,
		onInlineCommentsChange,
		onPinsChange,
	}

	return (
		<div
			data-testid="artifacts-pane"
			className={`flex-1 min-w-0 ${className ?? ""}`}
		>
			<IntentReview {...commonProps} />
		</div>
	)
}
