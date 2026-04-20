---
title: >-
  DESIGN-BRIEF §7 CSS block ships opacity: 0.7 / 0.5 that the same doc
  explicitly bans in §2
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T02:56:04Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

`DESIGN-BRIEF.md` is internally contradictory about full-card opacity on closed/rejected feedback items. The document bans the pattern and then ships the banned pattern 20 sections later.

**§2 "Banned Text-on-Surface Pairs" (lines 137-138):**

| Foreground | Forbidden backgrounds | Reason |
|---|---|---|
| `opacity-70` on closed card root | any | α-composite over already-muted metadata text drops to ~2:1 |
| `opacity-50` on rejected card root | any | α-composite makes strikethrough + metadata text unreadable |

And §2 `FeedbackItem` "Interaction states" (lines 273-274) reinforces it:

> **Status: closed**: … **Do NOT apply `opacity-70`** — the opacity composite collapses metadata-text contrast below AA.
> **Status: rejected**: … **Do NOT apply `opacity-50`** — the strikethrough itself becomes invisible under 50% opacity.

**§7 "CSS Additions" (lines 749-763) — in the same file:**

```css
.feedback-item-closed {
  border-left: 2px solid #4ade80; /* green-400 */
  opacity: 0.7;          ← banned above
}
.feedback-item-rejected {
  opacity: 0.5;          ← banned above
}
.feedback-item-rejected .feedback-title {
  text-decoration: line-through;
}
```

These are the exact two values the earlier sections forbid, on the exact two card-root selectors they forbid them on. The §7 block also ships two raw hex values (`#60a5fa`, `#4ade80`) in the same CSS fragment, which violates the mandate's "no raw hex" rule and the unit-16 gate.

**Recommended fix:** delete the `opacity: 0.7` and `opacity: 0.5` declarations from the `.feedback-item-closed` and `.feedback-item-rejected` rules. Replace with the §2 remediation already specified (`bg-green-50/60` + "Closed ·" prefix + ✓ glyph; `bg-stone-100` + "Rejected ·" prefix + full-opacity strikethrough). Replace the two inline `#60a5fa` / `#4ade80` values with CSS-var tokens defined in `DESIGN-TOKENS.md §1.8` or Tailwind `var(--color-blue-400)` / `var(--color-green-400)` references. Re-run unit-16 gates until hex count is 0.
