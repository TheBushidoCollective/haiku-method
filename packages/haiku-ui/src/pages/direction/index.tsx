/**
 * DirectionPageModule — per-route wrapper for /direction/:sessionId.
 *
 * Owns the `useSession` fetch + `useSessionWebSocket` subscription +
 * document-title sync; wraps the canonical SessionShell around the
 * DirectionPage so the title surfaces in the branded header.
 */

import { useEffect } from "react"
import { useSession, useSessionWebSocket } from "../../hooks/useSession"
import { SessionShell } from "../../shell/SessionShell"
import { DirectionPage } from "./DirectionPage"

export interface DirectionPageModuleProps {
	sessionId: string
}

export function DirectionPageModule({
	sessionId,
}: DirectionPageModuleProps): React.ReactElement {
	const { session, loading, error } = useSession(sessionId)
	const wsRef = useSessionWebSocket(sessionId)
	const dynamicTitle =
		session && session.session_type === "design_direction"
			? session.title || "Design Direction"
			: null

	useEffect(() => {
		if (dynamicTitle) document.title = dynamicTitle
	}, [dynamicTitle])

	if (loading) {
		return (
			<SessionShell kind="Design Direction">
				<div className="flex min-h-[40vh] items-center justify-center">
					<div className="text-center">
						<div className="mb-3 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-stone-300 border-t-teal-500" />
						<p className="text-sm text-stone-600 dark:text-stone-300">
							Loading session...
						</p>
					</div>
				</div>
			</SessionShell>
		)
	}

	if (error || !session) {
		return (
			<SessionShell kind="Design Direction">
				<div className="flex min-h-[40vh] items-center justify-center">
					<div className="text-center">
						<p className="text-lg font-semibold text-red-600 dark:text-red-400">
							Session not found
						</p>
						<p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
							{error || "The session may have expired."}
						</p>
					</div>
				</div>
			</SessionShell>
		)
	}

	if (session.session_type !== "design_direction") {
		return (
			<SessionShell kind="Design Direction">
				<div className="flex min-h-[40vh] items-center justify-center">
					<p className="text-sm text-stone-600 dark:text-stone-300">
						Session type mismatch (expected design_direction).
					</p>
				</div>
			</SessionShell>
		)
	}

	return (
		<SessionShell
			kind="Design Direction"
			title={session.title || "Design Direction"}
			annotatable
		>
			<DirectionPage session={session} sessionId={sessionId} wsRef={wsRef} />
		</SessionShell>
	)
}
