/**
 * useSessionWebSocket — maintains a WS connection to /ws/session/:id and
 * batches `session-update` frames via requestAnimationFrame so that bursty
 * traffic (100s of frames per second) collapses to one React commit per
 * animation frame.
 *
 * Algorithm:
 *   - Every `session-update` frame writes its payload to a useRef.
 *   - If a rAF is already scheduled, the handler returns (coalescing).
 *   - Otherwise it schedules a rAF; the callback reads the latest payload,
 *     clears the ref, and calls `onUpdate` exactly once.
 *   - Unmount cancels any pending rAF.
 *
 * Messages are validated against `WsServerMessageSchema` from `haiku-api`.
 */

import {
	type WsIntentEventMessage,
	type WsServerMessage,
	WsServerMessageSchema,
	type WsSessionUpdateMessage,
} from "haiku-api"
import { useEffect, useRef } from "react"
import { useApiClient } from "../api/context"

export interface UseSessionWebSocketOptions {
	onUpdate?: (msg: WsSessionUpdateMessage) => void
	/** Fires for every per-intent live-state event the server fans out
	 *  on this session's channel. The intent broadcaster emits these
	 *  on every workflow tick, gate prep, await-state flip, and
	 *  pending-decision change. Consumers typically refetch the
	 *  session snapshot from `/api/session/:id` so the UI reflects
	 *  fresh state without hand-reducing each event variant. */
	onIntentEvent?: (msg: WsIntentEventMessage) => void
	/** Fires once the session is detected as ended — either because the
	 *  server closed our active WebSocket or because a polling-fallback
	 *  probe of `/api/session/:id` came back 404. Consumers use it to
	 *  transition into a "session ended" terminal state (e.g. a
	 *  dismiss-and-close overlay). The WS is the primary signal; poll is
	 *  the safety net for environments where WS fails to upgrade or the
	 *  close frame is lost on the wire. */
	onServerClose?: () => void
	/** Session-status polling interval (ms). Defaults to 5s. Pass 0 to
	 *  disable the polling fallback (not recommended outside tests). */
	pollIntervalMs?: number
	/** Liveness-heartbeat interval (ms) sent over the live WS. Defaults
	 *  to 30s — the cadence the engine's presence watch is tuned for
	 *  (120s grace = 4 missed beats). Pass 0 to disable (tests only). */
	heartbeatIntervalMs?: number
}

