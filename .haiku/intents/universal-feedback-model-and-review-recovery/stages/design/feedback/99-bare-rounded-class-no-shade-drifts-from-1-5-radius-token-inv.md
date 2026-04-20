---
title: >-
  Bare `rounded` class (no shade) drifts from §1.5 radius token inventory —
  inconsistent card/button corner radii
status: open
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:28:30Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

DESIGN-TOKENS.md §1.5 "Border & Radius Tokens" enumerates every valid radius token: `rounded-xl` (cards, modal overlay), `rounded-full` (badges, pins, progress track), `rounded-lg` (buttons primary, inputs/textareas full, tooltips, image embeds), `rounded-md` (buttons secondary, inputs compact). **Bare `rounded` (no shade — Tailwind's default 0.25rem / equivalent to `rounded-sm`) is not in the inventory.**

DESIGN-BRIEF §2 Component Patterns also uses only `rounded-xl`, `rounded-full`, `rounded-lg` — never bare `rounded`.

Current state — bare `rounded` is used extensively in feedback-card-states.html on footer-button elements and status-pill spans:

- `feedback-card-states.html:58-67` — footer table cells: `<span class="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 text-stone-700 ...">` (7 occurrences in the status-transition matrix table).
- `feedback-card-states.html:95,114,132,133,151,152,171,190,210,211` — every pending/addressed/closed/rejected footer button uses `rounded` (no shade) instead of the canonical `rounded-lg` (primary) / `rounded-md` (secondary) per §1.5.

Dev-stage React will inherit the wrong radius on every card footer button. The design-system target is either `rounded-lg` (primary) or `rounded-md` (secondary) per DESIGN-TOKENS.md §1.5 — 0.5rem or 0.375rem, NOT 0.25rem.

Because bare `rounded` is the Tailwind default and there's no rule that surfaces the drift via grep, the inconsistency compounds silently.

Fix: sweep `feedback-card-states.html` for every bare `rounded\b` (not followed by `-xl`, `-lg`, `-md`, `-full`, `-sm`, `-2xl`) and replace with the correct token per DESIGN-TOKENS §1.5:

- Status-pill spans (in the status-transition matrix table L58-67): `rounded-full` (matches badge pattern in §1.5 + DESIGN-BRIEF §2 badge base class).
- Footer buttons (Dismiss, Reopen, Verify & Close): `rounded-md` (secondary button radius per §1.5) — consistent with the primary/secondary size class on the same button (`text-[11px] font-semibold px-2 py-1`).

Post-fix gate: `grep -rEn '\brounded\b(?!-)' stages/design/artifacts/feedback-card-states.html` returns 0. Stage-wide check: `grep -rEn 'class="[^"]*\brounded\b(?!-)' stages/design/artifacts/*.html` returns 0 — every rounded class carries an explicit shade matching DESIGN-TOKENS §1.5.
