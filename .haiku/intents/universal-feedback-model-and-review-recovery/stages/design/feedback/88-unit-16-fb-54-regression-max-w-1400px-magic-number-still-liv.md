---
title: >-
  Unit-16 FB-54 regression: `max-w-[1400px]` magic number still live in
  assessor-summary-card.html
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T09:26:11Z'
iteration: 4
visit: 4
source_ref: null
closed_by: null
---

Unit-16 gate 9 (FB-54) requires `max-w-[1400px]` to be replaced with the tokenized `max-w-page` utility (backed by the `--max-page-width` CSS variable defined in DESIGN-TOKENS.md §1.3). The gate command: `grep -rn 'max-w-\[1400px\]' stages/design/artifacts/` MUST return 0.

Current state:
- `stages/design/artifacts/assessor-summary-card.html:15` — header wrapper uses `class="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between"`.
- `stages/design/artifacts/assessor-summary-card.html:24` — main wrapper uses `<main class="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-8">`.

Both are raw magic-number max-width declarations, not named tokens. This fails the consistency mandate that "all spacing…values reference named tokens — no raw hex, px, or magic numbers."

Fix: replace both occurrences with `max-w-page` (same utility used in `feedback-inline-desktop.html:105`). Once fixed, re-verify `grep -rn 'max-w-\[1400px\]' stages/design/artifacts/` returns 0 stage-wide.
