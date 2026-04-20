# Design Review — unit-17-design-brief-tokens-alignment (bolt 2)

**Reviewer:** design-reviewer
**Outcome:** advance (all 5 gates pass)
**Date:** 2026-04-19

Bolt 2 closes the single blocking finding from bolt 1 (gate 3 — banned
footer-button verbs). No other gates regressed; DESIGN-BRIEF.md,
DESIGN-TOKENS.md, aria-landmark-spec.md, component-inventory.md, and
footer-button-copy-spec.md were unchanged in bolt 2, so gates 1/2/4/5
remain passing from the bolt-1 review. The secondary finding (dangling
`sheet-mine-panel` tabpanel) was also resolved.

## Gate-by-gate

### Gate 1 — FeedbackStatusBadge text-shade consistency — PASS (stable)

DESIGN-BRIEF §2 `FeedbackStatusBadge` table (lines 169-172) and
DESIGN-TOKENS §2.1 `feedback-status-*` table (lines 236-239) agree:

| Status | Light | Dark |
|---|---|---|
| pending | `bg-amber-100 text-amber-800` | `bg-amber-900/30 text-amber-300` |
| addressed | `bg-blue-100 text-blue-800` | `bg-blue-900/30 text-blue-300` |
| closed | `bg-green-100 text-green-800` | `bg-green-900/30 text-green-300` |
| rejected | `bg-stone-100 text-stone-500` | `bg-stone-800 text-stone-400` |

Both files carry matching TS map literals (`feedbackStatusColors` in
DESIGN-TOKENS, `feedbackColors` in DESIGN-BRIEF). No bolt-2 edits
touched either file.

### Gate 2 — Retired components + AgentFeedbackToggle documented — PASS (stable)

The BSD-`grep`-compatible version of the gate's literal grep
(`grep -nE 'SidebarSegmentedControl|\bMine\b|FeedbackFAB|MobileFeedbackSheet'`
against DESIGN-BRIEF.md) returns 4 hits, all inside the authoritative
"Retired Components (authoritative — do not resurrect)" subsection
required by gate 5 (lines 593-597). The unit-body resolution policy
(lines 126-127) is the explicit tiebreaker: "add 'Retired components'
subsection to DESIGN-BRIEF §2 explaining what each was and why it was
retired." Reasoning from bolt-1 review stands.

`AgentFeedbackToggle` remains documented in DESIGN-BRIEF §2 as a
first-class component.

### Gate 3 — Footer-button copy matrix — PASS (was blocking fail)

`grep -En '>(Reject|Close)<'` against
`stages/design/artifacts/*.html` now returns **zero hits**. Every site
flagged in the bolt-1 review is fixed with canonical verbs from the
DESIGN-BRIEF §2 footer-button matrix:

| Artifact | Bolt-1 site(s) | Bolt-2 replacement |
|---|---|---|
| `comment-to-feedback-flow.html` | L632 user pending `<button>Close</button>` | `Dismiss` (secondary-muted) |
| `comment-to-feedback-flow.html` | L658-660 agent pending `Reject`+`Close` buttons | single `Dismiss` button |
| `comment-to-feedback-flow.html` | L955-956 mobile mini preview `Reject`+`Close` | single `Dismiss` button |
| `comment-to-feedback-flow.html` | L1023, L1031 state-machine `<span>Close</span>`, `<span>Reject</span>` | illegitimate `Close →` arrow removed (no user-initiable pending → closed); `Reject →` → `Dismiss →`; addressed → closed arrow added with `Verify & Close` |
| `comment-to-feedback-flow.html` | L1085, L1092 action rules table `Close`, `Reject` cells | transition table drops the illegitimate `pending → closed` row; `pending → rejected` uses `Dismiss` with guard "Any pending item the user can see (any origin)"; adds `addressed → closed` row with `Verify & Close`; agent-addresses row marked italic with "no user-facing button" guard |
| `feedback-inline-desktop.html` | L295-296 adversarial-review pending `Reject`+`Close` | single `Dismiss` button with inline-comment rationale |
| `feedback-inline-mobile.html` | L235 narration comment "Reject button" | "Dismiss button" (and in-flight aria-live text "marking as closed..." → "marking as rejected..." to match the Dismiss → rejected destination) |
| `feedback-inline-mobile.html` | L250-251 agent pending `Reject`+`Close` | single `Dismiss` button |

