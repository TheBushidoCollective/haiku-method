---
name: close
description: Period close, reconciliation, and financial sign-off
optional: true
hats: [controller, reconciler, verifier]
fix_hats: [classifier, controller, feedback-assessor]
review: external
elaboration: autonomous
inputs:
  - stage: reporting
    output: financial-reports
  - stage: analysis
    discovery: variance-report
---

# Close

The terminal stage of the finance cycle: lock the period. Reconcile every balance-sheet account, post the sub-ledger entries, eliminate intercompany balances, confirm cut-off, and record the controller's sign-off with any noted exceptions. This is an operational stage — its units are ordered close steps, not analytical workings.

## Scope

Period sign-off: reconciliation, adjusting entries, intercompany elimination, cut-off verification, and the close package that records the result. Close decides *whether the period's books are right and ready to lock* — not why the numbers came out as they did (analysis), and not how they're communicated (reporting).

## What to do

- Reconcile every balance-sheet account and tie the trial balance — leave no account unconfirmed.
- Verify cut-off for revenue recognition and accrued expenses against stated cut-off rules.
- Post adjusting entries with supporting documentation, and declare a rollback path for any step that isn't idempotent.
- Record exceptions explicitly so anything unresolved carries forward as a known item, not a silent gap.

## What NOT to do

- Don't re-run analysis or rewrite the reports — consume them as the context for what to reconcile against.
- Don't seal the period with an account unreconciled or a cut-off unverified.
- Don't post an entry without documentation or a non-idempotent action without a rollback.
- Don't bury an exception to make the close look clean.
