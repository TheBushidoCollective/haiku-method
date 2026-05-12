---
name: roadmap
description: Create the roadmap with sequencing, dependencies, and milestones
hats: [roadmap-architect, capacity-planner, verifier]
fix_hats: [classifier, roadmap-architect, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: prioritization
    discovery: priority-matrix
---

# Roadmap

Translate the priority order into a coherent plan — sequencing, dependencies, milestones, and a narrative that explains why this order. The output is the artifact stakeholders will actually use to make commitments and resource decisions, so the bar is "defensible under questioning," not "pretty."

## Per-unit baton

Each roadmap unit walks `plan → do → verify`:

- **`roadmap-architect`** (plan / sequence) takes the priority matrix and constructs the roadmap structure for the unit's topic — typically `now / next / later`, theme-based, or outcomes-based, depending on the framing chosen during elaboration. Names dependencies, milestones, and the strategic narrative.
- **`capacity-planner`** (do / reality-check) pressure-tests the sequence against team capacity, skill mix, infrastructure constraints, and ongoing operational load. Updates the artifact with capacity callouts and proposed mitigations where the plan exceeds what's realistic.
- **`verifier`** (verify) validates the artifact body-only — dependency chains resolve, every milestone has measurable completion criteria, capacity assumptions are explicit — and advances or rejects.

## Inputs and outputs

Consumes `prioritization/priority-matrix` directly. Produces `discovery/ROADMAP-DOC.md` per topic, which feeds `stakeholder-review`.

## Fix loop and gate

`fix_hats: [classifier, roadmap-architect, feedback-assessor]` reopens the sequence when feedback lands. The gate is `ask` — roadmap commitments are visible to the rest of the org and the user owns the final shape. Project overlays at `.haiku/studios/product-strategy/stages/roadmap/` may pin the team's roadmap-tool conventions, milestone-naming style, or theme taxonomy without altering the plugin defaults.
