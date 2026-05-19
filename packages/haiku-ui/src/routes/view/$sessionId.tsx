/**
 * /view/:sessionId — artifact-browser opened by `haiku_view`. The
 * SPA reads `stage` and `artifact` query params at mount to
 * optionally deep-link to a specific stage or single artifact.
 *
 * No decision flow, no annotations, no heartbeat gating — this
 * route exists so runtime-verifier review-agents (and other Playwright
 * consumers) have a tunnelled URL pointing at the same rendering
 * surface a human would see.
 */

import { createFileRoute } from "@tanstack/react-router"
import { ViewModule } from "../../pages"

interface ViewSearch {
	stage?: string
	artifact?: string
}

function ViewRoute(): React.ReactElement {
	const { sessionId } = Route.useParams()
	const search = Route.useSearch() as ViewSearch
	return (
		<ViewModule
			sessionId={sessionId}
			stage={search.stage}
			artifact={search.artifact}
		/>
	)
}

export const Route = createFileRoute("/view/$sessionId")({
	component: ViewRoute,
	validateSearch: (raw: Record<string, unknown>): ViewSearch => {
		const out: ViewSearch = {}
		if (typeof raw.stage === "string") out.stage = raw.stage
		if (typeof raw.artifact === "string") out.artifact = raw.artifact
		return out
	},
})
