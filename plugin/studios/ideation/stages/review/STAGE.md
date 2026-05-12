---
name: review
description: Adversarial quality review of the deliverable
hats: [review-planner, synthesizer, reviewer, critic, fact-checker]
fix_hats: [classifier, synthesizer, feedback-assessor]
review: ask
elaboration: autonomous
inputs:
  - stage: create
    discovery: draft-deliverable
---

# Review

Adversarial quality review of the deliverable. The draft from `create` goes in; a structured review report with severity-graded findings comes out. This stage uses the plan-do-verify front loop (per architecture §3.5) followed by an adversarial pair — `critic` finds weaknesses, `fact-checker` verifies claims.

## What a unit IS for this stage

Each unit is a **review surface** — a named, observable property of the draft that gets reviewed against named criteria. Typical surfaces: clarity, evidence strength, novelty, structural integrity, scope fit, audience fit, internal coherence, terminology consistency. The review-planner decides the unit set during decompose.

## Per-unit baton

Five hats run in order:

- **`review-planner`** (plan) names the surfaces and criteria for THIS unit
- **`synthesizer`** (do) performs the review per the plan; produces structured observations with citations
- **`reviewer`** (verify) validates the synthesizer's body for coverage, citation rigor, and severity discipline — closes the front loop before adversarial hats run
- **`critic`** (adversarial) identifies weaknesses, logical gaps, and missing perspectives the front loop didn't surface
- **`fact-checker`** (adversarial verify) traces every claim to its source; flags anything that doesn't trace

The first three are the rally-race front loop (architecture §3.5); the last two are the adversarial loop. Front loop must close before adversarial runs.

## Inputs and outputs

Inputs: `create/draft-deliverable`. Output: per-unit observations composing into `REVIEW-FINDINGS.md` at intent scope, ordered by severity (critical → major → minor).

## Fix loop and gate

When review feedback opens, `fix_hats: [classifier, synthesizer, feedback-assessor]` dispatches per finding — `synthesizer` is the implementer because review-stage defects are usually missed observations, not missed plans. Gate is `ask` because a human typically arbitrates which findings the deliverable actually addresses before `deliver` runs.
