/**
 * IntentDriftAssessmentsSection — wraps `DriftAssessmentsView` with a
 * fetch hook against `/api/intents/:intent/assessments`. The injectable
 * `fetchImpl` prop exists specifically for testability — these tests
 * assert the loading / error / loaded states without hitting the network.
 *
 * Round 23 follow-up: the section was extracted as the shared mount for
 * the production `routes/review/$sessionId/intent.tsx` and the test-only
 * `pages/review/ReviewPage.tsx` IntentOverviewPane. Reviewer flagged it
 * as untested; this file closes that gap.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { IntentDriftAssessmentsSection } from "../IntentDriftAssessmentsSection"

afterEach(() => {
	cleanup()
})

function makeFetchImpl(
	response: { ok: boolean; json: () => unknown; status?: number } | Error,
): typeof fetch {
	return vi.fn(async () => {
		if (response instanceof Error) throw response
		return {
			ok: response.ok,
			status: response.status ?? (response.ok ? 200 : 500),
			json: async () => response.json(),
		} as Response
	}) as unknown as typeof fetch
}

describe("IntentDriftAssessmentsSection", () => {
	it("renders the empty state until the fetch resolves with no assessments", async () => {
		const fetchImpl = makeFetchImpl({
			ok: true,
			json: () => ({ assessments: [] }),
		})
		render(
			<IntentDriftAssessmentsSection
				intentSlug="test-intent"
				fetchImpl={fetchImpl}
			/>,
		)
		await waitFor(() => {
			expect(fetchImpl).toHaveBeenCalledTimes(1)
		})
		// DriftAssessmentsView renders an empty-state when assessments=[].
		// We don't assert on the exact copy here — that's the child's
		// contract — only that the wrapper rendered (no error banner).
		expect(screen.queryByText(/Failed to load drift assessments/)).toBeNull()
	})

	it("encodes the intent slug into the fetched URL", async () => {
		const fetchImpl = makeFetchImpl({
			ok: true,
			json: () => ({ assessments: [] }),
		})
		render(
			<IntentDriftAssessmentsSection
				intentSlug="my intent/with spaces"
				fetchImpl={fetchImpl}
			/>,
		)
		await waitFor(() => {
			expect(fetchImpl).toHaveBeenCalledTimes(1)
		})
		const callUrl = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][0]
		expect(callUrl).toBe("/api/intents/my%20intent%2Fwith%20spaces/assessments")
	})

	it("renders an amber error banner when fetch returns non-ok", async () => {
		const fetchImpl = makeFetchImpl({
			ok: false,
			status: 503,
			json: () => ({}),
		})
		render(
			<IntentDriftAssessmentsSection
				intentSlug="test-intent"
				fetchImpl={fetchImpl}
			/>,
		)
		await waitFor(() => {
			expect(
				screen.getByText(/Failed to load drift assessments: HTTP 503/),
			).toBeTruthy()
		})
	})

	it("renders an amber error banner when fetch throws", async () => {
		const fetchImpl = makeFetchImpl(new Error("network down"))
		render(
			<IntentDriftAssessmentsSection
				intentSlug="test-intent"
				fetchImpl={fetchImpl}
			/>,
		)
		await waitFor(() => {
			expect(
				screen.getByText(/Failed to load drift assessments: network down/),
			).toBeTruthy()
		})
	})

	it("does not set state after unmount (cancellation guard)", async () => {
		// Unmount immediately after render — before the fetch promise
		// resolves. The cleanup `cancelled = true` guard should prevent
		// any state update. We assert that no React act() warning fires
		// by spying on console.error: any "act" warning would surface
		// there.
		const errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		let resolveFn: (value: Response) => void = () => {}
		const slowFetch = vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					resolveFn = resolve
				}),
		) as unknown as typeof fetch
		const { unmount } = render(
			<IntentDriftAssessmentsSection
				intentSlug="test-intent"
				fetchImpl={slowFetch}
			/>,
		)
		unmount()
		// Resolve after unmount — cleanup must have flipped `cancelled`.
		resolveFn({
			ok: true,
			status: 200,
			json: async () => ({ assessments: [] }),
		} as Response)
		// Give the microtask queue a chance to drain.
		await new Promise((r) => setTimeout(r, 0))
		const actWarnings = errSpy.mock.calls.filter((call) =>
			String(call[0] ?? "").includes("not wrapped in act"),
		)
		expect(actWarnings.length).toBe(0)
		errSpy.mockRestore()
	})
})
