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

Plan and execute the production cutover: the runbook the on-call team follows during the maintenance window, with a rollback procedure or an explicit forward-fix rationale for every step. This is the operational stage of the migration — the point where the validated work goes live, and the point of no return is real.

## Scope

Authoring and executing the cutover runbook. Cutover decides *how the production switch happens, in what order, with what go/no-go gates and rollback paths* — not whether the migration is correct (validation) or how the data moves (migrate). Units are operational steps: preconditions, action, post-condition check, and a named rollback or a stated reason none exists.

## What to do

- Sequence each step with preconditions, owner, expected duration, action, post-condition check, and go/no-go criteria.
- Pair every step with its rollback procedure, or state explicitly why the step is forward-fix only and mark the point of no return.
- Define a data-sync strategy for writes that arrive during the maintenance window.
- Make each post-condition produce a mechanical pass/fail signal the on-call team can act on without judgment calls.

## What NOT to do

- Don't proceed on a migration the validation stage hasn't signed off, including the rollback rehearsal.
- Don't change migration code or mappings here; cutover executes, it doesn't rebuild.
- Don't write a step with no rollback and no stated forward-fix rationale.
- Don't self-advance the cutover gate — the runbook proceeds through the team's actual change-management approval.
