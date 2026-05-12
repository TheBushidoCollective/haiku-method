---
name: deliver
description: Facilitate training delivery and coordinate logistics
hats: [facilitator, coordinator, verifier]
fix_hats: [classifier, facilitator, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: develop
    output: training-materials
  - stage: design
    discovery: curriculum-plan
---

# Deliver

Run the training program — facilitate sessions, manage logistics, distribute materials, track attendance and completion, capture in-session observations that feed the evaluate stage. This is the operational stage of the training lifecycle: a unit is one delivery session (cohort, workshop, asynchronous release, etc.).

## Per-unit baton

Each unit walks the three hats in `plan → do → verify` order:

- **`facilitator`** (plan) reads the curriculum plan and the facilitator guide for the session, prepares the run-of-show, identifies likely points of confusion based on the audience, and decides where to adapt delivery
- **`coordinator`** (do) executes the logistics — scheduling, room or platform setup, technical checks, material distribution, access provisioning, attendance tracking, completion records, contingency plans for common failures
- **`verifier`** (verify) validates the delivery log for preconditions, action, and post-condition completeness — advances or rejects to the responsible hat

The detailed process for each role lives in the hat's md file. This stage's job is to enforce the chain.

## Inputs and outputs

Reads `develop/training-materials` and `design/curriculum-plan` for every unit. Output is `DELIVERY-LOG.md` per unit — the operational record (attendance, completion rate, real-time learner signals, logistics issues + resolution, facilitator observations and content improvement candidates).

## Fix loop and gate

Review feedback dispatches the `fix_hats: [classifier, facilitator, feedback-assessor]` chain. Gate is `auto` — once a delivery session is complete and the log is sealed, the workflow engine advances; corrective work for systemic delivery issues lands as feedback against the next iteration rather than blocking the current one. Project overlays at `.haiku/studios/training/stages/deliver/` may add house conventions (specific LMS, attendance system, accessibility accommodation process, named recording / video platform for asynchronous delivery) without modifying the plugin defaults.
