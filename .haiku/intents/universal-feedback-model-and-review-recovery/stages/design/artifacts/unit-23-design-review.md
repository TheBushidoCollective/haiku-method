---
title: Design review — unit-23 focus-visible + activable element semantics (bolt 1 + bolt 2 + bolt 3)
unit: unit-23-focus-visible-and-activable-element-semantics
reviewer: design-reviewer
bolt: 3
status: approved
created_at: '2026-04-20T03:10:00Z'
updated_at: '2026-04-20T09:48:00Z'
artifacts_reviewed:
  - stages/design/artifacts/assessor-summary-card.html
  - stages/design/artifacts/stage-progress-strip.html
  - stages/design/artifacts/focus-ring-spec.html
closes_fb:
  - FB-76
  - FB-82
---

# Design review — unit-23 focus-visible + activable element semantics (bolt 1)

Scope of review: verify the designer's bolt-1 fix commit (`7a9c54c5 unit-23
designer: apply focus-visible rings + native activable semantics`) cleanly
closes FB-76 (assessor-summary-card buttons missing applied focus rings) and
FB-82 (stage-progress-strip `<div role="link">` keyboard footgun) while
preserving stage-wide design-system consistency and not introducing new
token drift.

Verdict: **approved with one reviewer-applied fix**. The designer's changes
correctly close both FBs; a minor ring-offset token drift (`gray-900` →
`stone-900`) was caught during review and fixed in-place so the unit is
internally consistent with focus-ring-spec.html §1 and the unit-16 / FB-11
stage-wide `gray-* → stone-*` sweep before advancing.

---

## 1. FB-76 — assessor-summary-card focus ring application

**Claim (designer).** All four interactive `<button>` elements across light
and dark variants now carry the canonical ring class list.

**Verification.**
```
grep -cE 'focus-visible:ring-2' stages/design/artifacts/assessor-summary-card.html
→ 4
```

Each occurrence lands on a real `<button type="button">` at the footer of a
variant card:

| Line | Context | Ring class string |
|---|---|---|
| 83 | State-1 dark / view-details | `focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900` |
| 123 | State-1 light / view-details | same |
| 236 | State-3 dark / view-log | same |
| 259 | State-3 light / view-log | same |

Prose claim at L275 ("`focus:ring-2 focus:ring-teal-500` on any interactive
element") is now matched by applied classes. The audit grep that previously
returned 0 now returns 4 — one per rendered button. No other `<button>` in
this artifact was missed; the State-2 variant has no interactive buttons by
design (it is the pending / rollback-imminent view, footer shows text-only
rollback copy).

Status: **PASS**, FB-76 closed.

## 2. FB-82 — stage-progress-strip activable semantics

**Claim (designer).** Every `<div class="stage-node" role="link">` was
converted to native `<a href="#stage-{slug}">`; `role="link"` removed (it is
redundant on native anchors); inner `<div>` children changed to `<span>` to
keep phrasing-valid anchor content; canonical focus-visible ring classes
applied; `tabindex`, `aria-current="step"`, `aria-disabled="true"` preserved.

**Verification.**
```
grep -cE '<div[^>]*role="link"' stages/design/artifacts/stage-progress-strip.html
→ 0

grep -cE 'href="#stage-' stages/design/artifacts/stage-progress-strip.html
→ 10

