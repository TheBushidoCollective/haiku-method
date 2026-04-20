---
title: >-
  FB-99 closure is false: bare `rounded` class (no shade) still live on 10+
  feedback-card-states.html buttons / pills
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:49:02Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

DESIGN-TOKENS.md §1.5 "Border & Radius Tokens" enumerates the only valid radii: `rounded-xl`, `rounded-full`, `rounded-lg`, `rounded-md`, `rounded-sm`. Bare `rounded` (Tailwind's 0.25rem default) is NOT in the inventory. DESIGN-BRIEF §2 "Component Patterns" uses only `rounded-xl`/`rounded-full`/`rounded-lg` in every pattern row.

FB-99 is marked `status: closed` with `closed_by: unit-28-canonical-token-normalization-sweep`, but unit-28 does not exist on disk. The sweep never ran.

Current state — `grep -rEn 'class="[^"]*\brounded\b[^-]' stages/design/artifacts/feedback-card-states.html` returns 10+ live sites. Sampling:

- Status-transition matrix cells (L53, 58, 63, 68): `<span class="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 text-stone-700 ...">` → should be `rounded-full` per DESIGN-BRIEF §2 Badge pattern.
- Footer buttons (L95 Dismiss, L114 Dismiss, L132/151/171 Reopen, L133/152 Verify & Close, L190/210/211 and the Verify & Close button): `<button class="text-[11px] font-semibold px-2 py-1 rounded border border-stone-300 ...">` → should be `rounded-md` (secondary) or `rounded-lg` (primary) per DESIGN-TOKENS.md §1.5.

Effect on dev stage: every footer-button radius silently defaults to 0.25rem instead of the design-system-canonical 0.375rem (secondary) or 0.5rem (primary). This compounds across every rendered `FeedbackCard` in the review UI.

Fix: sweep `feedback-card-states.html` — replace every `\brounded\b(?!-)` with the correct token:
- Status-pill spans in the transition matrix table: `rounded-full`.
- Secondary footer buttons (Dismiss, Reopen): `rounded-md`.
- Primary footer button (Verify & Close): `rounded-md` (matches the `feedback-inline-desktop.html` / `feedback-inline-mobile.html` sister artifacts which already use `rounded-md` on the same button).

Verification: `grep -cEn 'class="[^"]*\brounded\b[^-]' stages/design/artifacts/feedback-card-states.html` → 0. Stage-wide gate: `grep -rEn 'class="[^"]*\brounded\b[^-]"' stages/design/artifacts/*.html` → 0. Reopen FB-99 with a valid `closed_by` pointer.
