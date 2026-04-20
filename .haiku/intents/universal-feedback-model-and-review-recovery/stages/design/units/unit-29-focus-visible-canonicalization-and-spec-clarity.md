---
title: >-
  Focus-visible canonicalization stage-wide — rewrite `focus:ring-*` to
  `focus-visible:ring-*`, add focus-visible rings to `.stage-btn`, clarify
  focus-ring-spec code samples
type: design
closes:
  - FB-93
  - FB-107
  - FB-110
depends_on:
  - unit-26-artifact-opacity-ban-enforcement
inputs:
  - stages/design/artifacts/focus-ring-spec.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/annotation-gesture-spec.html
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/keyboard-shortcut-map.html
outputs:
  - stages/design/artifacts/focus-ring-spec.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/annotation-gesture-spec.html
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/keyboard-shortcut-map.html
  - stages/design/artifacts/unit-29-design-review.md
quality_gates:
  - >-
    Every `focus:ring-*` Tailwind class (the shorthand that paints a ring on
    mouse click too) rewritten to `focus-visible:ring-*` across all authored
    HTML artifacts. Targets called out in FB-93: `feedback-inline-mobile.html`
    lines 118–120 (tablist), `keyboard-shortcut-map.html:550` (checkbox),
    `feedback-inline-desktop.html:208, 229, 237, 479` (pin markers + feedback
    card listitem), `annotation-gesture-spec.html:226` (pin overlay),
    `review-ui-mockup.html:214, 277, 278, 971` (textarea, annotation inputs,
    Next-unseen button), `annotation-popover-states.html:191, 193, 244, 246,
    299` (5 popover inputs/textareas). Preserve ring width, color, and offset
    on every rewrite — the only change is the `focus:` → `focus-visible:`
    prefix. `focus:outline-none` stays (outline suppression is unconditional).
    (a) Stage-wide grep gate: `grep -rEn
    'focus:ring-(1|2|teal|amber|red|green|sky|blue)' stages/design/artifacts/`
    returns 0 hits. (b) `grep -rEn 'focus-visible:ring-' stages/design/artifacts/`
    returns ≥ 15 hits (one per rewritten target, plus the canonical patterns
    already in focus-ring-spec.html).
  - >-
    `assessor-summary-card.html` prose at lines 275 and 317 rewritten to
    document the canonical `focus-visible:` pattern (not the legacy `focus:`
    shorthand). The canonical class string shown is `focus:outline-none
    focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
    dark:focus-visible:ring-offset-stone-900`. `grep -nE 'focus:ring-'
    stages/design/artifacts/assessor-summary-card.html` returns 0 hits.
  - >-
    `review-ui-mockup.html` `.stage-btn` buttons at lines 66, 83, 100, 118, 136,
    153 gain a visible `:focus-visible` ring in a color distinct from the
    sky-400 selection color. Approach: extend the companion `<style>` block
    (currently defining `.stage-btn .stage-icon { outline: 0 solid transparent;
    ... }` + `.stage-btn.stage-active .stage-icon { outline: 3px solid rgb(56
    189 248); }`) to add: `.stage-btn:focus-visible .stage-icon { outline: 3px
    solid rgb(20 184 166); outline-offset: 3px; }` and the dark-mode
    counterpart `html.dark .stage-btn:focus-visible .stage-icon { outline-color:
    rgb(45 212 191); /* teal-400 */ }`. Teal (focus) is visually distinct from
    sky (selection) so keyboard users can tell "I've focused this" apart from
    "this is the selected stage." `focus:outline-none` remains on each button
    (suppresses default outline); the new `:focus-visible` rule provides the
    replacement. (a) `grep -n ':focus-visible' stages/design/artifacts/review-ui-mockup.html`
    returns ≥ 2 hits (the new rule + dark counterpart). (b) Structural grep
    confirms the teal focus color is distinct from the sky selection color
    (closes FB-113): `grep -A1 'stage-btn:focus-visible'
    stages/design/artifacts/review-ui-mockup.html | grep -cE 'rgb\(20 184
    166\)|teal-500|teal-400'` returns ≥ 1, AND `grep -A1
    'stage-btn.stage-active'
    stages/design/artifacts/review-ui-mockup.html | grep -cE 'rgb\(56 189
    248\)|sky-400|sky-300'` returns ≥ 1 — the two outlines use different
    color families, making focus visually distinguishable from selection.
    Token cross-ref (closes FB-130): the teal focus color is documented as
    the canonical focus-ring token per `focus-ring-spec.html §1` and
    `DESIGN-TOKENS.md §N.focus-ring` (teal-500 in light, teal-400 in dark).
    The style block carries an inline comment: `/* focus-ring canonical per
    focus-ring-spec.html §1 + DESIGN-TOKENS.md §N; teal-500 is distinct from
    the sky-400 selection color by design */`. `grep -nE 'focus-ring
    canonical per focus-ring-spec'
    stages/design/artifacts/review-ui-mockup.html` returns ≥ 1.
  - >-
    `focus-ring-spec.html:108` code sample rewritten for unambiguity. The
    single `<code>` block is split into two labeled sections: (1) "Canonical
    focus ring — use on every interactive element:
    `focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2
    dark:focus-visible:ring-offset-stone-900`"; (2) "Outline suppression —
    pair with the ring above, not standalone: `focus:outline-none`". A new
    "What NOT to do" block is added: "DON'T: `focus:outline-none` (standalone
    — no replacement ring, WCAG 2.4.7 FAIL). DO: `focus:outline-none
    focus-visible:ring-2 focus-visible:ring-teal-500 ...`". The code-sample
    class changes from `text-[11px]` to `text-xs` so it no longer violates
    the §3 type-scale floor (this closes the overlap with FB-105). (a) `grep
    -nE 'focus:outline-none' stages/design/artifacts/focus-ring-spec.html`
    returns ≥ 2 hits — one in the "outline suppression" standalone label, one
    in the combined "DO" example. (b) `grep -n 'text-\[11px\]'
    stages/design/artifacts/focus-ring-spec.html` returns 0 hits on the §1
    canonical code sample at line 108.
  - >-
    feedback-assessor re-runs each of FB-93, FB-107, FB-110, FB-113, FB-130
    against its literal grep recipe and confirms each passes (0 hits for
    negative greps; ≥ 1 for positive greps).
