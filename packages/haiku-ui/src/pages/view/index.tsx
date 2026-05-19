/**
 * ViewPageModule — per-route wrapper for /view/:sessionId.
 *
 * Mirrors the shape of PickerPageModule / DirectionPageModule:
 * useSession fetch + useSessionWebSocket subscription wrapped in
 * SessionShell. Renders the full-size ArtifactRenderer when a
 * specific artifact deep-link was provided, or a directory-style
 * artifact list otherwise (deferred — first slice requires an
 * explicit `artifact` query param).
 */

import { useEffect } from "react"
import { useSession, useSessionWebSocket } from "../../hooks/useSession"
import { SessionShell } from "../../shell/SessionShell"
import { ViewPage } from "./ViewPage"

export interface ViewPageModuleProps {
	sessionId: string
	stage?: string
	artifact?: string
}

export function ViewPageModule({
	sessionId,
	stage,
	artifact,
}: ViewPageModuleProps): React.ReactElement {
	const { session, loading, error } = useSession(sessionId)
	useSessionWebSocket(sessionId)

	useEffect(() => {
		const base = artifact ? artifact.split("/").pop() ?? "Artifact" : "Artifact viewer"
		document.title = `${base} — H·AI·K·U`
	}, [artifact])

	if (loading) {
		return (
			<SessionShell kind="View">
				<div className="flex min-h-[40vh] items-center justify-center">
					<div className="text-center">
						<div className="mb-3 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-stone-300 border-t-teal-500" />
						<p className="text-sm text-stone-600 dark:text-stone-300">
							Loading view session…
						</p>
					</div>
				</div>
			</SessionShell>
		)
	}

	if (error || !session) {
		return (
			<SessionShell kind="View">
				<div className="flex min-h-[40vh] items-center justify-center">
					<div className="text-center">
						<p className="text-lg font-semibold text-red-600 dark:text-red-400">
							Session not found
						</p>
						<p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
							{error || "The view session may have been closed or expired."}
						</p>
					</div>
				</div>
			</SessionShell>
		)
	}

	if (session.session_type !== "view") {
		return (
			<SessionShell kind="View">
				<div className="flex min-h-[40vh] items-center justify-center">
					<p className="text-sm text-stone-600 dark:text-stone-300">
						Session type mismatch (expected view).
					</p>
				</div>
			</SessionShell>
		)
	}

	return (
		<SessionShell kind="View">
			<ViewPage
				sessionId={sessionId}
				session={session}
				stage={stage ?? session.stage}
				artifact={artifact ?? session.artifact}
			/>
		</SessionShell>
	)
}
