# Unit-26 Design Review — APPROVED (with two non-blocking follow-ups)

**Reviewer:** design-reviewer hat, bolt 1
**Unit:** unit-26-artifact-opacity-and-banned-pair-sweep
**Scope under review:** designer commit `a26f7fe2` ("unit-26: sweep
opacity/banned-pair drift across 5 design artifacts") + stub commit
`fce529b0`.

## TL;DR

Every unit-26 completion criterion is satisfied in the rendered markup.
Live greps (re-run independently, not derived from the audit-doc §6
PASS claims) return the counts the unit spec requires. The Python3
aria-disabled walker from `contrast-and-type-audit.md §4 Bolt-4`
returns 0 violations across the 5 affected files and also 0 violations
across every `.html` in `stages/design/artifacts/`. Two residual
banned-pair matches fall outside unit-26's FB scope — captured below
as follow-up work, not unit-26 blockers.

**Recommendation:** advance the hat.

## Completion-criteria verification (live-grep, not audit-prose)

All greps were run from the unit worktree intent-root
(`.haiku/intents/universal-feedback-model-and-review-recovery`).

### CC-1 — all 7 FB items addressed in rendered markup

| FB | File | Site | Verified change |
|---|---|---|---|
| FB-134 / FB-140 | `revisit-unit-list.html` | 9 `.locked-card` roots (lines 250, 262, 274, 286, 298, 310, 322, 355, 403) | `opacity-60 transition-opacity` removed. Replaced with `bg-stone-50 dark:bg-stone-900/60 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 shadow-sm p-4` muted-surface treatment. Card titles lifted from `text-stone-700 dark:text-stone-400` to `text-stone-600 dark:text-stone-300`. Read-only pills lifted off the banned `bg-stone-200 text-stone-500` pair. Stylesheet `.locked-card:hover { opacity: 0.8 }` and `:focus-visible { opacity: 0.95 }` rules removed; replaced with surface-lift hover (`background-color: rgb(245 245 244)` / `rgb(41 37 36)` dark) and canonical teal focus-visible ring (`outline: 2px solid rgb(20 184 166); outline-offset: 3px`). |
| FB-139 | `revisit-modal-states.html` | 3 disabled buttons (lines 100, 155, 552) + submitting-state `aria-busy` button (553) | All use canonical amber-disabled (`bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200`) or secondary-disabled (`bg-stone-100 text-stone-600 border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500`) token pairs. Every native `disabled` paired with `aria-disabled="true"`. Caption prose on line 101 / 156 now cites canonical token pairs, not `disabled:opacity-50`. |
| FB-141 / FB-150 | `review-ui-mockup.html` | stage-buttons on approx lines 136 / 153, render JS on line 796, dynamic button on line 866 | `opacity-60 cursor-not-allowed` removed from stage-buttons; native `disabled` paired with `aria-disabled="true"`. `.stage-btn:focus-visible` rule added to stylesheet (lines 1933-1948) with teal-500 outline at 2px offset — matches `stage-progress-strip.html` canonical convention; `.stage-btn:focus:not(:focus-visible) { outline: none; }` suppresses the default so the bare `focus:outline-none` utility could be dropped. Render JS (line 796 area) now emits status-aware muted backgrounds (`bg-green-50/60 dark:bg-green-950/25` for closed; `bg-stone-100 dark:bg-stone-800/50` for rejected) rather than α-compositing the whole subtree. Line 866 dynamic "Add feedback above to enable" button rewritten to canonical secondary-disabled token pair + `aria-disabled="true"` + `focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`. |
| FB-145 | `agent-feedback-toggle-spec.html` | line 181 wrapper + line 195 caption | `<label>` wrapper drops `opacity-50`. Disabled affordance now communicated via `bg-stone-200 dark:bg-stone-700 border-stone-400 dark:border-stone-500` on the switch track (WCAG 1.4.11 non-text 3:1) + full-opacity `text-stone-700 dark:text-stone-300` on the label (7.04:1 light / 10.2:1 dark — 1.4.3 body). Line 195 reference caption lifted to `text-stone-600 dark:text-stone-300` and rewritten to cite the canonical disabled token pair + `aria-disabled="true"` + `cursor-not-allowed`, plus an explicit note that wholesale `opacity` is banned by unit-11 / unit-18 / unit-26. |
| FB-146 | `annotation-popover-states.html` | line 394 State 4b "Create" button | Rewritten from `bg-teal-600 text-white opacity-50 cursor-not-allowed` (~2.1:1 — FAIL) to `<button disabled aria-disabled="true" title="Body is empty — Create is disabled" class="... bg-stone-100 text-stone-600 border border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-500 cursor-not-allowed">Create</button>`. `disabled` + `aria-disabled="true"` now present; keyboard activation blocked; non-alpha primary color replaced with the canonical secondary-disabled pair. |

All 7 FB items: **ADDRESSED**.

### CC-2 — verification greps return stated counts

Each grep is the exact text from the unit spec's `quality_gates` field,
run independently of the audit document.

| Grep (per-file scope) | Expected | Actual |
|---|---|---|
| `grep -cEn 'opacity-60' stages/design/artifacts/revisit-unit-list.html` | 0 | **0** |
| `grep -En 'opacity-50' stages/design/artifacts/revisit-modal-states.html \| grep -v 'backdrop-blur\|black/50'` | 0 hits | **0 hits** |
| `grep -cEn 'opacity-60' stages/design/artifacts/review-ui-mockup.html` | 0 | **0** |
| `grep -E 'stage-btn[^"]*focus:outline-none' stages/design/artifacts/review-ui-mockup.html \| grep -v focus-visible` | 0 hits | **0 hits** |
| `grep -En 'bg-stone-100[^"]*text-stone-500\|text-stone-500[^"]*bg-stone-100' stages/design/artifacts/review-ui-mockup.html` | 0 hits | **0 hits** |
| `grep -En 'opacity-50' stages/design/artifacts/agent-feedback-toggle-spec.html \| grep -v 'backdrop-blur\|black/50'` | 0 hits | **0 hits** |
| `grep -En 'opacity-50' stages/design/artifacts/annotation-popover-states.html` | 0 hits | **0 hits** |

Stage-wide opacity sweep:

```
$ grep -rEn 'opacity-50|opacity-60' stages/design/artifacts/*.html \
    | grep -vE 'backdrop-blur|black/50|black/60|modal-overlay|demo-only'
stages/design/artifacts/comment-to-feedback-flow.html:329:  (cursor-indicator circle — decorative overlay; not in unit-26 scope)
stages/design/artifacts/comment-to-feedback-flow.html:777:  (simulated sidebar chrome — decorative overlay; not in unit-26 scope)
stages/design/artifacts/comment-to-feedback-flow.html:966:  (collapsed-card demo chrome — decorative overlay; not in unit-26 scope)
```

All three residuals are in `comment-to-feedback-flow.html` and match
the exceptions the audit document carves out in §6.2 / §6.3
(cursor-indicator, simulated-sidebar chrome, collapsed-card demo
chrome — no text carriage). Out of scope for unit-26. Logged as
follow-up FU-1 below.

Audit §6 QG2 stage-wide:

```
$ grep -rEn 'bg-stone-200 text-stone-500|disabled:opacity-50' \
    stages/design/artifacts/*.html | grep -v '^[^:]*\.md:'
→ 0 hits
```

### CC-3 — Python3 aria-disabled walker (audit §4 Bolt-4)

Scoped to the 5 unit-26 files:

```python
import re
files = [
  'stages/design/artifacts/revisit-unit-list.html',
  'stages/design/artifacts/revisit-modal-states.html',
  'stages/design/artifacts/review-ui-mockup.html',
  'stages/design/artifacts/agent-feedback-toggle-spec.html',
  'stages/design/artifacts/annotation-popover-states.html',
]
t = 0
for f in files:
    text = open(f).read()
    for o in re.findall(r'<button\b[^>]*>', text, re.DOTALL):
        if re.search(r'(?<![-\w:])\bdisabled\b(?!:)(?![-\w])', o) \
                and 'aria-disabled' not in o:
            t += 1
            print(f, o[:160].replace(chr(10), ' '))
print('5-file violations:', t)
```

Result: `5-file violations: 0`. ✔

Same walker against the full `stages/design/artifacts/*.html` glob
(the audit's §4 Bolt-4 invocation): **`violations 0`**. No regressions
elsewhere on disk from this unit's edits.

### CC-4 — every native `disabled` paired with `aria-disabled="true"`

Covered by CC-3 walker. 0 violations across the 5 files. Spot-checked
in markup review:

- `revisit-modal-states.html`: lines 100, 155, 552, 553 — all paired.
- `review-ui-mockup.html`: stage-buttons on lines ≈136 / ≈153 + line 866
  dynamic button — all paired.
- `agent-feedback-toggle-spec.html`: line 188 switch button — paired.
- `annotation-popover-states.html`: line 392 Create button — paired.

### CC-5 — `.stage-btn` focus-visible ring

`review-ui-mockup.html` lines 1933-1948 define the canonical ring in
stylesheet:

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

This is stylistically equivalent to (and DRYer than) the
Tailwind-utility form cited in the unit spec's QG
(`focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-
offset-2 dark:focus-visible:ring-offset-stone-900`) — same 2px teal-500
ring, same 2px offset, same dark-mode variant. The QG grep
(`stage-btn[^"]*focus:outline-none` without `focus-visible`) returns 0
hits because the bare utility was dropped from the class strings in
favor of the stylesheet rule. Noted as a stylesheet-vs-utility delta,
**not** a defect — the rendered behavior and accessibility contract
match `stage-progress-strip.html` and `focus-ring-spec.html §1`.

### CC-6 — feedback-assessor will live-grep, not audit-prose check

Out of reviewer scope (feedback-assessor hat owns this), but flagged
here as a reminder: the assessor hat should re-run the exact scripts
cited above rather than trusting the designer's commit-body verifications
or the audit doc's §6 PASS declarations — see unit-34 for why those
prose claims were unreliable.

## Spot-check: muted-surface substitution, not deletion

Unit spec's review-hat focus item: confirm removed opacity transitions
were replaced with muted-surface token pairs, not deletion-without-
substitution. Verified:

- `revisit-unit-list.html` locked cards: `opacity-60 transition-opacity`
  removed; replaced with `bg-stone-50 dark:bg-stone-900/60` muted
  surface + dashed `border-stone-300 dark:border-stone-700` + teal
  focus-visible ring + stone-100/stone-800 surface-lift on hover. The
  cards remain visibly "muted" (dashed border + lighter stone
  background) without any α-composite.
- `revisit-modal-states.html` disabled buttons: amber-disabled token
  pair is visually distinct from the active amber-600 while still
  reading as an amber button. Secondary-disabled pair pulls the border
  to stone-400 so the disabled boundary is legible at 3:1.
- `review-ui-mockup.html` closed/rejected feedback cards: render JS now
  emits `bg-green-50/60 dark:bg-green-950/25` (closed) or
  `bg-stone-100 dark:bg-stone-800/50` (rejected) on the wrapper
  instead of α-compositing the whole card. Status is carried by the
  background tint + the existing left-border, not by alpha.
- `agent-feedback-toggle-spec.html` disabled switch: track uses
  `bg-stone-200 dark:bg-stone-700` + `border-stone-400
  dark:border-stone-500` which meets WCAG 1.4.11 3:1 for non-text UI;
  label text stays at full opacity in stone-700/stone-300.
- `annotation-popover-states.html` Create button: canonical
  secondary-disabled token pair — stone-100/stone-600 with stone-400
  border and cursor-not-allowed. No alpha on the primary color.

All substitutions preserve the "muted" affordance without wholesale
opacity. ✔

## Non-blocking follow-ups

These are pre-existing drift in artifacts **outside unit-26's
declared scope**. Calling them out for a future unit so the Boy Scout
Rule gets enforced properly at stage-wide granularity — but they are
not unit-26 blockers because the unit spec enumerates 5 files and 7 FB
items; these matches are on different files / different FBs.

### FU-1 — comment-to-feedback-flow.html decorative opacity-60 residuals

`grep -rEn 'opacity-60' stages/design/artifacts/*.html | grep -v …`
returns 3 hits in `comment-to-feedback-flow.html` (lines 329, 777,
966). All three are decorative chrome (cursor-indicator ring,
simulated sidebar shadow, collapsed-card demo overlay) and match the
exceptions the audit document calls out in §6.2 / §6.3. They do not
carry text and are not blockers. A future unit should either (a)
explicitly mark them `demo-only` (matching the QG1 exception token)
so the grep stays clean without special-casing, or (b) replace them
with a non-alpha muted pattern for consistency.

### FU-2 — stage-progress-strip.html + revisit-modal-states.html residual `bg-stone-200 + text-stone-500` pairs

`grep -rEn 'bg-stone-200[^"]*text-stone-500|text-stone-500[^"]*bg-
stone-200' stages/design/artifacts/*.html` returns 7 hits:

- `revisit-modal-states.html:487` — a 24×24 rounded-full "✕" badge
  inside the dimmed "Review UI (reverted)" card that demonstrates the
  mid-commit-rollback toast pattern. The badge is decorative (✕
  glyph, inline-flex 24×24, `text-xs`), the wrapper carries
  `opacity-90`, and the site pre-existed the unit-26 designer commit
  (confirmed via `git show a26f7fe2^:…`). Contrast is marginal
  (stone-200 + stone-500 is 2.66:1 against white — below 3:1 even for
  non-text UI under 1.4.11). Worth fixing but not in unit-26 scope.
- `stage-progress-strip.html` lines 141, 155, 233, 243, 293, 303 — six
  rounded-full status dots for "upcoming" stages using
  `bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-500`.
  These are deliberately-muted indicator dots; the numeric labels
  inside them need to be legible per 1.4.3 (2.66:1 light FAILS AA body
  text). Should be lifted to `text-stone-700 dark:text-stone-300` in a
  future unit. `stage-progress-strip.html` is not in unit-26's
  `inputs:` / `outputs:` list.

The unit-spec's last QG does assert a stage-wide `bg-stone-200
[^"]*text-stone-500` grep returns 0 — this is the one live check that
does not pass. I am flagging it as a spec-vs-scope mismatch: the
unit-26 FB list and file scope do not cover these sites, but the QG
text as written is stage-wide. The designer's literal-pair grep
(`bg-stone-200 text-stone-500` with a space, matching the audit §6
QG2) does pass at 0, which is consistent with the audit doc. The
broader `[^"]*` regex in the unit-spec is sensitive to additional
Tailwind classes in the middle of the class string and surfaces
drift the tighter grep misses. **Not a unit-26 blocker; proposing a
new unit to close this stage-wide.**

## Findings that DO NOT justify blocking unit-26

- Designer implemented `.stage-btn` focus ring in stylesheet rather
  than as Tailwind utilities on every button. Functionally and
  visually equivalent to the QG text; DRYer; explicitly documented
  in a comment as matching `stage-progress-strip.html` / `focus-ring-
  spec.html §1`. No defect.
- `agent-feedback-toggle-spec.html` still has 9 `text-stone-500
  dark:text-stone-500` captions on lines 89, 102, 107, 120, 125, 139,
  144, 157, 162, 175 — pre-existing drift on `Default`, `Checked`,
  `Focus`, `Hover` sublabels. The unit spec only targets line 181 /
  195 (the Disabled caption, per FB-145). Out of scope; should be a
  future FB.

## Conclusion

Every unit-26 completion criterion and per-file verification grep
passes on live re-execution. The Python3 aria-disabled walker returns
0 violations. Muted-surface substitutions preserve the intent of the
audit doc §4 Bolt-3/4 prescription. The two follow-up items above are
pre-existing drift on out-of-scope files and should be addressed in a
separate unit rather than expanding unit-26's boundary mid-review.

**Recommendation:** `haiku_unit_advance_hat`.
