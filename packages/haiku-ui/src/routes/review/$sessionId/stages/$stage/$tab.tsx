/**
 * /review/:sessionId/stages/:stage/:tab — stage content by tab.
 *
 * Valid tabs: `overview` | `units` | `knowledge` | `outputs` | `other`.
 * Any other value falls through to the root 404 via `notFoundComponent`.
 *
 * `other` is the catchall surface for files under `stages/<stage>/`
 * that aren't declared by a unit and aren't under `artifacts/` /
 * `knowledge/` / `discovery/` (added with the ReviewTab union
 * widening in commit ee1c784ae). Pre-2026-05-13 this list was stale
 * vs. the union, so `/stages/<stage>/other` 404'd with "No session
 * found" even though the session existed — reported from a v5.0.1
 * client.
 */

import { createFileRoute, notFound } from "@tanstack/react-router"
import type { ReviewTab } from "../../../../../pages/review/shared/stage-tabs"
import { StageContent } from "./-stage-content"

const VALID_TABS: ReviewTab[] = [
	"overview",
	"units",
	"knowledge",
	"outputs",
	"other",
]

function isTab(v: string): v is ReviewTab {
	return (VALID_TABS as string[]).includes(v)
}

function StageTab(): React.ReactElement {
	const { stage, tab } = Route.useParams()
	return <StageContent stage={stage} tab={tab} detail={null} />
}

export const Route = createFileRoute("/review/$sessionId/stages/$stage/$tab")({
	parseParams: (params) => {
		if (!isTab(params.tab)) throw notFound()
		return { ...params, tab: params.tab }
	},
	component: StageTab,
})
