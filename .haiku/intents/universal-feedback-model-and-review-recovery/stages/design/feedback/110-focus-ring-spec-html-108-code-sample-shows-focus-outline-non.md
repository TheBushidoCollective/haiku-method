---
title: >-
  focus-ring-spec.html:108 code sample shows focus:outline-none without
  focus-visible context — misleads devs
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:31:50Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-29-focus-visible-canonicalization-and-spec-clarity
---

`focus-ring-spec.html:108` displays the canonical focus-ring pattern as a code sample, and the sample ends with `focus:outline-none`:

```html
<code class="text-[11px] text-stone-700 dark:text-stone-300 break-all">focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900 focus:outline-none</code>
```

The intent is clear (suppress default outline + provide custom focus-visible ring), but as a reference doc the sample is ambiguous enough that it has ALREADY been misapplied: `review-ui-mockup.html:66, 83, 100, 118, 136, 153` uses only `focus:outline-none` without the `focus-visible:ring-*` companion classes (see FB-107).

This spec is supposed to be the canonical source for "how to style focus" — if it's being misread, it needs to be clarified.

Also: the code sample itself is `text-[11px]` without `font-semibold`, which violates the type-scale floor from `contrast-and-type-audit.md §3` (see FB-105).

**Fix required:**

1. Split the code sample into two labeled sections so the pattern is unmistakable:
   ```
   Canonical focus ring (use on EVERY interactive element):
     focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900

   Outline suppression (optional; pair with the ring above, not standalone):
     focus:outline-none
   ```

2. Add a "What NOT to do" example:
   ```
   DON'T: focus:outline-none  (no replacement ring — WCAG 2.4.7 FAIL)
   DO: focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ...
   ```

3. Lift the code-sample class from `text-[11px]` to `text-xs` so the spec doesn't violate its own sibling spec's typography floor.

**Why this matters:** The spec is the load-bearing reference dev-stage reads when implementing focus indicators. Ambiguous code samples cascade into real a11y failures downstream. See FB-107 for the cascade that already happened.

**WCAG refs:** 2.4.7 Focus Visible (Level AA) — via spec ambiguity driving downstream failures.
