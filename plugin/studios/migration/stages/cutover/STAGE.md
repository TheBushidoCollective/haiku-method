---
name: cutover
description: Plan and execute the production cutover with rollback procedures
hats: [cutover-coordinator, rollback-engineer, verifier]
fix_hats: [classifier, cutover-coordinator, feedback-assessor]
review: external
elaboration: collaborative
inputs:
  - stage: validation
    discovery: validation-report
review-agents-include:
  - stage: migrate
    agents: [data-integrity]
  - stage: validation
    agents: [parity]
---

# Cutover

Plan and execute the production cutover. This is the operational stage of the migration studio: units are operational steps (preconditions → action → post-condition check, with a named rollback or an explicit "forward-fix only" rationale). The output is the cutover runbook — the artifact the on-call team executes during the maintenance window.

## Per-unit baton

Each cutover unit walks three hats in `plan → do → verify` order:

- **`cutover-coordinator`** (plan / do for sequencing) reads the validation report and produces the step's runbook entry — preconditions, owner, expected duration, action, post-condition check, go/no-go criteria, communication triggers.
- **`rollback-engineer`** (do for the reversal path) consumes the runbook entry and produces the matching rollback procedure — the explicit steps to undo this action, the point-of-no-return marker if the step is irreversible, the data-sync strategy for writes that arrive during the maintenance window.
- **`verifier`** (verify) validates that preconditions, action, post-condition, and rollback (or rationale for none) are all stated, and that the post-condition produces a mechanical pass/fail signal. Advances or rejects.

The baton is the runbook step itself, accumulating across the chain: coordinator's step + rollback-engineer's reversal pair into one unit body, and the verifier confirms both halves are concrete.

## Inputs and outputs

Cutover consumes `validation/validation-report` plus the upstream review agents `migrate/data-integrity` and `validation/parity`. Output is `CUTOVER-RUNBOOK.md` (every step, every owner, every checkpoint, every rollback procedure, the communication plan, the point-of-no-return marker).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, cutover-coordinator, feedback-assessor]` dispatches per finding. The classifier routes; `cutover-coordinator` re-authors the runbook step; `feedback-assessor` closes. The gate is `external` — the runbook must be approved through the team's actual change-management surface (incident-management platform, change ticket, on-call lead signoff) before cutover proceeds. Project overlays MUST configure this surface; the plugin default does not assume a specific tool.