**Remaining `Close` / `Reject` substring hits** (audited, all legitimate):

- `annotation-popover-states.html`, `keyboard-shortcut-map.html`,
  `revisit-modal-spec.html` — `aria-label="Close"` on popover/modal
  dismiss-X glyph buttons. Scope of gate 3 is **feedback-item footer
  buttons**; dismiss-X glyphs on modals/popovers are not the regulated
  surface.
- `feedback-card-states.html`, `review-ui-mockup.html`,
  `feedback-lifecycle-transitions.html` — all `Verify & Close` (the
  canonical approved compound verb, explicitly distinguished from
  banned standalone `Close` by the gate wording).
- `feedback-inline-desktop.html` L295, `feedback-inline-mobile.html`
  L235, L250 — HTML comments explicitly narrating *why* the banned
  verbs were removed. Meta-documentation, not live UI.
- `comment-to-feedback-flow.html` L1086 — HTML comment documenting the
  canonical matrix. Not a button.
- Status-state labels (`aria-label="Status: closed"`, `"Closed ·"`
  status headings, `rejected` badge text) across multiple artifacts —
  these are status-values, not button labels. The gate wording bans
  `Reject` and `Close` *as footer-button labels*, not as
  status-state names.
- aria-live sequencing messages (`"marking as closed…"` etc.) —
  transition announcements, not button labels. These describe the
  destination status of the `Verify & Close` transition.

### Gate 4 — Origin-icon emoji mapping identical across three specs — PASS (stable)

Unchanged in bolt 2. The three spec surfaces continue to cite the same
codepoints in the same order:

| Origin | Codepoint | Glyph |
|---|---|---|
| adversarial-review | `U+1F50D` | 🔍 |
| external-pr | `U+1F517` | 🔗 |
| external-mr | `U+1F517` | 🔗 |
| user-visual | `U+270E` | ✎ |
| user-chat | `U+1F4AC` | 💬 |
| agent | `U+1F916` | 🤖 |

DESIGN-BRIEF §2, DESIGN-TOKENS §2.2, `aria-landmark-spec.md` §6 —
identical.

### Gate 5 — DESIGN-BRIEF §2 authoritative + component-inventory alias — PASS (stable)

Unchanged in bolt 2. DESIGN-BRIEF §2 "Retired Components" subsection
remains the canonical list (3 retired names + live replacements +
rationale). `component-inventory.md` defers to DESIGN-BRIEF §2 via
thin "spec location" pointers. `footer-button-copy-spec.md` carries
the explicit alias notice.

## Secondary finding resolution

The bolt-1 review flagged a dangling
`<div id="sheet-mine-panel" role="tabpanel" aria-labelledby="sheet-mine-tab" hidden></div>`
in `feedback-inline-mobile.html` as dead markup referencing the retired
identity-segmented control. Bolt 2 removed it cleanly and replaced it
with an inline comment pointing at DESIGN-BRIEF §2 "Retired Components."
Nice hygiene call — gates didn't require this but it's the right fix.

`grep -n 'sheet-mine-panel\|sheet-mine-tab' feedback-inline-mobile.html`
now returns zero hits.

## Lingering cross-gate note (flagged for feedback-assessor, not blocking)

The gate-2 literal grep and gate-5 authoritative-subsection requirement
remain in literal tension (gate-2 wants 0 hits on the four retired
names, gate-5 requires those exact names in a subsection). The unit
body's resolution policy is the tiebreaker, but future unit specs
should either scope gate-2's grep past the retired-components header
(e.g. stop at `^## Retired Components`) or grep only the "live" portion
of the file. Already flagged in bolt-1 review — restated here as a
known drift for the feedback-assessor hat to decide whether to capture
as a followup feedback item.

## Outcome

All 5 quality gates pass. Ready to advance.
