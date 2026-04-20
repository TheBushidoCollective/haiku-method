---
title: >-
  Palette, radii, and sizing magic-number stage-wide normalization — every
  `max-w-[1400px]` becomes `max-w-page`, every `gray-*` becomes `stone-*`,
  every bare `rounded` gains an explicit shade, every raw-px sizing literal
  either references a DESIGN-TOKENS §1.6 sizing token or is tagged
  `demo-only` with rationale
type: design
closes:
  - FB-132
  - FB-133
  - FB-135
  - FB-144
depends_on:
  - unit-26-artifact-opacity-and-banned-pair-sweep
inputs:
  - stages/design/artifacts/
  - stages/design/knowledge/DESIGN-TOKENS.md
outputs:
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/feedback-card-states.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/focus-ring-spec.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/feedback-inline-desktop.html
  - stages/design/artifacts/feedback-inline-mobile.html
  - stages/design/artifacts/review-context-header.html
  - stages/design/artifacts/rollback-reason-banner.html
  - stages/design/artifacts/comments-list-with-agent-toggle.html
  - stages/design/artifacts/revisit-modal-spec.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/review-package-structure.html
  - stages/design/knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/unit-27-design-review.md
quality_gates:
  - name: no-max-w-1400px
    command: "! grep -rn 'max-w-\\[1400px\\]' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/"
  - name: no-gray-palette-in-html
    command: "! grep -rn 'gray-' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/ --include='*.html'"
  - name: no-bare-rounded-class
    command: "! grep -rEn 'class=\"[^\"]*\\brounded\\b[^-]' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/ --include='*.html'"
  - name: no-raw-px-sizing-untagged
    command: "! grep -rEn 'max-w-\\[[0-9]+px\\]|w-\\[[0-9]+px\\]|min-h-\\[[0-9]+px\\]|h-\\[[0-9]+px\\]|rounded-\\[[0-9]+px\\]' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/ --include='*.html' | grep -v 'demo-only'"
  - name: design-tokens-1-6-sizing-section-exists
    command: "grep -E '^(#{1,4} )?1\\.6 Sizing|^(#{1,4} )?§1\\.6 Sizing' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/knowledge/DESIGN-TOKENS.md"
  - name: popover-width-tokens-declared
    command: "python3 -c \"import sys; c = open('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/knowledge/DESIGN-TOKENS.md').read(); names=['--popover-width-sm','--popover-width-md','--popover-width-lg','--annotation-w-md','--textarea-minh-md']; missing=[n for n in names if n not in c]; sys.exit(1 if missing else 0)\""
  - name: page-wrappers-use-max-w-page
    command: "! grep -En 'max-w-\\[(960|1000|1400)px\\]' .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/ -r --include='*.html'"
---
# Palette, radii, and sizing magic-number normalization

## Scope

Four overlapping consistency defects describe the same root pattern: token
drift between the DESIGN-TOKENS spec and live artifact markup.

- **FB-132** — `assessor-summary-card.html` lines 15, 24 carry
  `max-w-[1400px]`. DESIGN-BRIEF §4 mandates `max-w-page` (backed by
  `--max-page-width`). FB-88 was marked closed by non-existent
  `unit-28-canonical-token-normalization-sweep`.
- **FB-133** — `stage-progress-strip.html` carries 13 `gray-*` class
  occurrences across lines 361–460. DESIGN-BRIEF Color Palette mandates
  the `stone-*` scale. FB-89 was marked closed by the same non-existent
  unit-28.
- **FB-135** — `feedback-card-states.html` has 10+ bare `rounded` class
  occurrences (status pills, footer buttons). DESIGN-TOKENS §1.5 enumerates
  valid radii: `rounded-xl/full/lg/md/sm`. Bare `rounded` (Tailwind's
  0.25rem default) is not in the inventory.
