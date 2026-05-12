---
name: close
description: Period close, reconciliation, and financial sign-off
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

Lock the period. Reconcile every balance-sheet account, post all sub-ledger entries, eliminate intercompany balances, verify cut-off for revenue recognition and accrued expenses, and produce the close package that records the controller's sign-off and any noted exceptions.

This is an operational stage — units are ordered close steps, not analytical workings. Each step has concrete preconditions, an unambiguous action, and a verifiable post-condition. The stage produces one intent-scope artifact (`CLOSE-PACKAGE.md` under `stages/close/artifacts/`) plus per-unit step workings.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`controller`** (plan) reads the variance report and reporting outputs, defines the close steps in dependency order, sets cut-off rules, and identifies which accounts and sub-ledgers each step covers
- **`reconciler`** (do) executes the per-account reconciliations, posts adjusting entries with supporting documentation, eliminates intercompany transactions, and ties the trial balance
- **`verifier`** (verify) reads the unit body and advances or rejects on stated preconditions, unambiguous action, verifiable post-condition, and rollback semantics where the action is non-idempotent

Detailed process lives in each hat's md file.

## Inputs and outputs

Upstream `reporting/financial-reports` and `analysis/variance-report` feed in — they're the analytical context that informs what to look for during reconciliation. The output `close-package` is the period's record of sign-off and any exceptions carried into the next period.

## Fix loop and gate

`fix_hats: [classifier, controller, feedback-assessor]` dispatches per finding — classifier targets the affected step or account, `controller` revises the procedure (re-defines the reconciliation, re-issues the adjusting entry plan), `feedback-assessor` decides closure. The gate is `external` because period close typically requires controller signoff plus external-auditor review or board attestation; the engine waits for that approval signal before sealing. Project overlays may add house-style chart-of-accounts mappings, internal close checklists, or audit-firm-specific support packages.
