---
title: >-
  review-ui-mockup.html 3 live opacity-60 + stage-btn has no focus-visible —
  FB-94 falsely closed
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T17:51:45Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

`review-ui-mockup.html` still ships three `opacity-60` violations that `contrast-and-type-audit.md §6.2 / §4 Bolt-4` claims were remediated, AND the same `.stage-btn` buttons strip the default focus outline without replacing it with a focus-visible ring.

**Live opacity-60 violations (grep verified 2026-04-20):**

- `review-ui-mockup.html:136` — `<button type="button" data-stage="operations" data-disabled="true" class="stage-btn group w-full flex flex-col items-center focus:outline-none opacity-60 cursor-not-allowed" disabled aria-label="Operations — not yet started">`
- `review-ui-mockup.html:153` — same pattern for Security stage button.
- `review-ui-mockup.html:790` — inside the rendering JS: `const dim = (f.status === 'closed' || f.status === 'rejected') ? 'opacity-60' : '';`. Applies `opacity-60` to the root of every closed/rejected feedback card at runtime.

**Contrast impact:**

- Stage buttons (136/153): `<span>` labels "Operations" / "Security" use `text-stone-500 dark:text-stone-400` (marginal at 4.61:1 light on white full opacity). `opacity: 0.6` α-composites the label below the 4.5:1 AA floor. `disabled` + `aria-label` already carry "upcoming"; killing label legibility is not the right way to communicate it.
- Line 790 `${dim}`: every closed/rejected feedback card gets its subtree (title `text-stone-900`, body, metadata) α-composited at 60%. Audit explicitly called out that closed/rejected should use muted-surface backgrounds (`bg-green-50/60` / `bg-stone-100`), not subtree opacity.

**Additional violation — stage-btn has no focus-visible ring (WCAG 2.4.7):**

- Lines 66, 83, 100, 118, 136, 153 carry `focus:outline-none` on `.stage-btn` with no `focus-visible:` class.
- The companion `<style>` block (~lines 1923–1936) defines `.stage-btn .stage-icon { outline: 0 solid transparent; }` and only applies a `3px solid sky-400` outline when the button has `.stage-active` — that's a **selection indicator** (set by `setActiveStage()`), not a focus indicator. A keyboard user tabbing through the stage strip gets zero visible focus affordance.
- Direct WCAG 2.4.7 Focus Visible Level AA failure.

**Disabled-without-aria-disabled (same file, WCAG 4.1.2):**

- Lines 136, 153 carry native `disabled` but no `aria-disabled="true"` — contradicts audit §4 Bolt-4 row 5 which claims both attributes were paired.
- Line 856 (dynamic "Add feedback above to enable" button) also has native `disabled` with no `aria-disabled="true"`.

**Fix required:**

1. Drop `opacity-60 cursor-not-allowed` from Operations/Security buttons (136, 153); keep `disabled`; add `aria-disabled="true"`. The `<span>` label needs to lift from `text-stone-500` to `text-stone-600 dark:text-stone-300` so AA is met at full opacity.
2. Rewrite the `dim` JS at line 790 to emit status-aware muted-background token classes (`bg-green-50/60 dark:bg-green-950/25` for closed; `bg-stone-100 dark:bg-stone-800/50` for rejected) and keep the text subtree at full opacity — exactly what audit §4 Bolt-4 row 8 claims was done.
3. Add a canonical focus-visible ring to `.stage-btn` — Tailwind (`focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`) or CSS (`.stage-btn:focus-visible { outline: 2px solid rgb(20 184 166); outline-offset: 2px; border-radius: 4px; }` matching `stage-progress-strip.html` line 39).
4. Pair `disabled` with `aria-disabled="true"` on line 856.
5. After fix: `grep -En 'opacity-60' review-ui-mockup.html` → 0 hits; `grep -E 'stage-btn' review-ui-mockup.html | grep -v focus-visible` → 0 hits for buttons without focus-visible; aria-disabled walker returns 0 for this file.

**WCAG refs:** 1.4.3 Contrast (Minimum); 2.4.7 Focus Visible; 4.1.2 Name, Role, Value.
