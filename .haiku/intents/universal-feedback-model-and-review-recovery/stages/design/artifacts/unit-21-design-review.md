# unit-21 Design Review — stagewide-contrast-and-opacity-sweep (bolt 1)

**Reviewer:** design-reviewer
**Bolt:** 1
**Verdict:** REJECT — the sweep is not stage-wide. The unit's own name and §6.4 framing commit to auditing every `stages/design/artifacts/*.html`, but the bolt-1 builder only remediated 4 files (annotation-popover, agent-feedback-toggle, keyboard-shortcut-map, revisit-modal-states, revisit-unit-list partial) and left the same banned patterns in place across 10+ sibling artifacts the audit explicitly claims are clean.

The narrow QGs (QG1 `opacity-(50|70)`, QG2 `bg-stone-200 text-stone-500`/`disabled:opacity-50`, type-scale) do pass repo-wide. The failures below are all in the audit's own ban list and in patterns the unit was chartered to eliminate stage-wide.

---

## Blockers (must fix before advance)

### B1 — §6.2 QG3 (`<button ... disabled>` carries `aria-disabled="true"`) is falsely reported as PASS

The audit §6.2 QG3 row states "Python walker over all `*.html` → 0 violations." Repo-wide walker today:

```
stages/design/artifacts/review-ui-mockup.html  <button ... data-stage="operations" ... opacity-60 cursor-not-allowed" disabled aria-label="Operations...">
stages/design/artifacts/review-ui-mockup.html  <button ... data-stage="security" ... opacity-60 cursor-not-allowed" disabled aria-label="Security...">
stages/design/artifacts/review-ui-mockup.html  <button disabled class="w-full ... bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-500 cursor-not-allowed">
stages/design/artifacts/revisit-modal-states.html  <button aria-busy="true" disabled class="... bg-amber-600 text-white ... cursor-progress">
TOTAL violations: 4
```

- `review-ui-mockup.html:136` (Operations stage btn) — `disabled` without `aria-disabled="true"`.
- `review-ui-mockup.html:153` (Security stage btn) — same.
- `review-ui-mockup.html:856` (Add-feedback-to-enable) — `<button disabled>` with no `aria-disabled`.
- `revisit-modal-states.html:461` (submitting "Revisiting…") — `aria-busy="true" disabled` without `aria-disabled`. Audit §4 Bolt-4 claims this was fixed. It is not.

Fix: add `aria-disabled="true"` to each of the four; re-run the walker; update §6.2 QG3 line once it actually returns 0.

### B2 — `dark:text-stone-500` repo-wide is NOT eliminated, despite unit title "stage-wide sweep"

DESIGN-TOKENS.md §1.1a bans `text-stone-500` in dark mode on `stone-800` and below (2.36:1 on `bg-stone-950`, WCAG 1.4.3 AA fail). Unit-21's §6.4 fixed this in 3 files (annotation-popover, agent-feedback-toggle, keyboard-shortcut-map) and explicitly promoted the pattern to `text-stone-600 dark:text-stone-300` "for audit-wide consistency."

Remaining offenders (ALL still on banned `dark:text-stone-500`, page bg `stone-950`):

| Artifact | approximate count | examples |
|---|---|---|
| `review-context-header.html` | 20+ | L42, L51, L84, L90, L108, L118, L147, L152, L170, L180, L209, L214, L232, L242, L298, L309, L314, L343, L348 |
| `review-ui-mockup.html` | 20+ | L43, L48, L141, L158, L180, L786, L849, L856, L942, L1019, L1037, L1044, L1063, L1068, L1075, L1085, L1092, L1101, L1111, L1229, L1236, L1243, L1700, L1709, L1718, L1725 |
| `revisit-modal-states.html` | 25+ | L41, L208, L224, L235, L246, L268, L280, L292, L308, L318, L328, L357, L402, L447, L500, L507, L544, L551, L561, L600, L610 |
| `revisit-unit-list.html` | 10+ | L73, L114, L119, L180, L187, L194, L210, L217, L223, L343, L359, L375, L391, L403, L411 |
| `stage-progress-strip.html` | 10 | L141, L144, L155, L158, L163, L243, L246, L293, L296, L303, L306 |
| `skip-link-spec.html` | 5 | L86, L304, L308, L311, L342 |
| `review-package-structure.html` | 4 | L643, L829, L890, L1041 |
| `comment-to-feedback-flow.html` | 2 | L620, L648 |
| `focus-ring-spec.html` | 1 | L85 |

