/**
 * WebSocket envelope schemas — /ws/session/:sessionId
 *
 * Traversed by: review-ui-feedback.feature (decide/answer/select on the wire).
 *
 * Ground truth:
 * - Client -> server messages: `handleWebSocketMessage` in packages/haiku/src/http.ts (~line 724).
 *   Recognized `type` values: "decide" (review sessions), "answer" (question sessions),
 *   "select" (design_direction sessions).
 * - Server -> client messages: `sendToWebSocket` call sites in http.ts.
 *   Recognized envelopes: ack `{ ok: true, decision?, feedback? }`, error `{ error: string }`,
 *   plus session-update broadcasts from orchestrator/session stores.
 */

import { z } from "zod"
import { QuestionAnnotationsSchema, ReviewAnnotationsSchema } from "./common.js"
import { QuestionAnswerItemSchema } from "./question.js"

// ─── Client -> server ────────────────────────────────────────────────────

export const WsDecideMessageSchema = z
	.object({
		type: z.literal("decide"),
		decision: z.string(),
		feedback: z.string().optional(),
		annotations: ReviewAnnotationsSchema.optional(),
	})
	.describe("Review decision frame (session_type=review)")
export type WsDecideMessage = z.infer<typeof WsDecideMessageSchema>

export const WsAnswerMessageSchema = z
	.object({
		type: z.literal("answer"),
		answers: z.array(QuestionAnswerItemSchema),
		feedback: z.string().optional(),
		annotations: QuestionAnnotationsSchema.optional(),
	})
	.describe("Question answer frame (session_type=question)")
export type WsAnswerMessage = z.infer<typeof WsAnswerMessageSchema>

export const WsSelectMessageSchema = z
	.object({
		type: z.literal("select"),
		archetype: z.string(),
		parameters: z.record(z.number()),
		comments: z.string().optional(),
		annotations: z
			.object({
				screenshot: z.string().optional(),
				pins: z
					.array(
						z.object({
							x: z.number(),
							y: z.number(),
							text: z.string(),
						}),
					)
					.optional(),
			})
			.optional(),
	})
	.describe("Design-direction select frame (session_type=design_direction)")
export type WsSelectMessage = z.infer<typeof WsSelectMessageSchema>

export const WsClientMessageSchema = z
	.discriminatedUnion("type", [
		WsDecideMessageSchema,
		WsAnswerMessageSchema,
		WsSelectMessageSchema,
	])
	.describe("Any client -> server WebSocket envelope")
export type WsClientMessage = z.infer<typeof WsClientMessageSchema>

// ─── Server -> client ────────────────────────────────────────────────────

export const WsAckMessageSchema = z
	.object({
		type: z.literal("ack"),
		ok: z.literal(true),
		decision: z.string().optional(),
		feedback: z.string().optional(),
	})
	.describe(
		"Server acknowledgement frame. Shape aligns with the payload sendToWebSocket emits after a successful client message.",
	)
export type WsAckMessage = z.infer<typeof WsAckMessageSchema>

export const WsErrorMessageSchema = z
	.object({
		type: z.literal("error"),
		error: z.string(),
	})
	.describe("Server error frame")
export type WsErrorMessage = z.infer<typeof WsErrorMessageSchema>

export const WsSessionUpdateMessageSchema = z
	.object({
		type: z.literal("session-update"),
		session_id: z.string(),
		status: z.string(),
		decision: z.string().optional(),
		feedback: z.string().optional(),
	})
	.describe(
		"Server broadcast when a session's durable status changes (review decided, question answered, direction selected).",
	)
export type WsSessionUpdateMessage = z.infer<
	typeof WsSessionUpdateMessageSchema
>

export const WsServerMessageSchema = z
	.discriminatedUnion("type", [
		WsAckMessageSchema,
		WsErrorMessageSchema,
		WsSessionUpdateMessageSchema,
	])
	.describe("Any server -> client WebSocket envelope")
export type WsServerMessage = z.infer<typeof WsServerMessageSchema>
