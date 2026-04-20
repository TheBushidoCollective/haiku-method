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
depends_on: []
inputs:
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
  - stages/design/knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/unit-27-design-review.md
quality_gates:
  - >-
    Stage-wide `max-w-[1400px]` elimination: `grep -rn 'max-w-\[1400px\]'
    stages/design/artifacts/` → 0 hits. Both sites in
    `assessor-summary-card.html` (lines 15, 24) rewritten to `max-w-page`,
    matching the pattern already in `feedback-inline-desktop.html:105` and
    `rollback-reason-banner.html:20/29`.
  - >-
    Stage-wide `gray-*` palette elimination: `grep -rn 'gray-'
    stages/design/artifacts/*.html` → 0 hits on rendered markup (md files
    documenting the ban are excluded from the grep by the `.html` filter).
    All 13 `gray-*` tokens in `stage-progress-strip.html` (lines 361, 362,
    370, 372, 379, 391, 392, 399, 400, 451, 452, 459, 460) swept to
    `stone-*` at the same shade: `gray-900` → `stone-900`, `gray-800` →
    `stone-800`, `gray-700` → `stone-700`, `gray-500` → `stone-500`,
    `gray-400` → `stone-400`, `gray-300` → `stone-300`, `gray-200` →
    `stone-200`, `gray-100` → `stone-100`, `gray-50` → `stone-50`,
    `gray-950` → `stone-950`.
  - >-
    Stage-wide bare-`rounded` elimination: `grep -rEn 'class="[^"]*\brounded
    \b[^-]' stages/design/artifacts/*.html` → 0 hits. All 10+ sites in
    `feedback-card-states.html` resolved — status-pill spans in the
    transition matrix (lines 53, 58, 63, 68) use `rounded-full` per
    DESIGN-BRIEF §2 Badge pattern; secondary footer buttons (Dismiss at
    lines 95, 114; Reopen at 132, 151, 171) use `rounded-md`; primary
    footer button (Verify & Close) uses `rounded-md` matching the sister
    artifacts (feedback-inline-desktop/mobile).
  - >-
    Stage-wide raw-px sizing elimination: `grep -rEn 'max-w-\[[0-9]+px\]|w-
    \[[0-9]+px\]|min-h-\[[0-9]+px\]|h-\[[0-9]+px\]|rounded-\[[0-9]+px\]'
    stages/design/artifacts/*.html` returns either 0 hits OR every
    remaining match is on a line carrying an inline HTML comment containing
    the literal `demo-only` plus a short rationale (e.g., phone-frame
    mockup dimensions that intentionally visualize a real device size). No
    un-tagged raw-px sizing literal remains.
  - >-
    `DESIGN-TOKENS.md §1.6 Sizing` section lists the named sizing tokens
    referenced by the artifact rewrites. At minimum: `--popover-width-sm`
    (140px), `--popover-width-md` (160px), `--popover-width-lg` (220px),
    `--annotation-w-sm` (240px), `--annotation-w-md` (300px),
    `--textarea-minh-sm` (32px), `--textarea-minh-md` (40px),
    `--textarea-minh-lg` (48px), `--brand-diamond` (18px). If the
    `rounded-[28px]` literal in `annotation-popover-states.html:424` is
    kept as a phone-frame device radius, DESIGN-TOKENS.md §1.5 lists
    `rounded-phone` (or `rounded-3xl`) as an explicit inventory row. Token
    naming follows the `--<category>-<variant>` convention already in
    §1.1-§1.5.
  - >-
    Affected `.html` artifacts reference the new tokens (via Tailwind
    arbitrary value `w-[var(--popover-width-md)]` or a named utility in
    DESIGN-TOKENS §1.6 registry). No artifact declares a raw-px sizing
    value without a corresponding token or a `demo-only` comment.
  - >-
    Page wrappers in `agent-feedback-toggle-spec.html:37` and
    `focus-ring-spec.html:80` rewritten from `max-w-[960px]` /
    `max-w-[1000px]` to `max-w-page`.
  - >-
    The four grep gates above added to design-reviewer's gate list (as
    pointers in the hat instructions file or as inline comments in
    DESIGN-BRIEF §2 token-hygiene section) so they persist past this unit.
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
