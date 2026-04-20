---
title: >-
  Stage-wide contrast/opacity sweep — widen audit beyond the 7 input artifacts;
  fix annotation-popover disabled button, popover-close glyph, agent-toggle body
  copy
type: design
closes:
  - FB-71
  - FB-72
  - FB-77
depends_on: []
inputs:
  - stages/design/DESIGN-TOKENS.md
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/keyboard-shortcut-map.html
outputs:
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/keyboard-shortcut-map.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/revisit-unit-list.html
quality_gates:
  - >-
    `annotation-popover-states.html:394` no longer carries `opacity-50` on the
    disabled "Create" button. The button uses the DESIGN-TOKENS §4 disabled pair
    (e.g. `disabled:bg-teal-200 disabled:text-teal-800` or equivalent per the
    token table) rather than an opacity composite; it also carries the native
    `disabled` attribute AND `aria-disabled="true"`; and its label is promoted
    from `text-[10px]` to at least `text-xs`. `grep -cE 'opacity-50'
    stages/design/artifacts/annotation-popover-states.html` returns 0. `grep -nE
    'disabled>.*Create|aria-disabled="true".*Create'
    stages/design/artifacts/annotation-popover-states.html` returns a match on
    the Create button.
  - >-
    `annotation-popover-states.html:381` popover-close ✕ no longer uses
    `text-stone-400` in its default (non-hover) state. Replacement pattern:
    `text-stone-600 hover:text-stone-800 dark:text-stone-300
    dark:hover:text-stone-100` (≥ 7:1 against white light / ≥ 12:1 against
    stone-900 dark, both AAA). The close affordance carries an explicit 44×44
    hit area (via `p-2` padding on a ≥ 28×28 glyph or a `::before` hit-area
    spacer matching the pin pattern used elsewhere). `grep -nE
    'class="[^"]*text-stone-400[^"]*"[^>]*>&times;'
    stages/design/artifacts/annotation-popover-states.html` returns 0 hits.
  - >-
    `agent-feedback-toggle-spec.html` no longer ships `text-[10px]` or the
    `text-gray-400 on white` / `text-stone-400 on white` combinations unit-11 §1
    bans. Every variant label (Default / Checked / Focus / Error) promoted to
    `text-xs` (12px) or `text-[11px] font-semibold` (the unit-11 §3 exception),
    and every body-copy color updated to `text-gray-600 dark:text-gray-400` (≥
    7:1 / ≥ 6.9:1, AAA both modes). Same ban applies to
    `keyboard-shortcut-map.html` (e.g. `L553` req-mod-help copy). `grep -cE
    'text-\[10px\]' stages/design/artifacts/agent-feedback-toggle-spec.html
    stages/design/artifacts/keyboard-shortcut-map.html` returns 0.
  - >-
    `contrast-and-type-audit.md` is re-run against EVERY file under
    `stages/design/artifacts/*.html` (not just the original 7 inputs). The
    audit's §2 summary table lists the actual post-fix count per artifact,
    including `annotation-popover-states.html`,
    `agent-feedback-toggle-spec.html`, `keyboard-shortcut-map.html`, and every
    other `.html` artifact that declares interactive content. Every row reads
    `opacity-50/70: 0` and `text-[10px]: 0` against the actual files (not
    against a scoped subset).
  - >-
    `contrast-and-type-audit.md §2` carries a new sentence (or callout) making
    the audit's scope explicit: `*Audit scope: every
    stages/design/artifacts/*.html file, not only the unit frontmatter `inputs:`
    list.*` This prevents future contrast/opacity audits from silently skipping
    artifacts introduced after unit-11 ran. The unit-17 / unit-18 verification
    greps are updated to cover the widened scope as well (comment near the grep
    loop in each unit's post-sweep note).
status: active
bolt: 1
hat: design-reviewer
started_at: '2026-04-20T05:08:18Z'
hat_started_at: '2026-04-20T05:18:30Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T05:08:18Z'
    completed_at: '2026-04-20T05:18:30Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T05:18:30Z'
    completed_at: null
    result: null
---
# Stage-wide contrast/opacity sweep — widen audit beyond the 7 inputs

## Scope

Three findings that all share one root cause: unit-11's contrast/opacity
audit only ran grep against the 7 artifact files listed in its
frontmatter `inputs:`. Files introduced later in the iteration
(`annotation-popover-states.html`, `agent-feedback-toggle-spec.html`,
`keyboard-shortcut-map.html`) were never in the loop, so they still
ship the exact patterns unit-11 declared banned:

- **FB-71**: `annotation-popover-states.html:394` disabled "Create"
  button ships `text-white opacity-50` — ~2.6:1 composite contrast,
  `text-[10px]` label, no native `disabled`, no `aria-disabled`. A
  stacked unit-11 §1/§3 + native-semantics failure.
- **FB-72**: `annotation-popover-states.html:381` popover-close ✕
  uses `text-stone-400` on white — 2.52:1, fails WCAG 1.4.11 non-text
  contrast. Direct violation of the ban unit-11 added to
  `DESIGN-TOKENS.md §1.1a`.
- **FB-77**: `agent-feedback-toggle-spec.html` (and
  `keyboard-shortcut-map.html:553`) use `text-[10px] + text-gray-400`
  on white — 2.84:1 body copy. Multiple variant labels hit this.

Stage-wide dev hand-off means every artifact is an implementation
reference. Banning a pattern in 7 of N files is not banning it at all.

## Approach

Designer hat:

1. **FB-71 fix**: edit `annotation-popover-states.html:394`. Replace
   `opacity-50 cursor-not-allowed` on the Create button with the
   DESIGN-TOKENS §4 disabled pair. Add the native `disabled` attribute
   and `aria-disabled="true"`. Promote the `text-[10px]` label to
   `text-xs` (or `text-[11px] font-semibold` per unit-11 §3's exception).
2. **FB-72 fix**: edit `annotation-popover-states.html:381`. Swap the
   default `text-stone-400` for `text-stone-600` (and add dark-mode
   `dark:text-stone-300`). Confirm the 44×44 hit area via `p-2`
   padding or a sibling `::before` expander matching the pin pattern
   used elsewhere in the artifact.
3. **FB-77 fix**: scan `agent-feedback-toggle-spec.html` and
   `keyboard-shortcut-map.html` for every `text-[10px]` occurrence.
   Promote each to `text-xs` or `text-[11px] font-semibold`. For every
   `text-gray-400` / `text-stone-400` on white, substitute
   `text-gray-600 dark:text-gray-400` (or `text-stone-600
   dark:text-stone-300`). Confirm both banned patterns are at 0
   occurrences in both files.
4. **Audit scope widening**: edit
   `stages/design/artifacts/contrast-and-type-audit.md §2` to state
   the audit covers every `*.html` file in the artifacts directory,
   not a curated subset. Re-run the grep loop against the full
   directory and update the summary table with actual counts per
   artifact.

Design-reviewer hat runs the exact grep commands from the gate prose,
confirms each returns 0, and verifies the `disabled`/`aria-disabled`
pair is present on every disabled button in the affected files.

Feedback-assessor hat walks each FB item against the reviewer's
concrete claim (opacity-50 count, text-stone-400 on close glyph,
text-[10px] body copy) and confirms the fix lands on the exact lines
cited.

## Completion criteria

- [ ] `annotation-popover-states.html` has 0 `opacity-50` occurrences
- [ ] Create button uses the §4 disabled pair + `disabled` + `aria-disabled`
- [ ] popover-close ✕ uses `text-stone-600` + dark-mode variant + 44×44
- [ ] `agent-feedback-toggle-spec.html` has 0 `text-[10px]` / banned-gray
- [ ] `keyboard-shortcut-map.html` has 0 `text-[10px]` / banned-stone
- [ ] `contrast-and-type-audit.md §2` documents the widened scope explicitly
- [ ] Audit table reflects post-fix actual counts across all artifact files
- [ ] feedback-assessor verifies FB-71, FB-72, FB-77 at the cited lines
