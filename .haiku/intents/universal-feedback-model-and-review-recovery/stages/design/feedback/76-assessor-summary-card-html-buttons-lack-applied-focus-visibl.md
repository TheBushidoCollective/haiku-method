---
title: >-
  assessor-summary-card.html buttons lack applied focus-visible ring despite
  prose claim at line 275
status: closed
origin: adversarial-review
author: accessibility
author_type: agent
created_at: '2026-04-20T02:57:11Z'
iteration: 3
visit: 3
source_ref: null
closed_by: unit-23-focus-visible-and-activable-element-semantics
---

`assessor-summary-card.html:275` declares in prose: *"focus ring — `focus:ring-2 focus:ring-teal-500` on any interactive element (view details button, per-item rows)."* But the actual buttons in the artifact ship with **zero** `focus-visible:ring-*` or `focus:ring-*` classes. Verification:

```
grep -cE 'focus-visible:ring-2|focus:ring-2' stages/design/artifacts/assessor-summary-card.html
→ 0 (only the prose-level mention exists, not applied to any element)
```

**Affected buttons (checked interactive elements):**
- `L83`: `<button class="text-xs font-medium px-2 py-1 rounded-md bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 transition-colors">view details</button>` — no focus styles, no outline, will inherit browser default (which `focus-ring-spec.html §1` explicitly removes via `.focus:not(:focus-visible)` rule).
- `L123`: light-mode "view details" — same issue.
- `L236`: dark-mode "view log" — same issue.
- `L259`: light-mode "view log" — same issue.

**Failure modes:**
1. Keyboard users cannot tell where focus is. WCAG 2.4.7 Focus Visible, Level AA.
2. Contradicts the claim in `focus-ring-spec.html` that *every* interactive surface inherits the canonical 2px teal-500/teal-400 ring.
3. The prose description makes this look fixed when audit greps against the prose (it says "focus:ring-2 focus:ring-teal-500"), but greps that exclude prose (`grep -E 'class="[^"]*focus-visible:ring-2'`) show zero actual applications.

**Fix:** Add `focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900` to every `<button>` in the artifact. Confirm via:
```
grep -cE 'class="[^"]*focus-visible:ring-2' stages/design/artifacts/assessor-summary-card.html
```
should return ≥ 4 (one per button in light + dark states across the variants shown).
