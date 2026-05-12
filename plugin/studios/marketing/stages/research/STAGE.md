---
name: research
description: Audience research, competitive analysis, and market positioning
hats: [market-researcher, audience-analyst, verifier]
fix_hats: [classifier, market-researcher, feedback-assessor]
review: auto
elaboration: autonomous
inputs: []
---

# Research

Audience research, competitive analysis, and market positioning. This stage produces the foundational knowledge that every downstream marketing decision rests on: who the audience is, what they're already hearing from competitors, and where the unowned conversational space sits.

## Per-unit baton

Each research unit walks the three hats in `plan → do → verify` order:

- **`market-researcher`** (plan) — frames the topic, surveys the competitive and category landscape, gathers sourced evidence
- **`audience-analyst`** (do) — turns raw findings into segmented, behavior-grounded audience and positioning artifacts
- **`verifier`** (verify) — confirms the artifact is substantive, sourced, and internally consistent before advancing

Detailed per-hat process lives in each hat's md file — this stage enforces the chain, not the contents.

## Inputs and outputs

The stage has no upstream inputs (it kicks off the studio). Outputs are knowledge artifacts — market brief, segment definitions, positioning landscape — that the `strategy` stage consumes. Units are research topics, not execution tickets; the strategy stage authors its own units against these findings.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, market-researcher, feedback-assessor]` dispatches per finding: the classifier routes, the market-researcher re-authors against the cited gap, and the assessor decides closure. The gate is `auto` — research findings move forward without explicit human signoff, on the assumption that the strategy stage's collaborative elaboration will catch anything load-bearing before it shapes campaign decisions.
