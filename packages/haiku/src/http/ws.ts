// http/ws.ts — WebSocket registry, rate limiting, message dispatch.
//
// One WebSocket per sessionId. Tool handlers push session-update
// frames via `sendToWebSocket` and force-close via
// `closeSessionConnection`. The upgrade handler in buildApp registers
// new sockets via `wsConnections.set(...)` and deregisters on close;
// it also enforces the per-server cap (`MAX_WS_SESSIONS`) before
// allocating a slot.

import { appendFileSync } from "node:fs"
import { WsClientMessageSchema, type WsServerMessage } from "haiku-api"
import type { WebSocket as WsWebSocket } from "ws"
import {
	getSession,
	type QuestionAnnotations,
	type QuestionAnswer,
	type ReviewAnnotations,
	updateDesignDirectionSession,
	updateQuestionSession,
	updateSession,
} from "../sessions.js"

const SESSION_CANCEL_LOG_PATH = "/tmp/haiku-session-cancel.log"

/** Append-only log for session-close events. Helps trace why an SPA
 *  saw the "session ended" overlay when the workflow engine didn't expect to
 *  cancel — the file persists across restarts so post-mortems aren't
 *  blocked by lost stderr. */
export function logClose(msg: string): void {
	try {
		appendFileSync(
			SESSION_CANCEL_LOG_PATH,
			`${new Date().toISOString()} ${msg}\n`,
		)
	} catch {
		/* */
	}
	process.stderr.write(`[haiku-mcp] ${msg}\n`)
}

// ── WebSocket registry ───────────────────────────────────────────────────
//
// @fastify/websocket hands us a `WsWebSocket` which wraps `ws`'s
// `WebSocket`. We track one per sessionId so tool handlers can push
// session-update frames via `sendToWebSocket` and force-close via
// `closeSessionConnection`.

export const wsConnections = new Map<string, WsWebSocket>()

// Per-session rate-limit state — sliding-window message timestamps.
const wsRateState = new WeakMap<WsWebSocket, number[]>()

// Default WebSocket frame rate limit (frames per second per socket).
// HAIKU_WS_RATE_LIMIT is a TEST OVERRIDE only — not a production tunable.
// It accepts any integer and is clamped to a minimum of 1 so the rate
// limiter can NEVER be disabled through environment configuration.
// Values <= 0, NaN, or unparseable strings fall back to the default (20).
const WS_RATE_LIMIT_DEFAULT = 20
const WS_RATE_LIMIT_PER_SEC = ((): number => {
	const raw = process.env.HAIKU_WS_RATE_LIMIT
	if (raw === undefined) return WS_RATE_LIMIT_DEFAULT
	const parsed = Number.parseInt(raw, 10)
	if (!Number.isFinite(parsed) || parsed <= 0) return WS_RATE_LIMIT_DEFAULT
	return Math.max(parsed, 1)
})()

/** True when `socket` is allowed to process another inbound frame
 *  this 1-second sliding window. False means the rate limit was hit
 *  and the caller should drop the frame. */
export function allowWsFrame(socket: WsWebSocket): boolean {
	const now = Date.now()
	const windowStart = now - 1000
	const prior = wsRateState.get(socket) ?? []
	const recent = prior.filter((t) => t > windowStart)
	if (recent.length >= WS_RATE_LIMIT_PER_SEC) {
		wsRateState.set(socket, recent)
		return false
	}
	recent.push(now)
	wsRateState.set(socket, recent)
	return true
}

// ── Resource cap ──────────────────────────────────────────────────────────
//
// FB-08: cap on the total number of concurrent WebSocket sessions
// tracked in `wsConnections`. Excess sessions are closed immediately
// with RFC 6455 code 1013 (try again later). Default 128 — well above
// realistic concurrent review usage. Env var clamped to a minimum of
// 1 so the limit can never be disabled through configuration.

const MAX_WS_SESSIONS_DEFAULT = 128
export const MAX_WS_SESSIONS = ((): number => {
	const raw = process.env.HAIKU_MAX_WS_SESSIONS
	if (raw === undefined) return MAX_WS_SESSIONS_DEFAULT
	const parsed = Number.parseInt(raw, 10)
	if (!Number.isFinite(parsed) || parsed <= 0) return MAX_WS_SESSIONS_DEFAULT
	return Math.max(parsed, 1)
})()

