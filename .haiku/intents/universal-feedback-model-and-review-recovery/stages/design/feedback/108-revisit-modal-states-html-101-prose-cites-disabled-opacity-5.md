---
title: >-
  revisit-modal-states.html:101 prose cites disabled:opacity-50 as canonical —
  contradicts ban
status: open
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:31:08Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

`revisit-modal-states.html:101` documents the modal's disabled pattern as `disabled:opacity-50`:

```html
<p class="text-xs text-stone-500 dark:text-stone-400 font-mono">disabled:opacity-50</p>
```

This prose canonicalizes the banned pattern in the artifact's own reference text. Anyone reading this file for token guidance will adopt `disabled:opacity-50` on modal buttons, which unit-11 / unit-18 explicitly banned because `opacity-50` α-composited against any background drops text contrast below AA.

This also directly contradicts `contrast-and-type-audit.md §4 Bolt-4 row 1` which claims that the disabled Confirm & Revisit button was rewritten to:

> `bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 cursor-not-allowed` + `aria-disabled="true"` | 5.30:1 light / 8.15:1 dark (text) · PASS

The button markup WAS rewritten; the documentation prose that explains the pattern was not. So the artifact now has two inconsistent stories: the rendered button uses the canonical tokens, but the reference strip tells readers the disabled treatment is `disabled:opacity-50`.

**Fix required:** Rewrite line 101 to describe the canonical disabled token pair:

```html
<p class="text-xs text-stone-500 dark:text-stone-400 font-mono">
  disabled: bg-amber-300 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 + aria-disabled="true"
</p>
```

And add a short inline note that `opacity-*` utilities on disabled controls are banned stage-wide.

**Why this is an accessibility issue, not just a doc drift:**

If this spec/reference text ever gets copy-pasted into dev-stage implementation code, the `disabled:opacity-50` class makes it back into real UI and re-creates the contrast failure the audit claims is closed. The spec has to match the ban for the ban to hold.

**WCAG refs:** downstream 1.4.3 Contrast (Minimum) via spec drift.
