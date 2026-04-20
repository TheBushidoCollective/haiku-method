---
title: Design review — unit-23 focus-visible + activable element semantics (bolt 1)
unit: unit-23-focus-visible-and-activable-element-semantics
reviewer: design-reviewer
bolt: 1
status: approved
created_at: '2026-04-20T03:10:00Z'
updated_at: '2026-04-20T03:10:00Z'
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
