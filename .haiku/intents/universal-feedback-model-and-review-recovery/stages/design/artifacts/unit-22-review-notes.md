# unit-22 design review — modal dialog semantics & inert contract

## Bolt 2 — APPROVE (design-reviewer)

**Scope of bolt 2:** feedback-assessor rejected bolt 1 with two specific
gaps — missing `### 3.7` subsection in `aria-landmark-spec.md` (citations
throughout the artifacts pointed at §3.7 but no such subsection existed)
and no visible head-of-document pointer in `feedback-inline-mobile.html`
(references were buried deep in the file). Bolt 2 closes both gaps.

### Bolt 2 contract verification (all pass)

| Contract | Expected | Actual |
|---|---|---|
| `^### 3\.7` in `aria-landmark-spec.md` | 1 | 1 (L78) |
| `aria-landmark-spec\.md §3\.7` in `feedback-inline-mobile.html` | ≥ 1 | 4 (head-of-doc + controller) |
| `a11y contract` marker in `feedback-inline-mobile.html` | 1 | 1 (L4) |
| `main\.inert|setAttribute\(.aria-hidden` in mobile html | ≥ 4 | 5 |
| `role="dialog" aria-modal="true" aria-labelledby=` in revisit-modal-states | 4 | 4 |
| `role="dialog" aria-modal="true" aria-labelledby=` in mobile html | ≥ 1 | 2 |

### §3.7 subsection review (aria-landmark-spec.md L78–151)

The authored `### 3.7 Inert + aria-hidden contract` subsection is
comprehensive and technically correct:

- **Why both attributes** — correctly explains browser/AT coverage:
  `inert` (Safari 15.5+ / Chrome 102+ / Firefox 112+) covers input + focus
  but has inconsistent AT behavior; `aria-hidden="true"` covers AT
  traversal but leaves focus + pointer live. Together they form a
  complete neutralization with fallback paths in both directions.
- **Which nodes receive the pair** — correctly scopes to background
  landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`) and explicitly
  excludes the dialog itself and live-region nodes
  (`#feedback-live-polite`, `#feedback-live-assertive`). The live-region
  exclusion is essential so the rollback toast in
  §Failure-on-confirm remains announceable.
- **Open/close DOM writes** — correct API usage: property assignment for
  `inert` (`element.inert = true/false`) per the spec note that
  `removeAttribute('inert')` is brittle when the attribute was never
  serialized; `setAttribute`/`removeAttribute` for `aria-hidden`.
- **State matrix** — 5 phases × 6 columns, correctly models that Closing
  keeps both attributes on until dialog unmount (prevents focus leaks
  during the close animation).
- **Anti-patterns** — 5 specific don'ts, each with a concrete reason:
  don't inert `<body>` (breaks live regions), don't `aria-hidden` the
  dialog (removes it from AT tree), don't `display: none` (scroll jump),
  don't CSS-only backdrop (doesn't block tab order), don't inert the
  dialog's parent while also running focus-trap (breaks focus-trap's own
  DOM queries).
- **Vanilla-to-React port** — correctly identifies that only the
  focus-trap layer swaps (vanilla → `focus-trap-react`); the inert +
  aria-hidden writes remain identical and live in a `useEffect`.
- **Verification greps** — lists the three canonical greps feedback-
  assessor runs; matches §9's existing checklist conventions.

### Head-of-document comment review (feedback-inline-mobile.html L2–37)

Placed immediately after `<!DOCTYPE html>` so dev-stage sees the
contract before parsing any markup. Enumerates §3, §3.7, §5 references
with one-line summaries of each, explains that the vanilla
`<script data-feedback-sheet-controller>` at the bottom of the document
implements §3.7 end-to-end, and flags the React swap target
(`<FocusTrap active returnFocusOnDeactivate>` from `focus-trap-react`).
The appended grep-contract block is a nice touch — dev-stage reviewers
can sanity-check the contract without leaving the file.

### Cross-references stay clean

- §3 item 7 now ends with `See **§3.7 (Inert + aria-hidden contract)**
  below for the exhaustive rules.` — the existing inline pointer is
  upgraded from narrative text to an explicit cross-reference.
- §9 verification checklist (L325–337) unchanged — the bolt-2 verification
  greps are authored *inside* §3.7 (L147–151), which is the right place
  since they're contract-specific; §9 stays as the page-level landmark
  audit.
- §4 Focus-trap contract (L153+) unchanged — the new §3.7 slots cleanly
  between §3.x and §4 with correct heading depth (`###` inside `## 3`).

### Design-system consistency (unchanged from bolt 1)

- No raw hex introduced in bolt 2 (spec is markdown prose; html additions
  are comments only).
- Accessibility: §3.7 tightens the contract — strictly additive.
- No scope violations: the two files modified are exactly the two files
  listed in the unit spec. `git diff --stat HEAD~1 HEAD` shows
  `aria-landmark-spec.md` and `feedback-inline-mobile.html` only.

### Verdict (bolt 2)

APPROVE. Bolt 2 closes both feedback-assessor gaps with scope-clean,
technically correct additions. The §3.7 subsection is now the canonical
inert + aria-hidden contract for every dialog artifact in this intent;
the head-of-document pointer ensures dev-stage inherits the contract
before porting JSX. FB-74 and FB-80 both remain closed with the bolt 2
additions reinforcing the implementation.

---

## Bolt 1 — APPROVE (design-reviewer) [preserved for audit trail]

Scope: verify FB-74 (revisit-modal-states dialog landmarks) and FB-80
(mobile sheet inert + aria-hidden wiring) are correctly implemented and
meet the aria-landmark-spec §3 and §5 contracts.

