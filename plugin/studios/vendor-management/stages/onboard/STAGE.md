---
name: onboard
description: Integrate vendor and complete setup
hats: [integrator, coordinator, verifier]
fix_hats: [classifier, integrator, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: negotiate
    discovery: negotiation-terms
---

# Onboard

Stand the vendor relationship up operationally: accounts provisioned, access granted, integrations wired, data flowing, users trained, escalation paths agreed. This is an operational stage — each unit is a concrete onboarding step with named preconditions, an action, and a verifiable post-condition.

## Scope

Operational activation of the agreed relationship: technical setup (accounts, access, integration, end-to-end testing) and organizational readiness (training, communication channels, named escalation contacts) against the negotiated terms. Onboard decides *that the vendor is operationally live* — not what the terms are (negotiate) or how the relationship performs over time (monitor).

## What to do

- Configure accounts, access, and integrations, then test end-to-end for both happy path and failure scenarios.
- Document the integration architecture for the team that will maintain it after onboarding.
- Track readiness across IT, business, and vendor workstreams so no workstream is silently incomplete.
- Establish communication channels and escalation paths with named contacts before the relationship goes live.

## What NOT to do

- Don't reopen negotiated terms — a term that doesn't work operationally is feedback to negotiate.
- Don't run ongoing SLA tracking or relationship reviews; that's monitor.
- Don't mark an onboarding step done without its post-condition check passing.
- Don't leave an escalation path or maintenance handoff undocumented.
