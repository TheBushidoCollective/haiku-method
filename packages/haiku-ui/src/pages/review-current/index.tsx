/**
 * ReviewCurrentPageModule — per-route wrapper for /review/current.
 *
 * This route uses a different data source from `/review/:id` — the
 * always-available review state at `/api/review/current`. The module owns
 * the fetch lifecycle (via the injected ApiClient) + the document title,
 * and hands concrete data to the existing `<ReviewCurrentPage>` component.
 *
 * Per unit-06 tactical plan §5: the fetch is routed through
 * `useApiClient().fetchReviewCurrent()`, not a raw `fetch()` call, to honor
 * the unit spec phrasing "consuming the session from haiku-api" and to let
 * tests inject a mock via `<ApiClientProvider client={...} />`.
 */

import type { ReviewCurrentPayload } from "haiku-api"
import { useEffect, useState } from "react"
import { useApiClient } from "../../api/context"
import { ReviewCurrentPage } from "../../components/ReviewCurrentPage"
import type { ReviewCurrentResponse } from "../../types"

export function ReviewCurrentPageModule(): React.ReactElement {
	const client = useApiClient()
	const [data, setData] = useState<ReviewCurrentResponse | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		async function load() {
			try {
				const payload = (await client.fetchReviewCurrent()) as
					| ReviewCurrentPayload
					| ReviewCurrentResponse
				if (!cancelled) {
					// haiku-api's ReviewCurrentPayload is the wire type; the SPA's
					// local ReviewCurrentResponse carries additional parsed shapes
					// the server emits. Cast through unknown — the data is shape-
					// compatible at runtime.
					setData(payload as unknown as ReviewCurrentResponse)
					setLoading(false)
				}
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error ? err.message : "Failed to load review state",
					)
					setLoading(false)
				}
			}
		}
		load()
		return () => {
			cancelled = true
		}
	}, [client])

	useEffect(() => {
		if (data) document.title = `Review: ${data.intent}`
	}, [data])

	if (loading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="text-center">
					<div className="mb-3 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-stone-300 border-t-teal-500" />
					<p className="text-sm text-stone-600 dark:text-stone-300">
						Loading review state...
					</p>
				</div>
			</div>
		)
	}

	if (error || !data) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="text-center">
					<p className="text-lg font-semibold text-red-600 dark:text-red-400">
						Review state unavailable
					</p>
					<p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
						{error || "No active intent found."}
					</p>
				</div>
			</div>
		)
	}

	return <ReviewCurrentPage data={data} />
}
