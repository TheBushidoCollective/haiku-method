---
title: >-
  FB-88 closure is false: `max-w-[1400px]` magic-number still live on 2 sites in
  assessor-summary-card.html
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T17:48:06Z'
iteration: 5
visit: 5
source_ref: null
closed_by: null
bolt: 0
upstream_stage: null
---

DESIGN-BRIEF §4 mandates `max-w-page` (backed by `--max-page-width` CSS variable per DESIGN-TOKENS.md §1.3) as the canonical page-width utility — no raw px-magic-number max-widths. Gate: `grep -rn 'max-w-\[1400px\]' stages/design/artifacts/` MUST return 0.

FB-88 closed-by marker cites `unit-28-canonical-token-normalization-sweep` but `stages/design/units/` contains no unit-28 file (the units directory stops at `unit-25`). The rewrite never ran.

Current violations (stage-wide grep returns 2 matches):
- `stages/design/artifacts/assessor-summary-card.html:15` — header wrapper: `class="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between"`
- `stages/design/artifacts/assessor-summary-card.html:24` — main wrapper: `<main class="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-8">`

These two wrappers render every time the `AssessorSummaryCard` spec renders, so the drift is not dormant — it's on the canonical assessor-summary-card spec referenced by DESIGN-BRIEF §6 (FB-62) and the state-coverage grid §7.10.

Fix: replace both with `max-w-page` (same utility `feedback-inline-desktop.html:105`, `rollback-reason-banner.html:20/29` already use). Post-fix verification command: `grep -rn 'max-w-\[1400px\]' stages/design/artifacts/` → 0 hits. Additionally, reopen FB-88 with a real `closed_by` pointer to a unit that actually exists and executed.
