---
title: >-
  review-ui-mockup.html:136/153 stage-strip still opacity-60, line 790 still
  opacity-60 on fb-card — 1.4.3 FAIL
status: open
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T09:27:22Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

`review-ui-mockup.html` still ships three `opacity-60` violations that `contrast-and-type-audit.md §6.2 / §4 Bolt-4` claims were remediated.

**Live violations (grep verified 2026-04-19):**

- `review-ui-mockup.html:136` — `<button type="button" data-stage="operations" data-disabled="true" class="stage-btn group w-full flex flex-col items-center focus:outline-none opacity-60 cursor-not-allowed" disabled aria-label="Operations — not yet started">` — audit §4 Bolt-4 row 5 claims `opacity-60` was dropped; still present.
- `review-ui-mockup.html:153` — same pattern for Security stage button.
- `review-ui-mockup.html:790` — `const dim = (f.status === 'closed' || f.status === 'rejected') ? 'opacity-60' : '';` — audit §4 Bolt-4 row 8 claims this was replaced with status-aware muted background tokens (`bg-green-50/60 dark:bg-green-950/25` for closed; `bg-stone-100 dark:bg-stone-800/50` for rejected). The replacement has not happened — the runtime JS still applies `opacity-60` to the card root whenever status is closed or rejected.

**Impact:**

- Stage buttons at 136/153: the `<span>` labels "Operations" / "Security" use `text-stone-500 dark:text-stone-400` — already marginal at full opacity on white (4.61:1 light), and `opacity: 0.6` composites it below the 4.5:1 AA floor. Disabled intent is correctly announced via `disabled` + `aria-label`; killing legibility of the label is not a valid way to communicate "upcoming."
- Line 790 `${dim}`: every closed / rejected feedback card in the rendered mockup gets its entire subtree (title, body, metadata) α-composited at 60%. The title is `text-stone-900 dark:text-stone-100` — 0.6 α collapses it well below AA body-text threshold.

**Also in the same file:**

- The `.stage-btn` buttons at lines 66, 83, 100, 118, 136, 153 use `focus:outline-none` with NO `focus-visible:` ring. The companion `<style>` block (lines 1923-1936) defines `.stage-btn .stage-icon { outline: 0 solid transparent; ... }` and only applies a `3px solid sky-400` outline when `.stage-active` — that's a **selection indicator**, not a focus indicator. Keyboard users tabbing through stages get no focus visibility at all. This is a direct WCAG 2.4.7 Focus Visible failure.

**Fix required:**

1. Drop `opacity-60 cursor-not-allowed` from the Operations/Security stage buttons (136, 153); keep `disabled aria-disabled="true"`; the labels already pass AA at full opacity.
2. Rewrite the `dim` JS at line 790 to use muted-background tokens per the audit's canonical mapping (`bg-green-50/60` / `bg-stone-100` for closed/rejected) and keep the text subtree at full opacity.
3. Add a canonical focus-visible ring to `.stage-btn` — either a Tailwind class pattern (`focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900`) or a CSS rule `.stage-btn:focus-visible { outline: 3px solid rgb(20 184 166); outline-offset: 3px; }`.

**WCAG refs:** 1.4.3 Contrast (Minimum); 2.4.7 Focus Visible.
