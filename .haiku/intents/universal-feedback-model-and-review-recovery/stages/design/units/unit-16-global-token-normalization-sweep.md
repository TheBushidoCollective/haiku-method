---
title: Global token normalization sweep across all design artifacts
type: design
closes:
  - FB-38
  - FB-39
  - FB-42
  - FB-44
  - FB-47
  - FB-48
  - FB-50
  - FB-52
  - FB-54
  - FB-55
  - FB-57
  - FB-58
  - FB-59
depends_on: []
inputs:
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
  - stages/design/artifacts/
outputs:
  - stages/design/artifacts/
  - stages/design/DESIGN-BRIEF.md
  - knowledge/DESIGN-TOKENS.md
quality_gates:
  - >-
    `grep -rn 'gray-' stages/design/artifacts/ | wc -l` returns 0. Every
    `bg-gray-*`, `text-gray-*`, `border-gray-*`, `divide-gray-*`,
    `hover:*-gray-*`, `dark:*-gray-*`, `focus:*-gray-*` replaced with the
    stone-* equivalent at the same shade number (gray-50→stone-50, gray-100
    →stone-100, …, gray-950→stone-950). DESIGN-TOKENS.md §1.1 reaffirms: SPA
    artifacts MUST use stone-*.
  - >-
    `grep -rEn '#[0-9a-fA-F]{3,8}\b' stages/design/artifacts/ | grep -v
    'svg\|aria-hidden' | wc -l` returns 0. Every raw hex value replaced with a
    Tailwind utility class or a documented CSS-variable token defined in
    DESIGN-TOKENS.md. Exceptions allowed only inside `<svg>` children (rarely
    needed because artifacts use currentColor) — must be enumerated in
    DESIGN-TOKENS.md §1.4 "exempt raw hex sites."
  - >-
    `grep -rEn 'text-\[(9|10)px\]' stages/design/artifacts/ | wc -l` returns 0.
    Every 9px/10px text replaced with `text-xs` (12px) or `text-[11px]
    font-semibold`. The audit in contrast-and-type-audit.md §3 re-run and
    updated to match reality.
  - >-
    `grep -rEn 'text-(stone|gray)-400' stages/design/artifacts/` — no matches
    for metadata text. Approved uses are limited to dark-mode inverse pairs only
    (explicitly `dark:text-stone-400` on `dark:bg-stone-800` or darker). All
    single-theme `text-gray-400` / `text-stone-400` on light backgrounds
    replaced with `text-stone-500` (≥ 4.5:1 on white/stone-50/stone-100).
  - >-
    Sidebar widths canonical: `w-80 xl:w-96`. `grep -rEn 'w-96\b|w-80\b'
    stages/design/artifacts/` — every match is either on the sidebar root
    container using the `w-80 xl:w-96` pair, or on a non-sidebar element.
    DESIGN-BRIEF §1 Layout Structure updated to call out the canonical pair.
  - >-
    `grep -rEn 'focus:ring-1\b' stages/design/artifacts/` returns 0. Every
    `focus:ring-1` replaced with `focus-visible:ring-2
    focus-visible:ring-teal-500 focus-visible:ring-offset-2
    dark:focus-visible:ring-offset-stone-900` (the canonical focus-ring spec
    from focus-ring-spec.html §1). DESIGN-BRIEF §2 Input/Textarea pattern
    updated to use the canonical pattern.
  - >-
    `grep -rn 'Re-open' stages/design/artifacts/ stages/design/DESIGN-BRIEF.md
    knowledge/DESIGN-TOKENS.md` returns 0. Every occurrence replaced with
    `Reopen` (one word, no hyphen) per unit-14 canonical copy.
  - >-
    Breakpoint threshold canonical: **1280px** (Tailwind `xl`) for the desktop
    cutover. `grep -rEn '1024|1280' stages/design/artifacts/
    stages/design/DESIGN-BRIEF.md knowledge/DESIGN-TOKENS.md` — every 1024
    reference rewritten to 1280 OR explicitly scoped to `lg` (the smaller
    intermediate breakpoint). DESIGN-BRIEF §1 Responsive section and
    DESIGN-TOKENS.md breakpoint table updated.
  - >-
    `max-w-[1400px]` tokenized. Added `max-w-page` or similar utility backed by
    a CSS variable (`--max-page-width: 1400px`) in DESIGN-TOKENS.md §1.3 and
    referenced in every artifact page wrapper. `grep -rn 'max-w-\[1400px\]'
    stages/design/artifacts/` returns 0.
  - "Emoji origin mapping uses ONLY the canonical codepoints documented in DESIGN-BRIEF §2 and aria-landmark-spec.md §6 — `\U0001F50D U+1F50D` (adversarial-review), `\U0001F517 U+1F517` (external-pr/external-mr), `✎ U+270E` (user-visual), `\U0001F4AC U+1F4AC` (user-chat), `\U0001F916 U+1F916` (agent). `grep -rnP '\U0001F6E1|\U0001F500|✨|&#x1F6E1|&#x1F500|&#x2728' stages/design/artifacts/ stages/design/DESIGN-BRIEF.md` returns 0."
  - >-
    Inactive tabs: every tab with `tabindex="-1"` uses `text-stone-500
    dark:text-stone-400` minimum (not 400-on-white). Arrow-key roving tabindex
    handler documented in aria-landmark-spec.md §4.3, with an inline sample JS
    snippet the dev stage can adopt verbatim.
  - >-
    Re-audit: contrast-and-type-audit.md §3 contains post-sweep grep numbers
    matching the gates above (all zero for banned patterns).
    state-signaling-inventory.html screenshots re-rendered (or HTML updated) to
    match the post-sweep state.