If the unit is truly "stage-wide contrast sweep," all of these need to move to `text-stone-600 dark:text-stone-300` (or `text-stone-500` to a `text-stone-600` alone on whichever surface they ride). The audit §6.4.1 post-fix count table lists these files with "opacity-50/70: 0, text-[9/10px]: 0" which is true — but the table does not cover the `dark:text-stone-500` ban, which was the literal driver of FB-77.

Fix: do the same sweep you did for keyboard-shortcut-map.html — `sed`-style promote `dark:text-stone-500` → `dark:text-stone-300` and `text-stone-500` (bare, no `dark:`) → `text-stone-600 dark:text-stone-300` across every `.html` in `stages/design/artifacts/`. Skip only when the element rides on a surface where the pair passes AAA already (none do on `bg-stone-950`).

### B3 — `opacity-60` on text-carrying card/button roots is NOT zero

The audit §6.2 "QG1 extended · no `opacity-60` on any card / button root" row claims "0 on text-carrying card/button roots" and classifies the only hits as 2 decorative overlays in `comment-to-feedback-flow.html` plus 3 HTML-comment lines. Today:

1. `review-ui-mockup.html:136` — `<button ... opacity-60 cursor-not-allowed"` with visible "Operations" text label (L146). Text-carrying button root. Audit §4 Bolt-4 claims this was fixed to "drop `opacity-60`" — it wasn't.
2. `review-ui-mockup.html:153` — same, "Security" button.
3. `review-ui-mockup.html:790` — JS literal `const dim = ... ? 'opacity-60' : ''` applied to `.fb-card` root for closed/rejected cards. Audit §4 Bolt-4 claims this was "replaced with status-aware muted background tokens." It wasn't; the literal is still here.
4. `revisit-unit-list.html:247, 259, 271, 283, 295, 307, 319` — 7 rendered `<div role="article">` locked-unit cards, each `opacity-60 transition-opacity` on the root with an h3 title child. Audit §6.3 Bolt-5 claims these were replaced with `bg-stone-50 dark:bg-stone-900/60 ... border border-dashed`. They weren't.
5. `revisit-unit-list.html:345, 393` — two State-coverage reference tiles still demonstrate `opacity-60` on the card root (the State-coverage section was supposed to be rewritten per §6.3 to show the non-opacity treatment).
6. `comment-to-feedback-flow.html:966` — collapsed card preview `<div ... opacity-60>` with a `text-[9px] text-gray-400` child (audit §6.3 Bolt-3 claims text was lifted to `text-xs text-stone-300` and `opacity-60` removed). Text lift happened (I see `text-xs text-stone-300` now), but `opacity-60` on the parent is still there — the line now reads `border-l-[3px] border-l-amber-400 p-2 rounded-lg bg-amber-950/20 border border-stone-700 opacity-60` — the `opacity-60` was not stripped.

Fix options per site:
- Stage-strip upcoming buttons: drop `opacity-60`; the `text-stone-500 dark:text-stone-500` + `border-stone-300 dark:border-stone-600` already carries muted semantics at full opacity once B2 is applied. Add `aria-disabled="true"` (covers B1).
- Closed/rejected feedback-card JS literal: replace `const dim = ... 'opacity-60' : ''` with status-aware bg tokens (`bg-green-50/60 dark:bg-green-950/25` for closed, `bg-stone-100 dark:bg-stone-800/50` for rejected) matching `feedback-card-states.html` and DESIGN-TOKENS.md §2.3.
- `revisit-unit-list.html` locked cards: apply the treatment §6.3 already described — `bg-stone-50 dark:bg-stone-900/60 border border-dashed border-stone-300 dark:border-stone-700` on the card root; drop `opacity-60` and `transition-opacity`; lift h3 title from `text-stone-700 dark:text-stone-400` to `text-stone-600 dark:text-stone-300`; remove the stylesheet `.locked-card:hover { opacity: 0.8 }` and `:focus-visible { opacity: 0.95 }` rules.
- State-coverage reference tiles: rewrite as §6.3 already specifies (Default / Hover = surface lift / Focus = teal ring / Semantic-disabled). Do not canonicalize opacity in a reference section.
- `comment-to-feedback-flow.html:966` card preview: strip the `opacity-60` from the parent `<div>`. The text is already legible at full opacity (as §6.3 states).

