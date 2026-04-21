/**
 * Shared primitives used across multiple route groups.
 *
 * Ground truth mapping:
 * - `FeedbackOriginSchema`    mirrors `FEEDBACK_ORIGINS`  in packages/haiku/src/state-tools.ts
 * - `FeedbackStatusSchema`    mirrors `FEEDBACK_STATUSES` in packages/haiku/src/state-tools.ts
 * - `PinSchema`               mirrors `ReviewAnnotations.pins[]` in packages/haiku/src/sessions.ts
 * - `InlineCommentSchema`     mirrors `ReviewAnnotations.comments[]` / `QuestionAnnotations.comments[]`
 * - `ReviewAnnotationsSchema` mirrors `ReviewAnnotations` in packages/haiku/src/sessions.ts
 * - `QuestionAnnotationsSchema` mirrors `QuestionAnnotations` in packages/haiku/src/sessions.ts
 */

import { z } from "zod"

/** Origins a feedback item can come from. */
export const FeedbackOriginSchema = z
	.enum([
		"adversarial-review",
		"studio-review",
		"external-pr",
		"external-mr",
		"user-visual",
		"user-chat",
		"agent",
	])
	.describe(
		"Origin of a feedback item. Derives author_type (human|agent) via state-tools.deriveAuthorType.",
	)
export type FeedbackOrigin = z.infer<typeof FeedbackOriginSchema>

/** Lifecycle status of a feedback item. */
export const FeedbackStatusSchema = z
	.enum(["pending", "fixing", "addressed", "closed", "rejected"])
	.describe(
		"Lifecycle: pending -> fixing -> addressed -> closed, or pending -> rejected. Only pending/fixing block the stage gate.",
	)
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>

/** Authorship type derived from origin. */
export const AuthorTypeSchema = z
	.enum(["human", "agent"])
	.describe(
		"Derived from origin. Human-authored feedback cannot be closed/deleted by agents.",
	)
export type AuthorType = z.infer<typeof AuthorTypeSchema>

/** A pin placed on a mockup/screenshot during review. */
export const PinSchema = z
	.object({
		x: z.number().describe("Pin x-coordinate (0..1 relative to canvas width)"),
		y: z.number().describe("Pin y-coordinate (0..1 relative to canvas height)"),
		text: z.string().describe("Pin comment body"),
	})
	.describe("Screenshot pin annotation")
export type Pin = z.infer<typeof PinSchema>

/** An inline comment anchored to a span of text in a review artifact. */
export const InlineCommentSchema = z
	.object({
		selectedText: z
			.string()
			.describe("Highlighted text the comment anchors to"),
		comment: z.string().describe("Comment body"),
		paragraph: z
			.number()
			.describe("Zero-based paragraph index inside the reviewed artifact"),
	})
	.describe("Inline text-anchored comment annotation")
export type InlineComment = z.infer<typeof InlineCommentSchema>

/** Review-session annotation bundle (POST /review/:id/decide payload field). */
export const ReviewAnnotationsSchema = z
	.object({
		screenshot: z
			.string()
			.optional()
			.describe("Base64-encoded PNG of annotated canvas"),
		pins: z.array(PinSchema).optional(),
		comments: z.array(InlineCommentSchema).optional(),
	})
	.describe("Annotations attached to a review decision")
export type ReviewAnnotations = z.infer<typeof ReviewAnnotationsSchema>

/** Question-session annotation bundle. */
export const QuestionAnnotationsSchema = z
	.object({
		comments: z.array(InlineCommentSchema).optional(),
	})
	.describe("Annotations attached to a question answer")
export type QuestionAnnotations = z.infer<typeof QuestionAnnotationsSchema>

/** Session discriminator — which kind of interactive session this is. */
export const SessionTypeSchema = z
	.enum(["review", "question", "design_direction"])
	.describe("Session type discriminator")
export type SessionType = z.infer<typeof SessionTypeSchema>

/** Aggregate session-status union spanning all three session types. */
export const SessionStatusSchema = z
	.enum(["pending", "decided", "answered", "approved", "changes_requested"])
	.describe(
		"Runtime status across review | question | design_direction sessions.",
	)
export type SessionStatus = z.infer<typeof SessionStatusSchema>
