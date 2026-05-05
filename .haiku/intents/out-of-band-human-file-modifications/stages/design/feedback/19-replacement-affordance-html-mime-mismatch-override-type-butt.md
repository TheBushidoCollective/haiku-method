---
title: >-
  replacement-affordance.html: mime mismatch "override type" button missing
  focus ring, touch-target, inside aria-live
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-28T22:00:52Z'
iteration: 2
visit: 2
source_ref: null
closed_by: 'fix-loop:FB-19:bolt-1'
bolt: 1
triaged_at: '2026-04-28T22:00:52Z'
resolution: null
replies: []
---

## Finding

In the mime-mismatch state of the Replace modal (`wireframes/replacement-affordance.html`, line 810), an interactive `<button>` is embedded directly inside the `role="alert"` + `aria-live="assertive"` mime-warning region:

```html
<div class="mime-warning" role="alert" aria-live="assertive">
  <span>...Pick a matching file, or
    <button style="background:none;border:none;cursor:pointer;color:var(--accent-review);font-size:12px;padding:0;text-decoration:underline;">
      override type ▾
    </button>
  </span>
</div>
```

**Three accessibility failures:**

### 1. No focus indicator (WCAG 2.4.7)

The button has only unconditional inline styles — no `:focus-visible` CSS rule. Keyboard users tabbing to this control will see no visible focus ring. Every other interactive element in this wireframe has an explicit `focus-visible` outline rule; this one was missed because it was inlined inside a live region.

### 2. No touch target (spec §4.2)

No `.touch-target` or `.touch-target--hit-area` class applied. The visual hit area is approximately the text width ("override type ▾" ≈ 80×16px), far below the 44×44px minimum required by spec §4.2 and §2.10 for all interactive elements at ≤768px.

### 3. Interactive element inside aria-live="assertive" (ARIA anti-pattern)

ARIA 1.2 guidance warns against embedding interactive elements in live regions. When the assertive region is re-announced (e.g. on file change), screen readers interrupt and re-read the entire region including the button label. On VoiceOver (iOS) and NVDA, interactive controls nested inside `role="alert"` may be unreachable via keyboard and announced inconsistently.

## Remediation

1. Move the "override type" `<button>` **outside** the `role="alert"` div — as a sibling element immediately below the mime-warning.
2. Add `:focus-visible` rule: `outline: 3px solid var(--focus-ring-color); outline-offset: 2px;`.
3. Apply `.touch-target.touch-target--hit-area` to expand the tap area to ≥44×44px.
4. Update spec §2.5 / §2.6 to document: live region = status text only; action button = sibling element outside the live region.
