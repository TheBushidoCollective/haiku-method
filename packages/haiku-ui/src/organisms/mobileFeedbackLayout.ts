/**
 * Shared bottom-offset for the mobile feedback affordances.
 *
 * On mobile (<xl) the review gate (`GateDecisionBar`) is pinned to the very
 * bottom of the viewport inside a `sticky bottom-0 z-30` wrapper. Every
 * floating mobile feedback affordance that lives in the bottom band — the
 * `FeedbackFloatingButton` FAB and the `FeedbackSheet` drawer — must sit
 * ABOVE that bar so it never paints over the Approve / Request-Changes
 * controls.
 *
 * This constant is the single source of truth for that clearance. The FAB,
 * the drawer, and any future bottom-band affordance reference it instead of
 * hard-coding a magic `bottom-44`, so they can never drift out of alignment
 * with each other (and a single edit re-tunes all of them at once).
 *
 * The value is a Tailwind utility (`bottom-44` = 11rem) chosen to clear the
 * decision bar's height plus a small gap. The drawer is then geometrically
 * ABOVE the decision bar — they share a `z-30`-class layer but never overlap,
 * so the bar stays fully visible and clickable while the drawer is open.
 */
export const MOBILE_FEEDBACK_BOTTOM_OFFSET = "bottom-44"
