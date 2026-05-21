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

The terminal stage of the data-pipeline lifecycle: take the validated pipeline and put it into production. This is where the pipeline stops being code on a branch and becomes infrastructure other people depend on.

## Scope

Operationalizing the pipeline — orchestrator registration, schedule, resource sizing, alert routing, runbooks, and rollback plan. Deployment decides *how the pipeline runs and is operated in production* — it does not change transformation or validation logic; if either is wrong, that's a revisit upstream.

## What to do

- Package the pipeline for the orchestrator: schedule, dependency chain, retry / timeout policy, resource limits.
- Route alerts to the right on-call channel and monitor both pipeline health and data freshness.
- Write runbooks an unfamiliar engineer can actually follow, and a rollback plan for the first run.
- Hold operational readiness — not just a successful execution — as the bar to ship.

## What NOT to do

- Don't modify transformation or validation logic — route a regression back to the stage that owns it.
- Don't deploy a pipeline whose validation suite has unresolved blocking findings.
- Don't treat a clean run as readiness; without alerting, monitoring, and rollback it isn't done.
- Don't add scope the validated pipeline didn't already cover.
