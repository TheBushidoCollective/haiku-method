---
name: strategy
description: Define campaign goals, messaging framework, and channel strategy
hats: [strategist, brand-reviewer, verifier]
fix_hats: [classifier, strategist, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: research
    discovery: market-brief
---

# Strategy

Translate research findings into a campaign strategy: measurable goals, a messaging framework that maps audience pain to value, a channel mix grounded in audience behavior, and KPIs that ladder back to the goals. This is the stage where research becomes a plan the rest of the studio can execute.

## Per-unit baton

Each strategy unit walks three hats in `plan/do → brand-review → verify` order:

- **`strategist`** (plan + do) — reads the research artifacts, defines goals / messaging / channels / KPIs for this slice of the campaign, writes the strategy artifact
- **`brand-reviewer`** (brand-review) — checks the artifact for brand alignment, voice, and positioning fidelity; surfaces concerns through the brand lens
- **`verifier`** (verify) — walks the unit body for substance, research traceability, goal-to-KPI consistency, and decision-register alignment — the body-only structural check architecture §9 requires

The strategist's plan and execution land in the same artifact (the framework itself) because the "do" output IS the plan; the brand-reviewer and verifier then close out the loop.

## Inputs and outputs

Consumes `research/market-brief` (audience segments, competitive landscape, positioning gaps). Produces the messaging framework, channel strategy, and campaign goals that `content` and `launch` execute against.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, strategist, feedback-assessor]` dispatches per finding. The gate is `ask` — the user approves the strategy locally before content production begins, because strategy errors compound expensively downstream.
