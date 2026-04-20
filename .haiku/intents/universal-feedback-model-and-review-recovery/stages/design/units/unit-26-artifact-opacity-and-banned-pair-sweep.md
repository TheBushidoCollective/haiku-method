---
title: >-
  Artifact opacity-50/60 and banned-token-pair stage-wide rewrite — markup
  actually matches what contrast-and-type-audit claims for revisit-unit-list,
  revisit-modal-states, review-ui-mockup, agent-feedback-toggle-spec, and
  annotation-popover-states; disabled + aria-disabled contract enforced; stage-btn
  gets a focus-visible ring
type: design
closes:
  - FB-134
  - FB-139
  - FB-140
  - FB-141
  - FB-145
  - FB-146
  - FB-150
depends_on: []
inputs:
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/contrast-and-type-audit.md
outputs:
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/unit-26-design-review.md
quality_gates:
  - >-
    `grep -rEn 'opacity-50|opacity-60' stages/design/artifacts/*.html | grep
    -vE 'backdrop-blur|black/50|black/60|modal-overlay|demo-only'` returns 0
    hits on text-carrying card/button/label surfaces. Decorative-overlay
    opacity (backdrops, loading shrouds) and explicitly-tagged demo-only
    references are exempt; every other match must be resolved via canonical
    muted-surface token pairs from contrast-and-type-audit.md §4 Bolt-3/4.
  - >-
    `revisit-unit-list.html` — 9 locked-card roots (lines 247, 259, 271, 283,
    295, 307, 319, 345, 393) no longer carry `opacity-60 transition-opacity`;
    instead use `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-
    dashed border-stone-300 dark:border-stone-700 shadow-sm p-4`. Card titles
    lifted from `text-stone-700 dark:text-stone-400` to `text-stone-600
    dark:text-stone-300`. Read-only pill text lifted from `text-stone-500` to
    `text-stone-700 dark:text-stone-300`. Stylesheet `.locked-card:hover {
    opacity: 0.8 }` / `:focus-visible { opacity: 0.95 }` rules removed.
    Verification: `grep -cEn 'opacity-60'
    stages/design/artifacts/revisit-unit-list.html` → 0.
  - >-
    `revisit-modal-states.html` — 3 disabled buttons at lines 100, 155, 552
    rewritten from `bg-amber-600 text-white opacity-50 cursor-not-allowed` /
    `border border-stone-300 text-stone-700 opacity-50 cursor-not-allowed` to
    the canonical amber-disabled (`bg-amber-300 text-amber-900
    dark:bg-amber-900/40 dark:text-amber-200 cursor-not-allowed`) and
    secondary-disabled (`bg-stone-100 text-stone-600 border border-stone-400
    dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500
    cursor-not-allowed`) token pairs. Every native `disabled` on lines 100,
    155, 540-area, 552 paired with `aria-disabled="true"`. Reference prose
    on line 101 / 156 rewritten to cite canonical token pairs, not
    `disabled:opacity-50`. Verification: `grep -En 'opacity-50'
    stages/design/artifacts/revisit-modal-states.html | grep -v
    'backdrop-blur\|black/50'` → 0 hits.
  - >-
    `review-ui-mockup.html` — 3 `opacity-60` sites resolved: stage-button
    markup on lines 136, 153 drops `opacity-60 cursor-not-allowed` and pairs
    native `disabled` with `aria-disabled="true"`; label `<span>` lifted
    from `text-stone-500` to `text-stone-600 dark:text-stone-300`. Line 790
    render JS rewritten to emit status-aware muted backgrounds (`bg-green-
    50/60 dark:bg-green-950/25` for closed; `bg-stone-100 dark:bg-stone-
    800/50` for rejected) on the card wrapper rather than α-compositing the
    whole subtree. Every `.stage-btn` button gains a canonical focus-visible
    ring (`focus-visible:ring-2 focus-visible:ring-teal-500
    focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`)
    replacing the bare `focus:outline-none`. Line 856 dynamic button
    rewritten from `bg-stone-100 dark:bg-stone-800 text-stone-500
    dark:text-stone-500` to `bg-stone-100 dark:bg-stone-800 text-stone-600
    dark:text-stone-300 border border-stone-400 dark:border-stone-500
    cursor-not-allowed focus-visible:ring-2 focus-visible:ring-teal-500
    focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900
    outline-none` and pairs `disabled` with `aria-disabled="true"`. Lines
    844-852 dynamic branches switch from `focus:ring-2` to `focus-visible:`.
    Verification: `grep -En 'opacity-60'
    stages/design/artifacts/review-ui-mockup.html` → 0 hits; `grep -E
    'stage-btn[^"]*focus:outline-none'
    stages/design/artifacts/review-ui-mockup.html | grep -v focus-visible`
    → 0 hits; banned-pair grep `grep -En
    'bg-stone-100[^"]*text-stone-500|text-stone-500[^"]*bg-stone-100'
    stages/design/artifacts/review-ui-mockup.html` → 0 hits.
  - >-
    `agent-feedback-toggle-spec.html` — line 181 wrapper `<label>` drops
    `opacity-50`; disabled affordance communicated via `bg-stone-200
    dark:bg-stone-700` on the switch track, `border-stone-400
    dark:border-stone-500` for 3:1 non-text contrast, and full-opacity
    `text-stone-700 dark:text-stone-300` on the label text. Line 195
    reference caption rewritten to cite the canonical disabled token pair
    and color lifted from `text-stone-500 dark:text-stone-500` to
    `text-stone-600 dark:text-stone-300`. Verification: `grep -En
    'opacity-50' stages/design/artifacts/agent-feedback-toggle-spec.html |
    grep -v 'backdrop-blur\|black/50'` → 0 hits.
  - >-
    `annotation-popover-states.html` — line 394 State 4b "Create" button
    rewritten from `bg-teal-600 text-white opacity-50 cursor-not-allowed`
    to `<button type="button" disabled aria-disabled="true" class="px-2.5
    py-1 text-xs font-semibold rounded-md bg-stone-100 text-stone-600
    border border-stone-400 dark:bg-stone-800 dark:text-stone-300
    dark:border-stone-500 cursor-not-allowed">Create</button>`.
    Verification: `grep -En 'opacity-50'
    stages/design/artifacts/annotation-popover-states.html` → 0 hits.
  - >-
    Python3 aria-disabled walker (the script from contrast-and-type-audit.md
    §4 Bolt-4) returns 0 violations across the 5 affected files — every
    native `disabled` attribute is paired with `aria-disabled="true"`.
  - >-
    Stage-wide banned-pair grep `grep -rEn 'bg-stone-200[^"]*text-stone-
    500|text-stone-500[^"]*bg-stone-200' stages/design/artifacts/*.html` →
    0 hits on rendered markup (prose-documenting-the-ban lines in .md files
    and comment blocks are exempt; the grep is scoped to `.html`).