### B4 — Audit §6.2 / §6.3 / §6.4 prose describes remediations that were not performed

This is the root cause of B1 + B3. The contrast-and-type-audit.md file advertises:

- §4 Bolt-4 "review-ui-mockup.html · upcoming stage-strip buttons — dropped opacity-60; added aria-disabled" — not done.
- §4 Bolt-4 "review-ui-mockup.html · 'Add feedback above to enable' — canonical secondary-disabled token pair + aria-disabled" — not done (still `bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-500` with no `aria-disabled`).
- §4 Bolt-4 "review-ui-mockup.html · 'Approve (no-op outside gate)' — same canonical secondary-disabled token pair + aria-disabled" — needs to be re-verified (matches same markup as the Add-feedback button).
- §4 Bolt-4 "review-ui-mockup.html · closed/rejected feedback-card α-composite — replaced with status-aware muted background tokens" — not done (L790 `const dim = ... 'opacity-60'`).
- §4 Bolt-4 "revisit-modal-states.html · submitting 'Revisiting…' — added aria-disabled alongside aria-busy + disabled" — not done (L461).
- §6.3 "revisit-unit-list.html — 7 locked cards and 4 state-coverage tiles migrated off opacity-60" — not done.

Either (a) execute the remediations the audit already describes, or (b) rewrite the audit prose to reflect what actually shipped. Option (a) is correct; the audit prose is the target state the unit committed to.

### B5 — `revisit-unit-list.html` also has `dark:text-stone-600` on a `text-xs` glyph

Lines 253, 265, 277, 289, 301, 313, 325, 351 — `<span class="text-stone-500 dark:text-stone-600 text-xs">🔒</span>`. On `bg-stone-900` (dark card bg), `dark:text-stone-600` is `#57534e` on `#1c1917` = ~3.25:1. That's below the AA body-text 4.5:1 floor and below the AAA 7:1 target the audit holds for dark metadata. The 🔒 glyph is ≥ 16px when inside a `text-xs` span at the browser default zoom, but it's still user-facing information about the locked state. Combined with the opacity-60 on the parent card (B3), the composite ratio degrades further.

Fix: lift to `text-stone-400 dark:text-stone-400` or `text-stone-500 dark:text-stone-400` — both pass AA as a decorative/secondary indicator on stone-900 — OR promote to `text-stone-600 dark:text-stone-300` for AAA consistency with the new metadata floor.

---

## Minor (not blocking — fold into the B2 sweep or note as deferred)

### M1 — annotation-popover-states.html footer and mock sheet

- `annotation-popover-states.html:609` footer: `text-stone-500 dark:text-stone-400` — AA-floor both modes, not AAA. Audit §6.4 promoted the same pattern to `text-stone-600 dark:text-stone-300` in keyboard-shortcut-map for audit-wide consistency. Apply the same lift here.
- `annotation-popover-states.html:428` `<span class="text-xs text-stone-500">FB: 4 pending</span>` inside the phone-mockup's "mock content behind the sheet." No `dark:` variant. On the mock's `bg-white dark:bg-stone-900`: light 4.61:1 (AA floor), dark 4.55:1 (AA floor). The surrounding `<span class="text-xs font-semibold">` at L427 also has no explicit color — it inherits body stone-900/stone-100. This is decorative scaffolding for a bottom-sheet demo, but it's still user-facing text rendered at run-time. Promote to `text-stone-600 dark:text-stone-300` for consistency.

### M2 — assessor-summary-card.html dark-only render uses `text-stone-400` on body text

`assessor-summary-card.html:73, 160, 232` — `text-xs text-stone-400` bullet lists. These sit on a forced-dark card (surrounding `bg-stone-900`). `text-stone-400` on `bg-stone-900` is ~7.5:1 — passes AAA. Not a defect. Mentioning only to preempt a future audit flagging it: the card is dark-context-only, so the `dark:` qualifier is implicit.

### M3 — stage-progress-strip icon-circles pair banned `dark:text-stone-500` with `bg-stone-200 dark:bg-stone-700`

