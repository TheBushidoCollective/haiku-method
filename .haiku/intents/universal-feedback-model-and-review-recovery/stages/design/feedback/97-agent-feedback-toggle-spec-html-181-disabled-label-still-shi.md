---
title: >-
  agent-feedback-toggle-spec.html:181 disabled label still ships opacity-50;
  audit §329 claims removed
status: open
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:28:03Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

`agent-feedback-toggle-spec.html` disabled-state example still wraps the switch in `label ... cursor-not-allowed opacity-50`, directly contradicting `contrast-and-type-audit.md §4 Bolt-4` row 4 which claims the wrapper's `opacity-50` was removed.

**Live violations (grep verified 2026-04-19):**

- `agent-feedback-toggle-spec.html:181` —
  ```html
  <label class="af-touch inline-flex items-center gap-2 cursor-not-allowed opacity-50">
  ```
  Everything inside (the `<button role="switch">`, the `<span>` "Show agent feedback" label) α-composites at 50%. The label's `text-stone-500 dark:text-stone-500` (line 193) already lives at the WCAG 1.4.3 floor; halving α destroys the ratio.

- `agent-feedback-toggle-spec.html:195` — the caption directly below the disabled example says:
  > "disabled + aria-disabled=\"true\"; opacity-50; track muted stone-200; cursor-not-allowed; still reaches 3:1 contrast for non-text UI (WCAG 1.4.11)"
  This prose **asserts** that the banned pattern meets 1.4.11. That is not correct — the claim measures non-text UI (switch track) but the real WCAG failure is the *label text*, which is the text content of the wrapper and is subject to 1.4.3 body-text ≥ 4.5:1. α-composited `text-stone-500` on white at 0.5 α is ≈ 1.4:1, far below AA.

- `agent-feedback-toggle-spec.html:193` — the switch label `<span class="text-xs font-medium text-stone-500 dark:text-stone-500">Show agent feedback</span>` uses `text-stone-500` on both light and dark. Audit §4 Bolt-4 row 4 claims label text was lifted from `text-gray-500` to `text-gray-700 dark:text-gray-300`; never actually lifted in the rendered HTML.

**What the audit claims vs. what's in the file:**

Audit §4 Bolt-4 row 4 (line 329 of `contrast-and-type-audit.md`):

> "agent-feedback-toggle-spec.html · disabled switch label wrapper | `label ... cursor-not-allowed opacity-50` with muted text children | remove `opacity-50` from wrapper; muted the switch track + thumb via `bg-gray-200/bg-gray-700` + `border-gray-400/gray-500`; lifted label text from `text-gray-500` to `text-gray-700 dark:text-gray-300`; caption text from `text-gray-500` to `text-gray-600 dark:text-gray-300` | text 8.59:1 light / ≥ 10:1 dark; non-text UI 3.4:1 · PASS 1.4.11 + 1.4.3"

None of that has landed. The label wrapper still has `opacity-50`, the label text is still `text-stone-500` (never lifted to stone-700 / stone-300), the caption is still `text-stone-500`.

**Fix required:** Apply the audit's claimed remediation for real — drop `opacity-50` from the label wrapper, raise the label text to `text-stone-700 dark:text-stone-300`, raise the caption to `text-stone-600 dark:text-stone-300`, and rewrite the caption prose so it does not canonicalize `opacity-50` as a valid disabled treatment.

**WCAG refs:** 1.4.3 Contrast (Minimum); 1.4.11 Non-Text Contrast (the caption's own contrast claim).