status: pending
---
# Focus-visible canonicalization + spec clarity

## Scope

`DESIGN-BRIEF §2` and `focus-ring-spec.html §1` declare
`focus-visible:ring-*` as the canonical focus indicator stage-wide
— "no ring on mouse click." Three defects keep landing the banned
`focus:ring-*` shorthand downstream:

- **FB-93** · `focus:ring-*` (no `-visible`) still in ~10 artifacts
  on inputs, tablists, pin markers, textareas, popover inputs. Every
  occurrence paints a mouse-click ring too, which is the exact
  regression unit-16 retired.
- **FB-107** · `review-ui-mockup.html` `.stage-btn` (6 buttons) use
  `focus:outline-none` with NO replacement `:focus-visible` ring.
  Keyboard focus is invisible — a direct WCAG 2.4.7 failure.
- **FB-110** · `focus-ring-spec.html:108` canonical code sample
  ends with `focus:outline-none` with no surrounding context. The
  spec has already been misread — FB-107 is the downstream
  consequence.

## Approach

Designer hat:

1. **Stage-wide sweep (FB-93)** — class-by-class rewrite of every
   `focus:ring-*` to `focus-visible:ring-*`. Preserve width, color,
   offset. Leave `focus:outline-none` alone — it's an unconditional
   outline suppression and pairs correctly with the replacement
   ring.
2. **`.stage-btn` focus-visible ring (FB-107)** — extend the
   `<style>` block in `review-ui-mockup.html` with a
   `.stage-btn:focus-visible .stage-icon` rule in teal (distinct
   from the sky-400 selection color). Add the dark-mode
   counterpart.
3. **`focus-ring-spec.html` clarity (FB-110)** — split the
   `:108` code sample into labeled "canonical ring" + "outline
   suppression" sections; add a "DO / DON'T" contrast block. Lift
   the sample class from `text-[11px]` to `text-xs` (closes the
   FB-105 overlap for this one specific line).

Design-reviewer hat:

1. Manually walk each rewritten `focus-visible:ring-*` class to
   confirm no mixed `focus:` / `focus-visible:` combos remain on
   the same element.
2. Tab through the six `.stage-btn` buttons in the rendered
   `review-ui-mockup.html` and confirm the teal ring paints on
   keyboard focus but not on mouse click.
3. Read the rewritten `focus-ring-spec.html §1` as if seeing it for
   the first time — confirm the canonical pattern is now
   unmistakable.

Feedback-assessor hat:

1. Run each feedback body's literal grep recipe.
2. Confirm FB-93, FB-107, FB-110 all close.

## Out of scope

- `text-[11px]` without semibold elsewhere (outside the `focus-ring-spec.html:108`
  overlap) — handled by **unit-31**.
- Opacity-ban artifact remediation — **unit-26**.
- Canonical-pair token sweep — **unit-28**.

## Completion criteria

- [ ] Every `focus:ring-*` occurrence in `stages/design/artifacts/` rewritten to `focus-visible:ring-*`
- [ ] `.stage-btn:focus-visible` rule added to `review-ui-mockup.html` in teal
- [ ] `focus-ring-spec.html §1` code sample clarified with labeled sections + DO/DON'T block
- [ ] `focus-ring-spec.html` §1 code sample class lifted from `text-[11px]` to `text-xs`
- [ ] `assessor-summary-card.html` prose at 275, 317 documents canonical `focus-visible:` (not legacy `focus:`)
- [ ] Feedback-assessor confirms FB-93, FB-107, FB-110
