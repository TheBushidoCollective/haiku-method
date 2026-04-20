---
title: >-
  Unit-16 FB-50 regression: hyphenated "Re-open" still in
  contrast-and-type-audit.md
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:26:35Z'
iteration: 4
visit: 4
source_ref: null
closed_by: unit-28-canonical-token-normalization-sweep
---

Unit-16 gate 7 (FB-50) requires the hyphenated `Re-open` to be replaced with the canonical one-word `Reopen` (per DESIGN-BRIEF §2 Footer Button Copy Matrix and unit-14 canonical copy). Gate command: `grep -rn 'Re-open' stages/design/artifacts/ stages/design/DESIGN-BRIEF.md knowledge/DESIGN-TOKENS.md` MUST return 0.

Current state — hyphenated `Re-open` still appears in `stages/design/artifacts/contrast-and-type-audit.md`:

- Line 255: `| feedback-card-states.html · "Re-open" (disabled, light) | ...`
- Line 256: `| feedback-card-states.html · "Re-open" (disabled, dark) | ...`

The audit table rows reference the button by its old hyphenated label. Per DESIGN-BRIEF §2 Footer Button Copy table, the banned variants include "any hyphenated spelling of the reopen verb". Leaving hyphenated spelling in the audit table will re-seed the label into dev-stage implementation.

Fix: rewrite both table rows to use `"Reopen"` (no hyphen). Post-fix verification: `grep -n 'Re-open' stages/design/artifacts/contrast-and-type-audit.md` returns 0. Stage-wide: `grep -rn 'Re-open' stages/design/artifacts/ stages/design/DESIGN-BRIEF.md knowledge/DESIGN-TOKENS.md | grep -v 'stages/design/feedback/' | grep -v 'stages/design/units/'` returns 0 (feedback + unit docs legitimately quote the historical drift in their bodies).
