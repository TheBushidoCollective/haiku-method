/**
 * IntentDriftAssessmentsSection — wraps `DriftAssessmentsView` with a
 * fetch hook against the existing read-only assessments endpoint
 * (`GET /api/intents/:intent/assessments`, exposed by
 * `packages/haiku/src/http/assessments-routes.ts`). Designed for
 * intent-overview surfaces (production: `routes/review/$sessionId/intent.tsx`;
 * test path: `pages/review/ReviewPage.tsx`'s IntentOverviewPane).
 *
 * Failure handling: surfaces a small amber banner above the still-rendered
 * DriftAssessmentsView so the empty-state context stays visible while
 * the user retries (refreshing the route re-runs the fetch).
 */

import { useEffect, useState } from "react"
import {
	type AssessmentEntry,
	DriftAssessmentsView,
} from "./DriftAssessmentsView"

export interface IntentDriftAssessmentsSectionProps {
	intentSlug: string
	/** Optional override for the fetch implementation. Tests pass a stub
	 *  to assert on the loading / error / loaded states without hitting
	 *  the network. Default: `globalThis.fetch`. */
	fetchImpl?: typeof fetch
}

export function IntentDriftAssessmentsSection({
	intentSlug,
	fetchImpl,
}: IntentDriftAssessmentsSectionProps): React.ReactElement {
	const [assessments, setAssessments] = useState<AssessmentEntry[]>([])
	const [error, setError] = useState<string | null>(null)
	useEffect(() => {
		let cancelled = false
		const url = `/api/intents/${encodeURIComponent(intentSlug)}/assessments`
		const f = fetchImpl ?? globalThis.fetch
		f(url, { credentials: "include" })
			.then(async (res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				const body = (await res.json()) as { assessments?: AssessmentEntry[] }
				if (!cancelled) setAssessments(body.assessments ?? [])
			})
			.catch((err) => {
				if (!cancelled)
					setError(err instanceof Error ? err.message : String(err))
			})
		return () => {
			cancelled = true
		}
	}, [intentSlug, fetchImpl])
	return (
		<div>
			{error && (
				<div className="mb-2 px-4 py-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-800 dark:text-amber-300">
					Failed to load drift assessments: {error}. Empty state shown below.
				</div>
			)}
			<DriftAssessmentsView intentSlug={intentSlug} assessments={assessments} />
		</div>
	)
}
