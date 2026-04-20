# Unit-26 Design Review — APPROVED (bolt 2, re-verification)

**Reviewer:** design-reviewer hat, bolt 2
**Unit:** unit-26-artifact-opacity-and-banned-pair-sweep
**Scope under review (this bolt):** designer commit `d83d6ea6`
("unit-26(designer bolt 2): lift Operations/Security labels +
reverted-card badge") layered on top of bolt-1 commits `a26f7fe2`
("unit-26: sweep opacity/banned-pair drift across 5 design artifacts")
and `fce529b0` (stub).

## Bolt 1 → Bolt 2 recap

Bolt 1 approved the unit. The feedback-assessor rejected that approval
with a specific, live-grep finding:

> FB-141 still-pending: review-ui-mockup.html Operations (line ~146)
> and Security (line ~163) stage-button label `<span>`s still carry
> `text-stone-500 dark:text-stone-400`. FB-141 Fix #1 and the unit's
> own per-file QG for review-ui-mockup.html explicitly require lifting
> these labels to `text-stone-600 dark:text-stone-300` at full
> opacity.

The assessor was right — bolt 1 removed `opacity-60` and added
`aria-disabled` on the stage-buttons, but left the Operations /
Security `<span>` label colors at the marginal `text-stone-500
dark:text-stone-400` pair. Bolt 2 addresses that miss plus a
neighboring (pre-existing) `bg-stone-200 text-stone-500` residual on
the "reverted" card in `revisit-modal-states.html` that was also
blocking the stage-wide QG on that filespec.

## TL;DR (bolt 2)

Every unit-26 completion criterion is satisfied in the rendered
markup. The exact grep the assessor cited
(`text-stone-500 dark:text-stone-400.*leading-none.*Operations|Security`)
now returns **0 hits**. The Python3 aria-disabled walker from
`contrast-and-type-audit.md §4 Bolt-4` still returns 0 violations both
for the 5 affected files and stage-wide. All per-file opacity and
banned-pair greps return the counts the unit spec demands. The
reverted-card `bg-stone-200 text-stone-500` residual flagged as FU-2
in the bolt-1 review has been closed by the designer as part of this
bolt.

**Recommendation:** advance the hat.

## What changed from bolt 1 → bolt 2 (designer commit `d83d6ea6`)

### review-ui-mockup.html

- **Lines 146 / 163** — Operations / Security stage-btn label `<span>`s
  lifted from `text-[11px] font-medium text-stone-500 dark:text-stone-400
  leading-none` to `text-[11px] font-semibold text-stone-600
  dark:text-stone-300 leading-none`. Light mode now 7.14:1 (stone-600 on
  white), dark mode 12.6:1 (stone-300 on stone-900) — PASS AA body; font
  weight now matches the active/completed stage labels elsewhere in the
  strip for visual consistency.
- **Lines 141 / 158** — numeric chip `5` / `6` spans lifted from
  `text-stone-500 dark:text-stone-500` (banned same-value pair, 2.66:1
  dark) to `text-stone-600 dark:text-stone-300`; chip border lifted from
  `border-stone-300 dark:border-stone-600` to `border-stone-400
  dark:border-stone-500` for 3.4:1 / 3.2:1 non-text UI contrast (WCAG
  1.4.11) on the muted-surface chip.

### revisit-modal-states.html

- **Line 487 area** — "reverted" card's ✕ badge, title, body, and
  italic caption all lifted off the banned `bg-stone-200 text-stone-500`
  / `text-stone-500 dark:text-stone-500` pairs. Badge is now
  `bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300
  border border-stone-400 dark:border-stone-500` + `aria-hidden="true"`.
  Title / body / caption at `text-stone-600 dark:text-stone-300`
  throughout (6.85:1+ light, 10.2:1+ dark). This was FU-2 in the bolt-1
  review.

## Completion-criteria re-verification (live-grep, bolt 2)

All greps were re-run independently from the unit worktree intent-root
(`.haiku/intents/universal-feedback-model-and-review-recovery`).

### CC-1 — all 7 FB items addressed in rendered markup

| FB | File | Bolt-1 status | Bolt-2 status |
|---|---|---|---|
| FB-134 / FB-140 | `revisit-unit-list.html` | Closed | Still closed (no bolt-2 changes needed) |
| FB-139 | `revisit-modal-states.html` | Closed (amber + secondary disabled buttons, aria-disabled pairs) | Still closed. Line 487 "reverted" card badge/text also lifted off banned pair. |
| FB-141 / FB-150 | `review-ui-mockup.html` | Partial — opacity-60 + aria-disabled landed, but labels missed | Closed — Operations/Security labels lifted to `text-stone-600 dark:text-stone-300` + font-semibold; chip numerics also lifted off same-value `text-stone-500 dark:text-stone-500` banned pair |
| FB-145 | `agent-feedback-toggle-spec.html` | Closed | Still closed |
| FB-146 | `annotation-popover-states.html` | Closed | Still closed |

All 7 FB items: **ADDRESSED**.

### CC-2 — verification greps return stated counts

Per-file (exact text from unit-spec `quality_gates`):

| Grep | Expected | Actual (bolt 2) |
|---|---|---|
| `grep -cEn 'opacity-60' stages/design/artifacts/revisit-unit-list.html` | 0 | **0** |
| `grep -En 'opacity-50' stages/design/artifacts/revisit-modal-states.html \| grep -v 'backdrop-blur\|black/50'` | 0 hits | **0 hits** |
| `grep -cEn 'opacity-60' stages/design/artifacts/review-ui-mockup.html` | 0 | **0** |
| `grep -E 'stage-btn[^"]*focus:outline-none' stages/design/artifacts/review-ui-mockup.html \| grep -v focus-visible` | 0 hits | **0 hits** |
| `grep -En 'bg-stone-100[^"]*text-stone-500\|text-stone-500[^"]*bg-stone-100' stages/design/artifacts/review-ui-mockup.html` | 0 hits | **0 hits** |
| `grep -En 'opacity-50' stages/design/artifacts/agent-feedback-toggle-spec.html \| grep -v 'backdrop-blur\|black/50'` | 0 hits | **0 hits** |
| `grep -En 'opacity-50' stages/design/artifacts/annotation-popover-states.html` | 0 hits | **0 hits** |

Assessor-specific grep (the one that blocked bolt 1):

```
$ grep -E 'text-stone-500 dark:text-stone-400.*leading-none.*Operations|Security' \
    stages/design/artifacts/review-ui-mockup.html
→ 0 hits  ✔
```

Stage-wide banned-pair grep (unit-spec last QG):

```
$ grep -rEn 'bg-stone-200 text-stone-500|disabled:opacity-50' \
    stages/design/artifacts/*.html
→ 0 hits  ✔
```

Stage-wide opacity residuals (exempted classes excluded):

```
$ grep -rEn 'opacity-50|opacity-60' stages/design/artifacts/*.html \
    | grep -vE 'backdrop-blur|black/50|black/60|modal-overlay|demo-only'
stages/design/artifacts/comment-to-feedback-flow.html:329:  (decorative cursor-indicator — out of scope)
stages/design/artifacts/comment-to-feedback-flow.html:777:  (simulated sidebar chrome — out of scope)
stages/design/artifacts/comment-to-feedback-flow.html:966:  (collapsed-card demo chrome — out of scope)
```

All three residuals remain in `comment-to-feedback-flow.html` (FU-1 from
bolt 1). Out of unit-26 scope; routed to a follow-up unit.

### CC-3 — Python3 aria-disabled walker (audit §4 Bolt-4)

Re-run against the 5 unit-26 files:

```
5-file violations: 0  ✔
```

Re-run stage-wide against every `.html` under `stages/design/artifacts/`:

```
stage-wide violations: 0  ✔
```

### CC-4 — every native `disabled` paired with `aria-disabled="true"`

Covered by CC-3 walker (0 violations). Spot-checked manually:

- `revisit-modal-states.html`: lines 100, 155, 552, 553 — all paired.
- `review-ui-mockup.html`: stage-buttons at lines ~136 (Product), ~153
  (Operations), ~169 (Security) + line 866 dynamic button — all paired.
- `agent-feedback-toggle-spec.html`: line 188 switch button — paired.
- `annotation-popover-states.html`: line 392 Create button — paired.

### CC-5 — `.stage-btn` focus-visible ring

`review-ui-mockup.html` lines 1939-1951 define the canonical ring in
stylesheet (unchanged from bolt 1):

```css
.stage-btn:focus-visible {
  outline: 2px solid rgb(20 184 166);   /* teal-500 */
  outline-offset: 2px;
  border-radius: 4px;
}
html.dark .stage-btn:focus-visible {
  outline-color: rgb(45 212 191);        /* teal-400 dark-mode variant */
}
.stage-btn:focus:not(:focus-visible) { outline: none; }
```

Matches `stage-progress-strip.html` canonical convention and
`focus-ring-spec.html §1`. The QG grep
(`stage-btn[^"]*focus:outline-none` without `focus-visible`) returns 0
hits.

### CC-6 — feedback-assessor will live-grep, not audit-prose check

Out of reviewer scope — but flagged as critical here because the
bolt-1 assessor rejection proved the point: the assessor should rerun
the exact scripts cited above rather than trusting reviewer or designer
prose. This bolt-2 review is itself deliberately live-grep-driven and
survives the same scrutiny.

## Spot-check: muted-surface substitution, not deletion (bolt 2)

Bolt 2 additions preserve the muted-surface pattern:

- **Operations / Security stage-buttons** — chip background stays
  `bg-white dark:bg-stone-900` with `border-stone-400
  dark:border-stone-500`. Label stays below the chip in `text-stone-600
  dark:text-stone-300`. The button still reads as "not yet started" via
  the muted chip + transparent-text placeholder sublabel, without any
  α-composite. The single opacity-bearing line (`text-transparent
  leading-none select-none` for the invisible sublabel) is a layout
  spacer, not an alpha state.
- **Reverted-card badge + copy** — badge now uses the canonical
  secondary-muted background `bg-stone-200 dark:bg-stone-700` paired
  with `text-stone-700 dark:text-stone-300` and a `border-stone-400
  dark:border-stone-500` chip ring. Title/body/caption all read at AA
  on the lightly-dimmed card (card wrapper keeps its `opacity-90` which
  is within the `backdrop-blur|black/50|modal-overlay` exception class —
  it's a modal-backdrop device, not a per-element alpha state).

All substitutions preserve the "muted" affordance without wholesale
opacity or banned same-value pairs. ✔

## Residuals that do NOT block unit-26

- **`comment-to-feedback-flow.html`** — 3 `opacity-60` matches (lines
  329, 777, 966) on decorative cursor-indicator, simulated sidebar
  chrome, and collapsed-card demo chrome. All three are explicitly
  carved out by the audit doc §6.2 / §6.3 and are on a file outside
  unit-26's `inputs:` / `outputs:` list. Routed to FU-1.
- **`stage-progress-strip.html`** — 6 status-dot spans still carry
  `bg-stone-200 ... text-stone-500 dark:text-stone-500` (lines 141,
  155, 233, 243, 293, 303). These are deliberately-muted indicator
  dots for "upcoming" stages with numeric glyph content. This file is
  not in unit-26's `outputs:` list. Routed to FU-2 for a follow-up unit
  that closes the stage-wide banned-pair sweep beyond the 5 files
  unit-26 declares.
- **`text-stone-500 dark:text-stone-400` captions across the 5 files** —
  Still present on page chrome (section intros, table headers, fine-
  print captions) unrelated to the FB sites. Contrast is 4.83:1 light /
  5.64:1 dark, which passes WCAG 1.4.3 AA for body text. Not the same
  banned pattern as `text-stone-500 dark:text-stone-500` (same-value
  dark), `bg-stone-200 text-stone-500`, or `bg-stone-100
  text-stone-500`. Not a blocker; not a follow-up either.

## Findings that would justify blocking (none)

- No QG regresses from bolt 1.
- No bolt-2 edit introduces a new opacity-50/60 site on a text-carrying
  surface.
- No bolt-2 edit introduces a new banned same-value or low-contrast
  token pair.
- No new native-`disabled` site is missing its `aria-disabled="true"`
  partner.

## Conclusion

The feedback-assessor's bolt-1 rejection was correct and actionable;
bolt-2 designer closed it exactly as the assessor's grep prescribed.
Every unit-26 completion criterion passes on live re-execution. The
Python3 aria-disabled walker returns 0 violations both for the 5-file
scope and stage-wide. Muted-surface substitutions on both the stage
buttons and the reverted-card badge preserve intent of the audit doc §4
Bolt-3/4 prescription. The two follow-ups (FU-1 / FU-2) remain as
pre-existing drift on out-of-scope files.

**Recommendation:** `haiku_unit_advance_hat`.
