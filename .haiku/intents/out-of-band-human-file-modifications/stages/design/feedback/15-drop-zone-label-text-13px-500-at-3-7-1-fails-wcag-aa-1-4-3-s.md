---
title: >-
  Drop-zone label text (13px/500) at ~3.7:1 fails WCAG AA 1.4.3 — spec §4.4
  misclassifies threshold as 3:1
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-28T21:59:48Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-15:bolt-1'
bolt: 1
triaged_at: '2026-04-28T21:59:48Z'
resolution: null
replies: []
---

## Finding

Both wireframes render the drop-zone call-to-action label ("drop files or click to browse", "Drop to stage", "drop a file matching {mime}") using `--color-upload-affordance-fg` (`oklch(62% 0.14 185)`, teal-500 family) against a transparent-over-white background.

**Files and lines affected:**
- `wireframes/knowledge-upload.html` — `.drop-zone-label { font-size: 13px; font-weight: 500; color: var(--color-upload-affordance-fg); }` (line 239–243). Used at lines 473, 509, 543, 613, 665, 733.
- `wireframes/replacement-affordance.html` — `.dz-label { font-size: 13px; font-weight: 500; color: var(--color-upload-affordance-fg); }` (line 420). Used at lines 737, 890.

## Why this fails WCAG AA

The spec's own §4.4 table lists the measured ratio as **~3.7:1** and classifies the threshold as **"3:1 (large text / UI component)"**, then marks it as PASS. This classification is incorrect on two counts:

1. **Text is not a "UI component" for WCAG purposes.** WCAG 1.4.11 (Non-text Contrast, 3:1 threshold) applies to the graphical *boundaries* of UI components — not to text rendered inside them. Text labels, regardless of where they appear, are governed by WCAG 1.4.3 (Contrast Minimum).

2. **13px/500 is not "large text."** WCAG defines large text as ≥18pt (24px) regular weight, or ≥14pt (18.67px) bold (700+). At 13px and font-weight 500 ("medium"), this is normal text. The 4.5:1 threshold applies.

**3.7:1 < 4.5:1 → FAILS WCAG AA 1.4.3 for the drop-zone text label.**

The spec footnote ("exact ratios must be verified at development stage") does not resolve this — the spec has pre-documented ~3.7:1 and the wireframes implement exactly that. Implementation will inherit the failure.

## Remediation

**Option A (preferred):** Darken `--color-upload-affordance-fg` to `oklch(48% 0.16 185)` (teal-700 family), which yields approximately 5.2:1 against white, satisfying 4.5:1. This requires updating:
- `--color-upload-affordance-fg` in both wireframes
- `knowledge/DESIGN-TOKENS.md §1.3.4` token definition
- `SPA-UI-SPECS.md §4.4` table row for "Upload affordance text" (correct ratio and threshold)

**Option B:** Accept as known non-conformance with explicit documented decision (cannot remain silent).

Note: the hover and dragover backgrounds (`color-mix` at 8–15% teal opacity) will have slightly less contrast than the resting state; all must be re-verified after the token change.