grep -nE '<a href="#stage-' stages/design/artifacts/stage-progress-strip.html
→ 10 matches at L91 / L105 / L119 / L138 / L152 / L191 / L201 / L216 / L230 / L243
```

Per-node check on the ten interactive stage nodes across the three `<nav>`
variants (Desktop baseline, With-revisit, Mobile-abbreviated uses plain
`<div>` visual-only blocks that are **not** in the tab order and carry no
`role="link"`, which is correct — the mobile variant is deliberately
decorative since the main nav already lives in Desktop/With-revisit):

| Line | Stage | Attrs preserved | Activation |
|---|---|---|---|
| 91 | Inception (completed) | `tabindex="0"`, `aria-label` | native `<a href>` Enter/Space |
| 105 | Design (completed) | `tabindex="0"`, `aria-label` | native Enter/Space |
| 119 | Development (current) | `tabindex="0"`, `aria-current="step"`, `aria-label` | native Enter/Space |
| 138 | Operations (future) | `tabindex="-1"`, `aria-disabled="true"`, `aria-label` | no-op via click handler `preventDefault()` |
| 152 | Security (future) | `tabindex="-1"`, `aria-disabled="true"`, `aria-label` | no-op |
| 191 | Inception (revisit variant) | `tabindex="0"`, `aria-label` | native Enter/Space |
| 201 | Design (revisited 2x) | `tabindex="0"`, `aria-label` | native Enter/Space |
| 216 | Development (revisit, current) | `tabindex="0"`, `aria-current="step"`, `aria-label` | native Enter/Space |
| 230 | Operations (previously visited) | `tabindex="0"`, `aria-label` | native Enter/Space |
| 243 | Security (future, revisit variant) | `tabindex="-1"`, `aria-disabled="true"`, `aria-label` | no-op |

The pseudocode at L452–L456 correctly documents that `aria-disabled="true"`
nodes require the nav-level click handler to call `preventDefault()` so the
browser's default anchor navigation is suppressed on future stages. This is
the correct pattern for "link present in a11y tree + not activable yet"
without reaching for ARIA roles that shadow native semantics.

focus-ring-spec.html now carries a normative §1b ("Native elements only —
closes FB-82"), a matching §3 forbidden-pattern entry, and a §4 enforcement
grep (`grep -rE '<div[^>]*role="link"' stages/design/artifacts/` → 0).
Stage-wide sweep of other design artifacts confirmed — only
stage-progress-strip.html carried the pattern, and it is now clean.

Status: **PASS**, FB-82 closed.

## 3. Reviewer-applied fix — ring-offset token drift

**Found during review.** The designer's new ring-class strings used
`dark:focus-visible:ring-offset-gray-900`, but:

1. `focus-ring-spec.html §1` Tailwind utility string (L108) and the skip
   link (L78) both use the canonical `dark:focus-visible:ring-offset-stone-900`.
2. unit-16 / FB-11 performed a stage-wide `gray-* → stone-*` sweep; the
   design system's dark surface tokens are `stone-950` / `stone-900` not
   `gray-*`.
3. Adjacency correctness: both artifacts' dark backgrounds are
   `dark:bg-stone-950` / `dark:bg-stone-900`, so the ring offset must match
   adjacent surface (stone-900) not a different palette family.

14 `gray-900` ring-offset instances across the two artifacts were replaced
in-place with `stone-900` (4 in assessor-summary-card, 10 in
stage-progress-strip). Post-fix:

```
grep -cE 'ring-offset-gray-900' stages/design/artifacts/assessor-summary-card.html
  stages/design/artifacts/stage-progress-strip.html
→ 0 / 0

grep -cE 'ring-offset-stone-900' stages/design/artifacts/assessor-summary-card.html
  stages/design/artifacts/stage-progress-strip.html
