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

Decompose the charter into an executable plan: a work breakdown structure, dependencies, a sequenced schedule with critical path, resource assignments, and a risk register. This stage hands the project off from "we agreed what we'd do" to "we know how we'll do it" — and its quality drives every status conversation downstream.

## Scope

The work breakdown, dependencies, schedule, resource assignments, estimates, and risk register. Plan decides *how the charter's scope gets executed and by whom* — not what the project is or what success means (charter), or how actual progress compares to this baseline (track). The output is the baseline track and report measure against.

## What to do

- Decompose the charter's scope into a work breakdown structure, identify dependencies, and sequence the work along a critical path.
- Attach effort, duration, and confidence ranges to each work package, calibrating against historical data where available.
- Flag high-uncertainty items for contingency rather than hiding them in a point estimate.
- Build a risk register and keep every plan element traceable back to a charter scope item.

## What NOT to do

- Don't redefine scope or success criteria — a wrong charter is a revisit upstream, not a quiet change in the plan.
- Don't track actuals or report status; this stage produces the baseline, it doesn't measure against it.
- Don't present a high-uncertainty estimate as firm, or omit the contingency it needs.
- Don't add work packages the charter's scope didn't authorize.
