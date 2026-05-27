/**
 * Shared geometry for the mobile feedback rail + its reserved gutter.
 *
 * On mobile (<xl) the feedback trigger is a thin FULL-HEIGHT vertical column
 * (`FeedbackRail`) pinned to the left edge of the viewport. It occupies REAL
 * layout space — page content must never render underneath it. The review
 * content container reserves that space with matching left-padding so the
 * rail and content never overlap.
 *
 * This module is the single source of truth for that width so the rail and the
 * gutter can never drift apart:
 *   - `RAIL_WIDTH_CLASS`  — the rail's own `w-*` utility.
 *   - `RAIL_GUTTER_CLASS` — the matching `pl-*` the content container applies
 *     on the mobile branch to inset content by the rail's width.
 *
 * Both resolve to the same Tailwind scale step (`9` = 2.25rem = 36px), which
 * sits in the 36–40px target band for a vertical edge tab.
 *
 * The OPEN drawer is a separate, out-of-flow overlay (`fixed`, higher z) — it
 * floats ON TOP of content and does NOT consume layout, so there is zero
 * layout shift between the closed (gutter only) and open (gutter + overlay)
 * states. Only the rail gutter is permanent layout.
 */
export const RAIL_WIDTH_CLASS = "w-9"
export const RAIL_GUTTER_CLASS = "pl-9"
/**
 * Margin variant of the gutter (`ml-9`, same `9` scale step as the
 * width/padding above). Used by the sticky bottom gate bar: a PADDING
 * gutter (`pl-9`) only insets the bar's CONTENT — the bar's `w-full` dark
 * background still paints the full width, including the 36px the rail
 * occupies, painting a black box over the rail's bottom edge (the rail is
 * z-30, the bar z-[60], so the bar wins). A MARGIN (`ml-9`) instead pushes
 * the bar's whole box — background included — to start AFTER the rail, so
 * the rail stays visible to the very bottom and the bar sits beside it. A
 * flex child with `ml-9` (no `w-full`) fills the remaining width on its own.
 */
export const RAIL_GUTTER_MARGIN_CLASS = "ml-9"
