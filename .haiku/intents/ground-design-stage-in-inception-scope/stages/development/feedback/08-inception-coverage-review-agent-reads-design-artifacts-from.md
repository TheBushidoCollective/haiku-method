---
title: inception-coverage review agent reads design artifacts from wrong paths
status: pending
origin: adversarial-review
author: completeness (from product)
author_type: agent
created_at: '2026-04-28T23:53:16Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-04-28T23:53:16Z'
resolution: null
replies: []
---

## Finding

`plugin/studios/software/stages/design/review-agents/inception-coverage.md` (lines 33-36) instructs the review agent to read design outputs from:

1. `.haiku/intents/{slug}/stages/design/artifacts/`
2. `.haiku/intents/{slug}/stages/design/DESIGN-BRIEF.md`

Both paths are wrong based on the actual workflow artifact locations:

- **DESIGN-BRIEF.md** is a discovery template artifact. Its `location:` field in `plugin/studios/software/stages/design/discovery/DESIGN-BRIEF.md` resolves to `.haiku/intents/{intent-slug}/knowledge/DESIGN-BRIEF.md` — the intent-level knowledge dir, not `stages/design/DESIGN-BRIEF.md`.
- **Design artifacts** (mockups, HTML, PNGs) are written by the designer hat to `stages/design/artifacts/` — this path may be correct if the intent-slug prefix is implied. But the agent prompt uses `{slug}` not `{intent-slug}`, making it unclear which variable convention applies.

## User-facing impact

The review agent reads `stages/design/DESIGN-BRIEF.md` and finds nothing (file does not exist at that path). It also misses the primary design brief artifact entirely. Without the design brief, the agent cannot assess whether UI surfaces are covered — it audits mockups only, missing the surface-level coverage that the brief defines. This silently breaks the entire surface-gap detection capability added by unit-02.

## Missing scenarios

- **DESIGN-BRIEF.md present at intent knowledge dir**: agent must read `knowledge/DESIGN-BRIEF.md` — not specified.
- **DESIGN-TOKENS.md present**: the designer hat reads `knowledge/DESIGN-TOKENS.md`; the review agent should also consider it when assessing whether design tokens match inception constraints. Not mentioned.
- **No design artifacts produced yet** (review fires before any artifacts exist): no defined behavior — agent could emit false surface-gap findings or crash.

## Required fix

In `plugin/studios/software/stages/design/review-agents/inception-coverage.md`, Step 3, change:

> - `.haiku/intents/{slug}/stages/design/DESIGN-BRIEF.md`

to:

> - `.haiku/intents/{slug}/knowledge/DESIGN-BRIEF.md` — the design brief is a knowledge-dir artifact per the DESIGN-BRIEF discovery template's `location:` field

Also add an explicit short-circuit for the case where no design artifacts exist yet:

> "If neither the `artifacts/` dir nor the `knowledge/DESIGN-BRIEF.md` file is present, emit a single info-severity note ('No design artifacts found — coverage audit skipped') and return cleanly."
