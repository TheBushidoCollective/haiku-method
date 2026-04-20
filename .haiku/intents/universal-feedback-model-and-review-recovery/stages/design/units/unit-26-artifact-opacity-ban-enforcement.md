---
title: >-
  Artifact HTML opacity-ban enforcement — apply the audit's claimed remediation
  to every HTML that still ships opacity-50/60 on cards, buttons, and labels
type: design
closes:
  - FB-92
  - FB-94
  - FB-95
  - FB-97
  - FB-102
depends_on: []
inputs:
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/comment-to-feedback-flow.html
outputs:
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/contrast-and-type-audit.md
  - stages/design/artifacts/unit-26-design-review.md
quality_gates:
  - >-
    `revisit-unit-list.html` no longer ships `opacity-60` on any `.locked-card`,
    on the state-coverage reference tiles, or anywhere else. Every locked unit
    card (previously lines 247, 259, 271, 283, 295, 307, 319 per FB-92) is
    rewritten to the bolt-3 canonical muted treatment: `bg-stone-50
    dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300
    dark:border-stone-700 shadow-sm p-4 outline-none` with titles
    `text-stone-600 dark:text-stone-300`. The stylesheet's `.locked-card:hover {
    opacity: 0.8 }` and `:focus-visible { opacity: 0.95 }` rules are removed
    (hover lifts the surface to `bg-stone-100 dark:bg-stone-800` instead; focus
    draws the canonical teal `focus-visible:ring-*` ring). The state-coverage
    reference tiles at lines 345, 393 are rewritten to describe the same
    muted-background state language rather than "opacity 60%". The read-only
    pill at lines 240 and 398 raises from `bg-stone-200 text-stone-500
    dark:bg-stone-700 dark:text-stone-400` to `bg-stone-200 text-stone-700
    dark:bg-stone-700 dark:text-stone-300`. `grep -n 'opacity-60'
    stages/design/artifacts/revisit-unit-list.html` returns 0 hits; `grep -nE
    'bg-stone-200[^"]*text-stone-500|text-stone-500[^"]*bg-stone-200'
    stages/design/artifacts/revisit-unit-list.html` returns 0 hits.
  - >-
    `review-ui-mockup.html` stage-buttons for Operations (line 136) and Security
    (line 153) no longer carry `opacity-60 cursor-not-allowed`. Replacement
    pattern: keep `disabled aria-label="..."` and add `aria-disabled="true"`;
    drop `opacity-60` entirely; the `<span>` labels render at full opacity
    (`text-stone-500 dark:text-stone-400` already passes AA at full α on the
    rendered stone-100 strip surface). The runtime `dim` JS at line 790 is
    rewritten to use status-aware muted-background tokens instead of
    `opacity-60` — `closed` cards apply `bg-green-50/60 dark:bg-green-950/25`,
    `rejected` cards apply `bg-stone-100 dark:bg-stone-800/50`; neither dims the
    text subtree. `grep -n 'opacity-60'
    stages/design/artifacts/review-ui-mockup.html` returns 0 hits; `grep -n
    "'opacity-60'" stages/design/artifacts/review-ui-mockup.html` also returns 0.
  - >-
    `annotation-popover-states.html` State 4b "Create" button (line 394) no
    longer ships `bg-teal-600 text-white opacity-50`. Replacement pattern
    matches `contrast-and-type-audit.md §4 Bolt-3`: `px-2.5 py-1 text-xs
    font-semibold rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600
    dark:text-stone-300 border border-stone-400 dark:border-stone-500
    cursor-not-allowed` with `disabled aria-disabled="true"`. The explanatory
    `<li>` at line 402 is rewritten to stop canonicalizing `opacity: 0.5` as a
    valid disabled treatment — new prose states the canonical token pair
    (`bg-stone-100 ... text-stone-600 ...` with `border border-stone-400`) and
    adds a one-line note "`opacity-*` utilities on disabled controls are banned
    stage-wide." `grep -n 'opacity-50'
    stages/design/artifacts/annotation-popover-states.html` returns 0 hits for
    the Create button; prose `<li>` at line 402 mentions `opacity` only in the
    "banned stage-wide" ban note, not as canonical.
  - >-
    `agent-feedback-toggle-spec.html` disabled-example (line 181) label wrapper
    no longer carries `opacity-50`. Replacement: `<label class="af-touch
    inline-flex items-center gap-2 cursor-not-allowed">` (no opacity utility).
    Switch track and thumb mute via `bg-stone-200/bg-stone-700` +
    `border-stone-400/stone-500`; switch label (line 193) lifts from
    `text-stone-500 dark:text-stone-500` to `text-stone-700 dark:text-stone-300`;
    caption (line 195) lifts from `text-stone-500` to `text-stone-600
    dark:text-stone-300`; caption prose is rewritten to drop the "opacity-50"
    claim and describe the canonical token pair + `aria-disabled="true"`. The
    text now passes 1.4.3 at full α (`text-stone-700` on white ≥ 10:1 light,
    `text-stone-300` on stone-900 ≥ 10:1 dark). `grep -n 'opacity-50'
    stages/design/artifacts/agent-feedback-toggle-spec.html` returns 0 hits.
  - >-
    `comment-to-feedback-flow.html` collapsed card preview (line 966) no longer
    carries `opacity-60` on the root, and the child `<p>` is rewritten from
    `text-xs text-stone-500 truncate` to `text-xs text-stone-300 truncate` (the
    audit-prescribed color). A short inline HTML comment above the block
    documents the bolt-5 fix (`<!-- bolt-5: dropped opacity-60 and lifted child
    from stone-500 to stone-300 per FB-102 -->`). Post-fix contrast on the
    α-composited `bg-amber-950/20` surface is verified ≥ 4.5:1. `grep -n
    'opacity-60' stages/design/artifacts/comment-to-feedback-flow.html` returns
    0 hits; `grep -nE 'text-xs text-stone-500 truncate'
    stages/design/artifacts/comment-to-feedback-flow.html` returns 0 hits on the
    `:966` collapsed-card line.
  - >-
    Stage-wide grep enforcement: `grep -rnE 'opacity-(50|60)'
    stages/design/artifacts/*.html` returns 0 hits, confirming no card root,
    button, label wrapper, or status glyph carries the banned opacity tokens.
    Exceptions (if any) MUST be declared explicitly in
    `contrast-and-type-audit.md §N` with a named allow-list and the
    WCAG-justified reason, and each allow-listed line MUST pair with a
    `// allowlist: <FB-id>` inline HTML comment for auditability.
  - >-
    `contrast-and-type-audit.md` is re-run against this unit's outputs. Each
    artifact's existing "PASS" row is updated to reflect the actual post-fix
    state (e.g. row for `revisit-unit-list.html` now reads "no opacity tokens on
    locked cards; muted-background treatment per §6.3"); rows that previously
    claimed "removed" when the live file still shipped the banned pattern are
    rewritten so the audit matches the file. The audit carries a new §N.bolt-5
    table row that records the five audit/file divergences this unit closed
    (FB-92, FB-94, FB-95, FB-97, FB-102) so future adversarial reviews can
    spot-check the claim against reality.
  - >-
    feedback-assessor re-runs the FB-92 / FB-94 / FB-95 / FB-97 / FB-102 grep
    recipes literally (all listed inline in each feedback body) and confirms
    each returns 0 hits. The assessor additionally compares each artifact
    against its corresponding audit row and flags any remaining
    audit-vs-file divergence.
status: pending
---
# Artifact HTML opacity-ban enforcement

## Scope

Iteration-4 adversarial review found five artifacts that still ship
the banned `opacity-50` / `opacity-60` patterns on card roots,
disabled buttons, and label wrappers — the exact same patterns that
`contrast-and-type-audit.md §4` / §6.2 / §6.3 claim were remediated.
The audit is factually wrong; the HTML has not been rewritten. This
unit is the one that actually applies the bolt-3/bolt-4 claimed fixes
to disk.

- **FB-92** · `revisit-unit-list.html` — 9 locked cards, two
  state-coverage reference tiles, and the read-only pill.
- **FB-94** · `review-ui-mockup.html` — Operations/Security stage
  buttons at 136/153 and the runtime `dim` JS at 790.
- **FB-95** · `annotation-popover-states.html` — State 4b "Create"
  button at 394 and its explanatory `<li>` at 402.
- **FB-97** · `agent-feedback-toggle-spec.html` — disabled example
  wrapper at 181, label at 193, caption at 195.
- **FB-102** · `comment-to-feedback-flow.html` — collapsed card
  preview at 966.

## Approach

Designer hat, per artifact:

1. Open each file at the line numbers called out in the feedback
   body.
2. Replace every `opacity-50` / `opacity-60` with the canonical
   muted-background + full-α-text token pair the audit already
   prescribes (see each quality gate for exact classes).
3. Update surrounding prose, `<li>` explainer text, or JS string
   literals that canonicalize the banned pattern.
4. Re-run the feedback body's literal grep recipe against the file;
   confirm 0 hits before moving on.

Design-reviewer hat:

1. Walk each of the five artifacts side-by-side with
   `contrast-and-type-audit.md` and confirm the audit row and the
   file now match.
2. Re-compute the post-fix contrast ratios on the α-composited
   surfaces; confirm ≥ 4.5:1 for body text and ≥ 3:1 for non-text
   UI.
3. Add a `§N.bolt-5` audit table row that records the five
   divergences this unit closed.

Feedback-assessor hat:

1. Run each feedback body's literal grep recipe.
2. Confirm 0 hits.
3. Diff the audit's claim rows against the live files and report
   any remaining divergence.

## Out of scope

- Spec-text prose in `state-coverage-grid.md` that canonicalizes the
  banned pattern — handled by **unit-27** (spec alignment).
- Focus-visible rings missing on `.stage-btn` in `review-ui-mockup.html`
  — handled by **unit-29** (focus-visible canonicalization).
- Dark-mode contrast hot spots unrelated to opacity — handled by
  **unit-31**.

## Completion criteria

- [ ] All five HTML artifacts free of `opacity-50` / `opacity-60`
- [ ] Every audit claim row matches the live file
- [ ] Stage-wide grep `grep -rnE 'opacity-(50|60)' stages/design/artifacts/*.html` returns 0
- [ ] Audit log carries a §N.bolt-5 entry recording the five closed divergences
- [ ] Feedback-assessor confirms each of FB-92, FB-94, FB-95, FB-97, FB-102 against its literal grep recipe
