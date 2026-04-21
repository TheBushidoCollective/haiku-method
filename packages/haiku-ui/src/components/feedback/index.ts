/**
 * Barrel export for the feedback component cluster (unit-08).
 *
 * See `stages/development/units/unit-08-feedback-components.md` and
 * `stages/development/artifacts/unit-08-tactical-plan.md` for scope.
 */

export { FeedbackStatusBadge } from "./FeedbackStatusBadge"
export type { FeedbackStatusBadgeProps } from "./FeedbackStatusBadge"
export {
	FeedbackOriginIcon,
	originIcons,
	originLabels,
} from "./FeedbackOriginIcon"
export type { FeedbackOriginIconProps } from "./FeedbackOriginIcon"
export { FeedbackItem } from "./FeedbackItem"
export type { FeedbackItemProps } from "./FeedbackItem"
export {
	DEFAULT_ITEM_SIZE,
	DEFAULT_LIST_HEIGHT,
	FeedbackList,
	VIRTUALIZE_THRESHOLD,
} from "./FeedbackList"
export type { FeedbackListProps } from "./FeedbackList"
export { FeedbackSummaryBar } from "./FeedbackSummaryBar"
export type { FeedbackSummaryBarProps } from "./FeedbackSummaryBar"
export { useFeedbackListKeyboardNav } from "./useFeedbackListKeyboardNav"
export type {
	FeedbackListKeyboardNavHandle,
	UseFeedbackListKeyboardNavOptions,
} from "./useFeedbackListKeyboardNav"
export {
	feedbackStatusColors,
	statusDotClasses,
	statusBackground,
	statusBorderLeft,
	originColors,
	visitCounterClasses,
	TOKEN_HASH,
} from "./tokens"
export type { FeedbackOrigin, FeedbackStatus } from "./tokens"
