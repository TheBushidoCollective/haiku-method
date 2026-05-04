---
title: >-
  ⋯ button aria-label diverges: DESIGN-BRIEF uses "Output actions for" but
  SPA-UI-SPECS uses "More options for"
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-28T20:25:32Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-06:bolt-3'
bolt: 3
triaged_at: '2026-04-28T20:25:32Z'
resolution: null
replies: []
---

## Finding

The `⋯` menu button's required `aria-label` format is inconsistent across the two authoritative spec documents:

- **DESIGN-BRIEF.md line 292 (Screen 2, Accessibility):** `aria-label="Output actions for ${name}"`
- **SPA-UI-SPECS.md §2.4 line 176 and §2.6 line 239:** `aria-label="More options for {artifact-name}"`

The wireframe (`wireframes/replacement-affordance.html` line 558–562) uses the SPA-UI-SPECS value: `"More options for hero-mockup.html"`.

## Why this matters

This is a named interactive element's primary screen-reader label. The two strings differ in meaning:
- "Output actions" signals the category of actions available (replacements, downloads — output-specific).
- "More options" is generic — the same label pattern used on every overflow menu in the web ecosystem.

Developers will ship inconsistent labels depending on which spec they follow. More critically, "More options" does not satisfy SPA-UI-SPECS §2.4's rationale ("Without the interpolated `aria-label`, screen readers announce only 'button' with no context"), yet "More options for hero-mockup.html" also provides context. The semantic difference — whether the button is scoped to "output actions" or "options in general" — is non-trivial for screen-reader users understanding what controls are available on an artifact card.

## Affected files

- `stages/design/DESIGN-BRIEF.md` line 292 (Screen 2 accessibility section)
- `stages/design/artifacts/SPA-UI-SPECS.md` §2.4 and §2.6

## Correct behavior

SPA-UI-SPECS.md §0 is authoritative; it should explicitly resolve this conflict and specify the exact format string. Whichever string is chosen, DESIGN-BRIEF.md must be updated to match. Both documents should reference the same mandatory string to avoid implementation divergence.
