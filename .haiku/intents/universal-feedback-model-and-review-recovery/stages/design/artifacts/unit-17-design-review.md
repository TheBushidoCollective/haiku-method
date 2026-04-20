# Design Review — unit-17-design-brief-tokens-alignment (bolt 3)

**Reviewer:** design-reviewer
**Outcome:** advance (all 5 gates pass)
**Date:** 2026-04-19

Bolt 3 addresses two assessor-pending findings surfaced after bolt 2
closed: FB-40 (gate-1 contrast table drift) and FB-45 (forbidden emoji
still rendered in two artifacts). Both are fixed. Gates 2/3/5 are
unchanged from bolt 2 and remain stable.

## Gate-by-gate

### Gate 1 — FeedbackStatusBadge text-shade consistency — PASS (was drifted in §6)

Bolt 2 approved gate 1 against DESIGN-BRIEF §2 + DESIGN-TOKENS §2.1
only. FB-40 caught that DESIGN-BRIEF §6 "Contrast Ratios" table had
not been swept to match — it still listed amber-700 / blue-700 /
green-700 and stone-700 on stone-200 while §2 canonicalizes -800
shades and stone-500 on stone-100. §6 contradicted §2.

Bolt 3 (commit `c0ae4379`) rewrote §6 to match:

| Badge | Foreground | Background | Ratio |
|---|---|---|---|
| Pending (light) | `amber-800` | `amber-100` | 5.9:1 |
| Pending (dark) | `amber-300` | `amber-900/30` | 5.1:1 |
| Addressed (light) | `blue-800` | `blue-100` | 7.2:1 |
| Addressed (dark) | `blue-300` | `blue-900/30` | 5.5:1 |
| Closed (light) | `green-800` | `green-100` | 5.8:1 |
| Closed (dark) | `green-300` | `green-900/30` | 4.9:1 |
| Rejected (light) | `stone-500` | `stone-100` | 4.6:1 |
| Rejected (dark) | `stone-400` | `stone-800` | 4.9:1 |

DESIGN-BRIEF §2 (lines 169-172), DESIGN-BRIEF §6 (lines 734-741), and
DESIGN-TOKENS §2.1 (lines 236-239) now all three agree. All dark-mode
contrast pairs are lifted from `-400` foregrounds to `-300` to match
§2's canonical pairs. Every pair still passes WCAG 2.1 AA (≥ 4.5:1).

`grep -nE 'amber-700|blue-700|green-700'` against DESIGN-BRIEF.md
returns zero hits in the badge tables (remaining hits are unrelated —
`hover:bg-green-700` on buttons, `dark:border-stone-700` on cards).

### Gate 2 — Retired components + AgentFeedbackToggle documented — PASS (stable)

Unchanged in bolt 3. The gate's literal grep
(`SidebarSegmentedControl|\bMine\b|FeedbackFAB|MobileFeedbackSheet`)
returns exactly 4 hits against DESIGN-BRIEF.md, all inside the
"Retired Components (authoritative — do not resurrect)" subsection
(lines 587-599). Resolution policy from the unit body stands.
`AgentFeedbackToggle` remains documented as a first-class component.

### Gate 3 — Footer-button copy matrix — PASS (stable)

Unchanged in bolt 3. `grep -En '>(Reject|Close)<'` against
`stages/design/artifacts/*.html` still returns zero hits on live
buttons. The only substring hits are meta-documentation (this review
file restating the bolt-1 fix table, `aria-label="Close"` on popover
dismiss glyphs, `Verify & Close` compound verb, status labels,
aria-live announcements) — all audited as legitimate in the bolt-2
review and unchanged here.

### Gate 4 — Origin-icon emoji mapping identical across three specs — PASS (was partially failing via FB-45)

Bolt 2 approved gate 4 against the three SPEC surfaces only
(DESIGN-BRIEF §2, DESIGN-TOKENS §2.2, `aria-landmark-spec.md §6`).
FB-45 caught that the assessor's scope is broader — any rendered
artifact that carries origin emoji MUST use the canonical set.

Two artifacts were violating:

- `state-signaling-inventory.html` — DESIGN-BRIEF §2 line 276 cites
  this file as the canonical rendered matrix for state signaling
  across compact + expanded + light + dark. It rendered the retired
  set (🛡 shield / 🔀 shuffle / 👁 eye / ✨ sparkles) in 16 places.
- `feedback-card-states.html` — rendered 🛡 shield in 2 error-state
  card examples.

Bolt 3 (commit `e79e8250`) replaced every occurrence with the
canonical set:

- `🛡️ U+1F6E1` → `🔍 U+1F50D` (Review Agent)
- `🔀 U+1F500` → `🔗 U+1F517` (External PR/MR)
- `👁️ U+1F441` → `✎ U+270E` (Annotation)
- `✨ U+2728` → `🤖 U+1F916` (Agent)

Verification:

- `grep -rl '🛡\|🔀\|👁\|✨' stages/design/artifacts/*.html` →
  zero hits.
- The only remaining mentions of the retired codepoints across the
  stage are in `aria-landmark-spec.md §9` (HTML-entity-escaped on
  purpose so the audit grep stays clean when it scans its own spec),
  in DESIGN-TOKENS §2.2's "Banned (retired) emoji set" table, and in
  the feedback items that originally reported the drift — all
  meta-documentation, not live rendered UI.

The three SPEC surfaces still agree on the canonical six-row mapping
(unchanged from bolt 2). Gate 4 now verifies across spec + artifact
surfaces.

### Gate 5 — DESIGN-BRIEF §2 authoritative + component-inventory alias — PASS (stable)

Unchanged in bolt 3. DESIGN-BRIEF §2 "Retired Components" remains the
canonical list (3 retired names, live replacements, rationale).
`component-inventory.md` and `footer-button-copy-spec.md` carry
explicit alias notices ("DESIGN-BRIEF §2 wins").

## Scope of bolt-3 changes

Only two files modified across both commits:

- `stages/design/DESIGN-BRIEF.md` — 8 lines swept in §6 contrast
  table (commit `c0ae4379`).
- `stages/design/artifacts/state-signaling-inventory.html` — 32
  lines across 16 origin-icon spans (commit `e79e8250`).
- `stages/design/artifacts/feedback-card-states.html` — 4 lines
  across 2 error-card origin-icon spans (commit `e79e8250`).

No unit specs, no ARIA specs, no tokens file edits. Gates 2/3/5 are
mechanically guaranteed untouched.

## Lingering cross-gate note (unchanged from bolt 2, not blocking)

The literal tension between gate-2's retired-name grep and gate-5's
requirement that those names appear in the authoritative subsection
is still governed by the unit body's resolution policy. Already
flagged in bolt-1 + bolt-2 review — restated here only for
completeness. Feedback-assessor can decide whether to capture as a
followup; does not block advancement.

## Outcome

All 5 quality gates pass. FB-40 and FB-45 assessor-pending findings
closed. Ready to advance.
