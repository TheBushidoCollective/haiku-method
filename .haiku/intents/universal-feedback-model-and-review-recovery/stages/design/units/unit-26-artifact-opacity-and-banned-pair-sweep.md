---
title: >-
  Artifact opacity-50/60 and banned-token-pair stage-wide rewrite — markup
  actually matches what contrast-and-type-audit claims for revisit-unit-list,
  revisit-modal-states, review-ui-mockup, agent-feedback-toggle-spec, and
  annotation-popover-states; disabled + aria-disabled contract enforced;
  stage-btn gets a focus-visible ring
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
  - stages/design/artifacts/
  - stages/design/artifacts/contrast-and-type-audit.md
outputs:
  - stages/design/artifacts/revisit-unit-list.html
  - stages/design/artifacts/revisit-modal-states.html
  - stages/design/artifacts/review-ui-mockup.html
  - stages/design/artifacts/agent-feedback-toggle-spec.html
  - stages/design/artifacts/annotation-popover-states.html
  - stages/design/artifacts/comment-to-feedback-flow.html
  - stages/design/artifacts/unit-26-design-review.md
quality_gates:
  - name: stagewide-no-opacity-50-60-on-text
    command: >-
      ! grep -rEn 'opacity-(50|60)'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/*.html
      | grep -vE 'backdrop-blur|black/(50|60)|modal-overlay|demo-only'
  - name: revisit-unit-list-no-opacity-60
    command: >-
      ! grep -En 'opacity-60'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/revisit-unit-list.html
  - name: revisit-modal-states-no-opacity-50
    command: >-
      ! grep -En 'opacity-50'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/revisit-modal-states.html
      | grep -vE 'backdrop-blur|black/50|modal-overlay'
  - name: review-ui-mockup-no-opacity-60
    command: >-
      ! grep -En 'opacity-60'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/review-ui-mockup.html
  - name: review-ui-mockup-stage-btn-focus-visible
    command: >-
      ! grep -E 'stage-btn[^>]*focus:outline-none'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/review-ui-mockup.html
      | grep -v focus-visible
  - name: agent-feedback-toggle-no-opacity-50
    command: >-
      ! grep -En 'opacity-50'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/agent-feedback-toggle-spec.html
      | grep -vE 'backdrop-blur|black/50'
  - name: annotation-popover-no-opacity-50
    command: >-
      ! grep -En 'opacity-50'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/annotation-popover-states.html
  - name: stagewide-no-banned-stone-pairs
    command: >-
      ! grep -rEn
      'bg-stone-(100|200)[^"]*text-stone-500|text-stone-500[^"]*bg-stone-(100|200)'
      .haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/*.html
  - name: disabled-paired-with-aria-disabled
    command: >-
      python3 -c "import re, sys, glob; bad = []; [bad.append((f, line)) for f
      in
      glob.glob('.haiku/intents/universal-feedback-model-and-review-recovery/stages/design/artifacts/*.html')
      for i, line in enumerate(open(f).read().splitlines(), 1) if
      re.search(r'<(button|input|select|textarea|fieldset|label|a)\b[^>]*\bdisabled\b',
      line) and 'aria-disabled' not in line]; sys.exit(1 if bad else 0)"
status: active
bolt: 2
hat: feedback-assessor
started_at: '2026-04-20T19:39:02Z'
hat_started_at: '2026-04-20T20:07:33Z'
iterations:
  - hat: designer
    started_at: '2026-04-20T19:39:02Z'
    completed_at: '2026-04-20T19:48:49Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T19:48:50Z'
    completed_at: '2026-04-20T19:54:37Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T19:54:37Z'
    completed_at: '2026-04-20T19:58:07Z'
    result: reject
    reason: >-
      FB-141 still-pending: review-ui-mockup.html Operations (line ~146) and
      Security (line ~163) stage-button label <span>s still carry
      `text-stone-500 dark:text-stone-400`. FB-141 Fix #1 and the unit's own
      per-file QG for review-ui-mockup.html explicitly require lifting these
      labels to `text-stone-600 dark:text-stone-300` at full opacity. Opacity-60
      was removed and aria-disabled pairing landed, but the required text-color
      lift was skipped — grep `text-stone-500
      dark:text-stone-400.*leading-none.*Operations|Security` confirms the old
      tokens still render. FB-134, FB-139, FB-140, FB-145, FB-146, FB-150 all
      verified closed.
  - hat: designer
    started_at: '2026-04-20T19:58:07Z'
    completed_at: '2026-04-20T20:03:39Z'
    result: advance
  - hat: design-reviewer
    started_at: '2026-04-20T20:03:39Z'
    completed_at: '2026-04-20T20:07:33Z'
    result: advance
  - hat: feedback-assessor
    started_at: '2026-04-20T20:07:33Z'
    completed_at: null
    result: null
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
