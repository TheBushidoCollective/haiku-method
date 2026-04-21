/**
 * Route-parser coverage per unit-06 tactical plan §A2.
 *
 * Table-driven, asserts both shape and precedence (e.g. `/review/current`
 * must NOT fall through to the `/review/:id` regex).
 */

import { describe, expect, it } from "vitest"
import { parseRoute } from "../parseRoute"

describe("parseRoute", () => {
	const cases: Array<{
		path: string
		expected: ReturnType<typeof parseRoute>
	}> = [
		{
			path: "/review/current",
			expected: { pageType: "review-current", sessionId: "current" },
		},
		{
			path: "/review/current/",
			expected: { pageType: "review-current", sessionId: "current" },
		},
		{
			path: "/review/abc-123",
			expected: { pageType: "review", sessionId: "abc-123" },
		},
		{
			path: "/review/test-review-1",
			expected: { pageType: "review", sessionId: "test-review-1" },
		},
		{
			path: "/review/current/extra",
			expected: null,
		},
		{
			path: "/question/xyz",
			expected: { pageType: "question", sessionId: "xyz" },
		},
		{
			path: "/direction/q1",
			expected: { pageType: "direction", sessionId: "q1" },
		},
		{ path: "/", expected: null },
		{ path: "/unknown/path", expected: null },
		{ path: "/review/", expected: null },
		{ path: "/review", expected: null },
		{ path: "/review/../etc", expected: null },
	]

	for (const { path, expected } of cases) {
		it(`parses ${JSON.stringify(path)}`, () => {
			expect(parseRoute(path)).toEqual(expected)
		})
	}

	it("defaults to window.location.pathname when no arg is passed", () => {
		const previous = window.location.pathname
		window.history.replaceState({}, "", "/review/defaulted-path")
		try {
			expect(parseRoute()).toEqual({
				pageType: "review",
				sessionId: "defaulted-path",
			})
		} finally {
			window.history.replaceState({}, "", previous)
		}
	})
})