- **FB-144** — 30+ magic-number sizing literals (`max-w-[960px]`,
  `max-w-[1000px]`, `w-[140px]`, `w-[240px]`, `w-[300px]`, `w-[375px]`,
  `min-h-[32px]`, `min-h-[40px]`, `min-h-[48px]`, `h-[18px]`,
  `rounded-[28px]`, `max-w-[384px]`, `max-w-[220px]`) across 9+ artifacts
  bypass the DESIGN-TOKENS sizing inventory.

The common shape: a canonical token exists (or should exist), but the
artifact markup declares a literal value instead. Dev-stage implementation
will inherit every literal as a one-off value, multiplying the drift
surface.

## Approach

**Designer hat:**

1. **Palette & page-width & bare-rounded sweep** — mechanical substitution:
   - `max-w-[1400px]` → `max-w-page` (2 sites, assessor-summary-card.html).
   - `max-w-[960px]` / `max-w-[1000px]` → `max-w-page` (2 sites,
     agent-feedback-toggle-spec.html, focus-ring-spec.html).
   - `gray-N` → `stone-N` at the same shade (13 sites,
     stage-progress-strip.html).
   - `\brounded\b(?!-)` → correct token per DESIGN-TOKENS §1.5 (10+ sites,
     feedback-card-states.html):
     - Status pills in transition matrix → `rounded-full`.
     - Secondary buttons (Dismiss, Reopen) → `rounded-md`.
     - Primary buttons (Verify & Close) → `rounded-md`.
2. **DESIGN-TOKENS §1.6 Sizing** — add named tokens for the recurring
   magic-number widths / min-heights / radii:
   - `--popover-width-sm: 140px`, `--popover-width-md: 160px`,
     `--popover-width-lg: 220px` — for
     comment-to-feedback-flow.html popovers.
   - `--annotation-w-sm: 240px`, `--annotation-w-md: 300px` — for
     feedback-inline-desktop.html floating annotations.
   - `--textarea-minh-sm: 32px`, `--textarea-minh-md: 40px`,
     `--textarea-minh-lg: 48px` — for comment-to-feedback-flow.html /
     comments-list-with-agent-toggle.html textareas.
   - `--brand-diamond: 18px` — for review-context-header.html brand
     diamonds.
   - Phone-frame mockup in annotation-popover-states.html:424 —
     `w-[375px] h-[560px] rounded-[28px]`. Keep as a `demo-only` literal
     (real-device dimensions) with an inline comment; OR tokenize as
     `--phone-frame-w: 375px`, `--phone-frame-h: 560px`,
     `--phone-frame-r: 28px`. Choose `demo-only` comment — it's the only
     device-mockup artifact.
3. **Artifact rewrites** — every affected line references the token via
   Tailwind arbitrary value (`w-[var(--annotation-w-md)]`) OR the named
   utility in DESIGN-TOKENS §1.6.
4. **Design-reviewer gate pointers** — add the four verification greps to
   `design-reviewer.md` hat spec (or equivalent gate list) so they persist
   past this unit. (Unit-34 covers the automated-gate infrastructure;
   this unit just names the greps.)

**Design-reviewer hat:**

- Run every grep in `quality_gates`. Each must return the stated count.
- Confirm DESIGN-TOKENS §1.6 is authored with the naming convention from
  §1.1-§1.5 (`--<category>-<variant>`).
- Walk the affected artifacts to confirm the token references render the
  same visual size as the pre-rewrite literal (no visual regression).

**Feedback-assessor hat:**

- Re-run the live greps (not audit prose).
- Each of FB-132, FB-133, FB-135, FB-144 closure requires the specific
  grep it names returning the stated count.

## Completion criteria

- [ ] `max-w-[1400px]` grep → 0
- [ ] `gray-` grep on *.html → 0
- [ ] Bare-`rounded` grep → 0
- [ ] Raw-px sizing grep → 0 or tagged `demo-only`
- [ ] DESIGN-TOKENS §1.6 authored with the listed tokens
- [ ] Artifact rewrites reference the new tokens
- [ ] Four verification greps named in design-reviewer gate list
- [ ] FB-132, FB-133, FB-135, FB-144 all close on live-grep verification