export function useSessionWebSocket(
	sessionId: string,
	options: UseSessionWebSocketOptions = {},
) {
	const wsRef = useRef<WebSocket | null>(null)
	const pendingRef = useRef<WsSessionUpdateMessage | null>(null)
	const rafRef = useRef<number | null>(null)
	const onUpdateRef = useRef(options.onUpdate)
	const onIntentEventRef = useRef(options.onIntentEvent)
	const onServerCloseRef = useRef(options.onServerClose)
	// Timestamp (ms) of the most recent heartbeat_ack the server sent
	// back. Lets the UI prove the engine still sees this tab as
	// connected — receipt of the ack, not merely the send, is the
	// liveness signal the gate await keys off.
	const lastHeartbeatAckRef = useRef<number | null>(null)
	const client = useApiClient()

	// Keep the latest callbacks in refs so the effect doesn't re-open
	// the WS when the callback identities change.
	useEffect(() => {
		onUpdateRef.current = options.onUpdate
	}, [options.onUpdate])
	useEffect(() => {
		onIntentEventRef.current = options.onIntentEvent
	}, [options.onIntentEvent])
	useEffect(() => {
		onServerCloseRef.current = options.onServerClose
	}, [options.onServerClose])

	useEffect(() => {
		// Terminal-detection strategy: WS-primary, poll-fallback.
		//
		// - WS opens + receives the server's `session-ended` hint frame or
		//   a close frame → `onServerClose` fires immediately.
		// - WS never connects (403/404/CSP/CORS/etc.) → poll /api/session/:id
		//   every `pollIntervalMs`; a 404 triggers `onServerClose`.
		// - WS connects then drops without a clean close (network blip) →
		//   the poll confirms via 404.
		//
		// `serverCloseFired` guards against double-firing when both channels
		// race to detect the same end-of-session.
		let closedByCleanup = false
		let hadOpen = false
		let serverCloseFired = false
		const fireServerClose = () => {
			if (serverCloseFired) return
			serverCloseFired = true
			onServerCloseRef.current?.()
		}

		// Poll fallback — runs regardless of WS state; low-rate so it's
		// cheap. Disabled when `pollIntervalMs` is 0.
		const pollInterval = options.pollIntervalMs ?? 5000
		let pollTimer: ReturnType<typeof setTimeout> | null = null
		const scheduleNextPoll = () => {
			if (closedByCleanup || serverCloseFired || pollInterval <= 0) return
			pollTimer = setTimeout(runPoll, pollInterval)
		}
		const runPoll = async () => {
			if (closedByCleanup || serverCloseFired) return
			try {
				const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}`)
				if (closedByCleanup || serverCloseFired) return
				if (res.status === 404) {
					fireServerClose()
					return
				}
			} catch {
				// Network error — retry next cycle. Don't fire session-end
				// on transient fetch failures; we'd rather under-trigger
				// than spuriously close a working session.
			}
			scheduleNextPoll()
		}
		scheduleNextPoll()

		const ws = client.openWebSocket(sessionId)
		if (!ws) {
			// No WS at all — poll is the only signal. Return the same
			// cleanup shape so the poll-fallback shuts down on unmount.
			return () => {
				closedByCleanup = true
				if (pollTimer !== null) clearTimeout(pollTimer)
			}
		}

		// Liveness heartbeat over the live socket. The engine's presence
		// watch (120s grace) treats a connected, heartbeating tab as
		// "human present at the gate"; missing beats are what lets it
		// re-launch the browser or declare the await abandoned. We send
		// one immediately on open (so a fresh connect — including the
		// reconnect after a page refresh — registers presence at once)
		// and then every `heartbeatIntervalMs`.
		const heartbeatInterval = options.heartbeatIntervalMs ?? 30_000
		let heartbeatTimer: ReturnType<typeof setInterval> | null = null
		const sendHeartbeat = () => {
			if (ws.readyState !== ws.OPEN) return
			try {
				ws.send(JSON.stringify({ type: "heartbeat", t: Date.now() }))
			} catch {
				// Socket mid-close — the next reconnect resumes heartbeating.
			}
		}

		ws.onopen = () => {
			hadOpen = true
			if (heartbeatInterval > 0) {
				sendHeartbeat()
				heartbeatTimer = setInterval(sendHeartbeat, heartbeatInterval)
			}
		}

		ws.onclose = () => {
			if (wsRef.current === ws) wsRef.current = null
			if (heartbeatTimer !== null) {
				clearInterval(heartbeatTimer)
				heartbeatTimer = null
			}
			// A former-open that closed = server drop. Connection failure
			// (never opened) won't trigger here; poll catches that case.
			if (!closedByCleanup && hadOpen) fireServerClose()
		}

		ws.onerror = () => {
			if (wsRef.current === ws) wsRef.current = null
		}

		ws.onmessage = (ev: MessageEvent) => {
			let parsed: unknown
			try {
				parsed = JSON.parse(String(ev.data))
			} catch {
				return
			}
			const result = WsServerMessageSchema.safeParse(parsed)
			if (!result.success) return
			const msg: WsServerMessage = result.data

			// Heartbeat ack — the engine confirms it recorded our beat and
			// still sees this tab as connected. Stamp the receipt time; no
			// UI commit needed.
			if (msg.type === "heartbeat_ack") {
				lastHeartbeatAckRef.current = Date.now()
				return
			}

			// Per-intent live-state events forward synchronously — they
			// drive small UI state changes (Approve button gating,
			// pending-decision banner) and consumers typically respond
			// by refetching the session snapshot. No rAF coalescing
			// here: events are infrequent (human-paced workflow ticks)
			// and each one carries distinct meaning.
			if (msg.type === "intent-event") {
				onIntentEventRef.current?.(msg)
				return
			}

			if (msg.type !== "session-update") return

			// rAF coalescing — only the most recent session-update per frame wins.
			pendingRef.current = msg
			if (rafRef.current !== null) return
			rafRef.current = requestAnimationFrame(() => {
				rafRef.current = null
				const payload = pendingRef.current
				pendingRef.current = null
				if (payload && onUpdateRef.current) {
					onUpdateRef.current(payload)
				}
			})
		}

		wsRef.current = ws

		return () => {
			closedByCleanup = true
			if (pollTimer !== null) clearTimeout(pollTimer)
			if (heartbeatTimer !== null) {
				clearInterval(heartbeatTimer)
				heartbeatTimer = null
			}
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current)
				rafRef.current = null
			}
			pendingRef.current = null
			ws.close()
			if (wsRef.current === ws) wsRef.current = null
		}
	}, [sessionId, client, options.pollIntervalMs, options.heartbeatIntervalMs])

	return wsRef
}
