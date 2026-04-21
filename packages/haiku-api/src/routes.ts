/**
 * Route table — the canonical enumeration of every HTTP route and WebSocket
 * upgrade path handled by packages/haiku/src/http.ts. Consumed by:
 *   - `openapi.buildOpenApi()` to emit dist/openapi.json
 *   - tests in test/routes.test.mjs that assert every concrete handler in
 *     http.ts has a matching entry here
 *   - (future, unit-02+) the MCP backend and SPA to resolve path constants
 *
 * Path templates use RFC 6570 style (`{param}`). The `paths` object exposes
 * small builder functions so callers don't need to hand-format the templates.
 */

import type { ZodTypeAny } from "zod"
import {
	DirectionSelectRequestSchema,
	DirectionSelectResponseSchema,
} from "./schemas/direction.js"
import {
	FeedbackCreateRequestSchema,
	FeedbackCreateResponseSchema,
	FeedbackDeleteResponseSchema,
	FeedbackListResponseSchema,
	FeedbackUpdateRequestSchema,
	FeedbackUpdateResponseSchema,
} from "./schemas/feedback.js"
import {
	QuestionAnswerRequestSchema,
	QuestionAnswerResponseSchema,
} from "./schemas/question.js"
import {
	ReviewDecisionRequestSchema,
	ReviewDecisionResponseSchema,
} from "./schemas/review.js"
import {
	HeartbeatResponseSchema,
	ReviewCurrentPayloadSchema,
	SessionPayloadSchema,
} from "./schemas/session.js"

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "OPTIONS"

export interface RouteSpec {
	/** HTTP method. `"WS"` is used for the WebSocket upgrade path. */
	method: HttpMethod | "WS"
	/** RFC-6570-style path template, e.g. `/api/session/{id}`. */
	pathTemplate: string
	/** Unique `operationId` surfaced into the emitted OpenAPI document. */
	operationId: string
	/** Request body schema, or null when the method has no request body. */
	request: ZodTypeAny | null
	/** Response body schema, or null for streams / empty responses. */
	response: ZodTypeAny | null
	/** Short human-readable summary (becomes OpenAPI `summary`). */
	summary: string
	/** Optional — tag grouping in the emitted OpenAPI document. */
	tag?: string
}

/**
 * Path builders. Using functions (not just templates) forces consumers to
 * provide each parameter and keeps the path set refactorable.
 */
export const paths = {
	session: (id: string) => `/api/session/${id}`,
	sessionHeartbeat: (id: string) => `/api/session/${id}/heartbeat`,
	reviewCurrentPage: () => "/review/current",
	reviewPage: (id: string) => `/review/${id}`,
	reviewDecide: (id: string) => `/review/${id}/decide`,
	mockup: (id: string, path: string) => `/mockups/${id}/${path}`,
	wireframe: (id: string, path: string) => `/wireframe/${id}/${path}`,
	stageArtifact: (id: string, path: string) => `/stage-artifacts/${id}/${path}`,
	directionPage: (id: string) => `/direction/${id}`,
	directionSelect: (id: string) => `/direction/${id}/select`,
	questionImage: (id: string, index: number) =>
		`/question-image/${id}/${index}`,
	questionPage: (id: string) => `/question/${id}`,
	questionAnswer: (id: string, _?: never) => `/question/${id}/answer`,
	reviewCurrent: () => "/api/review/current",
	feedbackList: (intent: string, stage: string) =>
		`/api/feedback/${intent}/${stage}`,
	feedbackItem: (intent: string, stage: string, id: string) =>
		`/api/feedback/${intent}/${stage}/${id}`,
	file: (id: string, path: string) => `/files/${id}/${path}`,
	health: () => "/health",
	wsSession: (id: string) => `/ws/session/${id}`,
} as const

/**
 * The canonical route table. Ordering follows the dispatch order in
 * http.ts :: handleRequest (lines ~1376-1520) so diffs against the source
 * stay readable.
 */
