# Design Review — unit-17-design-brief-tokens-alignment (bolt 1)

**Reviewer:** design-reviewer
**Outcome:** reject (one blocking gate fails)
**Date:** 2026-04-19

## Gate-by-gate

### Gate 1 — FeedbackStatusBadge text-shade consistency — PASS

DESIGN-BRIEF §2 `FeedbackStatusBadge` table (lines 169-172) and DESIGN-TOKENS
§2.1 `feedback-status-*` table (lines 236-239) now agree on
`text-{amber,blue,green}-800` light and `text-{amber,blue,green,stone}-{300,300,300,400}`
dark. Contrast assertions match in both files (amber 5.9:1, blue 7.2:1,
green 5.8:1, stone 4.6:1 light; dark pairs ≥ 4.9:1). Both files restate
the same palette in identical TS map literals (`feedbackStatusColors`
and `feedbackColors`).

### Gate 2 — Retired components + AgentFeedbackToggle documented — PASS

The literal `grep -nE 'SidebarSegmentedControl|\bMine\b|FeedbackFAB(?!-pulse|\.)|MobileFeedbackSheet' DESIGN-BRIEF.md`
returns 4 hits, but all four are inside the authoritative "Retired
Components (authoritative — do not resurrect)" subsection at the end of
§2 (lines 587-599), which gate-5 explicitly requires. The unit body's
resolution policy (line 83-84 of the unit spec) directs the designer to
"add 'Retired components' subsection to DESIGN-BRIEF §2 explaining what
each was and why it was retired," which is what shipped. The gate's
literal grep is in internal tension with gate-5; the spec body is the
authoritative tiebreaker. The positive assertion — `AgentFeedbackToggle`
documented as a first-class component — is satisfied by DESIGN-BRIEF §2
lines 335-388 (props, visual spec, state table, behavior, ARIA contract,
rationale).

### Gate 3 — Footer-button copy matrix — BLOCKING FAIL

DESIGN-BRIEF §2 (lines 534-585) now carries the full canonical matrix
(Dismiss / Verify & Close / Reopen) and `footer-button-copy-spec.md` is
flipped to an alias. That half of the gate passes.

The second half fails: "`Reject`, `Close` (standalone, distinct from
'Verify & Close') MUST NOT appear as footer button labels in any
artifact or DESIGN-BRIEF." Live banned-verb buttons exist in three
artifacts:

| Artifact | Line | Element |
|---|---|---|
| `stages/design/artifacts/comment-to-feedback-flow.html` | 632 | `<button ...>Close</button>` |
| `stages/design/artifacts/comment-to-feedback-flow.html` | 658 | `<button ...>Reject</button>` |
| `stages/design/artifacts/comment-to-feedback-flow.html` | 660 | `<button ...>Close</button>` |
| `stages/design/artifacts/comment-to-feedback-flow.html` | 955 | `<button ...>Reject</button>` |
| `stages/design/artifacts/comment-to-feedback-flow.html` | 956 | `<button ...>Close</button>` |
| `stages/design/artifacts/comment-to-feedback-flow.html` | 1023 | `<span ...>Close</span>` (footer-action diagram) |
| `stages/design/artifacts/comment-to-feedback-flow.html` | 1031 | `<span ...>Reject</span>` (footer-action diagram) |
| `stages/design/artifacts/comment-to-feedback-flow.html` | 1085 | `<td>Close</td>` (action rules table) |
| `stages/design/artifacts/comment-to-feedback-flow.html` | 1092 | `<td>Reject</td>` (action rules table) |
| `stages/design/artifacts/feedback-inline-desktop.html` | 295 | `<button ...>Reject</button>` (pending agent item footer) |
| `stages/design/artifacts/feedback-inline-desktop.html` | 296 | `<button ...>Close</button>` (pending agent item footer) |
| `stages/design/artifacts/feedback-inline-mobile.html` | 250 | `<button ...>Reject</button>` (pending agent item footer) |
| `stages/design/artifacts/feedback-inline-mobile.html` | 251 | `<button ...>Close</button>` (pending agent item footer) |
| `stages/design/artifacts/feedback-inline-mobile.html` | 235 | HTML comment narrating "agent — shows Reject button" |

Required fix: every `Reject` footer-button label → **Dismiss**. Every
`Close` footer-button label on a `pending` item → **Dismiss** (per
DESIGN-BRIEF §2, pending items have a single `Dismiss` verb — there is
no separate Close action on pending). The narration comment at mobile
line 235 needs to say "Dismiss button" instead of "Reject button".

The rules-table rows at `comment-to-feedback-flow.html` lines 1085 and
1092 also need review: if the column reads "action name," it should use
the canonical verbs; if it reads "status transition," the cells should
read `rejected` and `closed` lowercase to distinguish from verbs.

### Gate 4 — Origin-icon emoji mapping identical across three specs — PASS

- DESIGN-BRIEF §2 lines 210-215
- DESIGN-TOKENS §2.2 lines 286-291
- aria-landmark-spec.md §6 lines 107-112

All three cite the same codepoints in the same order: adversarial-review
`U+1F50D` 🔍, external-pr `U+1F517` 🔗, external-mr `U+1F517` 🔗,
user-visual `U+270E` ✎, user-chat `U+1F4AC` 💬, agent `U+1F916` 🤖.
DESIGN-TOKENS §2.2 additionally lists the retired emoji set
(`U+1F6E1` shield, `U+1F500` shuffle, `U+1F441` eye, `U+2728` sparkles)
with rationale — good preventive documentation.

### Gate 5 — DESIGN-BRIEF §2 authoritative + component-inventory alias — PASS

DESIGN-BRIEF §2 "Retired Components (authoritative — do not resurrect)"
subsection (lines 587-599) lists the three retired names, their live
replacements, and one-line rationale per row. `component-inventory.md`
lines 26-36 now carry thin "spec location → DESIGN-BRIEF §2" pointers
instead of duplicating specs, and lines 53-57 defer retired-components
to DESIGN-BRIEF §2. `footer-button-copy-spec.md` lines 5-6 carry an
explicit "alias notice" declaring DESIGN-BRIEF §2 the single source of
truth.

## Secondary findings (non-blocking)

- `feedback-inline-mobile.html` line 292 has a dangling
  `<div id="sheet-mine-panel" role="tabpanel" aria-labelledby="sheet-mine-tab" hidden></div>`
  pointing at a non-existent `sheet-mine-tab`. The `Mine` tab button
  itself appears to have been removed, but this hidden tabpanel is dead
  markup referencing the retired identity split. Recommend removing it
  in the same fix pass.

- Gate 2 and gate 5 have a literal tension: gate 2 wants `grep` to
  return 0 on the four retired names, but gate 5 requires those exact
  names to appear in a "Retired components" subsection. The designer
  resolved per the unit-body policy (which is correct), but future unit
  specs should either (a) scope the grep with a negative-lookahead past
  the retired-components header, or (b) only grep the "live" portion of
  the file. Flagged for the feedback-assessor or a followup unit — not a
  reason to hold this bolt.

## Required before advance

Fix the 13 banned-verb sites listed under Gate 3 in
`comment-to-feedback-flow.html`, `feedback-inline-desktop.html`, and
`feedback-inline-mobile.html`. Canonical replacement per DESIGN-BRIEF
§2 footer-button matrix: **Dismiss** for both banned verbs when they
appear on pending items. Re-run the grep (`grep -EnW '>(Reject|Close)<'
stages/design/artifacts/*.html`) and confirm zero footer-button hits.