/** Send a JSON text frame to the SPA for a given session. No-op when
 *  the session has no open socket. */
export function sendToWebSocket(sessionId: string, data: unknown): void {
	const socket = wsConnections.get(sessionId)
	if (!socket || socket.readyState !== socket.OPEN) return
	try {
		socket.send(JSON.stringify(data))
	} catch {
		/* send may throw if the socket is mid-close */
	}
}

/**
 * Server-initiated end of a session. Fires when the originating MCP
 * tool call is cancelled or the tool's `finally` block cleans up.
 * Sends a typed hint frame (so the SPA's overlay can pick the reason),
 * then closes with RFC 6455 code 4001 in the private-use range.
 */
export function closeSessionConnection(
	sessionId: string,
	reason?: string,
): void {
	logClose(
		`closeSessionConnection(${sessionId}) invoked [build:fastify] reason=${reason ?? "null"}`,
	)
	const socket = wsConnections.get(sessionId)
	if (!socket) {
		logClose(
			`closeSessionConnection(${sessionId}): NO socket registered — SPA has no active WS`,
		)
		return
	}
	try {
		socket.send(
			JSON.stringify({ type: "session-ended", reason: reason ?? null }),
		)
		logClose(`closeSessionConnection(${sessionId}): hint frame queued`)
	} catch (err) {
		logClose(
			`closeSessionConnection(${sessionId}): hint write threw ${err instanceof Error ? err.message : String(err)}`,
		)
	}
	try {
		socket.close(4001, reason ?? "session ended")
		logClose(`closeSessionConnection(${sessionId}): close frame sent`)
	} catch {
		/* */
	}
	wsConnections.delete(sessionId)
}

// ── WebSocket message dispatch ────────────────────────────────────────────

/** Decode an inbound WebSocket frame, validate it, and route it to the
 *  matching session-update path. Sends an `error` frame back when the
 *  decode/validation fails. No-op when the session is unknown. */
export function handleWebSocketMessage(sessionId: string, raw: string): void {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		sendToWebSocket(sessionId, {
			type: "error",
			error: "invalid_json",
		} satisfies WsServerMessage)
		return
	}
	const schemaResult = WsClientMessageSchema.safeParse(parsed)
	if (!schemaResult.success) {
		sendToWebSocket(sessionId, {
			type: "error",
			error: "invalid_ws_frame",
		} satisfies WsServerMessage)
		return
	}
	const msg = schemaResult.data
	const session = getSession(sessionId)
	if (!session) return

	if (session.session_type === "review" && msg.type === "decide") {
		const decision =
			msg.decision === "approved" ? "approved" : "changes_requested"
		const feedback = msg.feedback ?? ""
		const annotations = msg.annotations as ReviewAnnotations | undefined
		updateSession(sessionId, {
			status: "decided" as never,
			decision,
			feedback,
			annotations,
		})
		sendToWebSocket(sessionId, {
			type: "ack",
			ok: true,
			decision,
			feedback,
		} satisfies WsServerMessage)
	} else if (session.session_type === "question" && msg.type === "answer") {
		const annotations = msg.annotations as QuestionAnnotations | undefined
		updateQuestionSession(sessionId, {
			status: "answered",
			answers: msg.answers as QuestionAnswer[],
			feedback: msg.feedback ?? "",
			annotations,
		})
		sendToWebSocket(sessionId, {
			type: "ack",
			ok: true,
		} satisfies WsServerMessage)
	} else if (
		session.session_type === "design_direction" &&
		msg.type === "select"
	) {
		if (session.status === "answered") {
			sendToWebSocket(sessionId, {
				type: "error",
				error: "Direction already selected",
			} satisfies WsServerMessage)
			return
		}
		const selection =
			msg.mode === "regenerate"
				? {
						mode: "regenerate" as const,
						keep: msg.keep ?? [],
						...(msg.comments ? { comments: msg.comments } : {}),
					}
				: {
						mode: "select" as const,
						// The schema's refinement guarantees archetype is a
						// non-empty string when mode === "select".
						archetype: msg.archetype as string,
						...(msg.comments ? { comments: msg.comments } : {}),
						...(msg.annotations ? { annotations: msg.annotations } : {}),
					}
		updateDesignDirectionSession(sessionId, {
			status: "answered",
			selection,
		})
		sendToWebSocket(sessionId, {
			type: "ack",
			ok: true,
		} satisfies WsServerMessage)
	}
}
