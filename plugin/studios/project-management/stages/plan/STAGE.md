---
name: plan
description: Create work breakdown, allocate resources, and define timeline
hats: [planner, estimator, verifier]
fix_hats: [classifier, planner, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: charter
    discovery: project-charter
outputs:
  - discovery: project-plan
    hat: planner
---

# Plan

Decompose the charter into an executable plan: a work breakdown structure (WBS), dependencies, a sequenced schedule with critical path, resource assignments, and a risk register. This stage hands the project off from "we agreed what we'd do" to "we know how we'll do it." Quality here drives every status conversation downstream — a vague plan produces vague tracking.

## Per-unit baton

Each unit is a plan element — a work package, dependency chain, resource assignment, schedule milestone, or risk-register entry. The three hats walk it in `plan → do → verify` order:

- **`planner`** (plan) reads the charter, decomposes scope into the WBS, identifies dependencies, and sequences the work
- **`estimator`** (do) attaches effort, duration, and confidence ranges to each work package; calibrates against historical data where available; flags high-uncertainty items for contingency
- **`verifier`** (verify) checks the body for trace-to-charter, internal coherence, and decision-register consistency — advances or rejects to the responsible hat

Detailed process lives in each hat's md file — this stage's role is to enforce the chain, not to repeat it.

## Inputs and outputs

The plan stage consumes `charter/discovery/project-charter`. Its output is `PROJECT-PLAN.md`, consumed by `track` (the baseline to compare actual against), `report` (the source of planned-vs-actual numbers), and `close` (the original scope to accept against).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, planner, feedback-assessor]` dispatches per finding. The gate is `ask` — local approval in the review UI is sufficient for most teams; project overlays can flip to `external` (formal plan baseline sign-off in a portfolio tool) where governance requires it. Overlays may also add tool-specific WBS shapes (numbering convention, ticket-tracker hierarchy, Gantt / timeline tool integration) without modifying the plugin defaults.
