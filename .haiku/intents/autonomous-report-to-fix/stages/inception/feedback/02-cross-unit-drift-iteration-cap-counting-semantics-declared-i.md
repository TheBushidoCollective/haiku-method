---
title: >-
  Cross-unit drift: iteration-cap counting semantics declared in unit-01/06,
  still open in unit-05
status: pending
origin: adversarial-review
author: spec-conformance
author_type: agent
created_at: '2026-05-05T23:10:29Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-05T23:10:29Z'
resolution: null
replies: []
---

## Spec criterion violated

The "Bounded loops — caps and escape hatches" criterion in unit-01 requires the artifact to "describe the user-observable behavior when the limit is reached" and to flag the cap value as an open question for product/design. unit-06's job is to consolidate open questions across artifacts and assign each a proposed default or escalation flag — coherently, not contradictorily.

## What the artifacts actually say

**unit-01** (`.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md` line 55):

> Each "attempt" is one webhook-triggered agent invocation that pushes at least one commit. After 5 attempts without all CI checks passing...

**unit-06** (`.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md` line 20):

> Each webhook-triggered agent invocation that pushes at least one commit counts as one attempt. When that count reaches the cap, the bot posts a "gave up" comment...

Both unit-01 and unit-06 explicitly fix the counting unit as "webhook-triggered invocation that pushes at least one commit."

**unit-05** (`.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md` line 99, in Open Questions):

> **Iteration Cap Counting Unit Ambiguity** — The unbounded fix-loop cost risk (above) is rated high, but the exact severity depends on what is counted as an "attempt" for cap purposes. If the cap counts successful commits (not total invocations), a fix agent that makes many API calls without producing a commit does not consume cap budget — but can still burn significant token cost. The counting semantics are a design decision; the risk severity may need to be revisited after the design stage resolves this.

unit-05 treats the counting semantics as still-open, with an explicit note that "the risk severity may need to be revisited after the design stage resolves this."

## Why this is intent-level, not per-unit

The three artifacts cannot all be right. Either:

1. The counting unit IS fixed by inception (units 01 and 06's reading), in which case unit-05's "Iteration Cap Counting Unit Ambiguity" open question is stale and the high-severity rating on "Unbounded Fix-Loop Cost" stands without further revisitation; OR
2. The counting unit is NOT fixed by inception (unit-05's reading), in which case units 01 and 06 are over-reaching by stating the counting rule as a proposed default rather than flagging it as needing design-stage resolution.

Downstream stages (product, design, operations) consume all three artifacts as a single coherent spec. Today they will find a counting rule asserted as the proposed default and an open question saying that counting rule is undecided — that's a self-contradiction the inception bundle is supposed to eliminate, not surface.

The cross-unit fix is one of:

- Strike the "pushes at least one commit" definition from units 01 and 06 (rephrase the cap as just "after N attempts the bot stops"), keep unit-05's open question intact, let design-stage resolve.
- Keep units 01 and 06's counting rule, strike unit-05's open question (move it to "resolved by inception, see unit-01"), revise unit-05's severity assessment caveat.

## File references

- `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/success-criteria-and-acceptance-shape.md:55`
- `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/open-questions-with-defaults.md:20`
- `.haiku/intents/autonomous-report-to-fix/stages/inception/artifacts/risk-inventory.md:99`
