---
title: >-
  Re-loop 6 unvalidated fix-chain findings on product stage (orchestrator
  dispatch bug — issue #271)
status: closed
origin: agent
author: parent-agent
author_type: agent
created_at: '2026-04-29T17:20:47Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'revisit:product:visit-2'
bolt: 0
triaged_at: '2026-04-29T17:20:47Z'
resolution: stage_revisit
replies: []
---

## Why we're revisiting

The `review_fix` action escalated 6 findings on the product stage at the 3-bolt cap because the parent dispatch protocol contained contradictory instructions (wave-by-hat sentence vs slot-pool one-spawn-per-chain directive — see https://github.com/gigsmart/haiku-method/issues/271). I dispatched only the `product` fix hat each bolt and never the `feedback-assessor`, so closure validation never ran, the bolt counter ticked uselessly, and the cap fired on findings whose product-hat fix was actually committed correctly to its isolation worktree.

## What still needs to happen

For each of the 6 findings below, the product-hat fix work is on disk on the per-finding worktree. The `feedback-assessor` hat needs to (a) two-stage validate the existing edits and (b) call `haiku_feedback_update { status: 'closed' }` if both stages pass — OR the product hat needs to run again if the existing edit is regressive / out of scope.

Unresolved findings (all status: fixing or addressed, all bolt 3):

- **FB-02** — Pending-marker clearance trigger contradiction across DATA-CONTRACTS.md / pending_marker_schema.feature / manual-change-assessment.feature. Bolt 3 fix landed `c9bba4b5` on the conservative terminal-only contract (`closed | rejected | revisit-complete`); also spawned FB-14 for sibling files which DID close.
- **FB-03** — Assessment append-only vs mutable resulting_sha. Bolt 3 fix made resulting_sha null for non-terminal outcomes and added PendingMarker.resolved_sha as the post-clearance SHA carrier, preserving the append-only invariant on Assessment.
- **FB-07** — trigger-revisit baseline timing was deferred to ARCHITECTURE.md §5.4. Bolt 3 fix inlined the rule as DATA-CONTRACTS.md §3.6 mirroring §3.5's surface-as-feedback contract; resulting_sha = pre-drift baseline at write, rewritten on marker clearance.
- **FB-10** — agent-writes-on-behalf-of-human.feature line 88 used non-existent `acknowledged_by` field. Bolt 3 fix replaced with canonical `author_class` per DATA-CONTRACTS.md §2.1.
- **FB-11** — drift-assessment-visibility.feature used inconsistent state names. Bolt 3 fix uses canonical `revisit-invoked` (per Assessment.revisit_invoked_at) and grounds `pending-revisit` and `resolved` in DATA-CONTRACTS.md §2.3 / §4.4.
- **FB-12** — unit-02 deliverable location ambiguity (5 vs 8 .feature files). Bolt 3 fix added outputs/features/README.md disambiguating 5 canonical user-behavior features at `features/` from 8 supplementary contract-verification scenarios at `outputs/features/`.

## What I need from this revisit

- Re-elaborate (or skip directly to re-execute / re-review per the workflow's choice) so the assessor wave can run on the existing fixes.
- This time I will dispatch BOTH `product` and `feedback-assessor` waves explicitly per the dispatch protocol (per the issue #271 workaround until that's fixed): wave A = all product hats up to cap, wait for all, wave B = all feedback-assessor hats up to cap.
- The fixes themselves are present on the per-FB worktrees — the assessor just needs to validate them.

No upstream design change is being requested. This revisit exists purely because the prior fix-loop spent its bolt budget on a parent-side coordination error rather than on the fix work.