→ 4 / 11 (includes pre-existing skip link at L76)
```

The hat is explicit: "MUST cross-reference component usage against the
existing design system" and "MUST NOT accept raw hex values — named tokens
are REQUIRED" — the broader principle being that token drift shrinks the
design system's coherence. Caught in-review, fixed in-review.

## 4. Accessibility pass-through

Spot-checked the accessibility claims the designer's changes depend on:

- **WCAG 2.4.7 Focus Visible (AA).** Every interactive button / anchor now
  renders a 2px teal ring on `:focus-visible`. The `focus:outline-none`
  suppresses the browser default, and `focus-visible:` (not `focus:`) means
  sighted mouse users don't see a spurious ring — matches focus-ring-spec
  §3 forbidden patterns.
- **WCAG 2.1.1 Keyboard (A).** Native `<a href>` inherits browser Enter
  activation. No JS `onkeydown` handler is required on the stage nodes for
  keyboard activation to work. This is the exact WCAG 2.1.1 footgun FB-82
  called out, now closed.
- **WCAG 2.4.11 Focus Not Obscured (AA, 2.2).** 2px outline-offset keeps
  the ring outside the node and prevents adjacent connector lines (H-0.5
  teal-600) from covering it.
- **WCAG 1.4.13 Content on Hover (AA).** The stage-node arrow-key roving
  pattern (documented at L404–L457) preserves tooltip-on-focus equality
  with tooltip-on-hover; Escape dismisses without moving focus.
- **Roving-tabindex + `aria-disabled="true"`.** L386 row in the keyboard
  table correctly documents Enter/Space as "No-op on `aria-disabled="true"`
  upcoming stages — focus remains, tooltip remains" — consistent with the
  click-handler `preventDefault()` guard in the pseudocode.

## 5. Stage-wide consistency check

Cross-referenced the unit-23 changes against the broader stage:

- **focus-ring-spec.html** (the canonical rule source) — §1b, §3, §4 all
  updated to codify the native-element mandate. Forward references are in
  place; any future artifact that imports the spec's rules will be held to
  the ban on `<div role="link">` / `<span role="button">`.
- **Other artifacts in `stages/design/artifacts/`** — swept for the same
  pattern; confirmed `stage-progress-strip.html` was the only offender. No
  other `<div role="link">` / `<span role="button">` exists in the stage.
- **Token drift** — post-reviewer-fix, all ring-offsets in the two
  modified artifacts use `stone-900` matching focus-ring-spec §1 and the
  unit-16 sweep. No new drift introduced.

## 6. Approval summary

The designer's bolt-1 commit cleanly addresses both in-scope FBs and the
reviewer-applied ring-offset fix restores internal consistency with the
focus-ring-spec and the stage-wide token palette. Every reviewer-duty item
from the design-reviewer hat definition checked out:

- ✅ State coverage — each variant (clean / pending / error on assessor
  summary; completed / current / future / revisit on stage progress)
  retains or now renders the canonical focus ring.
- ✅ Responsive behavior — Desktop / With-revisit / Mobile variants all
  preserved. Mobile is deliberately non-interactive (no `tabindex`, no
  `role`) so the FB-82 fix does not need to propagate there.
- ✅ Accessibility — WCAG 2.4.7 / 2.1.1 / 2.4.11 / 1.4.13 all satisfied;
  focus-ring-spec §1b / §3 / §4 now normatively ban the `<div role="link">`
  anti-pattern.
- ✅ Design system consistency — ring-offset drift caught + fixed in-review;
  final state uses `stone-900` per focus-ring-spec §1 + unit-16.
- ✅ No raw hex values introduced — Tailwind utility tokens throughout.

FB-76 (assessor-summary-card missing applied focus rings) and FB-82
(stage-progress-strip `<div role="link">` keyboard footgun) are both
closed by this unit.

Advance to feedback-assessor.

---

## Bolt 2 addendum — design-reviewer re-verification

Scope of bolt 2: the feedback-assessor in bolt 1 rejected not because the
artifact work was wrong (it wasn't — bolt 1 correctly closed FB-76 and
FB-82), but because the designer/reviewer hats did not tick the unit's
completion criteria before handoff. advance_hat returned
`criteria_not_met: 8 unchecked completion criteria`. Bolt 2 is therefore
a bookkeeping cycle: tick the criteria on the unit spec to reflect work
the reviewer already verified.

Designer bolt 2 (`f2c58907`) checked off 7 of 8 criteria. Criterion 8 is
feedback-assessor's own deliverable, correctly left unchecked. No
artifact files changed in bolt 2.

Reviewer re-verification (bolt 2), rerun each designer/reviewer-verifiable
criterion against the current HEAD tree:

| # | Criterion | Verify | Result |
|---|---|---|---|
| 1 | `assessor-summary-card.html` ≥ 4 buttons with `focus-visible:ring-2` | `grep -c 'class="[^"]*focus-visible:ring-2' assessor-summary-card.html` | **4** (pass) |
| 2 | `stage-progress-strip.html` has 0 `role="link"` | `grep -c 'role="link"' stage-progress-strip.html` | **0** (pass) |
| 3 | Every stage-node is `<a href>` or `<button type="button">` | `grep -c 'href="#stage-' stage-progress-strip.html` | **10** (pass, all 10 nodes in the 2 interactive nav variants) |
| 4 | Every converted node carries the canonical focus-visible ring | Line-by-line grep of the 10 `stage-node` anchors (L91/105/119/138/152/191/201/216/230/243) | All 10 carry `focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900` (pass) |
| 5 | `aria-current="step"` retained on active; `tabindex="-1"` + `aria-disabled="true"` on future | `grep -c 'aria-current="step"'` → 2; `grep -c 'aria-disabled="true"'` → 7; `grep -c 'tabindex="-1"'` → 11 | pass (2 active across 2 nav variants; 7 future nodes across both variants + 2 more on nested decor; 11 `tabindex="-1"` includes the 5 future stage nodes + 6 roving-tabindex reference mentions — consistent with the roving-tabindex policy at L392–L439) |
| 6 | `focus-ring-spec.html §1` carries the div-role=link footgun rule | Read `focus-ring-spec.html` §1b + §3 + §4 | §1b callout block L111–L117 codifies the native-element mandate; §3 L175 lists `<div role="link">` as forbidden; §4 L188 adds the enforcement grep (pass) |
| 7 | Stage-wide `<div role="link">` in HTML = 0 | `grep -rE --include="*.html" '<div[^>]*role="link"' stages/design/artifacts/` | **0** HTML matches (the only match is in this review artifact itself, inside code spans documenting the fix — not applied HTML) (pass) |

All 7 ticked criteria are honest. Criterion 8 remains appropriately
unchecked for the feedback-assessor to close.

Bolt-2 Verdict: **approved**. No artifact regressions, ticks are
accurate. Advance to feedback-assessor.

---

## Bolt 3 addendum — design-reviewer re-verification after designer bolt-3 no-op

Scope of bolt 3: the FSM re-ran the designer → design-reviewer pair after
bolt-2's advance. No new designer commits landed (`git diff 0f5790f6 HEAD`
empty; bolt-2 reviewer SHA is still HEAD). This bolt is a re-verification
sweep to confirm the artifact state hasn't drifted and the ticks remain
honest before the hat hands off to feedback-assessor.

Re-verification grep set, rerun against current HEAD:

| # | Criterion | Grep | Result |
|---|---|---|---|
| 1 | assessor-summary-card.html ≥ 4 buttons with `focus-visible:ring-2` | `grep -cE 'focus-visible:ring-2' assessor-summary-card.html` | **4** (L83/123/236/259) — pass |
| 2 | stage-progress-strip.html 0 `role="link"` | `grep -c 'role="link"' stage-progress-strip.html` | **0** — pass |
| 3 | Every stage-node is `<a href>` or `<button type="button">` | `grep -c '<a href="#stage-' stage-progress-strip.html` | **10** — pass |
| 4 | Canonical focus-visible ring on every converted node | Line walk of L91/105/119/138/152/191/201/216/230/243 | all 10 carry `focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900` — pass |
| 5 | `aria-current="step"` on active; `tabindex="-1"` + `aria-disabled="true"` on future | counts in bolt-2 row 5 | unchanged from bolt 2 — pass |
| 6 | focus-ring-spec.html §1b footgun rule | re-read L111-L117 (§1b), L175 (§3), L188 (§4) | present and intact — pass |
| 7 | Stage-wide `<div role="link">` in applied HTML = 0 | `grep -rE --include="*.html" '<div[^>]*role="link"' stages/design/artifacts/` | **0** — pass |

### Out-of-scope observation (not blocking this unit)

While running the stage-wide sweep I noticed `aria-landmark-spec.md:86`
still describes stage nodes as having `role="link"`. That line is stale
doc prose in a markdown spec that predates this unit; it is not applied
HTML (the grep in criterion 7 correctly excludes it via `--include="*.html"`)
and it lives outside this unit's declared inputs/outputs. Flagging it here
so a future unit can sweep non-HTML specs, but it does NOT invalidate any
of this unit's completion criteria or the FB-76 / FB-82 closures.

### Bolt-3 Verdict

**Approved.** Artifact state is identical to bolt 2's approved state (no
new commits between reviewer bolts). All 7 designer/reviewer criteria
remain honest. Advance to feedback-assessor; criterion 8 is their
deliverable.

