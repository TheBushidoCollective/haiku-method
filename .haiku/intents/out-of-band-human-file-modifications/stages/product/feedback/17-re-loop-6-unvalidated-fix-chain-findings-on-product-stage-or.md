---
title: >-
  Re-loop 6 unvalidated fix-chain findings on product stage (orchestrator
  dispatch bug — issue #271)
status: closed
origin: agent
author: parent-agent
author_type: agent
created_at: '2026-04-29T17:21:50Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'revisit:product:visit-2'
bolt: 0
triaged_at: '2026-04-29T17:21:50Z'
resolution: stage_revisit
replies: []
---

## Why we're revisiting

The `review_fix` action escalated 6 findings on the product stage at the 3-bolt cap because the parent dispatch protocol contained contradictory instructions (wave-by-hat sentence vs slot-pool one-spawn-per-chain directive — see https://github.com/gigsmart/haiku-method/issues/271). I dispatched only the `product` fix hat each bolt and never the `feedback-assessor`, so closure validation never ran, the bolt counter ticked uselessly, and the cap fired on findings whose product-hat fix was actually committed correctly to its isolation worktree.

## Unresolved findings (status: fixing or addressed, all bolt 3)

- **FB-02** — Pending-marker clearance trigger contradiction across DATA-CONTRACTS.md / pending_marker_schema.feature / manual-change-assessment.feature.
- **FB-03** — Assessment append-only vs mutable resulting_sha.
- **FB-07** — trigger-revisit baseline timing was deferred to ARCHITECTURE.md §5.4.
- **FB-10** — agent-writes-on-behalf-of-human.feature used non-existent `acknowledged_by` field.
- **FB-11** — drift-assessment-visibility.feature inconsistent state names.
- **FB-12** — unit-02 deliverable location ambiguity (5 vs 8 .feature files).

## What needs to happen this revisit

The product-hat fixes are present on the per-FB worktrees — the assessor just needs to validate them. This time both `product` and `feedback-assessor` waves will be dispatched explicitly per the dispatch protocol.
