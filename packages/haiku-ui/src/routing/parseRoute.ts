/**
 * Typed route parser for the H·AI·K·U review SPA.
 *
 * The SPA has four page types hung off `window.location.pathname`:
 *
 *   /review/current        -> { pageType: "review-current", sessionId: "current" }
 *   /review/:id            -> { pageType: "review",         sessionId: ":id"    }
 *   /question/:id          -> { pageType: "question",       sessionId: ":id"    }
 *   /direction/:id         -> { pageType: "direction",      sessionId: ":id"    }
 *   (anything else)        -> null   (shell renders a 404 placeholder)
 *
 * `/review/current` is tested BEFORE the generic `/review/:id` branch so the
 * literal `current` segment does not get dispatched to `SessionLoader` with
 * `sessionId: "current"`.
 *
 * Path-traversal defense: any path containing a `..` segment is rejected.
 *
 * Source of truth: see unit-06 scope in
 * `stages/development/units/unit-06-shell-and-routing.md`.
 */

export type PageType = "review" | "review-current" | "question" | "direction"

export interface ParsedRoute {
	pageType: PageType
	sessionId: string
}

const REVIEW_RE = /^\/review\/([^/]+)\/?$/
const QUESTION_RE = /^\/question\/([^/]+)\/?$/
const DIRECTION_RE = /^\/direction\/([^/]+)\/?$/

export function parseRoute(pathname?: string): ParsedRoute | null {
	const path =
		pathname ?? (typeof window === "undefined" ? "/" : window.location.pathname)

	// Path-traversal guard — a `..` segment in the URL should never reach a loader.
	const segments = path.split("/")
	if (segments.some((seg) => seg === "..")) {
		return null
	}

	// /review/current must win over /review/:id.
	if (path === "/review/current" || path === "/review/current/") {
		return { pageType: "review-current", sessionId: "current" }
	}

	const review = REVIEW_RE.exec(path)
	if (review?.[1]) {
		return { pageType: "review", sessionId: review[1] }
	}

	const question = QUESTION_RE.exec(path)
	if (question?.[1]) {
		return { pageType: "question", sessionId: question[1] }
	}

	const direction = DIRECTION_RE.exec(path)
	if (direction?.[1]) {
		return { pageType: "direction", sessionId: direction[1] }
	}

	return null
}
