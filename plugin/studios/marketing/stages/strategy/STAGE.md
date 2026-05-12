---
name: strategy
description: Define campaign goals, messaging framework, and channel strategy
hats: [strategist, brand-reviewer]
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

Each strategy unit walks two hats:

- **`strategist`** (plan + do) — reads the research artifacts, defines goals / messaging / channels / KPIs for this slice of the campaign, writes the strategy artifact
- **`brand-reviewer`** (verify) — checks the artifact for internal consistency, brand alignment, and traceability back to research; advances or rejects

The two-hat shape reflects the role: a strategist's plan and execution are the same artifact (the framework itself), and the brand reviewer is the terminal validator. The shape diverges from the canonical plan-do-verify triplet because the "do" output IS the plan — splitting them produces two passes on the same document.

## Inputs and outputs

Consumes `research/market-brief` (audience segments, competitive landscape, positioning gaps). Produces the messaging framework, channel strategy, and campaign goals that `content` and `launch` execute against.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, strategist, feedback-assessor]` dispatches per finding. The gate is `ask` — the user approves the strategy locally before content production begins, because strategy errors compound expensively downstream.
