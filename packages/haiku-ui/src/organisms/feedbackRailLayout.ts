/**
 * Shared geometry for the mobile feedback rail + its reserved gutter.
 *
 * On mobile (<xl) the feedback trigger is a thin FULL-HEIGHT vertical column
 * (`FeedbackRail`) pinned to the right edge of the viewport. It occupies REAL
 * layout space — page content must never render underneath it. The review
 * content container reserves that space with matching right-padding so the
 * rail and content never overlap.
 *
 * This module is the single source of truth for that width so the rail and the
 * gutter can never drift apart:
 *   - `RAIL_WIDTH_CLASS`  — the rail's own `w-*` utility.
 *   - `RAIL_GUTTER_CLASS` — the matching `pr-*` the content container applies
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
export const RAIL_GUTTER_CLASS = "pr-9"
