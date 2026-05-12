---
name: communicate
description: Develop stakeholder communications and rollout plan
hats: [communicator, planner, verifier]
fix_hats: [classifier, communicator, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: decide
    discovery: decision-brief
---

# Communicate

A decision that isn't communicated well is a decision that gets unwound during execution. This stage turns the decision brief into the artifacts that actually move the organization: tailored messaging for each stakeholder group, a sequenced rollout plan with named owners, and a FAQ that anticipates the hard questions before they're asked in public.

Units in this stage are **communication and rollout artifacts** — one per stakeholder audience or rollout workstream (e.g. "employee all-hands package", "investor letter", "customer notification", "phase-one rollout plan"). The stage output `COMMS-PACKAGE.md` aggregates the messaging, materials, plan, and FAQ.

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`communicator`** (plan) builds the messaging framework — what we say, to whom, through which channel, anticipating their concerns
- **`planner`** (do) sequences rollout actions with dependencies, owners, milestones, and contingency plans
- **`verifier`** (verify) checks messaging consistency across audiences, named owners, measurable milestones, and FAQ coverage

## Inputs and outputs

Consumes `decide/decision-brief`. Produces `comms-package` at intent scope: messaging framework, audience-specific materials, rollout calendar, FAQ.

## Fix loop and gate

`fix_hats: [classifier, communicator, feedback-assessor]` dispatches per finding. The gate is `ask` — local human approval, because the communicator's words become the organization's words; the user needs to read what's about to go out. Project overlays may add house-style voice guides, channel templates, and rollout-tracking conventions without modifying the plugin defaults.
