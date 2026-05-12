---
name: deployment
description: Deploy pipelines to production with monitoring and alerting
hats: [pipeline-engineer, sre, verifier]
fix_hats: [classifier, pipeline-engineer, feedback-assessor]
review: external
elaboration: autonomous
inputs:
  - stage: validation
    discovery: validation-report
review-agents-include:
  - stage: transformation
    agents: [data-quality]
  - stage: validation
    agents: [coverage]
---

# Deployment

Take the validated pipeline and put it into production. This stage owns the
orchestrator registration, the schedule, the resource sizing, the alert
routing, the runbooks, and the rollback plan. Deployment is where the
pipeline stops being code on a branch and starts being infrastructure other
people depend on — operational readiness, not just successful execution, is
the bar.

## Per-unit baton

Each deployment unit is one **operational step** — typically one DAG, one
schedule family, or one alert / runbook surface. The unit walks the three
hats in `plan → do → verify` order:

- **`pipeline-engineer`** (plan / do) packages the pipeline for the
  orchestrator: schedule, dependency chain, retry / timeout policy,
  resource limits, logging, and integration tests in a staging environment
- **`sre`** (do / verify) verifies operational readiness: alert routing to
  the right on-call channel, monitoring of pipeline health AND data
  freshness, runbooks an unfamiliar engineer can actually follow, rollback
  plan for the first run
- **`verifier`** (verify) validates the artifact body-only against substance,
  citation, internal consistency, and decision-register accountability

The stage also imports the upstream `data-quality` and `coverage` review
agents so deployment doesn't pass a pipeline whose validation tests or
transformation logic regressed since their original gates.

## Inputs and outputs

`VALIDATION-REPORT.md` from validation is the input — deployment refuses to
ship a pipeline whose validation suite has unresolved blocking findings.
The stage produces `PIPELINE-CONFIG.md` (intent-scope) — the orchestrator-
registered configuration, monitoring surface, and operational runbook.

## Fix loop and gate

`fix_hats: [classifier, pipeline-engineer, feedback-assessor]` dispatches per
finding. The gate is `external` — production deployment requires the team's
external approval mechanism (PR merge in the orchestrator's repo, change-
management ticket, on-call signoff) to land, not a local "approve" click.
Project overlays may add team-specific deployment manifests, CI hooks, or
on-call routing without modifying plugin defaults.
