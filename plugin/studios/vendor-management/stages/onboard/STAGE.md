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

Stand the vendor relationship up operationally — accounts provisioned, access granted, integrations wired, data flowing, users trained, escalation paths agreed. This is an operational stage; units are concrete onboarding steps with named preconditions, actions, and post-condition checks.

## Per-unit baton

Each unit walks `integrator → coordinator → verifier` in `plan → do → verify` order:

- **`integrator`** (plan / do for technical setup) configures accounts and access, wires the integration between vendor systems and the organization's existing infrastructure, runs end-to-end tests for happy path and failure scenarios, and documents the architecture for the team that will maintain it
- **`coordinator`** (do for organizational readiness) tracks the onboarding checklist across IT, business, and vendor workstreams; ensures users receive appropriate training and access; establishes communication channels and escalation paths with named contacts
- **`verifier`** (verify) validates each unit's body for stated preconditions, unambiguous action, verifiable post-condition, and rollback or recovery procedure where applicable

The baton accumulates: integration architecture → operational readiness → verified onboarding step.

## Inputs and outputs

`negotiate/negotiation-terms` feeds in. The output is the onboarding checklist (`outputs/ONBOARDING-CHECKLIST.md`) — confirmed account setup, access provisioning, integration testing, training completion, and escalation contacts — which feeds `monitor`.

## Fix loop and gate

When feedback opens, `fix_hats: [classifier, integrator, feedback-assessor]` dispatches per finding — the classifier routes, the integrator re-runs the affected setup or test, and the assessor independently decides closure. The gate is `auto` — the engine advances on its own once every onboarding step has passed its post-condition check, with no human pause. Project overlays may declare organization-specific account-provisioning runbooks, integration-platform URLs, or training-system links without modifying the plugin defaults.
