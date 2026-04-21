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
	type WsServerMessage,
	WsServerMessageSchema,
	type WsSessionUpdateMessage,
} from "haiku-api"
import { useEffect, useRef } from "react"
import { useApiClient } from "../api/context"

export interface UseSessionWebSocketOptions {
	onUpdate?: (msg: WsSessionUpdateMessage) => void
}

export function useSessionWebSocket(
	sessionId: string,
	options: UseSessionWebSocketOptions = {},
) {
	const wsRef = useRef<WebSocket | null>(null)
	const pendingRef = useRef<WsSessionUpdateMessage | null>(null)
	const rafRef = useRef<number | null>(null)
	const onUpdateRef = useRef(options.onUpdate)
	const client = useApiClient()

	// Keep the latest onUpdate in a ref so the effect doesn't re-open the WS
	// when the callback identity changes.
	useEffect(() => {
		onUpdateRef.current = options.onUpdate
	}, [options.onUpdate])

	useEffect(() => {
		const ws = client.openWebSocket(sessionId)
		if (!ws) return

		ws.onopen = () => {
			// connected
		}

		ws.onclose = () => {
			if (wsRef.current === ws) wsRef.current = null
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
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current)
				rafRef.current = null
			}
			pendingRef.current = null
			ws.close()
			if (wsRef.current === ws) wsRef.current = null
		}
	}, [sessionId, client])

	return wsRef
}
