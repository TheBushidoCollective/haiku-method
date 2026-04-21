import { useEffect, useState } from "react"
import { useApiClient } from "../api/context"
import type { QuestionAnswer, ReviewAnnotations, SessionData } from "../types"

// Re-export from the extracted module so existing `import { useSessionWebSocket }
// from "./useSession"` paths continue to work during migration.
export { useSessionWebSocket } from "./useSessionWebSocket"

/** Try to send data via WebSocket. Returns true if sent, false otherwise. */
function trySendViaWs(
	wsRef: React.RefObject<WebSocket | null>,
	data: unknown,
): boolean {
	const ws = wsRef.current
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data))
		return true
	}
	return false
}

export function useSession(sessionId: string) {
	const [session, setSession] = useState<SessionData | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const client = useApiClient()

	useEffect(() => {
		let cancelled = false

		async function fetchSession() {
			try {
				const data = await client.fetchSession(sessionId)
				if (!cancelled) {
					setSession(data)
					setLoading(false)
				}
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "Failed to load session",
					)
					setLoading(false)
				}
			}
		}

		fetchSession()

		return () => {
			cancelled = true
		}
	}, [sessionId, client])

	return { session, loading, error }
}

/** Submit a review decision (approve / changes_requested).
 *  Tries WebSocket first if a wsRef is provided, falls back to HTTP POST. */
export async function submitDecision(
	sessionId: string,
	decision: "approved" | "changes_requested" | "external_review",
	feedback: string,
	annotations?: ReviewAnnotations,
	wsRef?: React.RefObject<WebSocket | null>,
): Promise<void> {
	// Try WebSocket first
	if (wsRef) {
		const sent = trySendViaWs(wsRef, {
			type: "decide",
			decision,
			feedback,
			annotations,
		})
		if (sent) return
	}

	// Fall back to HTTP POST
	const payload: Record<string, unknown> = { decision, feedback }
	if (annotations) {
		payload.annotations = annotations
	}

	const res = await fetch(`/review/${sessionId}/decide`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"bypass-tunnel-reminder": "1",
		},
		body: JSON.stringify(payload),
		keepalive: true,
	})

	if (!res.ok) {
		throw new Error(`HTTP ${res.status}`)
	}
}

/** Submit question answers.
 *  Tries WebSocket first if a wsRef is provided, falls back to HTTP POST. */
export async function submitAnswers(
	sessionId: string,
	answers: QuestionAnswer[],
	wsRef?: React.RefObject<WebSocket | null>,
	feedback?: string,
	annotations?: {
		comments?: Array<{
			selectedText: string
			comment: string
			paragraph: number
		}>
	},
): Promise<void> {
	// Try WebSocket first
	if (wsRef) {
		const sent = trySendViaWs(wsRef, {
			type: "answer",
			answers,
			feedback,
			annotations,
		})
		if (sent) return
	}

	// Fall back to HTTP POST
	const payload: Record<string, unknown> = { answers }
	if (feedback) payload.feedback = feedback
	if (annotations) payload.annotations = annotations

	const res = await fetch(`/question/${sessionId}/answer`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"bypass-tunnel-reminder": "1",
		},
		body: JSON.stringify(payload),
		keepalive: true,
	})

	if (!res.ok) {
		throw new Error(`HTTP ${res.status}`)
	}
}

/** Submit a design direction selection.
 *  Tries WebSocket first if a wsRef is provided, falls back to HTTP POST. */
export async function submitDesignDirection(
	sessionId: string,
	archetype: string,
	parameters: Record<string, number>,
	wsRef?: React.RefObject<WebSocket | null>,
): Promise<void> {
	// Try WebSocket first
	if (wsRef) {
		const sent = trySendViaWs(wsRef, {
			type: "select",
			archetype,
			parameters,
		})
		if (sent) return
	}

	// Fall back to HTTP POST
	const res = await fetch(`/direction/${sessionId}/select`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"bypass-tunnel-reminder": "1",
		},
		body: JSON.stringify({ archetype, parameters }),
		keepalive: true,
	})

	if (!res.ok) {
		const body = await res.json().catch(() => ({}))
		throw new Error(body.error || `HTTP ${res.status}`)
	}
}

/** Best-effort attempt to close the tab after a submission.
 *  Caller is responsible for updating its own UI state — this helper only
 *  fires a last-ditch sendBeacon and calls window.close(). window.close() is
 *  a no-op for tabs the script didn't open, so callers MUST not gate their
 *  success state on this. */
export function tryCloseTab(beacon?: { url: string; body: unknown }) {
	setTimeout(() => {
		if (beacon && navigator.sendBeacon) {
			navigator.sendBeacon(
				beacon.url,
				new Blob([JSON.stringify(beacon.body)], { type: "application/json" }),
			)
		}
		window.close()
	}, 200)
}
