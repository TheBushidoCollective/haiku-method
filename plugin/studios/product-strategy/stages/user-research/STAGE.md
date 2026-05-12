---
name: user-research
description: Understand user needs, pain points, and jobs-to-be-done
hats: [user-researcher, insights-synthesizer, verifier]
fix_hats: [classifier, user-researcher, feedback-assessor]
review: ask
elaboration: collaborative
inputs:
  - stage: discovery
    discovery: market-landscape
---

# User Research

Turn the market view into a grounded understanding of real users — who they are, what they're trying to get done, where they're stuck, and what they've already tried. This is a research / distillation stage. Each unit is a knowledge topic (a persona, a job-to-be-done, a workflow surface) that the rest of the lifecycle depends on.

## Per-unit baton

Each unit walks `plan → do → verify`:

- **`user-researcher`** (plan / gather) designs the inquiry for this topic — questions, segments, mix of qualitative and quantitative signal — and captures raw findings.
- **`insights-synthesizer`** (do / distill) turns the raw findings into a structured insights artifact: patterns, segment differences, jobs-to-be-done in user language, named tensions.
- **`verifier`** (verify) validates the artifact body-only and either advances or rejects with a specific named criterion.

## Inputs and outputs

Consumes `discovery/market-landscape` to scope which segments matter. Produces `discovery/INSIGHTS-REPORT.md` per topic, which feeds `prioritization`.

## Fix loop and gate

`fix_hats: [classifier, user-researcher, feedback-assessor]` reroutes findings — the classifier names the responsible unit, the researcher re-gathers / re-synthesizes against the gap, the assessor closes when the diagnosis is sound. The gate is `ask` — the user reviews the synthesized insights before prioritization scores against them, because misread insights propagate down the entire chain. Project overlays may point at a specific research repository, interview tooling, or analytics surface in `.haiku/studios/product-strategy/stages/user-research/` without modifying the plugin defaults.
