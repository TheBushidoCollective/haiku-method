/**
 * State-matrix behavioral coverage for the redesigned RevisitModal
 * confirm dialog. The earlier per-reason form has been retired (pending
 * feedback items on disk ARE the reasons), so this suite covers the
 * confirm + dispatch + session/stage plumbing surface that remains.
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react"
import type { AdvanceResponse } from "haiku-api"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ApiClient } from "../../api/client"
import type { FeedbackItemData } from "../../types"
import { RevisitModal } from "../RevisitModal"

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

function makeStubClient(
	submitAdvance?: (sessionId: string) => Promise<AdvanceResponse>,
): ApiClient {
	return {
		fetchSession: vi.fn(),
		fetchReviewCurrent: vi.fn(),
		submitDecision: vi.fn(),
		submitAnswer: vi.fn(),
		submitDirection: vi.fn(),
		submitPicker: vi.fn(),
		submitAdvance:
			submitAdvance ??
			vi.fn(
				async (_s: string): Promise<AdvanceResponse> => ({
					ok: true as const,
					stage: "design",
					open_feedback_count: 0,
					stamped_user_slots: true,
				}),
			),
		feedback: {
			list: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		setSessionId: vi.fn(),
		getSessionId: () => null,
		openWebSocket: () => null,
	}
}

function makeItem(overrides: Partial<FeedbackItemData> = {}): FeedbackItemData {
	return {
		feedback_id: "FB-01",
		title: "Pending item",
		body: "body",
		status: "pending",
		origin: "user-chat",
		author: "user",
		author_type: "human",
		created_at: "2026-04-23T00:00:00Z",
		visit: 0,
		source_ref: null,
		closed_by: null,
		...overrides,
	}
}

describe("RevisitModal — state matrix (behavioral)", () => {
	it("closed (open=false): renders nothing into the DOM", () => {
		const { container } = render(
			<RevisitModal
				sessionId="s1"
				open={false}
				onClose={() => {}}
				apiClient={makeStubClient()}
			/>,
		)
		expect(container.innerHTML).toBe("")
	})

	it("open-default: exposes role=dialog + aria-modal=true + labelled heading", () => {
		render(
			<RevisitModal
				sessionId="s1"
				open
				onClose={() => {}}
				apiClient={makeStubClient()}
				pendingItems={[makeItem()]}
			/>,
		)
		const dialog = screen.getByRole("dialog")
		expect(dialog.getAttribute("aria-modal")).toBe("true")
		const labelId = dialog.getAttribute("aria-labelledby")
		expect(labelId).toBeTruthy()
		const labelEl = labelId ? document.getElementById(labelId) : null
		expect(labelEl?.textContent).toMatch(/send feedback/i)
	})

	it("submit calls /api/advance — no body, no workflow verb", async () => {
		const submitAdvance = vi.fn(
			async (_s: string): Promise<AdvanceResponse> => ({
				ok: true,
				stage: "product",
				open_feedback_count: 1,
				stamped_user_slots: false,
			}),
		)
		render(
			<RevisitModal
				sessionId="s1"
				open
				onClose={() => {}}
				targetStage="product"
				apiClient={makeStubClient(submitAdvance)}
				pendingItems={[makeItem()]}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: /Send/ }))
		await waitFor(() => expect(submitAdvance).toHaveBeenCalledTimes(1))
		// Single-arg call: only sessionId. No body, no stage, no verbs.
		expect(submitAdvance.mock.calls[0]).toEqual(["s1"])
	})

	it("submit passes through the sessionId verbatim regardless of targetStage", async () => {
		const submitAdvance = vi.fn(
			async (_s: string): Promise<AdvanceResponse> => ({
				ok: true,
				stage: "development",
				open_feedback_count: 0,
				stamped_user_slots: true,
			}),
		)
		render(
			<RevisitModal
				sessionId="s2-alt"
				open
				onClose={() => {}}
				targetStage="development"
				apiClient={makeStubClient(submitAdvance)}
				pendingItems={[makeItem()]}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: /Send/ }))
		await waitFor(() => expect(submitAdvance).toHaveBeenCalledTimes(1))
		expect(submitAdvance.mock.calls[0][0]).toBe("s2-alt")
	})

	it("onSuccess fires before onClose with the AdvanceResponse", async () => {
		const order: string[] = []
		const submitAdvance = vi.fn(
			async (_s: string): Promise<AdvanceResponse> => ({
				ok: true,
				stage: "design",
				open_feedback_count: 0,
				stamped_user_slots: true,
			}),
		)
		const onSuccess = vi.fn((_r: AdvanceResponse) => {
			order.push("onSuccess")
		})
		const onClose = vi.fn(() => {
			order.push("onClose")
		})
		render(
			<RevisitModal
				sessionId="s1"
				open
				onClose={onClose}
				onSuccess={onSuccess}
				apiClient={makeStubClient(submitAdvance)}
				pendingItems={[makeItem()]}
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: /Send/ }))
		await waitFor(() => expect(submitAdvance).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
		expect(order).toEqual(["onSuccess", "onClose"])
	})
})
