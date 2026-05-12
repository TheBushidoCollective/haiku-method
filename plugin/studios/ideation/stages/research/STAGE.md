---
name: research
description: Gather context, explore prior art, and understand the problem space
hats: [researcher, analyst, verifier]
fix_hats: [classifier, researcher, feedback-assessor]
review: auto
elaboration: collaborative
inputs: []
---

# Research

Gather context, explore prior art, and understand the problem space. This stage produces the evidence base the rest of the lifecycle stands on — a synthesized research brief organized by theme, with sourced claims, competing approaches, pattern analysis, and named knowledge gaps.

## What a unit IS for this stage

Each unit is a **knowledge topic** — one investigable question or surface (competitive landscape, user persona, technical feasibility, prior-art comparison, domain glossary). Units are NOT execution work; they are knowledge artifacts downstream stages consume.

## Per-unit baton

Units walk three hats in `plan → do → verify` order:

- **`researcher`** (plan + do) explores sources, gathers data, and produces sourced findings for THIS topic
- **`analyst`** (do) evaluates findings, surfaces patterns, narrows raw notes into actionable takeaways
- **`verifier`** (verify) validates the body for substance, citation, and consistency

Detailed per-hat process lives in each hat's md file. This stage's job is to enforce the chain, not repeat it.

## Inputs and outputs

The frontmatter declares the canonical I/O contract. Research has no upstream `inputs:` — it is the head of the pipeline. The stage produces one intent-scope `RESEARCH-BRIEF.md` that downstream stages (`create`, `review`, `deliver`) all consume.

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, researcher, feedback-assessor]` dispatches per finding — the classifier routes the FB to the right unit, `researcher` is the implementer, and the assessor independently decides closure. Gate is `auto` because research correctness is verified by downstream consumption; if a research gap is real, it surfaces in `create` or `review` and routes back via cross-stage feedback.