---
# Artifact opacity and banned-token-pair stage-wide rewrite

## Scope

Five artifacts ship disabled / locked / upcoming-state token patterns that the
`contrast-and-type-audit.md` document claims were fixed in bolts 3–4, but that
never landed in the rendered markup:

- **FB-134 / FB-140** — `revisit-unit-list.html` still ships 9 `.locked-card`
  roots and 2 state-coverage tiles with `opacity-60 transition-opacity`
  (lines 247, 259, 271, 283, 295, 307, 319, 345, 393). Titles at
  `text-stone-700 dark:text-stone-400` α-composited at 0.6 fall to ~3.9:1
  light / ~2.9:1 dark — WCAG 1.4.3 FAIL. Read-only pills use the banned
  `bg-stone-200 text-stone-500` pair (2.66:1).
- **FB-139** — `revisit-modal-states.html` 3 disabled buttons still ship
  `opacity-50` on lines 100 (amber confirm), 155 (secondary cancel), 552
  (second cancel). Four sites carry native `disabled` with no
  `aria-disabled="true"`.
- **FB-141 / FB-150** — `review-ui-mockup.html` stage-buttons on lines 136,
  153 still carry `opacity-60 cursor-not-allowed`, stage-btn class has no
  focus-visible ring (WCAG 2.4.7), line 790 render JS applies `opacity-60`
  to every closed/rejected feedback card, and line 856 dynamic button uses
  the banned `bg-stone-100 text-stone-500` pair (4.40:1 — fails AA body text).
- **FB-145** — `agent-feedback-toggle-spec.html` line 181 disabled `<label>`
  wrapper still carries `opacity-50`; caption at line 195 uses the banned
  `text-stone-500 dark:text-stone-500` pair and canonicalizes `opacity-50`
  as the standard in prose.
- **FB-146** — `annotation-popover-states.html` line 394 State 4b "Create"
  button still ships `bg-teal-600 text-white opacity-50 cursor-not-allowed`
  (~2.1:1 light — FAIL). Button has no `disabled` / `aria-disabled`
  attributes; keyboard users can tab to and activate it.

Every one of these was previously marked `closed_by: unit-26..unit-31` — units
that never landed on disk (FB-137). The audit prose recorded the fix; the
artifact markup did not.

## Approach

**Designer hat:**

1. For each affected file, apply the exact rewrites prescribed in
   `contrast-and-type-audit.md §4 Bolt-3/4` — treat that doc as the
   specification, and treat the current markup as the drift. Where the
   audit prescribes a token-pair substitution, apply it verbatim.
2. Every site where a native `disabled` attribute is present, pair it with
   `aria-disabled="true"`. No exceptions.
3. On `review-ui-mockup.html`, `.stage-btn` buttons get a canonical
   focus-visible ring matching the one already used in
   `stage-progress-strip.html` line 39.
4. Remove stylesheet `.locked-card:hover { opacity: 0.8 }` and
   `:focus-visible { opacity: 0.95 }` rules — the entire opacity-as-state
   pattern is banned.
5. Where the rendered markup diverges from a reference caption that
   documents the pattern (e.g. `agent-feedback-toggle-spec.html:195`), fix
   the caption to cite the canonical disabled token pair, not `opacity-50`.

**Design-reviewer hat:**

- Run the Python3 aria-disabled walker from `contrast-and-type-audit.md
  §4 Bolt-4` against each affected file. Must return 0 violations.
- Run every verification grep above. Must return 0 hits.
- Spot-check that removed opacity transitions were replaced with
  muted-surface token pairs, not deletion-without-substitution (the locked
  cards still need a visual "muted" treatment, just without α-composite).

**Feedback-assessor hat:**

- Independently re-run the audit script and greps without relying on the
  audit document's §6 PASS declarations (see unit-34 for why those were
  unreliable). Closure requires live-grep verification, not prose claims.

## Completion criteria

- [ ] All 7 FB items (FB-134, FB-139, FB-140, FB-141, FB-145, FB-146,
      FB-150) addressed in the rendered markup
- [ ] All verification greps in `quality_gates` return the stated counts
- [ ] Python3 aria-disabled walker returns 0 violations across the 5 files
- [ ] Every native `disabled` paired with `aria-disabled="true"`
- [ ] `.stage-btn` buttons have canonical focus-visible ring
- [ ] feedback-assessor runs live greps (not audit-prose check) before
      closure