### Contract verification

All §9 grep contracts from `aria-landmark-spec.md` passed against the two
edited files:

| Contract | Expected | Actual |
|---|---|---|
| `role="dialog" aria-modal="true" aria-labelledby=` in `revisit-modal-states.html` | ≥ 4 (one per shell) | 4 (error L438, loading L531, empty L580, long L628) |
| `role="dialog" aria-modal="true" aria-labelledby=` in `feedback-inline-mobile.html` | ≥ 1 | 1 (L178–181 sheet root) |
| `main.inert` / `setAttribute('aria-hidden'` in mobile controller | ≥ 1 each | 4 matches (L387–394) |
| `aria-haspopup="dialog"` on FAB | 1 | L132 |
| `aria-controls="feedback-sheet"` on FAB | 1 | L134 |
| `focus-trap-react` reference (dev-stage handoff) | ≥ 1 | 4 matches (L171, L363, L417, plus prose) |

### FB-74 checks (revisit-modal-states.html)

- Every modal shell container renders
  `role="dialog" aria-modal="true" aria-labelledby="{id}"` —
  error / loading / empty / long-content all covered.
- Loading shell additionally carries `aria-busy="true"` on the dialog
  root per §3 optional attribute (correctly paired with suppressed
  Escape + backdrop per footer text).
- `aria-labelledby` targets match visible `<h3>` heading ids:
  `revisit-states-{error,loading,empty,long}-title`.
- `aria-describedby` targets match visible `<p>` ids:
  `revisit-states-{error,loading,empty,long}-desc`.
- §Modal lifecycle (L303–425) documents the inert + aria-hidden pairing
  on `<main>`, `<header>`, `<nav>` and cites `aria-landmark-spec.md §3.7`.
- New state-matrix table (L342–417) enumerates phase × DOM/attribute
  state across Idle, Opening, Open+interactive, Loading, Closing, Closed
  — matches §5.4 of the spec.
- The mid-commit rollback "Review UI (reverted)" panel stays as-is; it's
  intentionally not a dialog, illustrating the post-close review surface.
  Rollback toast carries `role="status" aria-live="polite"` per spec.
- ↩ glyph in each modal header is `aria-hidden="true"` so the accessible
  name is the heading text alone — correct per §6 emoji ARIA policy.

### FB-80 checks (feedback-inline-mobile.html)

- Inline `onclick="…"` handlers removed from FAB and close button.
- FAB uses `data-feedback-sheet-trigger` marker attribute; close button
  uses `data-feedback-sheet-close`.
- Sheet ships with the `hidden` attribute so initial render matches the
  closed state.
- `<script data-feedback-sheet-controller>` (L374–435) implements real
  behavior, not narrative:
  - `lockBackground()` — sets `main.inert = true` + `aria-hidden="true"`
    on `<main>` and `<header role="banner">`.
  - `unlockBackground()` — reverses both on close.
  - `openSheet()` — removes `[hidden]`, flips `aria-expanded="true"`,
    locks background, moves focus to `#sheet-first-tab`, installs
    Escape listener.
  - `closeSheet()` — adds `[hidden]`, flips `aria-expanded="false"`,
    unlocks background, removes Escape listener, returns focus to FAB.
  - Escape listener scoped to `document` while sheet is open.
- Dev-stage handoff note (L169–175, L362–364) tells React to replace the
  vanilla controller with `<FocusTrap active returnFocusOnDeactivate>`
  from `focus-trap-react` wrapping `<MobileFeedbackPanel>`; the inert +
  aria-hidden apparatus stays as wired.
- Theme-toggle `onclick` at L68 is intentionally preserved — it's out of
  unit-22 scope (FB-80 is specifically about the sheet open/close path).

### Design-system consistency

- Every color reference uses named Tailwind tokens (stone, amber, teal,
  red, sky, blue, green, rose, violet) — no raw hex values introduced.
- Focus rings use canonical teal-500 ring + offset per
  `focus-ring-spec.html §1`.
- Dark-mode variants present on every surface (`dark:` prefixes).
- 44×44 touch targets enforced on mobile interactive elements
  (`.touch-target` utility + explicit `min-h-[44px]` where needed).

### State coverage (design-reviewer RFC 2119 MUST checks)

- All interactive states covered: default, hover, focus, active,
  disabled, loading, error, empty, long-content — confirmed by the
  state-matrix summary table (L716–770).
- Error state: inline `role="alert"` banner + retry button.
- Loading state: dialog-root `aria-busy="true"` + disabled controls +
  suppressed Escape/backdrop.
- Empty state: "no active gate" chip + fallback-to-current-stage target.
- Long-content: scrolling body with pinned footer; list truncates to
  12 + "… N more" link.
- Reduced-motion: `@media (prefers-reduced-motion: reduce)` disables
  scale transform + spinner rotation + toast slide.

### Pre-existing items (out of unit-22 scope — not blocking)

- `feedback-inline-mobile.html` L326 contains an orphan
  `</div><!-- /tabpanel -->` with no matching opening tag. Predates this
  commit (verified via `git show f5bcd618~1`). Belongs to a future
  cleanup unit; not in FB-74 or FB-80 scope.

### Verdict (bolt 1)

APPROVE. Every completion-criteria item on the unit spec is satisfied;
every `aria-landmark-spec.md` §9 grep contract passes; dialog +
inert + aria-hidden contracts are correctly wired end-to-end for both
artifacts with a clear dev-stage handoff to `focus-trap-react`.
