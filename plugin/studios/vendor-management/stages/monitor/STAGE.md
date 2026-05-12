---
name: monitor
description: Track vendor performance and SLA compliance
hats: [monitor, relationship-manager, verifier]
fix_hats: [classifier, monitor, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: onboard
    discovery: onboarding-checklist
  - stage: negotiate
    discovery: negotiation-terms
---

# Monitor

Track vendor performance against contractual SLAs and operational expectations over the life of the relationship. This is an operational stage; units are concrete monitoring observations or relationship reviews, each with preconditions, an action, and a verifiable post-condition.

## Per-unit baton

Each unit walks `monitor → relationship-manager → verifier` in `plan → do → verify` order:

- **`monitor`** (plan / do for performance) collects and independently verifies SLA compliance data for each contractual metric, calculates performance trends across multiple measurement periods, identifies breaches, and triggers the contractual remedies named in the negotiation terms
- **`relationship-manager`** (do for relationship health) conducts regular relationship reviews beyond SLA compliance — strategic alignment, partnership health signals, opportunities for mutual value, escalation of concerns before they become crises
- **`verifier`** (verify) validates each unit's body for stated preconditions, unambiguous action, verifiable post-condition, and rollback or recovery procedure where applicable

The baton is the performance data plus the relationship assessment — combined, they produce a third-party-risk-aware picture of whether the vendor relationship is meeting its terms and its strategic intent.

## Inputs and outputs

`onboard/onboarding-checklist` and `negotiate/negotiation-terms` feed in (the terms are needed every cycle to compare against). The output is the performance report (`outputs/PERFORMANCE-REPORT.md`) — SLA compliance per metric, trend analysis, relationship health, recommended actions. This stage is recurring; each iteration produces a new performance report against the same contract.

## Fix loop and gate

When feedback opens, `fix_hats: [classifier, monitor, feedback-assessor]` dispatches per finding — the classifier routes, the monitor re-runs the affected data collection or trend calculation, and the assessor independently decides closure. The gate is `auto` — the engine advances on its own once every observation unit has passed its post-condition check. Project overlays may declare organization-specific monitoring runbooks, TPRM platform URLs, or relationship-health questionnaires without modifying the plugin defaults.