export const routes: readonly RouteSpec[] = [
	// File serving ────────────────────────────────────────────────────────
	{
		method: "GET",
		pathTemplate: "/files/{sessionId}/{path}",
		operationId: "getSessionFile",
		request: null,
		response: null,
		summary: "Serve a file from a session's file-bundle root (raw stream).",
		tag: "files",
	},

	// Session API ────────────────────────────────────────────────────────
	{
		method: "GET",
		pathTemplate: "/api/session/{sessionId}",
		operationId: "getSession",
		request: null,
		response: SessionPayloadSchema,
		summary: "Return session JSON for the SPA to render.",
		tag: "session",
	},
	{
		method: "HEAD",
		pathTemplate: "/api/session/{sessionId}/heartbeat",
		operationId: "sessionHeartbeat",
		request: null,
		response: HeartbeatResponseSchema,
		summary: "Client presence ping. 200 if session exists, 404 otherwise.",
		tag: "session",
	},

	// Review pane (always-available) ─────────────────────────────────────
	{
		method: "GET",
		pathTemplate: "/review/current",
		operationId: "getReviewCurrentPage",
		request: null,
		response: null,
		summary: "Serve the always-available review pane (HTML SPA entry).",
		tag: "review",
	},
	{
		method: "GET",
		pathTemplate: "/review/{sessionId}",
		operationId: "getReviewPage",
		request: null,
		response: null,
		summary: "Serve the review page for a session (HTML SPA entry).",
		tag: "review",
	},
	{
		method: "POST",
		pathTemplate: "/review/{sessionId}/decide",
		operationId: "postReviewDecide",
		request: ReviewDecisionRequestSchema,
		response: ReviewDecisionResponseSchema,
		summary: "Submit a review decision (approved | changes_requested).",
		tag: "review",
	},

	// Mockup / wireframe / stage-artifact file serving ───────────────────
	{
		method: "GET",
		pathTemplate: "/mockups/{sessionId}/{path}",
		operationId: "getMockup",
		request: null,
		response: null,
		summary: "Serve a mockup asset for a review session (raw stream).",
		tag: "files",
	},
	{
		method: "GET",
		pathTemplate: "/wireframe/{sessionId}/{path}",
		operationId: "getWireframe",
		request: null,
		response: null,
		summary: "Serve a wireframe asset for a review session (raw stream).",
		tag: "files",
	},
	{
		method: "GET",
		pathTemplate: "/stage-artifacts/{sessionId}/{path}",
		operationId: "getStageArtifact",
		request: null,
		response: null,
		summary: "Serve a stage artifact for a review session (raw stream).",
		tag: "files",
	},

	// Design direction ───────────────────────────────────────────────────
	{
		method: "GET",
		pathTemplate: "/direction/{sessionId}",
		operationId: "getDirectionPage",
		request: null,
		response: null,
		summary: "Serve the design-direction selection page (HTML SPA entry).",
		tag: "direction",
	},
	{
		method: "POST",
		pathTemplate: "/direction/{sessionId}/select",
		operationId: "postDirectionSelect",
		request: DirectionSelectRequestSchema,
		response: DirectionSelectResponseSchema,
		summary: "Record a design-direction archetype + parameter selection.",
		tag: "direction",
	},

	// Question ───────────────────────────────────────────────────────────
	{
		method: "GET",
		pathTemplate: "/question-image/{sessionId}/{index}",
		operationId: "getQuestionImage",
		request: null,
		response: null,
		summary: "Serve an image referenced by a question session (raw stream).",
		tag: "question",
	},
	{
		method: "GET",
		pathTemplate: "/question/{sessionId}",
		operationId: "getQuestionPage",
		request: null,
		response: null,
		summary: "Serve the question page (HTML SPA entry).",
		tag: "question",
	},
	{
		method: "POST",
		pathTemplate: "/question/{sessionId}/answer",
		operationId: "postQuestionAnswer",
		request: QuestionAnswerRequestSchema,
		response: QuestionAnswerResponseSchema,
		summary: "Submit answers for a question session.",
		tag: "question",
	},

	// Review current snapshot ────────────────────────────────────────────
	{
		method: "GET",
		pathTemplate: "/api/review/current",
		operationId: "getReviewCurrent",
		request: null,
		response: ReviewCurrentPayloadSchema,
		summary: "Return the current active intent + stage status snapshot.",
		tag: "review",
	},

	// Feedback CRUD ──────────────────────────────────────────────────────
	{
		method: "GET",
		pathTemplate: "/api/feedback/{intent}/{stage}",
		operationId: "listFeedback",
		request: null,
		response: FeedbackListResponseSchema,
		summary:
			"List feedback items for an intent's stage (optionally filter by status).",
		tag: "feedback",
	},
	{
		method: "POST",
		pathTemplate: "/api/feedback/{intent}/{stage}",
		operationId: "createFeedback",
		request: FeedbackCreateRequestSchema,
		response: FeedbackCreateResponseSchema,
		summary: "Create a new feedback item in an intent's stage.",
		tag: "feedback",
	},
	{
		method: "PUT",
		pathTemplate: "/api/feedback/{intent}/{stage}/{feedbackId}",
		operationId: "updateFeedback",
		request: FeedbackUpdateRequestSchema,
		response: FeedbackUpdateResponseSchema,
		summary: "Update status or closed_by on a feedback item.",
		tag: "feedback",
	},
	{
		method: "DELETE",
		pathTemplate: "/api/feedback/{intent}/{stage}/{feedbackId}",
		operationId: "deleteFeedback",
		request: null,
		response: FeedbackDeleteResponseSchema,
		summary: "Delete a feedback item (blocks open items via 409).",
		tag: "feedback",
	},

	// Health ─────────────────────────────────────────────────────────────
	{
		method: "GET",
		pathTemplate: "/health",
		operationId: "getHealth",
		request: null,
		response: null,
		summary: "Plain-text keepalive check used by the tunnel.",
		tag: "health",
	},

	// WebSocket upgrade ──────────────────────────────────────────────────
	{
		method: "WS",
		pathTemplate: "/ws/session/{sessionId}",
		operationId: "upgradeSessionWebSocket",
		request: null,
		response: null,
		summary:
			"WebSocket upgrade for a session. Client and server envelopes are defined in schemas/websocket.ts.",
		tag: "websocket",
	},
] as const

/** Return every route that has both a request and a response schema. Used by
 *  the OpenAPI emitter to collect schemas for `components.schemas`. */
export function routesWithSchemas(): readonly RouteSpec[] {
	return routes.filter((r) => r.request !== null || r.response !== null)
}