Lines 141, 155, 243, 293, 303 — `bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-500 border border-stone-300 dark:border-stone-600` on 5×5 (20px) icon circles containing `5` / `6` numerals (or empty). Mixed concern:
- The **numeral text** `5`/`6` in `text-stone-500` on `bg-stone-200` is 3.94:1 (light) and `dark:text-stone-500` on `dark:bg-stone-700` is ~1.5:1 (dark). Dark fails AA body, though the numeral is arguably decorative because the stage name sits beside it.
- The **border** `border-stone-300` on `bg-stone-200` is below 1.4.11 non-text UI 3:1.

This is on the unit-21 radar via B2. Apply the same sweep as keyboard-shortcut-map.

---

## What's already working (keep as-is)

The bolt's actual work on the 4 touched files is correct:
- `annotation-popover-states.html` State 4b disabled Create button → canonical secondary-disabled pair. PASS.
- `annotation-popover-states.html` popover-close ✕ → 44×44 hit area with focus ring, dark color. PASS 2.5.5 + 1.4.3.
- `agent-feedback-toggle-spec.html` disabled variant → wrapper `opacity-50` dropped, muted track via `bg-gray-200 border-gray-400`, labels lifted to stone-600/300. PASS 1.4.11 + 1.4.3.
- `keyboard-shortcut-map.html` — 9 `dark:text-stone-500` sites + 83 `dark:text-stone-400` sites promoted; help-overlay close expanded to 44×44. PASS.
- `revisit-modal-states.html` — 3 disabled buttons migrated to canonical token pairs. PASS (except the missing `aria-disabled` on L461 — B1).
- `revisit-unit-list.html` — 2 read-only pills fixed. PASS.

The narrow QGs:
- QG1 `opacity-(50\|70)` repo-wide → 0 hits. PASS.
- QG2 `bg-stone-200 text-stone-500` + `disabled:opacity-50` repo-wide → 0 hits. PASS.
- Type-scale `text-[9px]\|text-[10px]` repo-wide → 0 hits. PASS.

---

## Recommended remediation plan for bolt 2

1. Apply B2: for every `.html` file in `stages/design/artifacts/`, replace `dark:text-stone-500` with `dark:text-stone-300` and replace bare `text-stone-500` (no `dark:` partner) with `text-stone-600 dark:text-stone-300`. Spot-check that bg-surface is `stone-950/900/800` or white/stone-50/stone-100 where the promotion is appropriate. Skip only cases already on a bg ≥ stone-200 where the ratio already passes.
2. Apply B1: add `aria-disabled="true"` to the 4 specific buttons (review-ui-mockup L136, L153, L856; revisit-modal-states L461). Re-run the Python walker and confirm 0.
3. Apply B3: remove `opacity-60` from stage-strip buttons, from the closed/rejected JS-dim literal, from the 9 `revisit-unit-list.html` locked-card sites, and from the collapsed-card preview in `comment-to-feedback-flow.html:966`. Where a surface lift is needed (locked cards), apply the tokens §6.3 already specifies.
4. Apply B5: promote the 🔒 lock glyph in revisit-unit-list.html to at least `dark:text-stone-400`.
5. Re-run the full QG sweep in §6.4.2 plus the two new gates:
   - `grep -rEn 'dark:text-stone-500' stages/design/artifacts/*.html` → should be 0.
   - Repo-wide Python `<button disabled>` aria-disabled walker → should be 0.
6. Update `contrast-and-type-audit.md` §6.2 + §6.3 + §6.4 to cite the actual post-remediation counts, not aspirational ones. If the audit prose gets ahead of the artifacts again, we're back to the same state the unit was created to fix.

---

## Accessibility gaps (summary against design-reviewer checklist)

- WCAG 1.4.3 (Contrast Minimum): FAIL. B2 `dark:text-stone-500` offenders render at 2.36:1 on `bg-stone-950`.
- WCAG 1.4.11 (Non-Text Contrast): PASS for disabled-button borders in the 4 remediated files; not re-verified in the unresolved sibling files.
- WCAG 2.5.5 (Target Size): PASS for the 2 buttons the bolt expanded (popover close, help-overlay close). No regressions detected.
- WCAG 4.1.2 (Name/Role/Value): PARTIAL FAIL — B1 (4 disabled buttons missing `aria-disabled`). Screen readers may not announce "dimmed" on the stage-strip upcoming buttons.
- Token usage: PASS where the bolt touched files; FAIL in the un-swept files per B2 + B3. No raw hex values outside the Tailwind palette.

Reject. Bolt 2 should address B1–B5 and bring the audit prose back in alignment with the actual artifact state.
