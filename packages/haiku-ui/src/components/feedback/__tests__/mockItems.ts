/**
 * Deterministic fixture generator for FeedbackItemData arrays.
 *
 * Visits roll 1 → 7 so virtualized renders exercise every visit-counter tier
 * (hidden / stone / amber / red). Statuses cycle through pending, addressed,
 * closed, rejected so every status is represented in the first four items.
 */

import type { FeedbackItemData } from "../../../types"
import type { FeedbackOrigin, FeedbackStatus } from "../tokens"

const STATUS_CYCLE: FeedbackStatus[] = [
	"pending",
	"addressed",
	"closed",
	"rejected",
]

const ORIGIN_CYCLE: FeedbackOrigin[] = [
	"adversarial-review",
	"user-chat",
	"user-visual",
	"external-pr",
	"agent",
	"external-mr",
]

export function mockItems(n: number): FeedbackItemData[] {
	const items: FeedbackItemData[] = []
	for (let i = 0; i < n; i++) {
		const status = STATUS_CYCLE[i % STATUS_CYCLE.length]
		const origin = ORIGIN_CYCLE[i % ORIGIN_CYCLE.length]
		const visit = ((i % 7) + 1) as number
		const id = `FB-${String(i + 1).padStart(2, "0")}`
		items.push({
			feedback_id: id,
			title: `Fixture feedback item ${id}`,
			body: `Body copy for ${id}. Lorem ipsum dolor sit amet.`,
			status,
			origin,
			author: origin === "agent" ? "agent" : "user",
			author_type: origin === "agent" ? "agent" : "human",
			created_at: `2026-04-20T10:${String(i % 60).padStart(2, "0")}:00Z`,
			visit,
			source_ref: null,
			closed_by: status === "closed" ? "unit-99-assessor" : null,
		})
	}
	return items
}
