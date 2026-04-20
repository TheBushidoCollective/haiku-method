---
title: >-
  feedback-inline-mobile dialog open/close handlers narrate aria-hidden+inert in
  comments — not actually wired
status: pending
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:58:34Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

`feedback-inline-mobile.html` describes the mobile bottom-sheet modal pattern but only *comments* the critical accessibility behavior, leaving the markup without an actual implementation hook that dev can copy.

**Location:** `stages/design/artifacts/feedback-inline-mobile.html:117`
```html
<button id="feedback-fab" …
  onclick="document.getElementById('feedback-sheet').classList.remove('hidden');
           this.setAttribute('aria-expanded','true');
           /* dev stage: on open, also set main#main-content aria-hidden=true + inert,
              then move focus to #sheet-first-tab via focus-trap library */">
```

And again at `L159`:
```html
onclick="var s=document.getElementById('feedback-sheet');s.classList.add('hidden');
         document.getElementById('feedback-fab').setAttribute('aria-expanded','false');
         document.getElementById('feedback-fab').focus();
         /* dev stage: also remove aria-hidden+inert from main + header */"
```

**Why this is an accessibility problem, not just a todo:**

1. `aria-landmark-spec.md §3.7` mandates: *"When a dialog is open, all other landmarks receive `aria-hidden="true"` **and** the `inert` attribute so assistive tech does not traverse background content."* The artifact DOES declare the dialog (`role="dialog" aria-modal="true"` at L147–L149) but the inert/aria-hidden apparatus is left as a comment.

2. Screen-reader users opening the sheet will currently (as the markup ships) still hear the entire underlying review page read out through the dialog — every tab, every heading, every stage-strip link — because the main content is not `inert` and does not have `aria-hidden="true"`. This defeats the purpose of `aria-modal="true"`.

3. **`aria-modal="true"` alone is NOT enough.** Safari/VoiceOver respects it; NVDA + JAWS on Windows respect it inconsistently, especially with virtual cursor. The belt-and-suspenders fix is the inert + aria-hidden pair, which the spec correctly mandates — it just isn't wired here.

4. The `focus-trap-react` library the spec references is called out in a comment but the artifact doesn't emit the marker attribute (`data-focus-trap`) or the `<FocusTrap>` wrapper pattern. Dev stage will ship an unwrapped dialog unless the handoff artifact is more explicit.

**Fix (wireframe-level; actual React wiring is dev-stage work):**

1. Move the narrative from `/* dev stage: … */` comments into a first-class `<script>` block at the bottom of the artifact that runs on sheet open/close and actually sets `document.getElementById('main-content').inert = true; document.getElementById('main-content').setAttribute('aria-hidden','true')` (same for `<header>`), and reverses on close.

2. Add a visible note in the artifact's HTML head comment pointing at `aria-landmark-spec.md §3.7` so the dev-stage hand-off inherits the contract, not the comment.

3. Add a matching verification step to the unit-19 completion criteria:
   ```
   grep -nE 'main.*\.inert|setAttribute\(.aria-hidden' feedback-inline-mobile.html
   ```
   should hit both the open handler and the close handler.