status: active
bolt: 1
hat: designer
started_at: '2026-04-20T01:54:01Z'
hat_started_at: '2026-04-20T01:54:01Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T01:54:01Z'
    completed_at: null
    result: null
---
# Global token normalization sweep

## Scope

Thirteen residual findings describe the same root failure: the bolt-2/bolt-3
sweeps from unit-10 / unit-11 / unit-13 / unit-14 touched some files but
missed others, so banned patterns remain spread across ~14 artifacts. A
targeted unit-by-unit sweep is the wrong shape — what's needed is a single
comprehensive pass over every artifact + DESIGN-BRIEF + DESIGN-TOKENS that
enforces the canonical token/name/pattern in every file.

**FB-to-fix mapping:**

- **FB-38** (gray-* sweep): 1,669 occurrences across 14 artifacts → 0
- **FB-39** (raw hex): 124 occurrences across 3+ artifacts → 0
- **FB-42 / FB-59** (text-[9px]/[10px]): widespread → 0
- **FB-44** (metadata contrast text-gray-400/stone-400 on white): widespread → stone-500+
- **FB-47** (sidebar widths diverge): → `w-80 xl:w-96`
- **FB-48 / FB-55** (focus:ring-1): → canonical focus-visible:ring-2 pair
- **FB-50** ("Re-open" drift): ~30 → `Reopen`
- **FB-52** (1024 vs 1280 drift): → 1280 canonical (Tailwind `xl`)
- **FB-54** (max-w-[1400px] magic number): → tokenized utility
- **FB-57** (emoji origin drift): 🛡/🔀/✨ → 🔍/🔗/🤖
- **FB-58** (inactive tabs text-gray-400 + tabindex=-1): → stone-500+ + documented arrow-key handler

## Approach

The designer hat will:

1. Run the exact grep commands from the quality gates across
   `stages/design/artifacts/` to generate a concrete hit list per pattern.
2. For each hit list, apply the codified replacement rule:
   - `gray-N` → `stone-N` (preserve shade number, preserve dark: prefix)
   - raw hex → Tailwind utility or documented CSS variable
   - `text-[10px]` / `text-[9px]` → `text-xs` (default) or `text-[11px]
     font-semibold` (compact badges only)
   - `text-gray-400` / `text-stone-400` on light → `text-stone-500`
   - sidebar root `w-{96,80}` alone → `w-80 xl:w-96`
   - `focus:ring-1` → `focus-visible:ring-2 focus-visible:ring-teal-500
     focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`
   - `Re-open` → `Reopen`
   - `1024px` / `lg:` at the desktop cutover → `1280px` / `xl:` (keeping
     `lg:` only where it's an intermediate step)
   - `max-w-[1400px]` → documented tokenized utility
   - 🛡/🔀/✨ → 🔍/🔗/🤖 (codepoints per DESIGN-BRIEF §2)
   - `tabindex="-1"` + `text-gray-400` → `tabindex="-1"` +
     `text-stone-500 dark:text-stone-400`
3. Re-write `contrast-and-type-audit.md` §3 with the measured post-sweep
   counts (all zero for banned patterns).
4. Update DESIGN-BRIEF §1 (layout / responsive) and §2 (typography floor,
   input/textarea focus ring) and DESIGN-TOKENS.md (max-w-page token,
   breakpoint table) to match.
5. Document the arrow-key roving-tabindex handler contract in
   aria-landmark-spec.md §4.3 for tab lists with `aria-orientation`.

The design-reviewer hat will re-run every grep command from the quality
gates and verify zero matches across the board, then spot-check 3-4
artifacts for focus-visible ring visibility and sidebar width correctness.

The feedback-assessor hat (auto-injected) will verify every FB item in
`closes:` is genuinely resolved by re-running the exact gate command each
item specified (most include the command in their body).

## Completion criteria

- [ ] All 12 quality_gates pass
- [ ] contrast-and-type-audit.md §3 post-sweep table reflects reality
- [ ] DESIGN-BRIEF §1, §2, §7 updated for canonical tokens/patterns
- [ ] DESIGN-TOKENS.md updated: breakpoint table (1280 canonical),
      max-w-page token, focus-visible canonical pattern
- [ ] aria-landmark-spec.md §4.3 documents roving-tabindex arrow-key
      handler with sample JS
- [ ] Every FB item listed in `closes:` verified as closed by the
      feedback-assessor against its original gate command
