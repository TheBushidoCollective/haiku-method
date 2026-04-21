/**
 * Frozen token manifest for the feedback component cluster.
 *
 * Mirrors DESIGN-TOKENS §2.1 (feedback status badge palette), §2.2 (origin
 * palette + canonical emoji + visible label), §2.3 (card background + border
 * tokens), §2.4 (visit counter escalation tiers), §2.5 (filter pill).
 *
 * These tables are re-stated here — not imported from a canonical runtime
 * source — so the feedback cluster has a single, committed snapshot of the
 * token set it was built against. `verify-tokens.mjs` is the drift gate: if
 * DESIGN-TOKENS.md diverges from these tables, that script fails on CI and
 * this file must be regenerated alongside the snapshots (per the unit spec's
 * "snapshots include a header recording the token hash" workflow).
 *
 * `TOKEN_HASH` is a 16-char stable hash over the concatenated manifest so the
 * snapshot header can encode the token generation as a single opaque string.
 * A stable djb2 hash is used instead of crypto.subtle.digest to keep the
 * import synchronous and browser-free (module-load time).
 */

import type { FeedbackOrigin, FeedbackStatus } from "haiku-api"

// ── §2.1 Feedback status colors ─────────────────────────────────────────────

/** Canonical per DESIGN-TOKENS §2.1 — rejected foreground lifted to
 * text-stone-600 (light) / text-stone-300 (dark) to hit AAA after FB-15. */
export const feedbackStatusColors: Record<FeedbackStatus, string> = {
	pending:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	fixing:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	addressed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
	closed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
	rejected: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
}

/** Status dot (compact indicator) from DESIGN-TOKENS §2.1. */
export const statusDotClasses: Record<FeedbackStatus, string> = {
	pending: "bg-amber-500",
	fixing: "bg-amber-500",
	addressed: "bg-blue-500",
	closed: "bg-green-500",
	rejected: "bg-stone-400 dark:bg-stone-500",
}

// ── §2.3 Card background + border tokens ────────────────────────────────────

export const statusBorderLeft: Record<FeedbackStatus, string> = {
	pending: "border-l-[3px] border-l-amber-400 dark:border-l-amber-500",
	fixing: "border-l-[3px] border-l-amber-400 dark:border-l-amber-500",
	addressed: "border-l-[3px] border-l-blue-400 dark:border-l-blue-500",
	closed: "border-l-[3px] border-l-green-500 dark:border-l-green-400",
	rejected: "border-l-[3px] border-l-stone-400 dark:border-l-stone-500",
}

export const statusBackground: Record<FeedbackStatus, string> = {
	pending: "bg-amber-50/50 dark:bg-amber-950/20",
	fixing: "bg-amber-50/50 dark:bg-amber-950/20",
	addressed: "bg-blue-50/50 dark:bg-blue-950/20",
	closed: "bg-green-50/60 dark:bg-green-950/25",
	rejected: "bg-stone-100 dark:bg-stone-800/50",
}

// ── §2.2 Origin palette + canonical emoji + visible label ───────────────────

export const originColors: Record<FeedbackOrigin, string> = {
	"adversarial-review":
		"bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
	"studio-review":
		"bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
	"external-pr":
		"bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
	"external-mr":
		"bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
	"user-visual": "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
	"user-chat": "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
	agent: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
}

/**
 * Canonical emoji map. Code points cross-referenced with DESIGN-TOKENS §2.2
 * and `aria-landmark-spec.md §6`. Do NOT substitute — the retired emoji set
 * at §2.2 is audit-enforced.
 */
export const originIcons: Record<FeedbackOrigin, string> = {
	"adversarial-review": "\u{1F50D}", // 🔍 magnifying glass
	"studio-review": "\u{1F50D}", // 🔍 same class as adversarial — label differentiates
	"external-pr": "\u{1F517}", // 🔗 link
	"external-mr": "\u{1F517}", // 🔗 link
	"user-visual": "\u{270E}", // ✎ pencil
	"user-chat": "\u{1F4AC}", // 💬 speech balloon
	agent: "\u{1F916}", // 🤖 robot face
}

/**
 * Human-readable labels — screen readers announce the label, not the slug.
 * Components MUST render originLabels[x] rather than the bare slug; that
 * rule is the regression guard enforced by the stage-wide banned-patterns
 * audit (see audit-config.json `banned-origin-jsx-bare`).
 */
export const originLabels: Record<FeedbackOrigin, string> = {
	"adversarial-review": "Review Agent",
	"studio-review": "Studio Review",
	"external-pr": "PR Comment",
	"external-mr": "MR Comment",
	"user-visual": "Annotation",
	"user-chat": "Comment",
	agent: "Agent",
}

// ── §2.4 Visit counter escalation tiers ─────────────────────────────────────

/** Returns the visit-counter pill classes for the given visit count.
 * `<= 1` → the pill is hidden (caller typically branches on this). */
export function visitCounterClasses(visits: number): string {
	if (visits <= 1) return "hidden"
	if (visits <= 3)
		return "bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300"
	if (visits <= 5)
		return "bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
	return "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300"
}

// ── Token manifest hash ─────────────────────────────────────────────────────

/**
 * Stable djb2 hash over an arbitrary string. Deterministic across platforms
 * (no crypto dependency), suitable for a snapshot-header identity check.
 */
function djb2Hex16(input: string): string {
	let hash = 5381n
	for (let i = 0; i < input.length; i++) {
		// djb2: hash = ((hash << 5) + hash) + c
		hash =
			(((hash << 5n) + hash) & 0xffffffffffffffffn) +
			BigInt(input.charCodeAt(i))
	}
	return (hash & 0xffffffffffffffffn).toString(16).padStart(16, "0").slice(-16)
}

const MANIFEST = JSON.stringify({
	feedbackStatusColors,
	statusDotClasses,
	statusBorderLeft,
	statusBackground,
	originColors,
	originIcons,
	originLabels,
	// Enumerate the visit-counter tiers so a threshold change flips the hash.
	visitCounterTiers: [
		visitCounterClasses(1),
		visitCounterClasses(2),
		visitCounterClasses(3),
		visitCounterClasses(4),
		visitCounterClasses(5),
		visitCounterClasses(6),
	],
})

/** 16-char hex hash over the frozen manifest. Used in snapshot headers. */
export const TOKEN_HASH: string = djb2Hex16(MANIFEST)

// ── Type re-exports (single-import surface for consumers) ───────────────────

export type { FeedbackOrigin, FeedbackStatus }
