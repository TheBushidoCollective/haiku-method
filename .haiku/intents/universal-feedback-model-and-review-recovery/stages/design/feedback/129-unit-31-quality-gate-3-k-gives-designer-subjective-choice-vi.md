---
title: >-
  unit-31 quality gate 3 (k) gives designer subjective choice — violates
  falsifiability standard
status: closed
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T15:34:14Z'
iteration: 5
visit: 5
source_ref: stages/design/units/unit-31-contrast-and-type-scale-fixes.md
closed_by: unit-31-contrast-and-type-scale-fixes
bolt: 0
upstream_stage: null
---

`stages/design/units/unit-31-contrast-and-type-scale-fixes.md` quality gate 3 item (k) (line 71-75):

> "(k) `review-package-structure.html:545, 666, 697, 725, 767, 805, 839, 870` eight code-block rows either lifted from `text-[11px]` to `text-xs font-mono` OR paired with `font-semibold` (designer's call per readability of each specific block; mixing is fine as long as the §3 rule — every `text-[11px]` pairs with `font-semibold` or `font-bold` — holds)."

"Designer's call" is an unfalsifiable criterion. An adversarial reviewer cannot confirm closure by grep; the gate passes regardless of what the designer chose as long as the broader `font-semibold`/`font-bold` pairing rule holds (which IS falsifiable via the one-liner at line 80-85).

This is soft consistency risk — the §3 one-liner does cover the fallback rule so the broader rule is still enforced. But the "either / or" choice with "designer's call" means two designers reading the same unit could land different class strings, reintroducing the consistency drift FB-105 exists to close.

Proposed fix: pick one canonical treatment per line and name it explicitly, OR rewrite the gate to defer to the fallback grep:

**Option A (recommended)** — commit to one treatment per line:

> "(k) `review-package-structure.html:545, 666, 697, 725, 767, 805, 839, 870` — all eight code-block rows lifted to `text-xs font-mono`. (The `text-xs` floor removes the 11px-specific weight requirement entirely; `font-mono` preserves the monospace treatment that distinguishes code blocks from prose.)"

**Option B** — if the designer truly needs discretion, rewrite the rule to explicitly allow both forms and drop the "designer's call" language:

> "(k) `review-package-structure.html:545, 666, 697, 725, 767, 805, 839, 870` — each of the eight code-block rows must satisfy ONE of: (i) `text-xs font-mono`, OR (ii) `text-[11px] font-semibold font-mono`. The §3 one-liner at line 80-85 verifies the choice is valid."

Option A is cleaner because it yields a single grep-verifiable class string per line instead of a per-line disjunction.
