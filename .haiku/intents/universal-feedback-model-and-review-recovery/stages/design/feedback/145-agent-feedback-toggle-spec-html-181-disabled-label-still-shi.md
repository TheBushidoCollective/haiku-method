---
title: >-
  agent-feedback-toggle-spec.html:181 disabled label still ships opacity-50
  wrapper — 1.4.3 FAIL
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:52:32Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

`agent-feedback-toggle-spec.html` — the canonical spec for the AgentFeedbackToggle switch — ships its OWN disabled-state example with the banned `opacity-50` wrapper pattern and a caption using `text-stone-500` on what ends up being a `dark:text-stone-500` background. Contradicts `contrast-and-type-audit.md §4 Bolt-4` row 4 which claims this artifact was remediated.

**Live violations (grep verified 2026-04-20):**

- `agent-feedback-toggle-spec.html:181` — `<label class="af-touch inline-flex items-center gap-2 cursor-not-allowed opacity-50">` wrapping the disabled switch + label text. Audit §4 Bolt-4 row 4 explicitly claims this was fixed: "remove `opacity-50` from wrapper; muted the switch track + thumb via `bg-gray-200/bg-gray-700` + `border-gray-400/gray-500`; lifted label text from `text-gray-500` to `text-gray-700 dark:text-gray-300`." None of that rewrite landed.
- `agent-feedback-toggle-spec.html:195` — `<p class="text-xs text-stone-500 dark:text-stone-500 mt-2">disabled + aria-disabled="true"; opacity-50; track muted stone-200; cursor-not-allowed; still reaches 3:1 contrast for non-text UI (WCAG 1.4.11)</p>`
  - This reference caption is (a) using `text-stone-500 dark:text-stone-500` which fails 4.5:1 on the dark surface (`text-stone-500` on `bg-stone-900` = 4.55:1 at the floor; on the actual `bg-stone-800` card used here it drops below AA) AND (b) canonicalizes `opacity-50` as the standard disabled treatment in prose — the exact pattern unit-11 / unit-18 banned.

**Contrast math for the caption:**

- Light: `text-stone-500` (#78716c) on the card surface (`bg-white` or `bg-stone-50`) → 4.40–4.61:1 — at the floor; FB-18 added the audit row explicitly stating `text-stone-500` on `bg-stone-100`/any muted surface is banned.
- Dark: `text-stone-500` on `bg-stone-900` = 4.55:1. When the card uses `bg-stone-800` (the typical card raised surface), the ratio drops to ~3.5:1 — FAIL AA body text.

**Contrast math for the wrapper opacity-50:**

- Opacity-50 on a `<label>` with full-opacity text children α-composites the entire subtree. The disabled-state label text children (e.g. "Show agent feedback") visually read at ≈2:1 against the card surface — FAIL AA.

**Also problematic — prose itself:**

- The caption claims "still reaches 3:1 contrast for non-text UI (WCAG 1.4.11)" while the wrapper is `opacity-50`. The artifact documents its own violation AS IF canonical. Anyone copy-pasting this into dev ships the failure.

**Fix required:**

1. Remove `opacity-50` from the `<label>` at line 181. Replace the disabled affordance with:
   - `bg-stone-200 dark:bg-stone-700` on the switch track (muted, not opacity-reduced).
   - `border-stone-400 dark:border-stone-500` for the 3:1 non-text contrast against the card surface.
   - Full-opacity `text-stone-700 dark:text-stone-300` on the label text and caption.
2. Rewrite line 195 to:
   - Cite the canonical disabled token pair (not `opacity-50`).
   - Raise the text color from `text-stone-500 dark:text-stone-500` to `text-stone-600 dark:text-stone-300` so the caption meets AA everywhere the card is shown.
3. Re-open FB-97 (same line called out and marked closed without the fix) and re-audit the whole file for FB-63's broader agent-feedback-toggle-spec compliance.
4. After fix: `grep -En 'opacity-50' agent-feedback-toggle-spec.html` → 0 hits on rendered markup.

**WCAG refs:** 1.4.3 Contrast (Minimum); 1.4.11 Non-Text Contrast; 4.1.2 Name, Role, Value (disabled state must be announced via `aria-disabled` paired with `disabled`, not communicated purely by α-composite).
