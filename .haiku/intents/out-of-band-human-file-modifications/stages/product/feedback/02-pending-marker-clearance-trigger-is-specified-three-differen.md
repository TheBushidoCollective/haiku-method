---
title: >-
  Pending-marker clearance trigger is specified three different ways across
  three artifacts
status: closed
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-04-29T03:41:51Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-02:bolt-1'
bolt: 0
triaged_at: '2026-04-29T03:41:51Z'
resolution: inline_fix
replies: []
hat: feedback-assessor
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T20:08:54Z'
    result: advanced
  - bolt: 1
    hat: feedback-assessor
    completed_at: '2026-04-29T20:11:22Z'
    result: closed
---
## Root cause

Four artifacts specified the `PendingMarker` clearance trigger inconsistently:

- **DATA-CONTRACTS.md §4.4** (MCP tool contract): had correct terminal-only enum (`feedback-closed | feedback-rejected | revisit-complete`) but was missing the explicit normative note that `feedback-addressed` does NOT trigger clearance.
- **DATA-CONTRACTS.md §6.3** (`pending_marker_cleared` event): same — correct enum, missing normative note.
- **`pending_marker_schema.feature`** (line 82): scenario "PendingMarker is cleared when linked feedback transitions to addressed" used `feedback-addressed` as the clearance trigger — directly contradicting the terminal-only contract.
- **`silent-filesystem-drop-detection.feature`** (lines 157–188): entire comment block described `addressed` as the **primary** clearance trigger, with `closed`/`rejected` as fallbacks. Three scenarios encoded that broken model.
- **`manual-change-assessment.feature`** (line 48): scenario covered only `closed`, not `rejected`, and had no "addressed does NOT clear" scenario.

## Chosen direction

**Terminal-only**: only `feedback-closed`, `feedback-rejected`, and `revisit-complete` clear a `PendingMarker`. `feedback-addressed` is a mid-state that can be reopened; it does not provide the immutability guarantee required to safely update the baseline and lift re-detection suppression. This matches unit-01 AC-G5 and AC-SF3.

## Files edited (5)

1. `.haiku/intents/out-of-band-human-file-modifications/product/DATA-CONTRACTS.md` — §4.4 Purpose paragraph rewritten to "terminal state"; normative constraint blockquote added (`feedback-addressed` is not a valid trigger, with rationale). §6.3 description rewritten; same normative constraint blockquote added.
2. `.haiku/intents/out-of-band-human-file-modifications/features/manual-change-assessment.feature` — Single `closed`-only scenario converted to `Scenario Outline` parameterized over `closed | rejected`; explicit "addressed does NOT clear" scenario added with rationale comment.
3. `.haiku/intents/out-of-band-human-file-modifications/features/silent-filesystem-drop-detection.feature` — Entire "addressed = primary trigger" comment block and four scenarios replaced with: corrected comment block, one `Scenario Outline` for `closed | rejected`, and one explicit "addressed does NOT clear" scenario.
4. `.haiku/intents/out-of-band-human-file-modifications/stages/product/outputs/features/pending_marker_schema.feature` — Single "addressed clears" scenario replaced with three: closed-clears, rejected-clears, addressed-does-NOT-clear (with rationale comment).

## Commit

`f1af0e6f` — haiku: fix FB-02 (terminal-only clearance trigger)
