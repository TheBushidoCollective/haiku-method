---
title: >-
  comment-to-feedback-flow.html:966 still opacity-60 on card root with
  text-stone-500 child — 1.4.3 FAIL
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:28:52Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

`comment-to-feedback-flow.html:966` still ships a "collapsed card preview" with `opacity-60` on the root AND `text-stone-500` text inside, which the `contrast-and-type-audit.md §6.3` bolt-3 table (line 499) claims was remediated.

**Live violation (grep verified 2026-04-19):**

```html
<!-- comment-to-feedback-flow.html:966 -->
<div class="border-l-[3px] border-l-amber-400 p-2 rounded-lg bg-amber-950/20 border border-stone-700 opacity-60">
  <p class="text-xs text-stone-500 truncate">Header alignment off...</p>
</div>
```

**Contrast math:**

- Background: `bg-amber-950/20` composited against a dark page bg (the section is nested inside `bg-stone-800/50` parents and the overall page is `class="dark"` above) yields roughly `#2a1a0a` effective color.
- Foreground: `text-stone-500` (#78716c).
- Before opacity: `#78716c` on `#2a1a0a` ≈ 3.3:1 — already below 1.4.3 AA body-text ≥ 4.5:1.
- After `opacity: 0.6` applied to the root: the text α-composites with the parent background, dropping contrast to ≈ 2.0:1 — solidly failing WCAG 1.4.3.

**What the audit claims vs. what's in the file:**

Audit §6.3 row 4 says:

> "comment-to-feedback-flow.html:962 · collapsed card preview | `border-l-[3px] border-l-amber-400 p-2 rounded-lg bg-amber-950/20 border border-gray-700 opacity-60` with `text-[9px] text-gray-400` child | removed `opacity-60`; lifted child text from `text-[9px] text-gray-400` to `text-xs text-stone-300`; inline HTML comment explains the bolt-3 fix | text 10.5:1+ on `bg-amber-950/20` α-composited surface · PASS 1.4.3 + unit-11 typography floor (12px minimum)"

In reality:

- `opacity-60` is still on the card root.
- The child text is `text-stone-500` (the `text-[9px] text-gray-400` was replaced with `text-xs text-stone-500`, not `text-stone-300`). Text size was lifted to `text-xs` (✓, satisfies typography floor) but text color is insufficient.
- The text is legibly broken despite the size fix.

**Fix required:** Remove `opacity-60` from the card root. Change the `<p>` color from `text-stone-500` to `text-stone-300` (as the audit already prescribes). Then verify the ≥ 4.5:1 ratio on the α-composited amber-950/20 surface.

**WCAG refs:** 1.4.3 Contrast (Minimum).
