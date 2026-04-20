---
title: >-
  `text-[11px]` paired with font-medium/font-mono/italic/no-weight violates §2
  Typography Floor across 8 artifacts
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:50:28Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

DESIGN-BRIEF §2 "Typography Floor" mandates: "`text-[11px]` is permitted ONLY when paired with `font-semibold` or `font-bold`." State-coverage-grid §3 gives the same rule, and `contrast-and-type-audit.md §3` adds "Remaining `text-[11px]` instances are ALL paired with `font-semibold` or `font-bold`".

Live stage-wide grep (`grep -rEn 'text-\[11px\]' stages/design/artifacts/*.html | grep -vE 'font-semibold|font-bold'`) returns 40+ violations across 8 artifacts where `text-[11px]` is paired with `font-medium` / `font-mono` / `italic` / no weight at all — NOT the mandated `semibold`/`bold`.

Sampled violations:

- `annotation-gesture-spec.html:111` — inline code pill, `text-[11px] font-mono` (no `semibold`).
- `feedback-lifecycle-transitions.html:226` — `text-[11px] text-stone-500 dark:text-stone-400 italic` (italic, no weight).
- `focus-ring-spec.html:108` — `text-[11px] text-stone-700 dark:text-stone-300 break-all` (no weight).
- `keyboard-shortcut-map.html:546, 635` — footer text at `text-[11px] text-stone-500` (no weight).
- `review-package-structure.html:545, 666, 697, 725, 767, 802, 805, 839, 870` — 9 sites at `text-[11px]` with no weight or `font-mono` only.
- `review-ui-mockup.html:43, 146, 163, 802, 1019, 1055, 1087, 1094, 1102, 1285, 1332, 1496, 1532, 1568, 1696` — 15+ sites, mostly `text-[11px] font-mono` or `text-[11px] font-medium` or bare.
- `revisit-modal-states.html:49, 444, 506, 537, 547, 588, 634` — modal-states-artifact footers / inline code at bare or `font-mono` `text-[11px]`.
- `rollback-reason-banner.html:55, 60, 65, ...` — monospaced-code `text-[11px] font-mono` in table cells without `semibold`.

The `font-semibold`/`font-bold` requirement exists because the heavier stroke width compensates for the smaller glyph size — `font-mono` doesn't (it's a family, not a weight), `font-medium` is one notch too light, `italic` is orthogonal, and a bare class fails the rule outright.

This fails consistency in two dimensions:
1. Cross-artifact drift — `comments-list-with-agent-toggle.html` already uses `text-[11px] font-semibold` uniformly; these 8 files don't.
2. Accessibility — WCAG 1.4.4 Resize Text at 200% zoom fails on 11px regular-weight glyphs (the type audit calls this out explicitly).

Fix options per site:
- For code pills / monospace labels: pair `font-mono` with `font-semibold` (→ `text-[11px] font-mono font-semibold`) OR lift to `text-xs font-mono` if the visual weight needs to stay light.
- For italic footer callouts: lift to `text-xs italic` (12px floor preserves readability without needing the weight).
- For bare `text-[11px]` prose: either pair with `font-semibold` or lift to `text-xs`.

Post-fix gate: `grep -rEn 'text-\[11px\]' stages/design/artifacts/*.html | grep -vE 'font-semibold|font-bold'` → 0 matches. This gate belongs in the design-reviewer's grep list alongside the existing `text-\[9px\]` / `text-\[10px\]` bans.
