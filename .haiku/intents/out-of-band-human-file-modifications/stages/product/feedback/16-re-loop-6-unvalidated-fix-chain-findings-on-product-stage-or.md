---
title: >-
  Re-loop 6 unvalidated fix-chain findings on product stage (orchestrator
  dispatch bug — issue #271)
status: closed
origin: agent
author: parent-agent
author_type: agent
created_at: '2026-04-29T17:21:40Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'revisit:product:visit-2'
bolt: 0
triaged_at: '2026-04-29T17:21:40Z'
resolution: stage_revisit
replies: []
---

## Why we're revisiting

The `review_fix` action escalated 6 findings on the product stage at the 3-bolt cap because the parent dispatch protocol contained contradictory instructions (wave-by-hat sentence vs slot-pool one-spawn-per-chain directive — see https://github.com/gigsmart/haiku-method/issues/271). I dispatched only the `product` fix hat each bolt and never the `feedback-assessor`, so closure validation never ran, the bolt counter ticked uselessly, and the cap fired on findings whose product-hat fix was actually committed correctly to its isolation worktree.

## Unresolved findings (status: fixing or addressed, all bolt 3)

- **FB-02** — Pending-marker clearance trigger contradiction across DATA-CONTRACTS.md / pending_marker_schema.feature / manual-change-assessment.feature. Bolt 3 fix landed `c9bba4b5` on the conservative terminal-only contract (`closed | rejected | revisit-complete`).
- **FB-03** — Assessment append-only vs mutable resulting_sha. Bolt 3 fix made resulting_sha null for non-terminal outcomes and added PendingMarker.resolved_sha as the post-clearance SHA carrier.
- **FB-07** — trigger-revisit baseline timing was deferred to ARCHITECTURE.md §5.4. Bolt 3 fix inlined the rule as DATA-CONTRACTS.md §3.6.
- **FB-10** — agent-writes-on-behalf-of-human.feature line 88 used non-existent `acknowledged_by` field. Bolt 3 fix replaced with canonical `author_class` per DATA-CONTRACTS.md §2.1.
- **FB-11** — drift-assessment-visibility.feature used inconsistent state names. Bolt 3 fix uses canonical `revisit-invoked` and grounds `pending-revisit` and `resolved` in DATA-CONTRACTS.md §2.3 / §4.4.
- **FB-12** — unit-02 deliverable location ambiguity (5 vs 8 .feature files). Bolt 3 fix added outputs/features/README.md disambiguating canonical user-behavior features at `features/` from supplementary contract-verification scenarios at `outputs/features/`.

## What needs to happen this revisit

The fixes themselves are present on the per-FB worktrees — the assessor just needs to validate them. This time both `product` and `feedback-assessor` waves will be dispatched explicitly per the dispatch protocol.
