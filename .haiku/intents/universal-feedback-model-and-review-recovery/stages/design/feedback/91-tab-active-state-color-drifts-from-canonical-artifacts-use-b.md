---
title: >-
  Tab active-state color drifts from canonical: artifacts use blue-600,
  DESIGN-BRIEF §2 says teal-600
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:26:51Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-28-canonical-token-normalization-sweep
---

DESIGN-BRIEF §2 "Design Language Reference > Component Patterns" declares the canonical tab-active pattern:

> - **Tab active**: `border-b-2 border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400`

This matches the SPA's teal accent. The review-app's primary accent is teal-600 per the color palette table (§Accent primary). Blue is reserved for `addressed` status and server-rendered templates (§DESIGN-TOKENS §1.1 SSR subsection), not for the SPA tab-active state.

Current state — every tab-strip in design artifacts uses `border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400` instead of the canonical teal:

- `stages/design/artifacts/feedback-inline-desktop.html:113` — desktop Overview/Units/Knowledge tablist, active tab is blue.
- `stages/design/artifacts/feedback-inline-mobile.html:118` — mobile Overview/Units/Knowledge tablist, active tab is blue.

Stage-wide grep confirms the drift: `grep -rEn 'border-teal-600 text-teal-600' stages/design/artifacts/` returns 0 matches — no artifact renders the canonical teal-active tab anywhere.

This is a component-pattern-language violation. Dev-stage React will wire blue-active tabs and the review app will ship with a visually inconsistent accent (teal everywhere except tabs).

Fix: sweep every tab-strip in `feedback-inline-desktop.html`, `feedback-inline-mobile.html`, and any other artifact that renders role=tablist, replacing `border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400` with the canonical `border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400` from DESIGN-BRIEF §2.

Post-fix gate: `grep -rEn 'border-blue-600 text-blue-600|role="tab"[^>]*border-blue' stages/design/artifacts/` returns 0; `grep -rEn 'border-teal-600 text-teal-600' stages/design/artifacts/` returns ≥ 2 (one per feedback-inline variant).
